import json
from pathlib import Path
from uuid import UUID

import click
from deepdiff import DeepDiff
from jinja2 import Environment, FileSystemLoader, Template, DebugUndefined
from rich.console import Console
from sqlalchemy.ext.asyncio import AsyncSession

from aci.cli import config
from aci.cli.async_command import async_command
from aci.common import utils
from aci.common.db import crud
from aci.common.db.sql_models import App
from aci.common.schemas.app import AppUpsert

console = Console()


@async_command()
@click.option(
    "--app-file",
    "app_file",
    required=True,
    type=click.Path(exists=True, path_type=Path),
    help="Path to the app JSON file",
)
@click.option(
    "--secrets-file",
    "secrets_file",
    type=click.Path(exists=True, path_type=Path),
    default=None,
    show_default=True,
    help="Path to the secrets JSON file",
)
@click.option(
    "--skip-dry-run",
    is_flag=True,
    help="Provide this flag to run the command and apply changes to the database",
)
async def upsert_app(app_file: Path, secrets_file: Path | None, skip_dry_run: bool) -> UUID:
    """
    Insert or update an App in the DB from a JSON file, optionally injecting secrets.
    If an app with the given name already exists, performs an update; otherwise, creates a new app.
    For changing the app name of an existing app, use the <PLACEHOLDER> command.
    """
    async with utils.create_db_async_session(config.DB_FULL_URL) as db_session:
        return await upsert_app_helper(db_session, app_file, secrets_file, skip_dry_run)


async def upsert_app_helper(
        db_session: AsyncSession, app_file: Path, secrets_file: Path | None, skip_dry_run: bool
) -> UUID:
    # Load secrets if provided
    secrets = {}
    if secrets_file:
        with open(secrets_file) as f:
            secrets = json.load(f)
    # Render the template in-memory and load JSON data
    try:
        rendered_content = _render_template_to_string(app_file, secrets)
    except Exception as e:
        console.print(f"[bold red]Error rendering template, failed to upsert app: {e}[/bold red]")
        raise e

    app_upsert = AppUpsert.model_validate(json.loads(rendered_content))
    existing_app = await crud.apps.get_app(
        db_session, app_upsert.name, public_only=False, active_only=False
    )
    if existing_app is None:
        return await create_app_helper(db_session, app_upsert, skip_dry_run)
    else:
        return await update_app_helper(
            db_session,
            existing_app,
            app_upsert,
            skip_dry_run,
        )


async def create_app_helper(db_session: AsyncSession, app_upsert: AppUpsert, skip_dry_run: bool) -> UUID:
    # Create the app entry in the database
    app = await crud.apps.create_app(db_session, app_upsert)

    if not skip_dry_run:
        console.rule(f"Provide [bold green]--skip-dry-run[/bold green] to create App={app.name}")
        await db_session.rollback()
    else:
        await db_session.commit()
        console.rule(f"Created App={app.name}")

    return app.id


async def update_app_helper(
        db_session: AsyncSession, existing_app: App, app_upsert: AppUpsert, skip_dry_run: bool
) -> UUID:
    """
    Update an existing app in the database.
    If fields used for generating embeddings (name, display_name, provider, description, categories) are changed,
    re-generates the app embedding.
    """
    existing_app_upsert = AppUpsert.model_validate(existing_app, from_attributes=True)
    if existing_app_upsert == app_upsert:
        console.rule(f"App={existing_app.name} exists and is up to date")
        return existing_app.id
    else:
        console.rule(f"App={existing_app.name} exists and will be updated")

    # Update the app in the database with the new fields and optional embedding update
    updated_app = await crud.apps.update_app(db_session, existing_app, app_upsert)

    diff = DeepDiff(existing_app_upsert.model_dump(), app_upsert.model_dump(), ignore_order=True)

    if not skip_dry_run:
        console.rule(
            f"Provide [bold green]--skip-dry-run[/bold green] to update App={existing_app.name} with the following changes:"
        )
        await db_session.rollback()
    else:
        await db_session.commit()
        console.rule(f"Updated App={existing_app.name}")

    console.print(diff.pretty())

    return updated_app.id


def _render_template_to_string(template_path: Path, secrets: dict[str, str]) -> str:
    """
    Render a Jinja2 template with the provided secrets and return as string.
    """
    env = Environment(
        loader=FileSystemLoader(template_path.parent),
        undefined=DebugUndefined,  # Raise error if any placeholders are missing
        autoescape=False,
        trim_blocks=True,
        lstrip_blocks=True,
    )

    template: Template = env.get_template(template_path.name)
    rendered_content: str = template.render(secrets)
    return rendered_content
