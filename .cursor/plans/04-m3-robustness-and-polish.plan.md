---
name: M3 — Robustness, ticket filing, polish
overview: Harden the reproduction loop, add success-path ticket filing and failure-path analysis, live dashboard progress, and optional Docker + demo seed script for a demo-grade build.
todos:
  - id: harden
    content: "Harden loop: try/finally mcp.close, step cap + wall-clock timeout, stuck-detection retry, per-report output dirs + cleanup."
    status: pending
  - id: tickets
    content: Add ticketStatus/ticketId/failureReason; file mock ticket + evidence on success; escalate + failure-analysis card on failure; migrate.
    status: pending
  - id: live-progress
    content: Dashboard polling/SSE while reproStatus=running, rendering trace steps as they land.
    status: pending
  - id: docker-demo
    content: Optional docker-compose for app + agent; demo seed script opening all 3 bug + 2 feature scenarios.
    status: pending
isProject: false
---

# M3 — Robustness, evidence, ticket filing, polish

**Unlocks:** demo-grade reliability — self-correction, failure analysis, filed tickets, live progress, optional Docker.

Prereq: [M2](03-m2-reproduction-agent.plan.md). See [00-overview.plan.md](00-overview.plan.md) for shared decisions.

## Scope

- Harden the reproduction loop.
- Add success-path ticket filing and failure-path analysis.
- Add live progress on the dashboard.
- Optional Docker + a demo seed script.

## Loop hardening (`lib/reproduce.ts`)

- Wrap the run in `try/finally` and always call `mcp.close()`; guard against double-close.
- Hard caps: `stopWhen: stepCountIs(30)` plus a wall-clock timeout; abort and mark `reproStatus='error'` on overrun.
- Stuck heuristics: detect repeated identical tool calls / no DOM change across snapshots and inject a corrective system message before retrying.
- Per-report `--output-dir` (`./repro-output/<reportId>`); clean up old dirs.

## Ticket filing + failure analysis

Add to `Report`:

```prisma
  ticketStatus   String?   // filed | escalated
  ticketId       String?
  failureReason  String?
```

Run `npx prisma migrate ddev --name tickets`.

- **Success** (`record_outcome.reproduced === true`): create a `filed` ticket record (mock ticket id) with the triage summary + evidence (screenshots, console, trace) and render it as a ticket card on the dashboard.
- **Failure** (`reproduced === false`): set `ticketStatus='escalated'`, store the `record_outcome.narrative` as `failureReason`, and render a failure-analysis card explaining what the agent tried and why it could not reproduce.

## Live progress

- Dashboard polls `GET /api/reports/[id]` (or an SSE endpoint) while `reproStatus='running'`, rendering trace steps as they land via `onStepFinish`.

## Optional Docker + demo

- `docker-compose.yml` running the Next.js app + the agent locally; ensure `npx playwright install chromium` (or a Playwright base image) inside the container.
- A demo seed script that opens each of the 3 bug scenarios and the 2 feature-request scenarios for a clean live run.

## Risks introduced

- Race-condition bug flakiness under automation — rely on the deterministic `?fast=1` fallback for the live demo.
- Browser-binary install inside Docker (use the official Playwright image if it fights you).

## Estimate

~3h for a 2-person team.