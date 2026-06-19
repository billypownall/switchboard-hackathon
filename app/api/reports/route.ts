import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const reports = await prisma.report.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json(reports);
}
