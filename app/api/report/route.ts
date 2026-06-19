import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { triage } from "@/lib/triage";
import { triageToReportData } from "@/lib/triagePersistence";

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
    return NextResponse.json(
      {
        error: "Invalid report payload.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const rawReport = await prisma.report.create({
    data: {
      ...parsed.data,
      consoleErrors: JSON.stringify(parsed.data.consoleErrors),
    },
  });
  const result = await triage(rawReport);
  const report = await prisma.report.update({
    where: {
      id: rawReport.id,
    },
    data: triageToReportData(result),
  });

  return NextResponse.json(report, { status: 201 });
}
