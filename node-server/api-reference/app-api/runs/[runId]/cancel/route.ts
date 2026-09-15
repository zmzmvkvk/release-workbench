import { NextResponse } from "next/server";
import { cancelRun, getRun } from "@/lib/run-store";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const { runId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const run = getRun(runId);
  if (!run) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const event = cancelRun(runId, body.reason ?? "user_cancelled");
  return NextResponse.json({ ok: true, event });
}
