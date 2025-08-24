from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aci.common import utils
from aci.common.db import crud
from aci.common.db.sql_models import App, Function
from aci.common.enums import Visibility
from aci.common.exceptions import FunctionNotFound, ConflictError, AppNotFound
from aci.common.logging_setup import get_logger
from aci.common.schemas.function import FunctionUpsert, FunctionUpdate

logger = get_logger(__name__)


async def create_functions(
        db_session: AsyncSession,
        functions_upsert: list[FunctionUpsert],
) -> list[Function]:
    """
    Create functions.
    Note: each function might be of different app.
    """
    logger.debug(f"Creating functions, functions_upsert={functions_upsert}")

    functions = []
    for i, function_upsert in enumerate(functions_upsert):
        app_name = utils.parse_app_name_from_function_name(function_upsert.name)
        app = await crud.apps.get_app(db_session, app_name, False, False)
        if not app:
            logger.error(f"App={app_name} does not exist for function={function_upsert.name}")
            raise ValueError(f"App={app_name} does not exist for function={function_upsert.name}")
        function_data = function_upsert.model_dump(mode="json", exclude_none=True)
        function = Function(
            app_id=app.id,
            **function_data,
        )
        db_session.add(function)
        functions.append(function)

    await db_session.flush()

    return functions


async def update_functions(
        db_session: AsyncSession,
        functions_upsert: list[FunctionUpsert],
) -> list[Function]:
    """
    Update functions.
    Note: each function might be of different app.
    """
    logger.debug(f"Updating functions, functions_upsert={functions_upsert}")
    functions = []
    for i, function_upsert in enumerate(functions_upsert):
        function = await crud.functions.get_function(db_session, function_upsert.name, False, False)
        if not function:
            logger.error(f"Function={function_upsert.name} does not exist")
            raise ValueError(f"Function={function_upsert.name} does not exist")

        function_data = function_upsert.model_dump(mode="json", exclude_unset=True)
        for field, value in function_data.items():
            setattr(function, field, value)
        functions.append(function)

    await db_session.flush()

    return functions


async def search_functions(
        db_session: AsyncSession,
        public_only: bool,
        active_only: bool,
        app_names: list[str] | None,
        limit: int,
        offset: int,
) -> list[Function]:
    """Get a list of functions with optional filtering by app names and sorting by vector similarity to intent."""
    statement = select(Function).join(App, Function.app_id == App.id)

    # filter out all functions of inactive apps and all inactive functions
    # (where app is active buy specific functions can be inactive)
    if active_only:
        statement = statement.filter(App.active).filter(Function.active)
    # if the corresponding project (api key belongs to) can only access public apps and functions,
    # filter out all functions of private apps and all private functions (where app is public but specific function is private)
    if public_only:
        statement = statement.filter(App.visibility == Visibility.PUBLIC).filter(
            Function.visibility == Visibility.PUBLIC
        )
    # filter out functions that are not in the specified apps
    if app_names is not None:
        statement = statement.filter(App.name.in_(app_names))

    statement = statement.offset(offset).limit(limit)
    logger.debug(f"Executing statement, statement={statement}")

    result = await db_session.execute(statement)
    return list(result.scalars().all())


async def get_functions(
        db_session: AsyncSession,
        public_only: bool,
        active_only: bool,
        app_names: list[str] | None,
        limit: int,
        offset: int,
) -> list[Function]:
    """Get a list of functions and their details. Sorted by function name."""
    statement = select(Function).join(App, Function.app_id == App.id)

    if app_names is not None:
        statement = statement.filter(App.name.in_(app_names))

    # exclude private Apps's functions and private functions if public_only is True
    if public_only:
        statement = statement.filter(App.visibility == Visibility.PUBLIC).filter(
            Function.visibility == Visibility.PUBLIC
        )
    # exclude inactive functions (including all functions if apps are inactive)
    if active_only:
        statement = statement.filter(App.active).filter(Function.active)

    statement = statement.order_by(Function.name).offset(offset).limit(limit)

    result = await db_session.execute(statement)
    return list(result.scalars().all())


async def get_functions_by_app_id(db_session: AsyncSession, app_id: UUID) -> list[Function]:
    statement = select(Function).filter(Function.app_id == app_id)

    result = await db_session.execute(statement)
    return list(result.scalars().all())


async def get_function(
        db_session: AsyncSession, function_name: str, public_only: bool, active_only: bool, project_id: UUID | None = None
) -> Function | None:
    if project_id is None:
        # If project_id is None, we assume it's a global function
        statement = select(Function).filter(Function.project_id.is_(None), Function.name == function_name)
    else:
        statement = select(Function).filter(Function.project_id == project_id, Function.name == function_name)

    # filter out all functions of inactive apps and all inactive functions
    # (where app is active buy specific functions can be inactive)
    if active_only:
        statement = (
            statement.join(App, Function.app_id == App.id)
            .filter(App.active)
            .filter(Function.active)
        )
    # if the corresponding project (api key belongs to) can only access public apps and functions,
    # filter out all functions of private apps and all private functions (where app is public but specific function is private)
    if public_only:
        statement = statement.filter(App.visibility == Visibility.PUBLIC).filter(
            Function.visibility == Visibility.PUBLIC
        )

    result = await db_session.execute(statement)
    return result.scalar_one_or_none()


async def get_user_function_by_name(
        db_session: AsyncSession,
        function_name: str,
        project_id: UUID,
) -> Function | None:
    """
    Get a user function by name, filtered by project_id.
    """
    statement = select(Function).filter(Function.project_id == project_id, Function.name == function_name)
    result = await db_session.execute(statement)
    return result.scalar_one_or_none()


async def get_user_functions_by_app_name(
        db_session: AsyncSession,
        app_name: str,
        project_id: UUID,
) -> list[Function]:
    """
    Get all functions of a user app by app name, filtered by project_id.
    """
    statement = (
        select(Function)
        .join(App, Function.app_id == App.id)
        .filter(App.name == app_name, App.project_id == project_id)
    )

    statement = statement.order_by(Function.name)
    result = await db_session.execute(statement)
    return list(result.scalars().all())


async def delete_user_function(
        db_session: AsyncSession,
        function_name: str,
        project_id: UUID,
) -> None:
    """
    Delete a user function by name, filtered by project_id.
    """
    logger.debug(f"Deleting user function: {function_name} for project_id: {project_id}")

    function = await get_user_function_by_name(db_session, function_name, project_id)
    if not function:
        raise FunctionNotFound(f"Function with name {function_name} not found on your organization")

    # Verify it's not a global function (additional safety check)
    if function.project_id is None:
        raise ConflictError("Cannot delete global function")

    await db_session.delete(function)
    await db_session.flush()


async def create_user_functions(
        db_session: AsyncSession,
        app_name: str,
        functions_upsert: list[FunctionUpsert],
        override_existing: bool,
        remove_previous: bool,
        project_id: UUID,
) -> list[Function]:
    """
    Create user functions for a specific organization.
    """
    logger.debug(
        f"Creating user functions for app name {app_name}, project_id={project_id}, override_existing={override_existing}, remove_previous={remove_previous}")

    app = await crud.apps.get_user_app_by_name(db_session, app_name, project_id)
    if not app:
        logger.error(f"User app={app_name} does not exist for project_id={project_id}")
        raise AppNotFound(f"User app {app_name} does not exist")

    # Normalize function names to ensure they are unique within the app
    for function_upsert in functions_upsert:
        function_upsert.name = utils.build_function_name(app_name, function_upsert.name)

    # Get names of functions that will be upserted
    upsert_function_names = {func_upsert.name for func_upsert in functions_upsert}

    # Handle removal of previous functions if requested
    if remove_previous:
        existing_functions = await get_user_functions_by_app_name(db_session, app_name, project_id)
        functions_to_remove = [func for func in existing_functions if func.name not in upsert_function_names]

        for func_to_remove in functions_to_remove:
            logger.debug(f"Removing previous function: {func_to_remove.name}")
            await db_session.delete(func_to_remove)

    functions = []
    for function_upsert in functions_upsert:
        # Check if function already exists
        existing_function = await get_user_function_by_name(db_session, function_upsert.name, project_id)

        if existing_function:
            if override_existing:
                # Update existing function
                logger.debug(f"Updating existing function: {function_upsert.name}")
                function_data = function_upsert.model_dump(mode="json", exclude_unset=True)
                for field, value in function_data.items():
                    setattr(existing_function, field, value)
                functions.append(existing_function)
            else:
                # Skip duplicate
                logger.debug(f"Skipping duplicate function: {function_upsert.name}")
                functions.append(existing_function)
        else:
            # Create new function
            logger.debug(f"Creating new function: {function_upsert.name}")
            function_data = function_upsert.model_dump(mode="json", exclude_none=True)
            function = Function(
                **function_data,
                app_id=app.id,
                project_id=project_id,
            )
            db_session.add(function)
            functions.append(function)
            function.app = app  # Set the relationship for potential later use

    await db_session.flush()

    return functions


async def update_user_function(
        db_session: AsyncSession,
        function_name: str,
        function_update: FunctionUpdate,
        project_id: UUID,
) -> Function:
    """
    Update user functions for a specific organization.
    """
    logger.debug(f"Updating user function, function_update={function_name}, project_id={project_id}")

    function = await get_user_function_by_name(db_session, function_name, project_id)
    if not function:
        logger.error(f"User function={function_name} does not exist for project_id={project_id}")
        raise FunctionNotFound(f"User function={function_name} does not exist on your organization")

    function_data = function_update.model_dump(mode="json", exclude_unset=True)
    for field, value in function_data.items():
        setattr(function, field, value)

    await db_session.flush()

    return function


async def get_user_function_tags(
        db_session: AsyncSession,
        project_id: UUID,
) -> list[str]:
    """
    Get all tags used in user functions for the current project functions and global functions.
    """
    statement = select(Function).filter(
        (Function.project_id == project_id) | (Function.project_id.is_(None))
    ).distinct(Function.tags)

    result = await db_session.execute(statement)
    functions = result.scalars().all()
    tags = set()

    for function in functions:
        if function.tags:
            tags.update(function.tags)

    return list(tags)
