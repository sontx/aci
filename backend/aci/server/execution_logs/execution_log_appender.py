import abc
import asyncio
import logging
import threading
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
    EXECUTION_LOG_APPENDER_REDIS_QUEUE_NAME,
)
from aci.server.redis_client import redis_client

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
    Provides a non-blocking async interface for logging execution events.
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
        self._stop_event = asyncio.Event()
        self._task: Optional[asyncio.Task] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None

    async def start(self) -> None:
        """Start the appender background processing."""
        if self._task and not self._task.done():
            return

        # Get or create event loop
        try:
            self._loop = asyncio.get_running_loop()
        except RuntimeError:
            # If no event loop is running, create one in a thread
            def run_in_thread():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                self._loop = loop
                loop.run_until_complete(self._start_background_task())
                loop.run_forever()

            thread_name = f"{self.__class__.__name__.lower().replace('logappender', '')}-log-appender-thread"
            self._thread = threading.Thread(target=run_in_thread, name=thread_name, daemon=True)
            self._thread.start()
            # Wait a bit for the thread to initialize
            await asyncio.sleep(0.1)
        else:
            await self._start_background_task()

    @abc.abstractmethod
    async def _start_background_task(self) -> None:
        """Initialize resources and start the background task. Must be implemented by subclasses."""
        pass

    @abc.abstractmethod
    async def stop(self, timeout: float = 5.0) -> None:
        """Stop the appender background processing."""
        pass

    @abc.abstractmethod
    async def enqueue(
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
        """Enqueue a log event asynchronously. Returns the execution ID if successful, None if dropped."""
        pass

    async def _flush_to_db(self, batch: list[LogEvent]) -> None:
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
        async with utils.create_db_async_session(config.DB_FULL_URL) as db_session:
            try:
                # Batch insert is more efficient than individual inserts
                if logs_rows:
                    await db_session.execute(insert(ExecutionLog), logs_rows)
                if details_rows:
                    await db_session.execute(insert(ExecutionDetail), details_rows)
                await db_session.commit()
            except Exception as e:
                await db_session.rollback()
                # Re-raise to let caller handle logging/metrics
                raise


class AsyncQueueLogAppender(LogAppenderBase):
    """
    AsyncQueue-based implementation of LogAppender.
    Uses an asyncio queue with background task for batched DB writes.
    """

    def __init__(
            self,
            max_queue: int = EXECUTION_LOG_APPENDER_MAX_QUEUE,
            flush_every_ms: int = EXECUTION_LOG_APPENDER_FLUSH_EVERY_MS,
            max_batch: int = EXECUTION_LOG_APPENDER_MAX_BATCH,
            drop_policy: str = EXECUTION_LOG_APPENDER_DROP_POLICY,
    ) -> None:
        super().__init__(max_queue, flush_every_ms, max_batch, drop_policy)
        self.q: Optional[asyncio.Queue[LogEvent]] = None

    async def _start_background_task(self) -> None:
        self.q = asyncio.Queue(maxsize=self.max_queue)
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run())
        logger.info("AsyncQueueLogAppender started with max_queue=%d, flush_every_ms=%d, max_batch=%d",
                    self.max_queue, self.flush_every_ms, self.max_batch)

    async def stop(self, timeout: float = 5.0) -> None:
        if self._stop_event:
            self._stop_event.set()
        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=timeout)
            except asyncio.TimeoutError:
                self._task.cancel()
                try:
                    await self._task
                except asyncio.CancelledError:
                    pass
        logger.info("AsyncQueueLogAppender stopped")

    async def enqueue(
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
        if not self.q:
            logger.warning("AsyncQueueLogAppender not started, dropping event")
            return None

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
        except asyncio.QueueFull:
            # Optionally: send a metric here. We deliberately drop to protect hot path.
            logger.warning("AsyncQueueLogAppender queue full, dropping event")
            return None

    async def _run(self) -> None:
        sleep_s = self.flush_every_ms / 1000.0
        batch: list[LogEvent] = []

        while not self._stop_event.is_set():
            try:
                # Small wait to coalesce
                await asyncio.sleep(sleep_s)

                # Collect batch
                while len(batch) < self.max_batch:
                    try:
                        evt = self.q.get_nowait()
                        batch.append(evt)
                        self.q.task_done()
                    except asyncio.QueueEmpty:
                        break

                if batch:
                    await self._flush_to_db(batch)
            except Exception as e:
                logger.exception("Failed to flush batch to DB: %s", e)
                # Swallow to keep the flusher alive; consider logging to stderr/metrics
                pass
            finally:
                batch.clear()


class AsyncRedisLogAppender(LogAppenderBase):
    """
    Redis-based implementation of LogAppender using async Redis.
    Uses Redis as a queue with background task for batched DB writes.
    """

    def __init__(
            self,
            redis_client: "redis.asyncio.Redis",  # redis.asyncio.Redis
            queue_name: str = "execution_logs",
            max_queue: int = EXECUTION_LOG_APPENDER_MAX_QUEUE,
            flush_every_ms: int = EXECUTION_LOG_APPENDER_FLUSH_EVERY_MS,
            max_batch: int = EXECUTION_LOG_APPENDER_MAX_BATCH,
            drop_policy: str = EXECUTION_LOG_APPENDER_DROP_POLICY,
    ) -> None:
        super().__init__(max_queue, flush_every_ms, max_batch, drop_policy)
        self.redis_client = redis_client
        self.queue_name = queue_name

    async def _start_background_task(self) -> None:
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run())
        logger.info("AsyncRedisLogAppender started with queue_name=%s, max_queue=%d, flush_every_ms=%d, max_batch=%d",
                    self.queue_name, self.max_queue, self.flush_every_ms, self.max_batch)

    async def stop(self, timeout: float = 5.0) -> None:
        if self._stop_event:
            self._stop_event.set()
        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=timeout)
            except asyncio.TimeoutError:
                self._task.cancel()
                try:
                    await self._task
                except asyncio.CancelledError:
                    pass
        logger.info("AsyncRedisLogAppender stopped")

    async def enqueue(
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
                "api_key_name": evt.api_key_name,
                "linked_account_owner_id": evt.linked_account_owner_id,
                "app_configuration_id": str(evt.app_configuration_id) if evt.app_configuration_id else None,
                "status": evt.status.value,
                "execution_time": evt.execution_time,
                "created_at": evt.created_at.isoformat(),
                "project_id": str(evt.project_id),
                "request": evt.request,
                "response": evt.response,
            })

            # Push to Redis queue (async)
            queue_length = await self.redis_client.lpush(self.queue_name, serialized)

            # Drop oldest if queue is too long (implement max_queue limit)
            if queue_length > self.max_queue:
                logger.warning("Redis queue is full, dropping oldest")
                await self.redis_client.rpop(self.queue_name)

            return evt.id
        except Exception as e:
            logger.exception("Failed to enqueue log event to Redis: %s", e)
            # Drop on any Redis error to protect hot path
            return None

    async def _run(self) -> None:
        import json

        sleep_s = self.flush_every_ms / 1000.0
        batch: list[LogEvent] = []

        while not self._stop_event.is_set():
            try:
                await asyncio.sleep(sleep_s)

                # Pop events from Redis queue
                while len(batch) < self.max_batch:
                    serialized = await self.redis_client.rpop(self.queue_name)
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
                    except (json.JSONDecodeError, KeyError, ValueError) as e:
                        logger.warning("Skipping malformed event: %s", e)
                        continue

                if batch:
                    await self._flush_to_db(batch)
            except Exception as e:
                logger.exception("Failed to flush batch to DB: %s", e)
                # Swallow to keep the flusher alive; consider logging to stderr/metrics
                pass
            finally:
                batch.clear()


log_appender: LogAppenderBase
if not redis_client:
    log_appender = AsyncQueueLogAppender(
        max_queue=EXECUTION_LOG_APPENDER_MAX_QUEUE,
        flush_every_ms=EXECUTION_LOG_APPENDER_FLUSH_EVERY_MS,
        max_batch=EXECUTION_LOG_APPENDER_MAX_BATCH,
        drop_policy=EXECUTION_LOG_APPENDER_DROP_POLICY,
    )
elif redis_client:
    log_appender = AsyncRedisLogAppender(
        redis_client=redis_client,
        queue_name=EXECUTION_LOG_APPENDER_REDIS_QUEUE_NAME,
        max_queue=EXECUTION_LOG_APPENDER_MAX_QUEUE,
        flush_every_ms=EXECUTION_LOG_APPENDER_FLUSH_EVERY_MS,
        max_batch=EXECUTION_LOG_APPENDER_MAX_BATCH,
        drop_policy=EXECUTION_LOG_APPENDER_DROP_POLICY,
    )
