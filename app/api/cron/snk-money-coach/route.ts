import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/snk-money/cron-auth.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ok: true, skipped: "pull_only_disabled", sent: 0 }, { headers: { "Cache-Control": "no-store" } });
}
