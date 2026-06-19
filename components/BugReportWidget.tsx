"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";

type SubmittedReport = {
  id: string;
  status: string;
  classification: "bug" | "feature_request" | "unclear" | null;
  triageSummary: string | null;
  triageConfidence: number | null;
  severity: "critical" | "high" | "medium" | "low" | null;
  suggestedPriority: "p0" | "p1" | "p2" | "p3" | null;
  followUpQuestion: string | null;
};

type ReportForm = {
  whatHappened: string;
  expected: string;
  steps: string;
};

const initialForm: ReportForm = {
  whatHappened: "",
  expected: "",
  steps: "",
};

function serializeConsoleArgs(args: unknown[]) {
  return args
    .map((arg) => {
      if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}`;
      }

      if (typeof arg === "string") {
        return arg;
      }

      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
}

export function BugReportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<ReportForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<SubmittedReport | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [consoleErrorCount, setConsoleErrorCount] = useState(0);
  const consoleErrorsRef = useRef<string[]>([]);

  useEffect(() => {
    const originalConsoleError = console.error;

    console.error = (...args: unknown[]) => {
      consoleErrorsRef.current = [...consoleErrorsRef.current, serializeConsoleArgs(args)].slice(-20);
      setConsoleErrorCount(consoleErrorsRef.current.length);
      originalConsoleError(...args);
    };

    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  function updateField(field: keyof ReportForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function dismiss() {
    setIsOpen(false);
    setSubmittedReport(null);
    setError(null);
    setFollowUpAnswer("");
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSubmittedReport(null);

    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          pageUrl: window.location.pathname + window.location.search,
          userAgent: navigator.userAgent,
          consoleErrors: consoleErrorsRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error("Report submission failed.");
      }

      const report = (await response.json()) as SubmittedReport;
      setSubmittedReport(report);
      setForm(initialForm);
      setFollowUpAnswer("");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!submittedReport) {
      return;
    }

    setIsSubmittingFollowUp(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/${submittedReport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followUpAnswer,
        }),
      });

      if (!response.ok) {
        throw new Error("Follow-up submission failed.");
      }

      const report = (await response.json()) as SubmittedReport;
      setSubmittedReport(report);
      setFollowUpAnswer("");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Something went wrong.");
    } finally {
      setIsSubmittingFollowUp(false);
    }
  }

  function classificationLabel(report: SubmittedReport) {
    if (report.classification === "feature_request") {
      return "Feature request";
    }

    if (report.classification === "bug") {
      return `Bug${report.severity ? ` · ${report.severity}` : ""}`;
    }

    if (report.classification === "unclear") {
      return "Unclear";
    }

    return "Pending";
  }

  return (
    <>
      <button
        className="fixed bottom-6 right-6 z-40 rounded-full bg-slate-950 px-5 py-3 font-bold text-white shadow-xl hover:bg-slate-800"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Feedback
      </button>

      {isOpen ? (
        <div
          aria-labelledby="bug-report-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-700">
                  QuickCart feedback
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950" id="bug-report-title">
                  Tell us what went wrong
                </h2>
              </div>
              <button
                aria-label="Close bug report"
                className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 hover:bg-slate-50"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={submitReport}>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">What happened?</span>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2"
                  onChange={(event) => updateField("whatHappened", event.target.value)}
                  required
                  value={form.whatHappened}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  What did you expect?
                </span>
                <textarea
                  className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2"
                  onChange={(event) => updateField("expected", event.target.value)}
                  required
                  value={form.expected}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Steps you took</span>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2"
                  onChange={(event) => updateField("steps", event.target.value)}
                  placeholder="Example: added espresso maker, applied SAVE10, changed quantity to 2..."
                  required
                  value={form.steps}
                />
              </label>

              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                We will also attach the current page, browser, and the last{" "}
                {consoleErrorCount} console errors captured in this session.
              </div>

              {submittedReport ? (
                <div className="space-y-3 rounded-xl bg-green-50 p-3 text-sm text-green-900">
                  <p className="font-semibold">
                    Report {submittedReport.id} submitted with status {submittedReport.status}.
                  </p>
                  <div className="rounded-lg bg-white/70 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-green-700">
                      Triage result
                    </p>
                    <p className="mt-1 font-bold">{classificationLabel(submittedReport)}</p>
                    {submittedReport.triageSummary ? (
                      <p className="mt-1 text-green-800">{submittedReport.triageSummary}</p>
                    ) : null}
                    {submittedReport.suggestedPriority ? (
                      <p className="mt-1 text-green-800">
                        Suggested priority: {submittedReport.suggestedPriority.toUpperCase()}
                      </p>
                    ) : null}
                  </div>

                  {submittedReport.classification === "unclear" &&
                  submittedReport.followUpQuestion ? (
                    <form className="space-y-2" onSubmit={submitFollowUp}>
                      <label className="block">
                        <span className="text-sm font-bold text-green-950">
                          {submittedReport.followUpQuestion}
                        </span>
                        <textarea
                          className="mt-2 min-h-20 w-full rounded-xl border border-green-200 px-3 py-2 text-slate-950"
                          onChange={(event) => setFollowUpAnswer(event.target.value)}
                          required
                          value={followUpAnswer}
                        />
                      </label>
                      <button
                        className="rounded-full bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-green-300"
                        disabled={isSubmittingFollowUp}
                        type="submit"
                      >
                        {isSubmittingFollowUp ? "Sending..." : "Send follow-up"}
                      </button>
                    </form>
                  ) : null}

                  <Link
                    className="mt-2 inline-flex text-green-950 underline underline-offset-4 hover:text-green-700"
                    href={`/dashboard/${submittedReport.id}`}
                    onClick={dismiss}
                  >
                    View this issue on the dashboard
                  </Link>
                </div>
              ) : null}
              {error ? (
                <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
                  {error}
                </p>
              ) : null}

              <button
                className="w-full rounded-full bg-cyan-500 px-5 py-3 font-bold text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Submitting..." : "Submit report"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
