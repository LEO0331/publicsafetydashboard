# Deployment Guide

## Recommended Target

Use a container host with persistent disk, such as Fly.io, Render, Railway, a VPS, or a school-managed server. This app uses SQLite plus local PDF/import artifacts, so serverless-only platforms without persistent filesystem storage are not the best first target.

## Required Environment Variables

```bash
ADMIN_TOKEN="<strong-secret>"
DATABASE_URL="file:./dev.db"
SQLITE_PATH="./drizzle/dev.db"
```

`ADMIN_TOKEN` must not be `change-me`; the server rejects that placeholder.

## GitHub Actions

Two workflows are included:

- `.github/workflows/ci.yml`: lint, typecheck, unit/integration tests, Playwright e2e, and Lighthouse CI.
- `.github/workflows/deploy.yml`: builds and publishes a Docker image to GitHub Container Registry after CI passes on `main`, or manually through `workflow_dispatch`.

The complete app needs Next.js API routes, SQLite, Python PDF import scripts, uploads, logs, and server-side admin endpoints, so deploy it as a Docker/Node service.

## Docker / Full App Deployment

The published image is tagged as:

```text
ghcr.io/<owner>/<repo>:latest
ghcr.io/<owner>/<repo>:<commit-sha>
```

The workflow lowercases `<owner>/<repo>` before publishing because GHCR image names must be lowercase.

The Docker image installs `build-essential` because `better-sqlite3` is a native Node addon. When no prebuilt binary exists for the Node version in the base image, `npm ci` falls back to `node-gyp` compilation and requires `make`, `gcc`, and `g++`. If GitHub Actions fails with `gyp ERR! stack Error: not found: make`, keep the build toolchain in the Dockerfile.

### GitHub Deployment Flow

1. Push or merge to `main`.
2. Wait for the `CI` workflow to pass.
3. The `Build and Publish Image` workflow publishes the Docker image to GHCR.
4. Open the deploy workflow summary and copy the published image tag.
5. Configure your runtime host to pull that image.
6. Set `ADMIN_TOKEN` and mount persistent storage for `/app/drizzle`, `/app/data`, and `/app/logs`.
7. Run `npm run db:migrate` once before serving traffic, or use your host's release-command mechanism.

If the package is private and your deployment host pulls directly from GHCR, create a GitHub token with package read access and configure the host's registry credentials.

## Render Deployment

The live app can run on Render as a Docker web service:

```text
https://publicsafetydashboard.onrender.com
```

Render free instances can run the frontend and backend together, but they do not support persistent disks. Imported SQLite data, uploaded PDFs, and logs can disappear after redeploys, restarts, or idle spin-downs. Use a paid Render service with a persistent disk for durable data.

Recommended Render settings:

```text
Runtime: Docker
Branch: main
Instance type: Free for demo, paid for durable storage
ADMIN_TOKEN: <strong random secret>
SQLITE_PATH: ./drizzle/dev.db
DATABASE_URL: file:./drizzle/dev.db
NODE_ENV: production
Start Command: leave blank; use the Dockerfile CMD
```

The Docker image starts with:

```bash
sh scripts/start-render.sh
```

That script creates local data directories, runs `npm run db:migrate`, seeds the bundled starter dataset if the records table is empty, then starts Next.js on Render's `$PORT`.

If a Render deploy fails with status `127`, check the Render service settings and remove any custom Start Command. A command override bypasses the Dockerfile `CMD` and can fail if Render parses the shell command differently.

For a paid durable deployment, attach persistent storage for:

```text
/app/drizzle
/app/data
/app/logs
```

## Local Docker Run

```bash
docker build -t public-safety-dashboard .
docker run --rm -p 3000:3000 \
  -e ADMIN_TOKEN="<strong-secret>" \
  -e SQLITE_PATH="./drizzle/dev.db" \
  -v "$PWD/drizzle:/app/drizzle" \
  -v "$PWD/data:/app/data" \
  -v "$PWD/logs:/app/logs" \
  public-safety-dashboard
```

Run migrations before first use:

```bash
docker run --rm \
  -e SQLITE_PATH="./drizzle/dev.db" \
  -v "$PWD/drizzle:/app/drizzle" \
  public-safety-dashboard npm run db:migrate
```

## Render / Railway / Fly.io Pattern

1. Connect the GitHub repository.
2. Use the Dockerfile build.
3. Mount persistent storage for:
   - `/app/drizzle`
   - `/app/data`
   - `/app/logs`
4. Set `ADMIN_TOKEN`.
5. Run `npm run db:migrate` once during setup or as a release command if the platform supports it.
6. Start with the default Docker command.

## Vercel Note

Vercel can run many Next.js apps well, but this project is local-first with SQLite, Python PDF parsing, uploads, and import logs. Use Vercel only after moving persistence and ingestion to external services.
