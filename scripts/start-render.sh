#!/bin/sh
set -eu

mkdir -p drizzle data logs

npm run db:migrate

exec npm run start -- -H 0.0.0.0 -p "${PORT:-3000}"
