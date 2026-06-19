import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { openai } from "@ai-sdk/openai";
import { createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { QUICKCART_APP_CONTEXT, QUICKCART_BASE_URL } from "@/lib/appContext";
import { prisma } from "@/lib/db";
import { createJiraBug, getJiraConfig, logJiraDebug } from "@/lib/jira";

type ReproOutcome = {
  reproduced: boolean;
  confidence: number;
  narrative: string;
  observedVsExpected: string;
  stepsSummary: string;
};

type ReproTraceEntry = {
  ts: string;
  stepNumber: number | null;
  text: string | null;
  toolCalls: Array<{
    toolName: string;
    inputSummary: string;
  }>;
  toolResults: Array<{
    toolName: string;
    outputSummary: string;
  }>;
};

type ReportForRepro = {
  id: string;
  whatHappened: string;
  expected: string;
  steps: string;
  pageUrl: string;
  classification: string | null;
  triageSummary: string | null;
  severity: string | null;
  affectedArea: string | null;
  reproSteps: string | null;
};

const OutcomeSchema = z.object({
  reproduced: z.boolean(),
  confidence: z.number().min(0).max(1),
  narrative: z.string(),
  observedVsExpected: z.string(),
  stepsSummary: z
    .string()
    .describe(
      "A concise plain-English summary (2-4 sentences) of the steps you actually performed in the browser and what you observed at each key point.",
    ),
});

const REPRO_STEP_LIMIT = 30;
const REPRO_TIMEOUT_MS = Number(process.env.REPRO_TIMEOUT_MS ?? 120_000);
const REPRO_OUTPUT_RETENTION_MS = Number(process.env.REPRO_OUTPUT_RETENTION_MS ?? 1000 * 60 * 60 * 24);

export function logReproduceDebug(event: string, details: Record<string, unknown> = {}) {
  console.info(`[reproduce] ${event}`, details);
}

function summarizeValue(value: unknown, maxLength = 600) {
  let text: string;

  if (typeof value === "string") {
    text = value;
  } else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function getObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function parseStringArray(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function buildReproSystemPrompt(report: ReportForRepro) {
  const parsedSteps = parseStringArray(report.reproSteps);
  const routeHint = report.pageUrl.startsWith("/") ? report.pageUrl : "/checkout";
  const startUrl = `${QUICKCART_BASE_URL}${routeHint}`;

  return `
You are an automated reproduction agent for QuickCart.

${QUICKCART_APP_CONTEXT}

Target app base URL: ${QUICKCART_BASE_URL}
Recommended starting URL: ${startUrl}

Structured triage:
- Classification: ${report.classification}
- Severity: ${report.severity ?? "unknown"}
- Affected area: ${report.affectedArea ?? "unknown"}
- Summary: ${report.triageSummary ?? report.whatHappened}
- User expected: ${report.expected}
- User-provided steps: ${report.steps}
- Parsed reproduction steps: ${
    parsedSteps.length ? parsedSteps.map((step, index) => `${index + 1}. ${step}`).join("\n") : "none"
  }

Required browser tactics:
- Open a fresh page with browser_navigate.
- Call browser_snapshot (with NO arguments) before every interaction and after every action. It returns the full accessibility tree inline so you can read the page. Each element has a ref like [ref=e12].
- For every interaction, pass that exact ref to browser_click, browser_type, browser_fill_form, etc. NEVER guess CSS selectors. If a ref is stale, take a fresh browser_snapshot and re-read the refs.
- Known QuickCart checkout controls: a textbox labeled "Coupon code" (placeholder "SAVE10"), an "Apply" button, quantity textboxes labeled "Quantity for <product name>", "Remove" buttons per line item, and a "Place order" button.
- FOLLOW THE PARSED REPRODUCTION STEPS IN ORDER, one at a time. Do not repeat the same action. After each step, take a snapshot and verify the page actually changed before moving to the next step.
- Do NOT just keep re-applying the coupon. The bug usually appears only AFTER a later step (for example: apply SAVE10, THEN change a quantity, THEN read the order total; or apply coupon, remove a line item, then apply the coupon again). Carry out the whole sequence.
- After completing the sequence, read the rendered total / page text in the snapshot and compare it to what the user expected. A total showing "NaN", a crash, a disabled "Place order" button, or a duplicate order all count as reproducing the bug.
- Prefer normal user interactions over browser_evaluate.
- When you observe the failing state, call browser_take_screenshot and browser_console_messages to capture evidence. It captures the whole page automatically; do NOT pass a filename, target, or element.
- If relevant, call browser_network_requests before the final verdict.
- Finish by calling record_outcome exactly once. Always fill observedVsExpected with what you actually saw versus what the user expected, and fill stepsSummary with a concise plain-English recap (2-4 sentences) of the steps you performed and what you observed.
- If you genuinely cannot reproduce it after following all the steps, record what you tried and why it failed.
`.trim();
}

function buildPrompt(report: ReportForRepro) {
  return `
Attempt to reproduce this QuickCart report:

What happened: ${report.whatHappened}
Expected: ${report.expected}
Steps: ${report.steps}

Navigate the app, follow the parsed steps from triage, gather evidence, and call record_outcome.
`.trim();
}

function buildCorrectivePrompt(report: ReportForRepro) {
  return `${buildPrompt(report)}

The previous attempt appeared stuck or incomplete. Start over from a fresh page, follow each parsed step exactly once, do not repeat successful actions, and call record_outcome only after checking the final page state.`;
}

async function appendTrace(reportId: string, entry: ReproTraceEntry) {
  const current = await prisma.report.findUnique({
    where: { id: reportId },
    select: { reproTrace: true },
  });
  const trace = parseTrace(current?.reproTrace ?? null);

  trace.push(entry);

  logReproduceDebug("persisting step trace", {
    reportId,
    stepNumber: entry.stepNumber,
    toolCallCount: entry.toolCalls.length,
    toolCalls: entry.toolCalls.map((call) => call.toolName),
    toolResultCount: entry.toolResults.length,
  });

  await prisma.report.update({
    where: { id: reportId },
    data: {
      reproTrace: JSON.stringify(trace),
    },
  });
}

async function cleanupOldOutputDirs(currentReportId: string) {
  const outputRoot = path.join(process.cwd(), "public", "repro-output");

  try {
    await mkdir(outputRoot, { recursive: true });
    const entries = await readdir(outputRoot, { withFileTypes: true });
    const now = Date.now();

    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && entry.name !== currentReportId)
        .map(async (entry) => {
          const entryPath = path.join(outputRoot, entry.name);
          const stats = await stat(entryPath);

          if (now - stats.mtimeMs > REPRO_OUTPUT_RETENTION_MS) {
            await rm(entryPath, { recursive: true, force: true });
            logReproduceDebug("cleaned old output directory", {
              reportId: currentReportId,
              removed: entry.name,
            });
          }
        }),
    );
  } catch (error) {
    logReproduceDebug("output cleanup skipped", {
      reportId: currentReportId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

function parseTrace(value: string | null): ReproTraceEntry[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as ReproTraceEntry[]) : [];
  } catch {
    return [];
  }
}

function traceEntryFromStep(step: unknown): ReproTraceEntry {
  const stepObject = getObject(step);
  const toolCalls = Array.isArray(stepObject.toolCalls) ? stepObject.toolCalls : [];
  const toolResults = Array.isArray(stepObject.toolResults) ? stepObject.toolResults : [];

  return {
    ts: new Date().toISOString(),
    stepNumber: typeof stepObject.stepNumber === "number" ? stepObject.stepNumber : null,
    text: typeof stepObject.text === "string" && stepObject.text ? stepObject.text : null,
    toolCalls: toolCalls.map((call) => {
      const callObject = getObject(call);
      return {
        toolName:
          typeof callObject.toolName === "string"
            ? callObject.toolName
            : typeof callObject.toolName === "symbol"
              ? callObject.toolName.toString()
              : "unknown_tool",
        inputSummary: summarizeValue(callObject.input ?? callObject.args ?? callObject),
      };
    }),
    toolResults: toolResults.map((result) => {
      const resultObject = getObject(result);
      return {
        toolName:
          typeof resultObject.toolName === "string"
            ? resultObject.toolName
            : typeof resultObject.toolName === "symbol"
              ? resultObject.toolName.toString()
              : "unknown_tool",
        outputSummary: summarizeValue(resultObject.output ?? resultObject.result ?? resultObject),
      };
    }),
  };
}

async function listScreenshotUrls(outputDir: string, reportId: string) {
  try {
    const files = await readdir(outputDir);
    return files
      .filter((file) => /\.(png|jpe?g)$/i.test(file))
      .map((file) => `/repro-output/${reportId}/${file}`);
  } catch {
    return [];
  }
}

function extractConsoleOutput(trace: ReproTraceEntry[]) {
  return trace.flatMap((entry) =>
    entry.toolResults
      .filter((result) => result.toolName === "browser_console_messages")
      .map((result) => result.outputSummary),
  );
}

function toolCallSignature(entry: ReproTraceEntry) {
  return entry.toolCalls.map((call) => `${call.toolName}:${call.inputSummary}`).join("|");
}

function shouldRetryForStuckTrace(trace: ReproTraceEntry[], outcome: ReproOutcome | null) {
  if (outcome?.reproduced) {
    return false;
  }

  const toolEntries = trace.filter((entry) => entry.toolCalls.length > 0);
  const lastSignatures = toolEntries.slice(-4).map(toolCallSignature);
  const repeatedLastActions =
    lastSignatures.length >= 3 && new Set(lastSignatures.filter(Boolean)).size === 1;

  const snapshotLinkOnlyCount = trace.filter((entry) =>
    entry.toolResults.some(
      (result) =>
        result.toolName === "browser_snapshot" && result.outputSummary.includes("[Snapshot]("),
    ),
  ).length;

  const interactionErrorCount = trace.filter((entry) =>
    entry.toolResults.some(
      (result) =>
        (result.toolName.startsWith("browser_") || result.toolName === "unknown_tool") &&
        result.outputSummary.includes("### Error"),
    ),
  ).length;

  return repeatedLastActions || snapshotLinkOnlyCount >= 2 || interactionErrorCount >= 3;
}

type ReportForTicket = {
  id: string;
  whatHappened: string;
  expected: string;
  pageUrl: string;
  triageSummary: string | null;
  severity: string | null;
  affectedArea: string | null;
  reproSteps: string | null;
};

async function fileJiraTicket(
  report: ReportForTicket,
  outcome: ReproOutcome,
  screenshotUrls: string[],
  consoleOutput: string[],
) {
  if (!getJiraConfig()) {
    logJiraDebug("skipped (not configured)", { reportId: report.id });
    await prisma.report.update({
      where: { id: report.id },
      data: { ticketStatus: "skipped" },
    });
    return;
  }

  const screenshotPaths = screenshotUrls.map((url) =>
    path.join(process.cwd(), "public", url.replace(/^\//, "")),
  );

  const summary = `[QuickCart] ${report.triageSummary ?? report.whatHappened}`.slice(0, 240);

  try {
    const ticket = await createJiraBug({
      reportId: report.id,
      summary,
      severity: report.severity,
      affectedArea: report.affectedArea,
      pageUrl: report.pageUrl,
      whatHappened: report.whatHappened,
      expected: report.expected,
      observedVsExpected: outcome.observedVsExpected,
      narrative: outcome.narrative,
      reproSteps: parseStringArray(report.reproSteps),
      consoleOutput,
      screenshotPaths,
    });

    await prisma.report.update({
      where: { id: report.id },
      data: {
        ticketStatus: "filed",
        ticketId: ticket.id,
        ticketKey: ticket.key,
        ticketUrl: ticket.url,
        ticketError: null,
        failureReason: null,
      },
    });
    logJiraDebug("ticket stored", { reportId: report.id, key: ticket.key });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Jira error.";
    logJiraDebug("ticket creation failed", { reportId: report.id, error: message });
    await prisma.report.update({
      where: { id: report.id },
      data: {
        ticketStatus: "failed",
        ticketError: message,
        failureReason: null,
      },
    });
  }
}

// Mark a report as running and dispatch the (long-lived) reproduction in the
// background so the HTTP request can return immediately.
export async function startReproduction(reportId: string) {
  const updated = await prisma.report.update({
    where: { id: reportId },
    data: {
      reproStatus: "running",
      reproTrace: JSON.stringify([]),
      reproOutcome: null,
      screenshots: JSON.stringify([]),
      consoleOutput: JSON.stringify([]),
      ticketStatus: null,
      ticketId: null,
      ticketKey: null,
      ticketUrl: null,
      ticketError: null,
      failureReason: null,
    },
  });

  setTimeout(() => {
    logReproduceDebug("dispatching async reproduction", { reportId });
    void reproduceReport(reportId);
  }, 0);

  return updated;
}

type ExecutableTool = { execute?: (input: unknown, options: unknown) => unknown };

// Wrap one MCP tool so we strip the given input keys before it runs.
function stripToolInputKeys<T extends Record<string, unknown>>(
  mcpTools: T,
  toolName: string,
  keys: string[],
): T {
  const original = mcpTools[toolName] as ExecutableTool | undefined;

  if (!original || typeof original.execute !== "function") {
    return mcpTools;
  }

  const originalExecute = original.execute.bind(original);

  return {
    ...mcpTools,
    [toolName]: {
      ...original,
      execute: (input: unknown, options: unknown) => {
        const cleaned =
          input && typeof input === "object" ? { ...(input as Record<string, unknown>) } : {};
        for (const key of keys) {
          delete cleaned[key];
        }
        return originalExecute(cleaned, options);
      },
    },
  };
}

// The reproduction model sometimes fights the tool schemas in two ways that
// leave us with nothing to show:
// 1. browser_snapshot with a `filename`/`target` writes the tree to disk and
//    returns only a link, so the model is driving blind.
// 2. browser_take_screenshot with a `filename` saves to the server cwd (project
//    root) instead of our per-report output dir AND skips the inline image, so
//    the dashboard never sees a screenshot. It also passes a guessed `target`
//    (e.g. "html") together with fullPage, which Playwright rejects.
// Stripping those keys forces full inline snapshots and screenshots that land in
// the per-report output dir, regardless of what the model asks for.
function sanitizeMcpTools<T extends Record<string, unknown>>(mcpTools: T): T {
  let sanitized = stripToolInputKeys(mcpTools, "browser_snapshot", [
    "filename",
    "target",
    "depth",
  ]);
  sanitized = stripToolInputKeys(sanitized, "browser_take_screenshot", [
    "filename",
    "target",
    "element",
  ]);
  return sanitized;
}

function fallbackOutcome(text: string): ReproOutcome {
  return {
    reproduced: false,
    confidence: 0.35,
    narrative:
      text ||
      "The reproduction run completed without calling record_outcome, so no reliable verdict was captured.",
    observedVsExpected: "No structured observed-vs-expected comparison was recorded.",
    stepsSummary: text || "The agent did not record a summary of the steps it took.",
  };
}

export async function reproduceReport(reportId: string) {
  logReproduceDebug("started", {
    reportId,
  });

  const report = await prisma.report.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    logReproduceDebug("report lookup failed", {
      reportId,
    });
    throw new Error(`Report ${reportId} not found.`);
  }

  logReproduceDebug("loaded report", {
    reportId,
    classification: report.classification,
    severity: report.severity,
    affectedArea: report.affectedArea,
    hasTriageSummary: Boolean(report.triageSummary),
    reproStepCount: parseStringArray(report.reproSteps).length,
  });

  if (report.classification !== "bug") {
    logReproduceDebug("rejected non-bug report", {
      reportId,
      classification: report.classification,
    });

    await prisma.report.update({
      where: { id: reportId },
      data: {
        reproStatus: "error",
        reproOutcome: JSON.stringify({
          reproduced: false,
          confidence: 1,
          narrative: "Reproduction can only run for bug-classified reports.",
          observedVsExpected: "This report is not classified as a bug.",
          stepsSummary: "No browser session was started.",
        } satisfies ReproOutcome),
      },
    });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    logReproduceDebug("cannot start llm reproduction", {
      reportId,
      reason: "OPENAI_API_KEY is not set",
    });

    await prisma.report.update({
      where: { id: reportId },
      data: {
        reproStatus: "error",
        reproOutcome: JSON.stringify({
          reproduced: false,
          confidence: 1,
          narrative: "OPENAI_API_KEY is not set, so the browser-driving LLM could not run.",
          observedVsExpected: "No browser session was started.",
          stepsSummary: "No browser session was started.",
        } satisfies ReproOutcome),
      },
    });
    return;
  }

  const outputDir = path.join(process.cwd(), "public", "repro-output", reportId);
  await mkdir(outputDir, { recursive: true });
  await cleanupOldOutputDirs(reportId);
  logReproduceDebug("prepared output directory", {
    reportId,
    outputDir,
  });

  let mcpClient: Awaited<ReturnType<typeof createMCPClient>> | null = null;
  let recordedOutcome: ReproOutcome | null = null;

  const recordOutcome = tool({
    description: "Finalize the reproduction attempt. Call this exactly once at the end.",
    inputSchema: OutcomeSchema,
    execute: async (payload) => {
      logReproduceDebug("record_outcome called", {
        reportId,
        reproduced: payload.reproduced,
        confidence: payload.confidence,
      });

      recordedOutcome = payload;
      return {
        recorded: true,
        reproduced: payload.reproduced,
      };
    },
  });

  try {
    logReproduceDebug("starting playwright mcp", {
      reportId,
      command: "node",
      headless: true,
    });

    mcpClient = await createMCPClient({
      transport: new Experimental_StdioMCPTransport({
        command: "node",
        args: [
          path.join(process.cwd(), "node_modules", "@playwright", "mcp", "cli.js"),
          "--headless",
          "--output-mode",
          "stdout",
          "--output-dir",
          outputDir,
        ],
      }),
    });
    logReproduceDebug("playwright mcp connected", {
      reportId,
      serverName: mcpClient.serverInfo?.name,
      serverVersion: mcpClient.serverInfo?.version,
    });

    const rawMcpTools = await mcpClient.tools();
    const mcpTools = sanitizeMcpTools(rawMcpTools);
    logReproduceDebug("discovered mcp tools", {
      reportId,
      toolCount: Object.keys(mcpTools).length,
      tools: Object.keys(mcpTools).slice(0, 12),
      sanitizedSnapshot: typeof rawMcpTools.browser_snapshot !== "undefined",
    });

    const model = process.env.REPRO_MODEL ?? "gpt-5.1";
    logReproduceDebug("calling reproduction llm", {
      reportId,
      model,
      stopStepCount: REPRO_STEP_LIMIT,
      timeoutMs: REPRO_TIMEOUT_MS,
    });

    const runAgentAttempt = async (prompt: string, system: string) => {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), REPRO_TIMEOUT_MS);

      try {
        return await generateText({
          model: openai(model),
          system,
          prompt,
          tools: {
            ...mcpTools,
            record_outcome: recordOutcome,
          },
          stopWhen: stepCountIs(REPRO_STEP_LIMIT),
          abortSignal: abortController.signal,
          onStepFinish: async (step) => {
            const entry = traceEntryFromStep(step);
            logReproduceDebug("agent step finished", {
              reportId,
              stepNumber: entry.stepNumber,
              textLength: entry.text?.length ?? 0,
              toolCalls: entry.toolCalls.map((call) => call.toolName),
              toolResults: entry.toolResults.map((toolResult) => toolResult.toolName),
            });
            await appendTrace(reportId, entry);
          },
        });
      } finally {
        clearTimeout(timeout);
      }
    };

    let result = await runAgentAttempt(buildPrompt(report), buildReproSystemPrompt(report));
    logReproduceDebug("llm loop completed", {
      reportId,
      finishReason: result.finishReason,
      textLength: result.text.length,
      recordedOutcome: Boolean(recordedOutcome),
    });

    let traceRecord = await prisma.report.findUnique({
      where: { id: reportId },
      select: { reproTrace: true },
    });
    let trace = parseTrace(traceRecord?.reproTrace ?? null);
    let outcome = recordedOutcome ?? fallbackOutcome(result.text);

    if (shouldRetryForStuckTrace(trace, recordedOutcome)) {
      logReproduceDebug("stuck trace detected; retrying with corrective prompt", {
        reportId,
        traceStepCount: trace.length,
        recordedOutcome: Boolean(recordedOutcome),
      });
      await appendTrace(reportId, {
        ts: new Date().toISOString(),
        stepNumber: null,
        text: "Detected a stuck or incomplete browser run; retrying once with corrective instructions.",
        toolCalls: [],
        toolResults: [],
      });
      recordedOutcome = null;

      result = await runAgentAttempt(
        buildCorrectivePrompt(report),
        `${buildReproSystemPrompt(report)}

Corrective retry: the prior attempt was stuck. Use fresh snapshots, do not repeat the same action loop, and complete the user-provided sequence before deciding.`,
      );
      logReproduceDebug("corrective llm loop completed", {
        reportId,
        finishReason: result.finishReason,
        textLength: result.text.length,
        recordedOutcome: Boolean(recordedOutcome),
      });

      traceRecord = await prisma.report.findUnique({
        where: { id: reportId },
        select: { reproTrace: true },
      });
      trace = parseTrace(traceRecord?.reproTrace ?? null);
      outcome = recordedOutcome ?? fallbackOutcome(result.text);
    }

    const screenshots = await listScreenshotUrls(outputDir, reportId);
    const consoleOutput = extractConsoleOutput(trace);
    logReproduceDebug("collected evidence", {
      reportId,
      traceStepCount: trace.length,
      screenshotCount: screenshots.length,
      consoleOutputCount: consoleOutput.length,
      reproduced: outcome.reproduced,
    });

    await prisma.report.update({
      where: { id: reportId },
      data: {
        reproStatus: outcome.reproduced ? "reproduced" : "not_reproduced",
        reproOutcome: JSON.stringify(outcome),
        screenshots: JSON.stringify(screenshots),
        consoleOutput: JSON.stringify(consoleOutput),
      },
    });
    logReproduceDebug("stored reproduction result", {
      reportId,
      reproStatus: outcome.reproduced ? "reproduced" : "not_reproduced",
      confidence: outcome.confidence,
    });

    if (outcome.reproduced) {
      await fileJiraTicket(report, outcome, screenshots, consoleOutput);
    } else {
      await prisma.report.update({
        where: { id: reportId },
        data: {
          ticketStatus: "escalated",
          failureReason: outcome.narrative,
        },
      });
      logReproduceDebug("stored failure escalation", {
        reportId,
        failureReasonLength: outcome.narrative.length,
      });
    }
  } catch (error) {
    logReproduceDebug("failed", {
      reportId,
      error: error instanceof Error ? error.message : "Unknown reproduction error.",
    });

    await prisma.report.update({
      where: { id: reportId },
      data: {
        reproStatus: "error",
        ticketStatus: "escalated",
        failureReason: error instanceof Error ? error.message : "Unknown reproduction error.",
        reproOutcome: JSON.stringify({
          reproduced: false,
          confidence: 0,
          narrative: error instanceof Error ? error.message : "Unknown reproduction error.",
          observedVsExpected: "The reproduction agent failed before producing a verdict.",
          stepsSummary: "The reproduction agent failed before producing a verdict.",
        } satisfies ReproOutcome),
      },
    });
  } finally {
    logReproduceDebug("closing playwright mcp", {
      reportId,
      hadClient: Boolean(mcpClient),
    });
    await mcpClient?.close();
    logReproduceDebug("finished", {
      reportId,
    });
  }
}
