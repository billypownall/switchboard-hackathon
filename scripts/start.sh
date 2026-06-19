#!/bin/sh
set -e

# Apply any pending migrations against the mounted SQLite volume.
npx prisma migrate deploy

# Railway (and most container hosts) inject PORT. Default to 3000 locally.
export PORT="${PORT:-3000}"

# The reproduction agent needs a URL it can navigate to. Prefer an explicit
# override, then Railway's public domain, then loopback for local runs.
if [ -z "${NEXT_PUBLIC_APP_URL}" ]; then
  if [ -n "${RAILWAY_PUBLIC_DOMAIN}" ]; then
    export NEXT_PUBLIC_APP_URL="https://${RAILWAY_PUBLIC_DOMAIN}"
  else
    export NEXT_PUBLIC_APP_URL="http://localhost:${PORT}"
  fi
fi

echo "[start] serving on port ${PORT}; agent base URL: ${NEXT_PUBLIC_APP_URL}"

exec npx next start -p "${PORT}"
