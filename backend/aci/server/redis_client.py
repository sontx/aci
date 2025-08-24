import logging

import redis

from aci.server.config import (
    REDIS_DB,
    REDIS_HOST,
    REDIS_PORT,
    REDIS_PASSWORD,
)

redis_client: redis.asyncio.client.Redis

if REDIS_HOST:
    logger = logging.getLogger(__name__)
    logger.info(f"Initializing Redis client, host={REDIS_HOST}, port={REDIS_PORT}, db={REDIS_DB}")

    redis_client = redis.asyncio.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        password=REDIS_PASSWORD,
        decode_responses=True,
    )
