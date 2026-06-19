---
name: M0 — Dummy app + report widget
overview: Scaffold the QuickCart Next.js app with Prisma/SQLite, three intentional seeded bugs in checkout, and a bug-report widget that captures context and posts to /api/report. No AI yet. Fully demoable.
todos:
  - id: scaffold
    content: Scaffold Next.js App Router + TS + Tailwind; add Prisma + SQLite and the Report model; run initial migration; add lib/db.ts singleton.
    status: completed
  - id: quickcart
    content: "Build QuickCart pages: storefront (app/page.tsx), cart (app/cart/page.tsx), checkout (app/checkout/page.tsx)."
    status: completed
  - id: seeded-bugs
    content: "Implement the 3 seeded bugs in checkout: SAVE10+quantity NaN, sequence-dependent coupon/remove crash, double-click race with ?fast=1 deterministic fallback."
    status: completed
  - id: widget
    content: Build BugReportWidget (floating button + modal, 3 fields), patch console.error ring buffer, auto-capture pathname/userAgent/console; mount in layout.
    status: completed
  - id: api-dashboard
    content: Add POST /api/report (persist raw) + GET /api/reports; minimal /dashboard listing reports.
    status: completed
isProject: false
---

# M0 — Dummy app + report widget (no AI)

**Unlocks:** a real app with reliably triggerable bugs and a report-capture path. Fully demoable on its own.

Prereq: none. See [00-overview.plan.md](00-overview.plan.md) for shared decisions.

## Scope

- Scaffold Next.js App Router + TS + Tailwind.
- Add Prisma + SQLite with a `Report` model.
- Build `QuickCart` (storefront → cart → checkout) with the **3 seeded bugs**.
- Build `BugReportWidget` (floating button + modal, three fields + auto-context).
- `POST /api/report` persists the raw report and returns it.
- Minimal `/dashboard` listing raw reports.

## Setup

```bash
npx create-next-app@latest quickcart --ts --app --tailwind --eslint
cd quickcart
npm i prisma @prisma/client zod
npx prisma init --datasource-provider sqlite
```

## Data model (`prisma/schema.prisma`)

```prisma
model Report {
  id            String   @id @default(cuid())
  whatHappened  String
  expected      String
  steps         String
  pageUrl       String
  userAgent     String
  consoleErrors String   // JSON array as string
  status        String   @default("new")
  createdAt     DateTime @default(now())
}
```

Run `npx prisma migrate dev --name init` and add `lib/db.ts` exporting a singleton `PrismaClient`.

## App pages

- `app/page.tsx` — product grid (hardcoded product list), "Add to cart".
- `app/cart/page.tsx` — line items, quantity edit, "Checkout".
- `app/checkout/page.tsx` — the bug surface (client component). Holds cart state, coupon field, quantity inputs, "Place order".

### Seeded bugs (all in `app/checkout/page.tsx`)

1. **Form-input failure (`SAVE10` + quantity edit → NaN total).** Compute discount against the pre-parse quantity string so that editing quantity after applying the coupon yields `NaN`.
2. **Sequence-dependent button break.** Apply coupon → remove item → apply coupon again calls into a now-undefined line item and throws, disabling "Place order" permanently. Only breaks in that order.
3. **Race condition on submit.** "Place order" has no in-flight lock; a double-click within ~300ms fires two POSTs. Add a hidden `?fast=1` query flag that shortens the debounce window for a deterministic demo trigger.

Keep each bug isolated and clearly commented as intentional so they don't bleed into each other.

## Bug report widget (`components/BugReportWidget.tsx`)

- Floating button bottom-right; opens a modal with three textareas: **what happened**, **what you expected**, **steps you took**.
- On mount, patch `console.error` to push into a bounded ring buffer (last ~20 messages).
- On submit, send JSON to `POST /api/report` with the three fields plus auto-context: `window.location.pathname`, `navigator.userAgent`, and the captured console errors.
- Mount the widget in `app/layout.tsx` so it's present on every page.

## API + dashboard

- `app/api/report/route.ts` — `POST` validates with Zod, writes a `Report`, returns it. `app/api/reports/route.ts` — `GET` returns all reports.
- `app/dashboard/page.tsx` — server component listing reports (newest first) with raw fields.

## Demo script

Trigger each bug manually, open the widget, submit a report, and see it appear on `/dashboard`.

## Risks introduced

- Making bugs reliably triggerable without the app looking generically broken.
- Getting the `console.error` capture buffer to attach before the bug fires.

## Estimate

~3h for a 2-person team.
