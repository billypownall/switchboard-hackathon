import { NextResponse } from "next/server";

export const runtime = "nodejs";

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { fast?: boolean };

  await wait(body.fast ? 75 : 300);

  return NextResponse.json({
    orderId: `QC-${Date.now().toString(36).toUpperCase()}`,
  });
}
