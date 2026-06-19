import Image from "next/image";
import { DashboardAutoRefresh } from "@/components/DashboardAutoRefresh";
import { ReproduceButton } from "@/components/ReproduceButton";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function parseConsoleErrors(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function parseJsonStringArray(value: string | null) {
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

type ReproOutcome = {
  reproduced?: boolean;
  confidence?: number;
  narrative?: string;
  observedVsExpected?: string;
  stepsSummary?: string;
};

type ReproTraceEntry = {
  ts?: string;
  stepNumber?: number | null;
  text?: string | null;
  toolCalls?: Array<{
    toolName?: string;
    inputSummary?: string;
  }>;
  toolResults?: Array<{
    toolName?: string;
    outputSummary?: string;
  }>;
};

function parseJsonObject(value: string | null): ReproOutcome | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as ReproOutcome) : null;
  } catch {
    return null;
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

function classificationLabel(classification: string | null) {
  if (classification === "feature_request") {
    return "Feature request";
  }

  if (classification === "bug") {
    return "Bug";
  }

  if (classification === "unclear") {
    return "Unclear";
  }

  return "Pending";
}

function classificationBadgeClass(classification: string | null) {
  if (classification === "bug") {
    return "bg-red-50 text-red-700 ring-red-100";
  }

  if (classification === "feature_request") {
    return "bg-violet-50 text-violet-700 ring-violet-100";
  }

  if (classification === "unclear") {
    return "bg-amber-50 text-amber-800 ring-amber-100";
  }

  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export default async function DashboardPage() {
  const reports = await prisma.report.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
  const hasRunningReproduction = reports.some((report) => report.reproStatus === "running");

  return (
    <div className="space-y-8">
      <DashboardAutoRefresh enabled={hasRunningReproduction} />
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-700">
          Report dashboard
        </p>
        <h1 className="mt-2 text-4xl font-bold text-slate-950">Raw issue reports</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          M0 stores exactly what the widget captured. Later milestones will add triage,
          reproduction traces, screenshots, and filed ticket cards.
        </p>
      </div>

      {reports.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-xl font-bold text-slate-950">No reports yet</h2>
          <p className="mt-2 text-slate-600">
            Trigger a checkout bug, click &quot;Feedback&quot;, and submit the modal.
          </p>
        </section>
      ) : (
        <section className="grid gap-5">
          {reports.map((report) => {
            const consoleErrors = parseConsoleErrors(report.consoleErrors);
            const reproSteps = parseJsonStringArray(report.reproSteps);
            const reproTrace = parseTrace(report.reproTrace);
            const reproOutcome = parseJsonObject(report.reproOutcome);
            const screenshots = parseJsonStringArray(report.screenshots);
            const reproductionConsoleOutput = parseJsonStringArray(report.consoleOutput);

            return (
              <article
                className="scroll-mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm target:border-cyan-400 target:ring-4 target:ring-cyan-100"
                id={`report-${report.id}`}
                key={report.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">Report {report.id}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {report.createdAt.toLocaleString()} · {report.status}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">
                    {report.pageUrl}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ring-1 ${classificationBadgeClass(
                      report.classification,
                    )}`}
                  >
                    {classificationLabel(report.classification)}
                  </span>
                  {report.severity ? (
                    <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-700 ring-1 ring-red-100">
                      Severity: {report.severity}
                    </span>
                  ) : null}
                  {report.suggestedPriority ? (
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-700 ring-1 ring-violet-100">
                      Priority: {report.suggestedPriority}
                    </span>
                  ) : null}
                  {report.status === "awaiting_user" ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-100">
                      Awaiting user
                    </span>
                  ) : null}
                </div>

                {report.triageSummary ? (
                  <section className="mt-5 rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                      Triage summary
                    </h3>
                    <p className="mt-2 text-slate-800">{report.triageSummary}</p>
                    {report.triageConfidence !== null ? (
                      <p className="mt-2 text-sm text-slate-500">
                        Confidence: {Math.round(report.triageConfidence * 100)}%
                      </p>
                    ) : null}
                  </section>
                ) : null}

                {report.classification === "bug" && reproSteps.length > 0 ? (
                  <section className="mt-5 rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                      Parsed reproduction steps
                    </h3>
                    <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-800">
                      {reproSteps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </section>
                ) : null}

                {report.classification === "feature_request" ? (
                  <section className="mt-5 rounded-xl border border-violet-100 bg-violet-50 p-4">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-violet-700">
                      Feature request logged
                    </h3>
                    <p className="mt-2 text-sm text-violet-900">
                      No browser reproduction session is needed for this report.
                    </p>
                  </section>
                ) : null}

                {report.classification === "unclear" && report.followUpQuestion ? (
                  <section className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-amber-800">
                      Follow-up question
                    </h3>
                    <p className="mt-2 text-sm text-amber-950">{report.followUpQuestion}</p>
                    {report.followUpAnswer ? (
                      <p className="mt-3 text-sm text-amber-950">
                        <span className="font-semibold">User answer:</span>{" "}
                        {report.followUpAnswer}
                      </p>
                    ) : null}
                  </section>
                ) : null}

                {report.classification === "bug" ? (
                  <section className="mt-5 rounded-xl border border-cyan-100 bg-cyan-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wide text-cyan-800">
                          Browser reproduction
                        </h3>
                        <p className="mt-1 text-sm text-cyan-950">
                          Status:{" "}
                          <span className="font-bold">
                            {report.reproStatus ?? "not started"}
                          </span>
                        </p>
                        {report.reproStatus === "running" ? (
                          <p className="mt-1 text-sm font-semibold text-cyan-800">
                            Running in a fresh Playwright MCP browser session...
                          </p>
                        ) : null}
                      </div>
                      <ReproduceButton
                        disabled={report.reproStatus === "running"}
                        reportId={report.id}
                      />
                    </div>

                    {reproOutcome ? (
                      <div className="mt-4 rounded-xl bg-white/80 p-4">
                        <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                          Verdict
                        </p>
                        <p className="mt-2 font-bold text-slate-950">
                          {reproOutcome.reproduced ? "Reproduced" : "Not reproduced"}
                          {typeof reproOutcome.confidence === "number"
                            ? ` · ${Math.round(reproOutcome.confidence * 100)}% confidence`
                            : ""}
                        </p>
                        {reproOutcome.narrative ? (
                          <p className="mt-2 text-sm text-slate-800">{reproOutcome.narrative}</p>
                        ) : null}
                        {reproOutcome.observedVsExpected ? (
                          <p className="mt-2 text-sm text-slate-700">
                            <span className="font-semibold">Observed vs expected:</span>{" "}
                            {reproOutcome.observedVsExpected}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {report.ticketStatus === "filed" && report.ticketKey ? (
                      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">
                          Jira ticket filed
                        </p>
                        <a
                          className="mt-2 inline-flex font-bold text-emerald-900 underline underline-offset-4 hover:text-emerald-700"
                          href={report.ticketUrl ?? "#"}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {report.ticketKey}
                        </a>
                        <p className="mt-1 text-sm text-emerald-800">
                          Bug created automatically with reproduction evidence attached.
                        </p>
                      </div>
                    ) : null}

                    {report.ticketStatus === "failed" ? (
                      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="text-sm font-bold uppercase tracking-wide text-red-700">
                          Jira ticket failed
                        </p>
                        <p className="mt-1 text-sm text-red-800">{report.ticketError}</p>
                      </div>
                    ) : null}

                    {report.ticketStatus === "escalated" && report.failureReason ? (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm font-bold uppercase tracking-wide text-amber-800">
                          Failure analysis escalated
                        </p>
                        <p className="mt-2 text-sm text-amber-950">
                          The browser agent could not confidently reproduce this report. It has been
                          escalated for human review.
                        </p>
                        <p className="mt-2 text-sm text-amber-900">
                          <span className="font-semibold">Why:</span> {report.failureReason}
                        </p>
                      </div>
                    ) : null}

                    {screenshots.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-sm font-bold uppercase tracking-wide text-cyan-800">
                          Screenshots
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {screenshots.map((screenshot) => (
                            <a
                              className="block overflow-hidden rounded-xl border border-cyan-100 bg-white"
                              href={screenshot}
                              key={screenshot}
                              rel="noreferrer"
                              target="_blank"
                            >
                              <Image
                                alt="Reproduction evidence screenshot"
                                className="h-auto w-full"
                                height={360}
                                src={screenshot}
                                width={640}
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {reproOutcome?.stepsSummary ? (
                      <div className="mt-4 rounded-xl bg-white/80 p-4">
                        <p className="text-sm font-bold uppercase tracking-wide text-cyan-800">
                          What the agent did
                        </p>
                        <p className="mt-2 text-sm text-slate-800">
                          {reproOutcome.stepsSummary}
                        </p>
                      </div>
                    ) : null}

                    {reproTrace.length > 0 ? (
                      <details className="mt-4 rounded-xl border border-cyan-100 bg-white/80 p-4">
                        <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-cyan-800">
                          Step trace ({reproTrace.length})
                        </summary>
                        <ol className="mt-4 space-y-3">
                          {reproTrace.map((entry, index) => (
                            <li className="rounded-lg bg-slate-50 p-3 text-sm" key={`${report.id}-trace-${index}`}>
                              <p className="font-bold text-slate-950">
                                Step {entry.stepNumber ?? index + 1}
                              </p>
                              {entry.text ? (
                                <p className="mt-1 text-slate-700">{entry.text}</p>
                              ) : null}
                              {entry.toolCalls?.length ? (
                                <div className="mt-2">
                                  <p className="font-semibold text-slate-700">Tool calls</p>
                                  <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">
                                    {entry.toolCalls.map((call, callIndex) => (
                                      <li key={`${report.id}-call-${index}-${callIndex}`}>
                                        {call.toolName ?? "unknown_tool"}:{" "}
                                        {call.inputSummary ?? "no input summary"}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {entry.toolResults?.length ? (
                                <div className="mt-2">
                                  <p className="font-semibold text-slate-700">Tool results</p>
                                  <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">
                                    {entry.toolResults.map((result, resultIndex) => (
                                      <li key={`${report.id}-result-${index}-${resultIndex}`}>
                                        {result.toolName ?? "unknown_tool"}:{" "}
                                        {result.outputSummary ?? "no output summary"}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      </details>
                    ) : null}

                    {reproductionConsoleOutput.length > 0 ? (
                      <details className="mt-4 rounded-xl border border-cyan-100 bg-white/80 p-4">
                        <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-cyan-800">
                          Reproduction console output ({reproductionConsoleOutput.length})
                        </summary>
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {reproductionConsoleOutput.map((line, index) => (
                            <li key={`${report.id}-repro-console-${index}`}>{line}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </section>
                ) : null}

                <dl className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      What happened
                    </dt>
                    <dd className="mt-2 text-sm text-slate-800">{report.whatHappened}</dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Expected
                    </dt>
                    <dd className="mt-2 text-sm text-slate-800">{report.expected}</dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Steps
                    </dt>
                    <dd className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                      {report.steps}
                    </dd>
                  </div>
                </dl>

                <details className="mt-5 rounded-xl border border-slate-200 p-4">
                  <summary className="cursor-pointer text-sm font-bold text-slate-700">
                    Captured context
                  </summary>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <p>
                      <span className="font-semibold">User agent:</span> {report.userAgent}
                    </p>
                    <div>
                      <p className="font-semibold">Console errors ({consoleErrors.length})</p>
                      {consoleErrors.length === 0 ? (
                        <p className="mt-1 text-slate-500">None captured.</p>
                      ) : (
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {consoleErrors.map((error, index) => (
                            <li key={`${report.id}-${index}`}>{error}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </details>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
