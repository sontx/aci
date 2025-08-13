import os
import datetime

import click
from rich.console import Console
from rich.progress import Progress
from sqlalchemy import text
from sqlalchemy.orm import Session

from aci.common import encryption, utils
from aci.cli import config
from aci.common.db.sql_models import APIKey, App, AppConfiguration, LinkedAccount

console = Console()


def generate_key_id_and_key(key_size: int = 32) -> tuple[str, str]:
    """
    Generate a new key_id and AES key.

    key_size: length in bytes (16 = AES-128, 24 = AES-192, 32 = AES-256)
    Returns: (key_id, key_hex)
    """
    if key_size not in (16, 24, 32):
        raise ValueError("key_size must be 16, 24, or 32 bytes")

    # Key ID format: YYYY-MM-DD
    key_id = datetime.date.today().isoformat()

    # Generate a secure random key and encode in hex
    key_hex = os.urandom(key_size).hex()

    return key_id, key_hex


def validate_key_hex(key_hex: str) -> tuple[int, str]:
    """
    Validate a hex-encoded encryption key and return its size and normalized format.

    Args:
        key_hex: The hex-encoded key string

    Returns:
        Tuple of (key_size_bytes, normalized_key_hex)

    Raises:
        ValueError: If the key is invalid
    """
    # Remove any whitespace and convert to lowercase
    key_hex = key_hex.strip().lower()

    # Check if it's valid hex
    try:
        key_bytes = bytes.fromhex(key_hex)
    except ValueError:
        raise ValueError("Key must be a valid hexadecimal string")

    # Check if it's a valid AES key size
    key_size = len(key_bytes)
    if key_size not in (16, 24, 32):
        raise ValueError(f"Key size must be 16, 24, or 32 bytes (got {key_size} bytes)")

    return key_size, key_hex


@click.group()
def encryption_key():
    """Encryption key management commands"""
    pass


@encryption_key.command("generate-key")
@click.option(
    "--key-size",
    "key_size",
    type=click.Choice(["16", "24", "32"]),
    default="32",
    help="Key size in bytes (16=AES-128, 24=AES-192, 32=AES-256). Default is 32.",
)
def generate_key(key_size: str):
    """Generate and display a new encryption key"""
    try:
        key_id, key_hex = generate_key_id_and_key(int(key_size))

        console.print(f"[bold green]Encryption Key Generated Successfully[/bold green]")
        console.print(f"Key ID: {key_id}")
        console.print(f"Key (hex): {key_hex}")
        console.print(f"Key size: {key_size} bytes (AES-{int(key_size) * 8})")

    except ValueError as e:
        console.print(f"[bold red]Error:[/bold red] {e}")
        raise click.Abort()


@encryption_key.command("reencrypt-to-current")
@click.option(
    "--batch-size",
    type=int,
    default=50,
    help="Number of records to process in each batch (default: 50)"
)
@click.option(
    "--commit-every",
    type=int,
    default=1000,
    help="Commit changes every N records (default: 1000)"
)
def reencrypt_to_current(batch_size: int, commit_every: int):
    """Re-encrypt all encrypted data using the current encryption key

    This command will:
    1. Find all encrypted data in the database
    2. Re-encrypt it using the current encryption key by reading and writing back each field
    3. Update the database with the re-encrypted data in batches
    4. Use cursor-based pagination for better performance on large datasets
    5. Commit periodically to avoid long-running transactions

    Tables processed:
    - api_keys (key field)
    - apps (security_schemes, default_security_credentials_by_scheme fields)
    - app_configurations (security_scheme_overrides field)
    - linked_accounts (security_credentials field)
    """
    console.print(f"[bold blue]Re-encryption to Current Key Process Started[/bold blue]")
    current_key_id = encryption._keystore.current_key_id
    console.print(f"Current key ID: {current_key_id}")
    console.print(f"Batch size: {batch_size}, Commit every: {commit_every} records")

    def process_entity_batch(session, entity_class, entity_name, encrypted_fields, progress_task, progress):
        """Process a single entity type with offset-based pagination"""
        total_processed = 0
        commit_counter = 0

        # Get total count for progress tracking
        total_count = session.query(entity_class).count()
        progress.update(progress_task, total=total_count)

        # Use offset-based pagination for simplicity and reliability
        offset = 0

        while offset < total_count:
            # Query batch using offset-based pagination
            query = session.query(entity_class).order_by(entity_class.id).offset(offset).limit(batch_size)
            batch = query.all()

            if not batch:
                break

            # Process each entity in the batch
            for entity in batch:
                try:
                    # Process each encrypted field
                    for field_name in encrypted_fields:
                        field_value = getattr(entity, field_name, None)
                        if field_value is not None:
                            # For dict fields, check if not empty
                            if isinstance(field_value, dict) and not field_value:
                                continue
                            # Read and set back to trigger re-encryption
                            setattr(entity, field_name, field_value)

                    session.add(entity)
                    total_processed += 1
                    commit_counter += 1

                    # Commit periodically to avoid long-running transactions
                    if commit_counter >= commit_every:
                        session.commit()
                        console.print(f"[dim]Committed {commit_counter} {entity_name} records[/dim]")
                        commit_counter = 0

                except Exception as e:
                    console.print(f"[yellow]Warning: Could not process {entity_name} {entity.id}: {e}[/yellow]")

                # Update progress
                progress.update(progress_task, completed=total_processed)

            # Move to next batch
            offset += batch_size

        # Final commit for remaining records
        if commit_counter > 0:
            session.commit()
            console.print(f"[dim]Final commit: {commit_counter} {entity_name} records[/dim]")

        return total_processed

    total_processed_overall = 0

    try:
        with utils.create_db_session(config.DB_FULL_URL) as session:
            # Set a reasonable statement timeout for large operations
            session.execute(text("SET statement_timeout = '30min'"))

            with Progress() as progress:
                # Process API Keys
                console.print("\n[bold cyan]Processing API Keys...[/bold cyan]")
                api_keys_task = progress.add_task("API Keys", total=None)
                processed = process_entity_batch(
                    session, APIKey, "API Key", ["key"], api_keys_task, progress
                )
                total_processed_overall += processed
                console.print(f"API Keys: {processed} processed")

                # Process Apps
                console.print("\n[bold cyan]Processing Apps...[/bold cyan]")
                apps_task = progress.add_task("Apps", total=None)
                processed = process_entity_batch(
                    session, App, "App",
                    ["security_schemes", "default_security_credentials_by_scheme"],
                    apps_task, progress
                )
                total_processed_overall += processed
                console.print(f"Apps: {processed} processed")

                # Process App Configurations
                console.print("\n[bold cyan]Processing App Configurations...[/bold cyan]")
                app_configs_task = progress.add_task("App Configurations", total=None)
                processed = process_entity_batch(
                    session, AppConfiguration, "App Configuration",
                    ["security_scheme_overrides"],
                    app_configs_task, progress
                )
                total_processed_overall += processed
                console.print(f"App Configurations: {processed} processed")

                # Process Linked Accounts
                console.print("\n[bold cyan]Processing Linked Accounts...[/bold cyan]")
                linked_accounts_task = progress.add_task("Linked Accounts", total=None)
                processed = process_entity_batch(
                    session, LinkedAccount, "Linked Account",
                    ["security_credentials"],
                    linked_accounts_task, progress
                )
                total_processed_overall += processed
                console.print(f"Linked Accounts: {processed} processed")

        console.print(f"\n[bold green]Re-encryption completed successfully![/bold green]")
        console.print(f"Total records processed: {total_processed_overall}")
        console.print(f"Batch size used: {batch_size}")
        console.print(f"Commit frequency: every {commit_every} records")
        console.print(f"All encrypted data is now using key ID: {current_key_id}")

    except Exception as e:
        console.print(f"[bold red]Re-encryption failed:[/bold red] {e}")
        console.print(f"[bold yellow]Note: Some records may have been successfully re-encrypted before the failure.[/bold yellow]")
        raise click.Abort()
