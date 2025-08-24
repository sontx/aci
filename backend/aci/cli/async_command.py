import click
import asyncio
from functools import wraps

def async_command(*args, **kwargs):
    """
    Wraps an async function into a click command.
    Accepts the same arguments as click.command().
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*w_args, **w_kwargs):
            return asyncio.run(f(*w_args, **w_kwargs))
        return click.command(*args, **kwargs)(wrapper)
    return decorator