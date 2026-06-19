---
name: "M2 — Reproduction agent (happy path)"
overview: "Wire Playwright MCP as a stdio child process via the Vercel AI SDK, run a multi-step generateText tool loop that drives the browser, force a structured verdict via a record_outcome tool, persist trace/screenshots/console, and render evidence on the dashboard."
todos:
  - id: deps
    content: "Install @playwright/mcp and chromium; choose a stronger reproduction model."
    status: pending
  - id: schema
    content: "Extend Report with reproStatus, reproTrace, reproOutcome, screenshots, consoleOutput; migrate."
    status: pending
  - id: reproduce-lib
    content: "Add lib/reproduce.ts: experimental_createMCPClient (stdio) + Experimental_StdioMCPTransport, generateText loop with mcpTools + record_outcome, stopWhen stepCountIs, onStepFinish trace, mcp.close in finally."
    status: pending
  - id: system-prompt
    content: "Write the reproduction system prompt: base URL + route map + triage output + snapshot/self-correct tactics."
    status: pending
  - id: route
    content: "Add async POST /api/reports/[id]/reproduce (nodejs runtime, maxDuration) writing reproStatus and persisting outcome/screenshots/console."
    status: pending
  - id: dashboard
    content: "Add Reproduce button on bug rows; detail view with trace timeline, screenshots, console errors, verdict."
    status: pending
isProject: false
---

# M2 — Reproduction agent (happy path)

**Unlocks:** for bug-classified reports, a real browser attempts reproduction end-to-end and shows a trace + screenshots.

Prereq: [M1](02-m1-triage-agent.plan.md). See [00-overview.plan.md](00-overview.plan.md) for shared decisions.

## Scope

- Wire Playwright MCP as a stdio child process via the Vercel AI SDK.
- Run a multi-step `generateText` tool loop that drives the browser.
- Force a structured verdict via a local `record_outcome` tool.
- Persist trace, screenshots, and console output; render them on the dashboard.

## Setup

```bash
npm i @playwright/mcp
npx playwright install chromium
```

A stronger model than triage is recommended for the reproduction agent.

## Schema additions (`prisma/schema.prisma`)

Add to `Report`:

```prisma
  reproStatus    String?   // running | reproduced | not_reproduced | error
  reproTrace     String?   // JSON: array of steps from onStepFinish
  reproOutcome   String?   // JSON: record_outcome payload
  screenshots    String?   // JSON: array of file paths
  consoleOutput  String?   // JSON: captured console messages
```

Run `npx prisma migrate dev --name reproduction`.

## Reproduction agent (`lib/reproduce.ts`)

```ts
const mcp = await experimental_createMCPClient({
  transport: new Experimental_StdioMCPTransport({
    command: 'npx',
    args: ['-y','@playwright/mcp@latest','--headless','--output-dir', outDir],
  }),
});
const mcpTools = await mcp.tools();

const record_outcome = tool({
  description: 'Finalize the reproduction attempt. Call this exactly once at the end.',
  parameters: z.object({
    reproduced: z.boolean(),
    confidence: z.number().min(0).max(1),
    narrative: z.string(),
    observedVsExpected: z.string(),
  }),
  execute: async (payload) => { /* persisted by caller */ return payload; },
});

const result = await generateText({
  model,
  system: reproSystemPrompt,                 // app desc + routes + triage output + tactics
  prompt: 'Reproduce the bug described in the triage report.',
  tools: { ...mcpTools, record_outcome },
  stopWhen: stepCountIs(30),
  onStepFinish: persistStepToTrace,          // live trace for dashboard
});

await mcp.close();
```

Always wrap the loop so `mcp.close()` runs in a `finally` block (M3 hardens this). Use a unique `outDir` per report, e.g. `./repro-output/<reportId>`.

### System prompt design

- Base URL `http://localhost:3000` + the route map from `lib/appContext.ts`.
- The triage `reproSteps`, `affectedArea`, and `summary`.
- Tactics: "call `browser_snapshot` before every interaction and after each action", "use accessibility refs from the latest snapshot", "on the failing state call `browser_take_screenshot` and `browser_console_messages`", "self-correct if a ref is missing", "finish by calling `record_outcome`".

## Wiring

- `app/api/reports/[id]/reproduce/route.ts` — `export const runtime = 'nodejs'`, set `maxDuration`. `POST` sets `reproStatus='running'` and kicks off `reproduce()` as an async task (do not block the response on the full run).
- `onStepFinish` appends `{ tool, args, resultSummary, ts }` to `reproTrace`.
- On completion, persist `reproOutcome`, copy screenshot paths from `outDir` into `screenshots`, and store `consoleOutput`.

## Dashboard

- Bug rows get a "Reproduce" button.
- Detail view renders the step-by-step trace timeline, screenshot thumbnails, console errors, and the `record_outcome` verdict.
- While `reproStatus='running'`, show a spinner (polling refinement comes in M3).

## Risks introduced

- MCP child-process lifecycle / zombie browsers (mitigate with `finally { mcp.close() }`).
- Long-run timeouts on the route (async + `maxDuration`).
- Accessibility-snapshot context bloat (depth-limited snapshots).
- Agent failing to reach the failing state via refs.

## Estimate

~3.5h for a 2-person team.
