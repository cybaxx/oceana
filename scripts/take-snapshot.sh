#!/usr/bin/env bash
# Take a DB snapshot from the running postgres container.
# Usage: ./scripts/take-snapshot.sh
set -euo pipefail

cd "$(dirname "$0")/.."

docker exec oceana-postgres-1 pg_dump -U oceana --clean --if-exists oceana > docker/postgres/snapshot.sql
echo "Snapshot saved to docker/postgres/snapshot.sql ($(wc -l < docker/postgres/snapshot.sql) lines)"
