import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { fetchCategory } from "@/lib/news/aggregate";

export const dynamic = "force-dynamic";

type BriefPoint = { headline: string; what_happened: string; why_it_matters: string; source: string; article_url: string };

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const locale = searchParams.get("lang") === "th" ? "th" : "en";

  const [world, thailand] = await Promise.all([fetchCategory("world"), fetchCategory("thailand")]);
  const pool = [...world.articles.slice(0, 6), ...thailand.articles.slice(0, 6)];

  if (pool.length === 0) {
    return NextResponse.json({ points: [], generated_by: "none", fetched_at: new Date().toISOString() });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const points: BriefPoint[] = pool.slice(0, 6).map((a) => ({
      headline: a.headline,
      what_happened: a.headline,
      why_it_matters: a.summary,
      source: a.source,
      article_url: a.article_url,
    }));
    return NextResponse.json({ points, generated_by: "mechanical", fetched_at: new Date().toISOString() });
  }

  const articlesText = pool
    .map((a, i) => `${i + 1}. [${a.category}/${a.region}] ${a.headline} — ${a.summary} (source: ${a.source})`)
    .join("\n");

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 900,
    system: `You produce a concise executive news brief ("Today in 60 Seconds") for a private life-management app. You are given a numbered list of real news headlines and summaries — use ONLY these, never invent facts, names, or numbers not present in them. Select the 5 to 8 most important, prioritizing world and Thailand developments (geopolitics, economy, central banks, markets, major corporate/tech events, major disasters) over routine or celebrity news. Respond in ${locale === "th" ? "Thai" : "English"}. Respond ONLY with a raw JSON array, no prose, no markdown code fences, shaped exactly as: [{"headline": string, "what_happened": string (one sentence), "why_it_matters": string (one sentence), "source_index": number (the 1-based index into the given list)}]`,
    messages: [{ role: "user", content: articlesText }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "[]";

  let points: BriefPoint[] = [];
  try {
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/, "");
    const parsed: Array<{ headline: string; what_happened: string; why_it_matters: string; source_index: number }> = JSON.parse(cleaned);
    points = parsed
      .map((p) => {
        const src = pool[p.source_index - 1];
        if (!src) return null;
        return { headline: p.headline, what_happened: p.what_happened, why_it_matters: p.why_it_matters, source: src.source, article_url: src.article_url };
      })
      .filter((p): p is BriefPoint => p !== null);
  } catch {
    points = pool.slice(0, 6).map((a) => ({ headline: a.headline, what_happened: a.headline, why_it_matters: a.summary, source: a.source, article_url: a.article_url }));
  }

  return NextResponse.json({ points, generated_by: "ai", fetched_at: new Date().toISOString() });
}
