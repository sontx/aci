import os
from typing import Callable, Type, TypeVar, Union, List, Awaitable, Optional

from aiocache import BaseCache
from aiocache import caches
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


def configure_cache_from_env():
    """
    Configure the default cache based on environment variables.
    Uses RedisCache if REDIS_HOST is provided; otherwise, SimpleMemoryCache.
    """
    redis_host = os.environ.get("REDIS_HOST")
    redis_port = int(os.environ.get("REDIS_PORT", 6379))
    redis_db = int(os.environ.get("REDIS_DB", 0))
    common_kwargs = {
        "ttl": int(os.environ.get("CACHE_TTL", 60)),
    }

    if redis_host:
        config = {
            "default": {
                "cache": "aiocache.RedisCache",
                "endpoint": redis_host,
                "port": redis_port,
                "db": redis_db,
                "timeout": 1,
                **common_kwargs,
            }
        }
        print("Configured default cache: RedisCache")
    else:
        config = {
            "default": {
                "cache": "aiocache.SimpleMemoryCache",
                **common_kwargs,
            }
        }
        print("Configured default cache: SimpleMemoryCache (fallback)")

    caches.set_config(config)


def get_cache() -> BaseCache:
    """
    Get the default cache instance.
    """
    return caches.get("default")


def cache_pydantic(
        model: Type[T],
        *,
        key: str,
        ttl: int = 60,
        many: bool = False,
) -> Callable[[Callable[..., Awaitable[Union[T, List[T]]]]], Callable[..., Awaitable[Union[T, List[T]]]]]:
    """
    Decorator to cache the result of a function that returns a Pydantic model or list of models.
    """

    def decorator(func: Callable[..., Awaitable[Union[T, List[T]]]]) -> Callable[..., Awaitable[Union[T, List[T]]]]:
        async def wrapper(*args, **kwargs) -> Union[T, List[T]]:
            cache = caches.get("default")
            cached_data = await cache.get(key)
            if cached_data is not None:
                if many:
                    return [model(**item) for item in cached_data]
                return model(**cached_data)

            result = await func(*args, **kwargs)
            if many:
                to_cache = [item.model_dump() for item in result]
            else:
                to_cache = result.model_dump()
            await cache.set(key, to_cache, ttl=ttl)
            return result

        return wrapper

    return decorator


class PydanticCacheHelper:
    def __init__(self, model: Type[T], many: bool = False):
        self.model = model
        self.many = many
        self.cache = get_cache()

    async def get(self, key: str) -> Optional[Union[T, List[T]]]:
        cached_data = await self.cache.get(key)
        if cached_data is None:
            return None
        if self.many:
            return [self.model(**item) for item in cached_data]
        return self.model(**cached_data)

    async def set(self, key: str, value: Union[T, List[T]], ttl: int = None):
        if self.many:
            to_cache = [item.model_dump() for item in value]
        else:
            to_cache = value.model_dump()
        await self.cache.set(key, to_cache, ttl=ttl)
