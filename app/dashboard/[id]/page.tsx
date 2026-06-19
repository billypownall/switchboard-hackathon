import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardAutoRefresh } from "@/components/DashboardAutoRefresh";
import { ReproduceButton } from "@/components/ReproduceButton";
import { prisma } from "@/lib/db";
import {
  classificationBadgeClass,
  classificationLabel,
  laneById,
  laneForReport,
  parseConsoleErrors,
  parseJsonObject,
  parseJsonStringArray,
  parseTrace,
} from "@/lib/reportView";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReportDetailPage({ params }: PageProps) {
  const { id } = await params;
  const report = await prisma.report.findUnique({ where: { id } });

  if (!report) {
    notFound();
  }

  const consoleErrors = parseConsoleErrors(report.consoleErrors);
  const reproSteps = parseJsonStringArray(report.reproSteps);
  const reproTrace = parseTrace(report.reproTrace);
  const reproOutcome = parseJsonObject(report.reproOutcome);
  const screenshots = parseJsonStringArray(report.screenshots);
  const reproductionConsoleOutput = parseJsonStringArray(report.consoleOutput);
  const lane = laneById(laneForReport(report));

  return (
    <div className="space-y-6">
      <DashboardAutoRefresh enabled={report.reproStatus === "running"} />

      <Link className="mono-label inline-flex items-center gap-1 text-[11px] text-[#6a7180] hover:text-[#16191f]" href="/dashboard">
        &larr; Back to console
      </Link>

      <article className="rounded-xl border border-[#e3e4e9] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {lane ? <span className="led" style={{ background: lane.color }} /> : null}
              <span className="mono-label text-[10px] text-[#6a7180]">{lane?.name ?? "Intake"}</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-[#16191f]">Report {report.id}</h1>
            <p className="mono-label mt-1 text-[10px] text-[#9aa0ad]">
              {report.createdAt.toLocaleString()} · {report.status}
            </p>
          </div>
          <span className="mono-label rounded-full bg-[#edeef1] px-3 py-1 text-[10px] text-[#6a7180]">
            {report.pageUrl}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span
            className={`mono-label rounded-full px-3 py-1 text-[10px] ring-1 ${classificationBadgeClass(
              report.classification,
            )}`}
          >
            {classificationLabel(report.classification)}
          </span>
          {report.severity ? (
            <span className="mono-label rounded-full bg-red-50 px-3 py-1 text-[10px] text-red-700 ring-1 ring-red-100">
              Severity: {report.severity}
            </span>
          ) : null}
          {report.suggestedPriority ? (
            <span className="mono-label rounded-full bg-teal-50 px-3 py-1 text-[10px] text-teal-700 ring-1 ring-teal-100">
              Priority: {report.suggestedPriority}
            </span>
          ) : null}
          {report.status === "awaiting_user" ? (
            <span className="mono-label rounded-full bg-amber-50 px-3 py-1 text-[10px] text-amber-800 ring-1 ring-amber-100">
              Awaiting user
            </span>
          ) : null}
        </div>

        {report.triageSummary ? (
          <section className="mt-5 rounded-xl border border-[#e3e4e9] p-4">
            <h2 className="mono-label text-[10px] text-[#6a7180]">Triage summary</h2>
            <p className="mt-2 text-sm text-[#16191f]">{report.triageSummary}</p>
            {report.triageConfidence !== null ? (
              <p className="mt-2 text-xs text-[#9aa0ad]">
                Confidence: {Math.round(report.triageConfidence * 100)}%
              </p>
            ) : null}
          </section>
        ) : null}

        {report.classification === "bug" && reproSteps.length > 0 ? (
          <section className="mt-5 rounded-xl border border-[#e3e4e9] p-4">
            <h2 className="mono-label text-[10px] text-[#6a7180]">Parsed reproduction steps</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[#16191f]">
              {reproSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        ) : null}

        {report.classification === "feature_request" ? (
          <section className="mt-5 rounded-xl border border-teal-100 bg-teal-50 p-4">
            <h2 className="mono-label text-[10px] text-teal-700">Feature request logged</h2>
            <p className="mt-2 text-sm text-teal-900">
              No browser reproduction session is needed for this report.
            </p>
          </section>
        ) : null}

        {report.classification === "unclear" && report.followUpQuestion ? (
          <section className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4">
            <h2 className="mono-label text-[10px] text-amber-800">Follow-up question</h2>
            <p className="mt-2 text-sm text-amber-950">{report.followUpQuestion}</p>
            {report.followUpAnswer ? (
              <p className="mt-3 text-sm text-amber-950">
                <span className="font-semibold">User answer:</span> {report.followUpAnswer}
              </p>
            ) : null}
          </section>
        ) : null}

        {report.classification === "bug" ? (
          <section className="mt-5 rounded-xl border border-[#e3e4e9] bg-[#f6f7f9] p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="mono-label text-[10px] text-[#6a7180]">Browser reproduction</h2>
                <p className="mt-1 text-sm text-[#16191f]">
                  Status: <span className="font-bold">{report.reproStatus ?? "not started"}</span>
                </p>
                {report.reproStatus === "running" ? (
                  <p className="mt-1 text-sm font-semibold text-[#5b7cfa]">
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
              <div className="mt-4 rounded-xl bg-white p-4">
                <p className="mono-label text-[10px] text-[#6a7180]">Verdict</p>
                <p className="mt-2 font-bold text-[#16191f]">
                  {reproOutcome.reproduced ? "Reproduced" : "Not reproduced"}
                  {typeof reproOutcome.confidence === "number"
                    ? ` · ${Math.round(reproOutcome.confidence * 100)}% confidence`
                    : ""}
                </p>
                {reproOutcome.narrative ? (
                  <p className="mt-2 text-sm text-[#16191f]">{reproOutcome.narrative}</p>
                ) : null}
                {reproOutcome.observedVsExpected ? (
                  <p className="mt-2 text-sm text-[#6a7180]">
                    <span className="font-semibold">Observed vs expected:</span>{" "}
                    {reproOutcome.observedVsExpected}
                  </p>
                ) : null}
              </div>
            ) : null}

            {report.ticketStatus === "filed" && report.ticketKey ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="mono-label text-[10px] text-emerald-700">Jira ticket filed</p>
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
                <p className="mono-label text-[10px] text-red-700">Jira ticket failed</p>
                <p className="mt-1 text-sm text-red-800">{report.ticketError}</p>
              </div>
            ) : null}

            {report.ticketStatus === "escalated" && report.failureReason ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="mono-label text-[10px] text-amber-800">Failure analysis escalated</p>
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
                <p className="mono-label text-[10px] text-[#6a7180]">Screenshots</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {screenshots.map((screenshot) => (
                    <a
                      className="block overflow-hidden rounded-xl border border-[#e3e4e9] bg-white"
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
              <div className="mt-4 rounded-xl bg-white p-4">
                <p className="mono-label text-[10px] text-[#6a7180]">What the agent did</p>
                <p className="mt-2 text-sm text-[#16191f]">{reproOutcome.stepsSummary}</p>
              </div>
            ) : null}

            {reproTrace.length > 0 ? (
              <details className="mt-4 rounded-xl border border-[#e3e4e9] bg-white p-4">
                <summary className="mono-label cursor-pointer text-[10px] text-[#6a7180]">
                  Step trace ({reproTrace.length})
                </summary>
                <ol className="mt-4 space-y-3">
                  {reproTrace.map((entry, index) => (
                    <li
                      className="rounded-lg bg-[#f6f7f9] p-3 text-sm"
                      key={`${report.id}-trace-${index}`}
                    >
                      <p className="font-bold text-[#16191f]">Step {entry.stepNumber ?? index + 1}</p>
                      {entry.text ? <p className="mt-1 text-[#6a7180]">{entry.text}</p> : null}
                      {entry.toolCalls?.length ? (
                        <div className="mt-2">
                          <p className="font-semibold text-[#6a7180]">Tool calls</p>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-[#6a7180]">
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
                          <p className="font-semibold text-[#6a7180]">Tool results</p>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-[#6a7180]">
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
              <details className="mt-4 rounded-xl border border-[#e3e4e9] bg-white p-4">
                <summary className="mono-label cursor-pointer text-[10px] text-[#6a7180]">
                  Reproduction console output ({reproductionConsoleOutput.length})
                </summary>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#6a7180]">
                  {reproductionConsoleOutput.map((line, index) => (
                    <li key={`${report.id}-repro-console-${index}`}>{line}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>
        ) : null}

        <dl className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-[#f6f7f9] p-4">
            <dt className="mono-label text-[10px] text-[#6a7180]">What happened</dt>
            <dd className="mt-2 text-sm text-[#16191f]">{report.whatHappened}</dd>
          </div>
          <div className="rounded-xl bg-[#f6f7f9] p-4">
            <dt className="mono-label text-[10px] text-[#6a7180]">Expected</dt>
            <dd className="mt-2 text-sm text-[#16191f]">{report.expected}</dd>
          </div>
          <div className="rounded-xl bg-[#f6f7f9] p-4">
            <dt className="mono-label text-[10px] text-[#6a7180]">Steps</dt>
            <dd className="mt-2 whitespace-pre-wrap text-sm text-[#16191f]">{report.steps}</dd>
          </div>
        </dl>

        <details className="mt-5 rounded-xl border border-[#e3e4e9] p-4">
          <summary className="mono-label cursor-pointer text-[10px] text-[#6a7180]">
            Captured context
          </summary>
          <div className="mt-4 space-y-3 text-sm text-[#6a7180]">
            <p>
              <span className="font-semibold">User agent:</span> {report.userAgent}
            </p>
            <div>
              <p className="font-semibold">Console errors ({consoleErrors.length})</p>
              {consoleErrors.length === 0 ? (
                <p className="mt-1 text-[#9aa0ad]">None captured.</p>
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
    </div>
  );
}
