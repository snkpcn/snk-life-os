import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchCategory } from "@/lib/news/aggregate";
import type { NewsCategory } from "@/lib/news/types";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES: NewsCategory[] = ["world", "thailand", "business", "markets", "tech"];

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") as NewsCategory | null;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  if (!category || !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid or missing category" }, { status: 400 });
  }

  const { articles, failedProviders } = await fetchCategory(category);
  const limited = limit ? articles.slice(0, limit) : articles;

  return NextResponse.json({
    articles: limited,
    partial: failedProviders.length > 0,
    failedProviders,
    fetched_at: new Date().toISOString(),
  });
}
