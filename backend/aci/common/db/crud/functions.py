from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from aci.common import utils
from aci.common.db import crud
from aci.common.db.sql_models import App, Function
from aci.common.enums import Visibility
from aci.common.exceptions import FunctionNotFound, ConflictError, AppNotFound
from aci.common.logging_setup import get_logger
from aci.common.schemas.function import FunctionUpsert

logger = get_logger(__name__)


def create_functions(
        db_session: Session,
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
        app = crud.apps.get_app(db_session, app_name, False, False)
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

    db_session.flush()

    return functions


def update_functions(
        db_session: Session,
        functions_upsert: list[FunctionUpsert],
) -> list[Function]:
    """
    Update functions.
    Note: each function might be of different app.
    """
    logger.debug(f"Updating functions, functions_upsert={functions_upsert}")
    functions = []
    for i, function_upsert in enumerate(functions_upsert):
        function = crud.functions.get_function(db_session, function_upsert.name, False, False)
        if not function:
            logger.error(f"Function={function_upsert.name} does not exist")
            raise ValueError(f"Function={function_upsert.name} does not exist")

        function_data = function_upsert.model_dump(mode="json", exclude_unset=True)
        for field, value in function_data.items():
            setattr(function, field, value)
        functions.append(function)

    db_session.flush()

    return functions


def search_functions(
        db_session: Session,
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

    return list(db_session.execute(statement).scalars().all())


def get_functions(
        db_session: Session,
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

    return list(db_session.execute(statement).scalars().all())


def get_functions_by_app_id(db_session: Session, app_id: UUID) -> list[Function]:
    statement = select(Function).filter(Function.app_id == app_id)

    return list(db_session.execute(statement).scalars().all())


def get_function(
        db_session: Session, function_name: str, public_only: bool, active_only: bool
) -> Function | None:
    statement = select(Function).filter(Function.org_id.is_(None), Function.name == function_name)

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

    return db_session.execute(statement).scalar_one_or_none()


def get_user_function_by_name(
        db_session: Session,
        function_name: str,
        org_id: UUID,
) -> Function | None:
    """
    Get a user function by name, filtered by org_id.
    """
    statement = select(Function).filter(Function.org_id == org_id, Function.name == function_name)
    return db_session.execute(statement).scalar_one_or_none()


def get_user_functions_by_app_name(
        db_session: Session,
        app_name: str,
        org_id: UUID,
) -> list[Function]:
    """
    Get all functions of a user app by app name, filtered by org_id.
    """
    statement = (
        select(Function)
        .join(App, Function.app_id == App.id)
        .filter(App.name == app_name, App.org_id == org_id)
    )

    statement = statement.order_by(Function.name)
    return list(db_session.execute(statement).scalars().all())


def delete_user_function(
        db_session: Session,
        function_name: str,
        org_id: UUID,
) -> None:
    """
    Delete a user function by name, filtered by org_id.
    """
    logger.debug(f"Deleting user function: {function_name} for org_id: {org_id}")

    function = get_user_function_by_name(db_session, function_name, org_id)
    if not function:
        raise FunctionNotFound(f"Function with name {function_name} not found on your organization")

    # Verify it's not a global function (additional safety check)
    if function.org_id is None:
        raise ConflictError("Cannot delete global function")

    db_session.delete(function)
    db_session.flush()


def create_user_functions(
        db_session: Session,
        app_name: str,
        functions_upsert: list[FunctionUpsert],
        override_existing: bool,
        remove_previous: bool,
        org_id: UUID,
) -> list[Function]:
    """
    Create user functions for a specific organization.
    """
    logger.debug(f"Creating user functions for app name {app_name}, org_id={org_id}, override_existing={override_existing}, remove_previous={remove_previous}")

    app = crud.apps.get_user_app_by_name(db_session, app_name, org_id)
    if not app:
        logger.error(f"User app={app_name} does not exist for org_id={org_id}")
        raise AppNotFound(f"User app {app_name} does not exist")

    # Normalize function names to ensure they are unique within the app
    for function_upsert in functions_upsert:
        function_upsert.name = utils.build_function_name(app_name, function_upsert.name)

    # Get names of functions that will be upserted
    upsert_function_names = {func_upsert.name for func_upsert in functions_upsert}

    # Handle removal of previous functions if requested
    if remove_previous:
        existing_functions = get_user_functions_by_app_name(db_session, app_name, org_id)
        functions_to_remove = [func for func in existing_functions if func.name not in upsert_function_names]

        for func_to_remove in functions_to_remove:
            logger.debug(f"Removing previous function: {func_to_remove.name}")
            db_session.delete(func_to_remove)

    functions = []
    for function_upsert in functions_upsert:
        # Check if function already exists
        existing_function = get_user_function_by_name(db_session, function_upsert.name, org_id)

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
                org_id=org_id,
            )
            db_session.add(function)
            functions.append(function)

    db_session.flush()
    return functions


def update_user_functions(
        db_session: Session,
        function_upsert: FunctionUpsert,
        org_id: UUID,
) -> Function:
    """
    Update user functions for a specific organization.
    """
    logger.debug(f"Updating user function, functions_upsert={function_upsert.name}, org_id={org_id}")

    function = get_user_function_by_name(db_session, function_upsert.name, org_id)
    if not function:
        logger.error(f"User function={function_upsert.name} does not exist for org_id={org_id}")
        raise FunctionNotFound(f"User function={function_upsert.name} does not exist on your organization")

    function_data = function_upsert.model_dump(mode="json", exclude_unset=True)
    for field, value in function_data.items():
        setattr(function, field, value)

    db_session.flush()

    return function
