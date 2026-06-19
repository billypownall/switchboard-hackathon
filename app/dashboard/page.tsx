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

  return (
    <div className="space-y-8">
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
