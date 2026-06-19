import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { QUICKCART_APP_CONTEXT } from "@/lib/appContext";

export const TriageSchema = z.object({
  classification: z.enum(["bug", "feature_request", "unclear"]),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  affectedArea: z.string().optional(),
  reproSteps: z.array(z.string()).optional(),
  suggestedPriority: z.enum(["p0", "p1", "p2", "p3"]).optional(),
  followUpQuestion: z.string().optional(),
});

export type TriageResult = z.infer<typeof TriageSchema>;

export type ReportInput = {
  whatHappened: string;
  expected: string;
  steps: string;
  pageUrl: string;
  userAgent: string;
  consoleErrors: string;
  followUpAnswer?: string | null;
};

const TRIAGE_SYSTEM = `
You are a triage engineer for QuickCart.

${QUICKCART_APP_CONTEXT}

Classify user feedback as exactly one of:
- bug: The user reports broken, incorrect, crashing, duplicated, or impossible-to-complete behavior.
- feature_request: The user asks for a new capability, workflow, integration, visual mode, or payment option.
- unclear: The report does not include enough concrete information to classify or reproduce.

Rules:
- For bug reports, include severity, affectedArea, and reproSteps.
- Severity guide: critical blocks checkout or creates data duplication; high breaks a key checkout/cart task; medium causes incorrect display or recoverable bad state; low is cosmetic or minor.
- For feature requests, include suggestedPriority and do not invent reproduction steps.
- For unclear reports, include exactly one followUpQuestion that asks for the most important missing detail.
- Be conservative. Do not classify a feature request as a bug just because it mentions missing behavior.
- Set confidence honestly from 0 to 1.
`.trim();

function formatReport(report: ReportInput) {
  return `
User report:
- What happened: ${report.whatHappened}
- Expected: ${report.expected}
- Steps: ${report.steps}
- Page: ${report.pageUrl}
- User agent: ${report.userAgent}
- Console errors: ${report.consoleErrors || "[]"}
- Follow-up answer: ${report.followUpAnswer || "none"}
`.trim();
}

function normalizeTriage(result: TriageResult): TriageResult {
  if (result.classification === "bug") {
    return {
      ...result,
      severity: result.severity ?? "medium",
      affectedArea: result.affectedArea ?? "QuickCart",
      reproSteps: result.reproSteps?.length ? result.reproSteps : ["Review the submitted steps."],
      suggestedPriority: undefined,
      followUpQuestion: undefined,
    };
  }

  if (result.classification === "feature_request") {
    return {
      ...result,
      severity: undefined,
      affectedArea: undefined,
      reproSteps: undefined,
      suggestedPriority: result.suggestedPriority ?? "p3",
      followUpQuestion: undefined,
    };
  }

  return {
    ...result,
    severity: undefined,
    affectedArea: undefined,
    reproSteps: undefined,
    suggestedPriority: undefined,
    followUpQuestion:
      result.followUpQuestion ??
      "Can you share the exact page and steps you took before the issue happened?",
  };
}

function fallbackTriage(report: ReportInput): TriageResult {
  const text = `${report.whatHappened} ${report.expected} ${report.steps}`.toLowerCase();
  const featureWords = ["feature request", "dark mode", "paypal", "save my card", "payment option"];
  const bugWords = [
    "nan",
    "crash",
    "disabled",
    "duplicate",
    "double-click",
    "not working",
    "broken",
    "error",
  ];

  if (featureWords.some((word) => text.includes(word))) {
    return {
      classification: "feature_request",
      summary: report.whatHappened,
      confidence: 0.74,
      suggestedPriority: text.includes("payment") || text.includes("paypal") ? "p2" : "p3",
    };
  }

  if (bugWords.some((word) => text.includes(word))) {
    const blocksCheckout = text.includes("disabled") || text.includes("duplicate");
    return {
      classification: "bug",
      summary: report.whatHappened,
      confidence: 0.72,
      severity: blocksCheckout ? "high" : "medium",
      affectedArea: report.pageUrl.includes("checkout") ? "Checkout" : "QuickCart",
      reproSteps: report.steps
        .split(/\n|\. /)
        .map((step) => step.trim())
        .filter(Boolean),
    };
  }

  return {
    classification: "unclear",
    summary: "The report does not include enough detail to classify confidently.",
    confidence: 0.5,
    followUpQuestion: "What page were you on, and what exact steps led to the problem?",
  };
}

export async function triage(report: ReportInput): Promise<TriageResult> {
  if (!process.env.OPENAI_API_KEY) {
    return normalizeTriage(fallbackTriage(report));
  }

  const { object } = await generateObject({
    model: openai(process.env.TRIAGE_MODEL ?? "gpt-4o-mini"),
    schema: TriageSchema,
    system: TRIAGE_SYSTEM,
    prompt: formatReport(report),
  });

  return normalizeTriage(object);
}

export function statusForTriage(classification: TriageResult["classification"]) {
  if (classification === "bug") {
    return "triaged";
  }

  if (classification === "feature_request") {
    return "feature_logged";
  }

  return "awaiting_user";
}
