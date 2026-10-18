#!/usr/bin/env bash
# Cloud Agent start — runs on every boot. Must be idempotent and return.
set -euo pipefail

PG_VERSION="16"
PG_CLUSTER="main"

echo "[start] Ensuring the PostgreSQL cluster is running..."
if ! pg_lsclusters -h 2>/dev/null | awk '{print $4}' | grep -q "online"; then
  sudo pg_ctlcluster "${PG_VERSION}" "${PG_CLUSTER}" start || true
fi

# Wait until PostgreSQL accepts connections, then return.
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then
    echo "[start] PostgreSQL is ready."
    exit 0
  fi
  sleep 1
done

echo "[start] WARNING: PostgreSQL did not become ready in time." >&2
exit 0
