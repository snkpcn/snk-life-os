import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchCoinDetail, fetchChart } from "@/lib/crypto/coingecko";
import { CHART_RANGE_DAYS, type CryptoChartRange } from "@/lib/crypto/types";

export const dynamic = "force-dynamic";

const VALID_RANGES = Object.keys(CHART_RANGE_DAYS) as CryptoChartRange[];

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const range = (searchParams.get("range") as CryptoChartRange) || "1M";
  const days = CHART_RANGE_DAYS[VALID_RANGES.includes(range) ? range : "1M"];

  const [asset, chart] = await Promise.all([fetchCoinDetail(params.id), fetchChart(params.id, days)]);

  if (!asset) {
    return NextResponse.json({ asset: null, chart: [], fetched_at: new Date().toISOString() }, { status: 200 });
  }

  return NextResponse.json({ asset, chart, range, fetched_at: new Date().toISOString() });
}
