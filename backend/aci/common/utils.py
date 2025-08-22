import json
import os
import re
from functools import cache
from uuid import UUID

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from aci.common.logging_setup import get_logger

logger = get_logger(__name__)


def check_and_get_env_variable(name: str, decode_json=False) -> str:
    value = os.getenv(name)
    if value is None:
        raise ValueError(f"Environment variable '{name}' is not set")
    if value == "":
        raise ValueError(f"Environment variable '{name}' is empty string")

    if decode_json:
        try:
            value = json.loads(value)
        except json.JSONDecodeError as e:
            raise ValueError(f"Environment variable '{name}' is not valid JSON: {e}")

    return value


def construct_db_url(
        scheme: str, user: str, password: str, host: str, port: str, db_name: str
) -> str:
    return f"{scheme}://{user}:{password}@{host}:{port}/{db_name}"


def format_to_screaming_snake_case(name: str) -> str:
    """
    Convert a string with spaces, hyphens, slashes, camel case etc. to screaming snake case.
    e.g., "GitHub Create Repository" -> "GITHUB_CREATE_REPOSITORY"
    e.g., "GitHub/Create Repository" -> "GITHUB_CREATE_REPOSITORY"
    e.g., "github-create-repository" -> "GITHUB_CREATE_REPOSITORY"
    """
    # Replace any run of non-alphanumeric characters with a single underscore
    s = re.sub(r"[^0-9A-Za-z]+", "_", name)
    # Collapse multiple underscores and trim
    s = re.sub(r"_+", "_", s).strip("_")
    return s.upper()


# NOTE: it's important that you don't create a new engine for each session, which takes
# up db resources and will lead up to errors pretty fast
# TODO: fine tune the pool settings
@cache
def get_db_engine(db_url: str) -> Engine:
    return create_engine(
        db_url,
        pool_size=10,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=3600,  # recycle connections after 1 hour
        pool_pre_ping=True,
    )


# NOTE: cache this because only one sessionmaker is needed for all db sessions
@cache
def get_sessionmaker(db_url: str) -> sessionmaker:
    engine = get_db_engine(db_url)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_db_session(db_url: str) -> Session:
    SessionMaker = get_sessionmaker(db_url)
    session: Session = SessionMaker()

    return session


def parse_app_name_from_function_name(function_name: str) -> str:
    """
    Parse the app name from a function name.
    e.g., "ACI_TEST__HELLO_WORLD" -> "ACI_TEST"
    """
    return function_name.split("__")[0]


def build_function_name(app_name: str, function_name: str) -> str:
    """
    Build a function name from an app name and a function name.
    e.g., "ACI_TEST", "HELLO_WORLD" -> "ACI_TEST__HELLO_WORLD"
    """
    if function_name.startswith(f"{app_name}__"):
        return function_name
    return f"{app_name}__{function_name}"


def snake_to_camel(string: str) -> str:
    """
    Convert a snake case string to a camel case string.
    e.g., "snake_case_string" -> "SnakeCaseString"
    """
    parts = string.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


def to_snake_case(string: str) -> str:
    """
    Convert a string to snake_case.
    Handles CamelCase and replaces hyphens with underscores.
    e.g., "SnakeCase-String" -> "snake_case_string"
    """
    string = string.replace("-", "_")
    string = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", string)
    string = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", string)
    return string.lower()


def random_string(length: int = 10) -> str:
    """
    Generate a random string of fixed length.
    """
    import random
    import string

    letters = string.ascii_letters + string.digits
    return ''.join(random.choice(letters) for _ in range(length))


def generate_api_key() -> str:
    """
    Generate a secure API key.
    Format: api_<32_random_characters>
    """
    import secrets
    import string

    # Use cryptographically secure random generator
    alphabet = string.ascii_letters + string.digits
    random_part = ''.join(secrets.choice(alphabet) for _ in range(32))
    return f"api_{random_part}"


def is_uuid(value: str | UUID) -> bool:
    if isinstance(value, UUID):
        return True
    try:
        UUID(value)
        return True
    except ValueError:
        return False
