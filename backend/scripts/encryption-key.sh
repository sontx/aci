#!/bin/bash

set -euo pipefail

function usage() {
  cat <<EOF
Usage: $0 [command] [options]

Commands:
  generate              Generate a new encryption key (default)
  reencrypt-to-current  Re-encrypt all encrypted data using the current encryption key

Options for generate:
  -h, --help      Display this help message
  -s, --key-size  Key size in bytes (16=AES-128, 24=AES-192, 32=AES-256). Default is 32.
  -o, --output    Output format: console (default), json, env

Options for reencrypt-to-current:
  -h, --help        Display this help message
  -b, --batch-size  Number of records to process in each batch (default: 50)
  -c, --commit-every Commit changes every N records (default: 1000)
EOF
}

COMMAND="generate"
KEY_SIZE="32"
OUTPUT_FORMAT="console"
BATCH_SIZE="50"
COMMIT_EVERY="1000"

parse_arguments() {
  # Check if first argument is a command
  if [[ $# -gt 0 ]] && [[ "$1" == "generate" || "$1" == "reencrypt-to-current" ]]; then
    COMMAND="$1"
    shift
  fi

  while [[ $# -gt 0 ]]; do
    case $1 in
      -s|--key-size)
        if [[ "$COMMAND" != "generate" ]]; then
          echo "Error: --key-size is only valid for generate command"
          usage
          exit 1
        fi
        if [[ -z "${2:-}" ]]; then
          echo "Error: --key-size requires a value"
          usage
          exit 1
        fi
        if [[ "$2" != "16" && "$2" != "24" && "$2" != "32" ]]; then
          echo "Error: key-size must be 16, 24, or 32"
          usage
          exit 1
        fi
        KEY_SIZE="$2"
        shift 2
        ;;
      -o|--output)
        if [[ "$COMMAND" != "generate" ]]; then
          echo "Error: --output is only valid for generate command"
          usage
          exit 1
        fi
        if [[ -z "${2:-}" ]]; then
          echo "Error: --output requires a value"
          usage
          exit 1
        fi
        if [[ "$2" != "console" && "$2" != "json" && "$2" != "env" ]]; then
          echo "Error: output format must be console, json, or env"
          usage
          exit 1
        fi
        OUTPUT_FORMAT="$2"
        shift 2
        ;;
      -b|--batch-size)
        if [[ "$COMMAND" != "reencrypt-to-current" ]]; then
          echo "Error: --batch-size is only valid for reencrypt-to-current command"
          usage
          exit 1
        fi
        if [[ -z "${2:-}" ]]; then
          echo "Error: --batch-size requires a value"
          usage
          exit 1
        fi
        if ! [[ "$2" =~ ^[0-9]+$ ]] || [[ "$2" -le 0 ]]; then
          echo "Error: batch-size must be a positive integer"
          usage
          exit 1
        fi
        BATCH_SIZE="$2"
        shift 2
        ;;
      -c|--commit-every)
        if [[ "$COMMAND" != "reencrypt-to-current" ]]; then
          echo "Error: --commit-every is only valid for reencrypt-to-current command"
          usage
          exit 1
        fi
        if [[ -z "${2:-}" ]]; then
          echo "Error: --commit-every requires a value"
          usage
          exit 1
        fi
        if ! [[ "$2" =~ ^[0-9]+$ ]] || [[ "$2" -le 0 ]]; then
          echo "Error: commit-every must be a positive integer"
          usage
          exit 1
        fi
        COMMIT_EVERY="$2"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown argument: $1"
        usage
        exit 1
        ;;
    esac
  done
}

generate_encryption_key() {
  echo "Generating encryption key with size: $KEY_SIZE bytes..." >&2

  # Call the CLI command and capture output
  local output
  output=$(python -m aci.cli encryption-key generate-key --key-size "$KEY_SIZE" 2>/dev/null)

  if [[ $? -ne 0 ]]; then
    echo "Error: Failed to generate encryption key" >&2
    exit 1
  fi

  # Parse the output to extract key information
  local key_id
  local key_hex
  local key_size_info

  key_id=$(echo "$output" | grep "Key ID:" | sed 's/Key ID: //')
  key_hex=$(echo "$output" | grep "Key (hex):" | sed 's/Key (hex): //')
  key_size_info=$(echo "$output" | grep "Key size:" | sed 's/Key size: //')

  case $OUTPUT_FORMAT in
    console)
      echo "$output"
      ;;
    json)
      cat <<EOF
{
  "key_id": "$key_id",
  "key_hex": "$key_hex",
  "key_size": "$KEY_SIZE",
  "algorithm": "AES-$((KEY_SIZE * 8))"
}
EOF
      ;;
    env)
      cat <<EOF
ENCRYPTION_KEY_ID="$key_id"
ENCRYPTION_KEY="$key_hex"
ENCRYPTION_KEY_SIZE="$KEY_SIZE"
ENCRYPTION_ALGORITHM="AES-$((KEY_SIZE * 8))"
EOF
      ;;
  esac
}

reencrypt_to_current() {
  echo "Re-encrypting all data to current key..." >&2
  echo "Using batch size: $BATCH_SIZE, commit every: $COMMIT_EVERY records" >&2

  # Call the CLI command with options
  local output
  output=$(python -m aci.cli encryption-key reencrypt-to-current --batch-size "$BATCH_SIZE" --commit-every "$COMMIT_EVERY" 2>&1)

  if [[ $? -ne 0 ]]; then
    echo "Error: Failed to re-encrypt data to current key" >&2
    echo "$output" >&2
    exit 1
  fi

  echo "$output"
}

# Execute the script functions
parse_arguments "$@"

case $COMMAND in
  generate)
    generate_encryption_key
    ;;
  reencrypt-to-current)
    reencrypt_to_current
    ;;
  *)
    echo "Unknown command: $COMMAND"
    usage
    exit 1
    ;;
esac
