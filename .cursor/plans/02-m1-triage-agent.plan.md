---
name: M1 — Triage agent + dashboard v1
overview: Add the LLM triage step (Vercel AI SDK generateObject + Zod) to /api/report, persist structured triage, implement the Unclear follow-up loop, stop on feature requests, and upgrade the dashboard with triage output.
todos:
  - id: deps-keys
    content: Install ai + provider package; set provider key in .env.local; pick a cheap/fast triage model.
    status: completed
  - id: schema
    content: Extend Report with triage columns (classification, summary, confidence, severity, affectedArea, reproSteps, suggestedPriority, followUpQuestion, followUpAnswer); migrate.
    status: completed
  - id: app-context
    content: Add lib/appContext.ts (shared app description + route map).
    status: completed
  - id: triage-lib
    content: Add lib/triage.ts with TriageSchema + generateObject and the triage system prompt.
    status: completed
  - id: wire-route
    content: Wire triage into POST /api/report (nodejs runtime); set status per class; add PATCH /api/reports/[id] for the Unclear follow-up re-triage.
    status: completed
  - id: widget-dashboard
    content: Render triage result + follow-up question in the widget; dashboard v1 triage badges and feature summaries.
    status: completed
isProject: false
---

# M1 — Triage agent + dashboard v1

**Unlocks:** submitted reports are auto-classified; feature requests stop; unclear reports loop back to the user.

Prereq: [M0](01-m0-dummy-app-and-widget.plan.md). See [00-overview.plan.md](00-overview.plan.md) for shared decisions.

## Scope

- Add the LLM triage step to `POST /api/report` (Vercel AI SDK `generateObject`).
- Persist a structured triage result on the `Report`.
- Implement the **Unclear** follow-up loop end-to-end.
- Stop on **Feature request** (no browser session).
- Upgrade the dashboard to show triage output.

## Setup

```bash
npm i ai @ai-sdk/openai   # or your chosen provider package
```

Set the provider key in `.env.local` (e.g. `OPENAI_API_KEY`). Use a cheap/fast model for triage.

## Schema additions (`prisma/schema.prisma`)

Add to `Report`:

```prisma
  classification    String?   // bug | feature_request | unclear
  triageSummary     String?
  triageConfidence  Float?
  severity          String?   // critical | high | medium | low
  affectedArea      String?
  reproSteps        String?   // JSON array as string
  suggestedPriority String?   // p0..p3
  followUpQuestion  String?
  followUpAnswer    String?
```

`status` lifecycle: `new` → (`triaged` | `awaiting_user` | `feature_logged`).

Run `npx prisma migrate dev --name triage`.

## Shared app context (`lib/appContext.ts`)

Export a plain string describing QuickCart, its routes (`/`, `/cart`, `/checkout`), the checkout behaviors, and the base URL. Both the triage and reproduction agents import this so descriptions never drift.

## Triage agent (`lib/triage.ts`)

```ts
const TriageSchema = z.object({
  classification: z.enum(['bug', 'feature_request', 'unclear']),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  severity: z.enum(['critical','high','medium','low']).optional(),
  affectedArea: z.string().optional(),
  reproSteps: z.array(z.string()).optional(),
  suggestedPriority: z.enum(['p0','p1','p2','p3']).optional(),
  followUpQuestion: z.string().optional(),
});

export async function triage(report) {
  const { object } = await generateObject({
    model,                 // cheap/fast model
    schema: TriageSchema,
    system: TRIAGE_SYSTEM, // role + appContext + class rules
    prompt: formatReport(report),
  });
  return object;
}
```

### System prompt design

- Role: "triage engineer for QuickCart."
- Inject `lib/appContext.ts`.
- Definitions of each class.
- Rules: bugs require `severity` + `affectedArea` + `reproSteps`; feature requests require `suggestedPriority`; unclear requires exactly one `followUpQuestion`; set `confidence` honestly.

## Wiring

- `app/api/report/route.ts` — add `export const runtime = 'nodejs'`. After persisting the raw report, call `triage()`, store the result, set `status`.
  - `bug` → `status='triaged'` (ready to reproduce in M2).
  - `feature_request` → `status='feature_logged'`, stop.
  - `unclear` → `status='awaiting_user'`, return `followUpQuestion`.
- `app/api/reports/[id]/route.ts` — `PATCH` accepts a `followUpAnswer`, appends it to the report, and re-runs `triage()`.

## Widget changes

- After submit, render the triage result inline (class + severity, or feature summary).
- If `unclear`, show the `followUpQuestion` with an answer box that `PATCH`es `/api/reports/[id]`, then re-renders the new triage result.

## Dashboard v1

- Triage badges (class + severity color), parsed `reproSteps`, feature-request summaries, and an `awaiting_user` indicator.

## Risks introduced

- Schema-conformance failures from the model (mitigate with `generateObject` + retry).
- Prompt tuning so the two feature requests are not labeled as bugs.
- Provider key / `nodejs` runtime configuration.

## Estimate

~2.5h for a 2-person team.
