import click

from aci.cli.commands import (
    billing,
    create_project,
    delete_app,
    encryption_key,
    get_app,
    rename_app,
    upsert_app,
    upsert_functions,
)
from aci.common.logging_setup import setup_logging


@click.group(context_settings={"help_option_names": ["-h", "--help"]})
def cli() -> None:
    """AIPO CLI Tool"""
    setup_logging()


# Add commands to the group
cli.add_command(create_project.create_project)
cli.add_command(upsert_app.upsert_app)
cli.add_command(get_app.get_app)
cli.add_command(rename_app.rename_app)
cli.add_command(delete_app.delete_app)
cli.add_command(upsert_functions.upsert_functions)
cli.add_command(billing.populate_subscription_plans)
cli.add_command(encryption_key.encryption_key)

if __name__ == "__main__":
    cli()
