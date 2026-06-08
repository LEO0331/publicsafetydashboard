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

The published image is tagged as:

```text
ghcr.io/<owner>/<repo>:latest
ghcr.io/<owner>/<repo>:<commit-sha>
```

The workflow lowercases `<owner>/<repo>` before publishing because GHCR image names must be lowercase.

### GitHub Deployment Flow

1. Push or merge to `main`.
2. Wait for the `CI` workflow to pass.
3. The `Build and Publish Image` workflow publishes the Docker image to GHCR.
4. Open the deploy workflow summary and copy the published image tag.
5. Configure your runtime host to pull that image.
6. Set `ADMIN_TOKEN` and mount persistent storage for `/app/drizzle`, `/app/data`, and `/app/logs`.
7. Run `npm run db:migrate` once before serving traffic, or use your host's release-command mechanism.

If the package is private and your deployment host pulls directly from GHCR, create a GitHub token with package read access and configure the host's registry credentials.

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
