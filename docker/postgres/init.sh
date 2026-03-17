#!/bin/bash
# Runs on first DB creation only (docker-entrypoint-initdb.d)
# Extensions and schema are handled by backend migrations,
# but this ensures the DB is ready to accept connections cleanly.
set -e

echo "=== Oceana: Postgres init script ==="
echo "Database '$POSTGRES_DB' created for user '$POSTGRES_USER'"
echo "Backend migrations will handle schema + seed data on startup."
