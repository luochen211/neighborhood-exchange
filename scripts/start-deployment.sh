#!/bin/sh
set -eu
# Seed only on the first deployment; restarts must preserve user state.
if [ ! -e "${DATABASE_URL:-/data/neighborhood.db}" ]; then
  node apps/api/dist/db/cli.js migrate
  if [ "${DEMO_MODE:-false}" = "true" ]; then
    node apps/api/dist/db/cli.js seed
  fi
fi
exec node apps/api/dist/server.js
