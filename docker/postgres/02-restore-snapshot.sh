#!/bin/bash
# Runs on first DB creation only (docker-entrypoint-initdb.d)
# Restores the snapshot if it exists. Backend migrations run first (on backend startup),
# but this pre-loads data so the environment is ready immediately.
set -e

SNAPSHOT="/docker-entrypoint-initdb.d/snapshot.sql"

if [ -f "$SNAPSHOT" ]; then
    echo "=== Oceana: Restoring DB snapshot ==="
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$SNAPSHOT" || true
    echo "=== Oceana: Snapshot restored ==="
else
    echo "=== Oceana: No snapshot found, starting fresh ==="
fi
