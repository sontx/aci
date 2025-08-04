from pydantic import BaseModel
from typing import Generic, TypeVar

T = TypeVar("T")


class Paged(BaseModel, Generic[T]):
    total: int
    items: list[T]

