import { NextResponse } from 'next/server';
import { personalReadiness } from '@/lib/snk-money/readiness';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const body = await personalReadiness();
  return NextResponse.json(body, { status: body.ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
