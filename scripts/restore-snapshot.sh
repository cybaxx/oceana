#!/usr/bin/env bash
# Restore DB from snapshot into a running postgres container.
# Usage: ./scripts/restore-snapshot.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if ! docker compose ps postgres | grep -q running; then
    echo "Starting postgres..."
    docker compose up -d postgres
    sleep 3
fi

echo "Restoring snapshot..."
docker exec -i oceana-postgres-1 psql -U oceana -d oceana < docker/postgres/snapshot.sql

echo "Done. Start everything with: docker compose up -d"
