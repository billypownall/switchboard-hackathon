import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { triage } from "@/lib/triage";
import { triageToReportData } from "@/lib/triagePersistence";

export const runtime = "nodejs";

const FollowUpSchema = z.object({
  followUpAnswer: z.string().min(1),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const report = await prisma.report.findUnique({
    where: {
      id,
    },
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  return NextResponse.json(report);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  const parsed = FollowUpSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid follow-up payload.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const reportWithAnswer = await prisma.report.update({
    where: {
      id,
    },
    data: {
      followUpAnswer: parsed.data.followUpAnswer,
    },
  });

  const result = await triage(reportWithAnswer);
  const report = await prisma.report.update({
    where: {
      id,
    },
    data: triageToReportData(result),
  });

  return NextResponse.json(report);
}
