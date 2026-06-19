# Deploying QuickCart + reproduction agent

This app is **not** serverless-friendly: the reproduction agent spawns the
Playwright MCP browser as a child process, runs a real Chromium binary, writes
screenshots to disk, and uses local SQLite. It needs an **always-on container
with a persistent volume**. The repo ships a `Dockerfile` (built on the official
Playwright image, Chromium preinstalled) so any container host works.

## Recommended: Railway

1. **Create the project**
   - Push this repo to GitHub.
   - In Railway: **New Project → Deploy from GitHub repo**, pick this repo.
   - Railway reads `railway.json` + `Dockerfile` automatically (no buildpack config needed).

2. **Add persistent volumes** (Service → Settings → Volumes)
   - Mount path `/data` — holds the SQLite database (`DATABASE_URL=file:/data/dev.db`).
   - Mount path `/app/public/repro-output` — holds reproduction screenshots so they survive redeploys.

3. **Set environment variables** (Service → Variables)
   - `OPENAI_API_KEY` — required for triage + the reproduction agent.
   - `JIRA_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY` — required to file bugs.
   - Optional: `REPRO_MODEL` (default `gpt-5.1`), `TRIAGE_MODEL` (default `gpt-5.1`),
     `REPRO_TIMEOUT_MS` (default `120000`).
   - **Do not** set `NEXT_PUBLIC_APP_URL` — `scripts/start.sh` points the agent at
     `http://localhost:$PORT` inside the container, which is correct since the app
     and agent run in the same process.

4. **Deploy.** On boot, `scripts/start.sh` runs `prisma migrate deploy` against the
   `/data` volume and then `next start` on Railway's injected `$PORT`. Railway gives
   you a public URL; open `/dashboard` for the console and use the **Feedback** widget.

### Notes
- Secrets are never baked into the image (`.env`/`.env.*` are in `.dockerignore`);
  always configure them in the Railway dashboard.
- The deterministic `?fast=1` checkout path keeps the duplicate-order race reliable
  under automation for a live demo.

## Alternatives
- **Render** — same model: New → Web Service → Docker, add a Disk for `/data` and
  `/app/public/repro-output`, set the same env vars.
- **Fly.io** — `fly launch` (reads the Dockerfile), `fly volumes create` for the two
  mount paths, `fly secrets set` for env vars.

## Local container parity
`docker compose up --build` runs the exact same image locally, reading env from
`.env.local` and using named volumes for `/data` and `/app/public/repro-output`.
