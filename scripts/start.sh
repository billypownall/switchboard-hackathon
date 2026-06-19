#!/bin/sh
set -e

# Apply any pending migrations against the mounted SQLite volume.
npx prisma migrate deploy

# Railway (and most container hosts) inject PORT. Default to 3000 locally.
export PORT="${PORT:-3000}"

# The reproduction agent navigates the app from inside this same container,
# so point it at the loopback address on whatever port we actually bind to.
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:${PORT}}"

exec npx next start -p "${PORT}"
