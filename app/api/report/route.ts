import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logTriageDebug, triage } from "@/lib/triage";
import { triageToReportData } from "@/lib/triagePersistence";
import { logReproduceDebug, startReproduction } from "@/lib/reproduce";

export const maxDuration = 300;

export const runtime = "nodejs";

const ReportSchema = z.object({
  whatHappened: z.string().min(1),
  expected: z.string().min(1),
  steps: z.string().min(1),
  pageUrl: z.string().min(1),
  userAgent: z.string().min(1),
  consoleErrors: z.array(z.string()).default([]),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = ReportSchema.safeParse(body);

  if (!parsed.success) {
    logTriageDebug("rejected invalid report payload", {
      issues: parsed.error.issues.length,
    });

    return NextResponse.json(
      {
        error: "Invalid report payload.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  logTriageDebug("received report submission", {
    pageUrl: parsed.data.pageUrl,
    consoleErrorCount: parsed.data.consoleErrors.length,
    whatHappenedLength: parsed.data.whatHappened.length,
    expectedLength: parsed.data.expected.length,
    stepsLength: parsed.data.steps.length,
  });

  const rawReport = await prisma.report.create({
    data: {
      ...parsed.data,
      consoleErrors: JSON.stringify(parsed.data.consoleErrors),
    },
  });
  logTriageDebug("stored raw report", {
    reportId: rawReport.id,
    status: rawReport.status,
  });

  const result = await triage(rawReport);
  const report = await prisma.report.update({
    where: {
      id: rawReport.id,
    },
    data: triageToReportData(result),
  });
  logTriageDebug("stored triage result", {
    reportId: report.id,
    status: report.status,
    classification: report.classification,
    severity: report.severity,
    suggestedPriority: report.suggestedPriority,
  });

  if (report.classification === "bug") {
    logReproduceDebug("auto-starting reproduction after triage", {
      reportId: report.id,
    });
    const runningReport = await startReproduction(report.id);
    return NextResponse.json(runningReport, { status: 201 });
  }

  return NextResponse.json(report, { status: 201 });
}
