# appender.py
from __future__ import annotations

import abc
import logging
import queue
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import insert

from aci.common import utils
from aci.common.db.sql_models import ExecutionLog, ExecutionDetail
from aci.common.enums import ExecutionStatus
from aci.server import config
from aci.server.config import (
    EXECUTION_LOG_APPENDER_MAX_QUEUE,
    EXECUTION_LOG_APPENDER_FLUSH_EVERY_MS,
    EXECUTION_LOG_APPENDER_MAX_BATCH,
    EXECUTION_LOG_APPENDER_DROP_POLICY,
    EXECUTION_LOG_APPENDER_IMPLEMENTATION,
    EXECUTION_LOG_APPENDER_REDIS_QUEUE_NAME,
    REDIS_DB,
    REDIS_HOST,
    REDIS_PORT,
    REDIS_PASSWORD,
)

logger = logging.getLogger(__name__)


@dataclass
class LogEvent:
    # fields for execution_logs
    id: UUID
    function_name: str
    app_name: str
    api_key_name: Optional[str]
    linked_account_owner_id: Optional[str]
    app_configuration_id: Optional[UUID]
    status: ExecutionStatus
    execution_time: int
    created_at: datetime
    project_id: UUID
    # optional details
    request: Optional[dict[str, Any]] = None
    response: Optional[any] = None


class LogAppenderBase(abc.ABC):
    """
    Abstract base class for log appenders.
    Provides a non-blocking interface for logging execution events.
    """

    def __init__(
            self,
            max_queue: int = EXECUTION_LOG_APPENDER_MAX_QUEUE,
            flush_every_ms: int = EXECUTION_LOG_APPENDER_FLUSH_EVERY_MS,
            max_batch: int = EXECUTION_LOG_APPENDER_MAX_BATCH,
            drop_policy: str = EXECUTION_LOG_APPENDER_DROP_POLICY,
    ) -> None:
        self.max_queue = max_queue
        self.flush_every_ms = flush_every_ms
        self.max_batch = max_batch
        self.drop_policy = drop_policy
        self._stop = threading.Event()

    @abc.abstractmethod
    def start(self) -> None:
        """Start the appender background processing."""
        pass

    @abc.abstractmethod
    def stop(self, timeout: float = 5.0) -> None:
        """Stop the appender background processing."""
        pass

    @abc.abstractmethod
    def enqueue(
            self,
            *,
            function_name: str,
            app_name: str,
            project_id: UUID,
            status: ExecutionStatus,
            execution_time: int,
            linked_account_owner_id: Optional[str] = None,
            app_configuration_id: Optional[str] = None,
            api_key_name: Optional[str] = None,
            request: Optional[dict] = None,
            response: Optional[Any] = None,
            created_at: Optional[datetime] = None,
            execution_id: Optional[UUID] = None,
    ) -> Optional[UUID]:
        """Enqueue a log event. Returns the execution ID if successful, None if dropped."""
        pass

    def _flush_to_db(self, batch: list[LogEvent]) -> None:
        """Flush a batch of log events to the database using a session."""
        if not batch:
            return

        logs_rows = [{
            "id": ev.id,
            "function_name": ev.function_name,
            "app_name": ev.app_name,
            "linked_account_owner_id": ev.linked_account_owner_id,
            "app_configuration_id": ev.app_configuration_id,
            "api_key_name": ev.api_key_name,
            "status": ev.status.value,
            "execution_time": ev.execution_time,
            "created_at": ev.created_at,
            "project_id": ev.project_id,
        } for ev in batch]

        details_rows = [{
            "id": ev.id,
            "request": ev.request,
            "response": ev.response,
        } for ev in batch if (ev.request is not None or ev.response is not None)]

        # Use context manager for automatic session cleanup
        with utils.create_db_session(config.DB_FULL_URL) as db_session:
            try:
                # Batch insert is more efficient than individual inserts
                if logs_rows:
                    db_session.execute(insert(ExecutionLog), logs_rows)
                if details_rows:
                    db_session.execute(insert(ExecutionDetail), details_rows)
                db_session.commit()
            except Exception as e:
                db_session.rollback()
                # Re-raise to let caller handle logging/metrics
                raise


class QueueLogAppender(LogAppenderBase):
    """
    Queue-based implementation of LogAppender.
    Uses an in-memory queue with background thread for batched DB writes.
    """

    def __init__(
            self,
            max_queue: int = EXECUTION_LOG_APPENDER_MAX_QUEUE,
            flush_every_ms: int = EXECUTION_LOG_APPENDER_FLUSH_EVERY_MS,
            max_batch: int = EXECUTION_LOG_APPENDER_MAX_BATCH,
            drop_policy: str = EXECUTION_LOG_APPENDER_DROP_POLICY,
    ) -> None:
        super().__init__(max_queue, flush_every_ms, max_batch, drop_policy)
        self.q: "queue.Queue[LogEvent]" = queue.Queue(maxsize=max_queue)
        self._thr: Optional[threading.Thread] = None

    def start(self) -> None:
        if self._thr and self._thr.is_alive():
            return
        self._stop.clear()
        self._thr = threading.Thread(target=self._run, name="log-flusher", daemon=True)
        self._thr.start()
        logger.info("QueueLogAppender started with max_queue=%d, flush_every_ms=%d, max_batch=%d",
                    self.max_queue, self.flush_every_ms, self.max_batch)

    def stop(self, timeout: float = 5.0) -> None:
        self._stop.set()
        if self._thr:
            self._thr.join(timeout=timeout)
        logger.info("QueueLogAppender stopped")

    def enqueue(
            self,
            *,
            function_name: str,
            app_name: str,
            project_id: UUID,
            status: ExecutionStatus,
            execution_time: int,
            linked_account_owner_id: Optional[str] = None,
            app_configuration_id: Optional[str] = None,
            api_key_name: Optional[str] = None,
            request: Optional[dict] = None,
            response: Optional[Any] = None,
            created_at: Optional[datetime] = None,
            execution_id: Optional[UUID] = None,
    ) -> Optional[UUID]:
        evt = LogEvent(
            id=execution_id or uuid4(),
            function_name=function_name,
            app_name=app_name,
            linked_account_owner_id=linked_account_owner_id,
            app_configuration_id=app_configuration_id,
            api_key_name=api_key_name,
            status=status,
            execution_time=execution_time,
            created_at=created_at or datetime.now(timezone.utc),
            project_id=project_id,
            request=request,
            response=response,
        )
        try:
            # Never block the caller; drop if full
            self.q.put_nowait(evt)
            return evt.id
        except queue.Full:
            # Optionally: send a metric here. We deliberately drop to protect hot path.
            logger.warning("QueueLogAppender queue full, dropping event")
            return None

    def _run(self) -> None:
        sleep_s = self.flush_every_ms / 1000.0
        batch: list[LogEvent] = []
        while not self._stop.is_set():
            try:
                # Small wait to coalesce
                time.sleep(sleep_s)
                while len(batch) < self.max_batch:
                    try:
                        batch.append(self.q.get_nowait())
                    except queue.Empty:
                        break
                if not batch:
                    continue
                self._flush_to_db(batch)
            except Exception:
                # Swallow to keep the flusher alive; consider logging to stderr/metrics
                pass
            finally:
                batch.clear()


class RedisLogAppender(LogAppenderBase):
    """
    Redis-based implementation of LogAppender.
    Uses Redis as a queue with background thread for batched DB writes.
    """

    def __init__(
            self,
            redis_client: Any,  # redis.Redis or redis.asyncio.Redis
            queue_name: str = "execution_logs",
            max_queue: int = EXECUTION_LOG_APPENDER_MAX_QUEUE,
            flush_every_ms: int = EXECUTION_LOG_APPENDER_FLUSH_EVERY_MS,
            max_batch: int = EXECUTION_LOG_APPENDER_MAX_BATCH,
            drop_policy: str = EXECUTION_LOG_APPENDER_DROP_POLICY,
    ) -> None:
        super().__init__(max_queue, flush_every_ms, max_batch, drop_policy)
        self.redis_client = redis_client
        self.queue_name = queue_name
        self._thr: Optional[threading.Thread] = None

    def start(self) -> None:
        if self._thr and self._thr.is_alive():
            return
        self._stop.clear()
        self._thr = threading.Thread(target=self._run, name="redis-log-flusher", daemon=True)
        self._thr.start()
        logger.info("RedisLogAppender started with queue_name=%s, max_queue=%d, flush_every_ms=%d, max_batch=%d",
                    self.queue_name, self.max_queue, self.flush_every_ms, self.max_batch)

    def stop(self, timeout: float = 5.0) -> None:
        self._stop.set()
        if self._thr:
            self._thr.join(timeout=timeout)
        logger.info("RedisLogAppender stopped")

    def enqueue(
            self,
            *,
            function_name: str,
            app_name: str,
            project_id: UUID,
            status: ExecutionStatus,
            execution_time: int,
            linked_account_owner_id: Optional[str] = None,
            app_configuration_id: Optional[str] = None,
            api_key_name: Optional[str] = None,
            request: Optional[dict] = None,
            response: Optional[Any] = None,
            created_at: Optional[datetime] = None,
            execution_id: Optional[UUID] = None,
    ) -> Optional[UUID]:
        import json

        evt = LogEvent(
            id=execution_id or uuid4(),
            function_name=function_name,
            app_name=app_name,
            linked_account_owner_id=linked_account_owner_id,
            app_configuration_id=app_configuration_id,
            api_key_name=api_key_name,
            status=status,
            execution_time=execution_time,
            created_at=created_at or datetime.now(timezone.utc),
            project_id=project_id,
            request=request,
            response=response,
        )

        try:
            # Serialize the event to JSON
            serialized = json.dumps({
                "id": str(evt.id),
                "function_name": evt.function_name,
                "app_name": evt.app_name,
                "linked_account_owner_id": evt.linked_account_owner_id,
                "app_configuration_id": str(evt.app_configuration_id) if evt.app_configuration_id else None,
                "status": evt.status.value,
                "execution_time": evt.execution_time,
                "created_at": evt.created_at.isoformat(),
                "project_id": str(evt.project_id),
                "request": evt.request,
                "response": evt.response,
            })

            # Push to Redis queue (non-blocking)
            queue_length = self.redis_client.lpush(self.queue_name, serialized)

            # Drop oldest if queue is too long (implement max_queue limit)
            if queue_length > self.max_queue:
                logger.warning("Redis queue is full, dropping")
                self.redis_client.rpop(self.queue_name)
                return None

            return evt.id
        except Exception:
            logger.exception("Failed to enqueue log event to Redis")
            # Drop on any Redis error to protect hot path
            return None

    def _run(self) -> None:
        import json

        sleep_s = self.flush_every_ms / 1000.0
        batch: list[LogEvent] = []

        while not self._stop.is_set():
            try:
                time.sleep(sleep_s)

                # Pop events from Redis queue
                while len(batch) < self.max_batch:
                    serialized = self.redis_client.rpop(self.queue_name)
                    if not serialized:
                        break

                    try:
                        data = json.loads(serialized)
                        evt = LogEvent(
                            id=UUID(data["id"]),
                            function_name=data["function_name"],
                            app_name=data["app_name"],
                            linked_account_owner_id=data["linked_account_owner_id"],
                            app_configuration_id=UUID(data["app_configuration_id"]) if data[
                                "app_configuration_id"] else None,
                            api_key_name=data.get("api_key_name"),
                            status=ExecutionStatus(data["status"]),
                            execution_time=data["execution_time"],
                            created_at=datetime.fromisoformat(data["created_at"]),
                            project_id=UUID(data["project_id"]),
                            request=data["request"],
                            response=data["response"],
                        )
                        batch.append(evt)
                    except (json.JSONDecodeError, KeyError, ValueError):
                        # Skip malformed events
                        continue

                if not batch:
                    continue

                self._flush_to_db(batch)
            except Exception as e:
                logger.exception("Failed to flush batch to DB: %s", e)
                # Swallow to keep the flusher alive; consider logging to stderr/metrics
                pass
            finally:
                batch.clear()


log_appender: LogAppenderBase
if EXECUTION_LOG_APPENDER_IMPLEMENTATION == "queue":
    log_appender = QueueLogAppender(
        max_queue=EXECUTION_LOG_APPENDER_MAX_QUEUE,
        flush_every_ms=EXECUTION_LOG_APPENDER_FLUSH_EVERY_MS,
        max_batch=EXECUTION_LOG_APPENDER_MAX_BATCH,
        drop_policy=EXECUTION_LOG_APPENDER_DROP_POLICY,
    )
elif EXECUTION_LOG_APPENDER_IMPLEMENTATION == "redis":
    import redis

    redis_client = redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        password=REDIS_PASSWORD,
        decode_responses=True,
    )
    log_appender = RedisLogAppender(
        redis_client=redis_client,
        queue_name=EXECUTION_LOG_APPENDER_REDIS_QUEUE_NAME,
        max_queue=EXECUTION_LOG_APPENDER_MAX_QUEUE,
        flush_every_ms=EXECUTION_LOG_APPENDER_FLUSH_EVERY_MS,
        max_batch=EXECUTION_LOG_APPENDER_MAX_BATCH,
        drop_policy=EXECUTION_LOG_APPENDER_DROP_POLICY,
    )
else:
    raise ValueError(f"Unknown log appender implementation: {EXECUTION_LOG_APPENDER_IMPLEMENTATION}")
