import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logReproduceDebug, reproduceReport } from "@/lib/reproduce";

export const runtime = "nodejs";
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  logReproduceDebug("route received reproduce request", {
    reportId: id,
  });

  const report = await prisma.report.findUnique({
    where: {
      id,
    },
  });

  if (!report) {
    logReproduceDebug("route rejected missing report", {
      reportId: id,
    });

    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  if (report.classification !== "bug") {
    logReproduceDebug("route rejected non-bug report", {
      reportId: id,
      classification: report.classification,
    });

    return NextResponse.json(
      {
        error: "Only bug reports can be reproduced.",
      },
      { status: 400 },
    );
  }

  const updatedReport = await prisma.report.update({
    where: {
      id,
    },
    data: {
      reproStatus: "running",
      reproTrace: JSON.stringify([]),
      reproOutcome: null,
      screenshots: JSON.stringify([]),
      consoleOutput: JSON.stringify([]),
    },
  });
  logReproduceDebug("route marked report running", {
    reportId: id,
    previousReproStatus: report.reproStatus,
  });

  setTimeout(() => {
    logReproduceDebug("route dispatching async reproduction", {
      reportId: id,
    });
    void reproduceReport(id);
  }, 0);

  return NextResponse.json(updatedReport, { status: 202 });
}
