#!/bin/sh
set -eu

mkdir -p drizzle data logs

npm run db:migrate
python3 scripts/seed_initial_data.py --if-empty
python3 scripts/seed_geocode_cache.py

exec npm run start -- -H 0.0.0.0 -p "${PORT:-3000}"
