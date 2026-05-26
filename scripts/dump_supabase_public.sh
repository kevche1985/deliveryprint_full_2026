#!/usr/bin/env bash
set -eo pipefail

# Required env vars:
#   SUPABASE_DB_PASSWORD, SUPABASE_POOLER_HOST, SUPABASE_POOLER_USER
# Optional: SUPABASE_POOLER_PORT (default 6543), SUPABASE_DBNAME (default postgres), OUTPUT

require() {
  local name="$1"
  local val="${!name:-}"
  if [[ -z "$val" ]]; then
    echo "Missing required env var: $name" >&2
    exit 1
  fi
}

require SUPABASE_DB_PASSWORD
require SUPABASE_POOLER_HOST
require SUPABASE_POOLER_USER

SUPABASE_POOLER_PORT="${SUPABASE_POOLER_PORT:-6543}"
SUPABASE_DBNAME="${SUPABASE_DBNAME:-postgres}"
OUTPUT="${OUTPUT:-supabase_public_schema.sql}"

PGPASSWORD="$SUPABASE_DB_PASSWORD" pg_dump \
  -h "$SUPABASE_POOLER_HOST" \
  -p "$SUPABASE_POOLER_PORT" \
  -U "$SUPABASE_POOLER_USER" \
  -d "$SUPABASE_DBNAME" \
  -n public \
  --no-owner --no-privileges --format=plain \
  -f "$OUTPUT"
