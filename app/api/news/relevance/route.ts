import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildTodayContext, buildTasksContext, buildMoneyContext, buildProjectsGoalsContext } from "@/lib/stark-context";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const locale = body.locale === "th" ? "th" : "en";
  const article = body.article as { headline?: string; summary?: string } | undefined;
  if (!article?.headline) return NextResponse.json({ error: "Missing article" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ interpretation: null, reason: "not_connected" });
  }

  const [today, tasks, money, projectsGoals] = await Promise.all([
    buildTodayContext(supabase),
    buildTasksContext(supabase),
    buildMoneyContext(supabase),
    buildProjectsGoalsContext(supabase),
  ]);
  const context = [today, tasks, money, projectsGoals].join("\n");
  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 300,
    system: `You are Stark inside SNK LIFE OS. Given one news article and a live snapshot of the user's own data (businesses, money, portfolio, projects, goals), write ONE short paragraph (2-3 sentences max) on whether and how this news could plausibly matter to this specific user, grounded only in the data given. This is explicitly a labeled interpretation, not a fact — hedge appropriately ("could", "may"), and say plainly if there is no clear connection rather than forcing one. Respond in ${locale === "th" ? "Thai" : "English"}, plain text only, no preamble.\n\nUSER DATA SNAPSHOT:\n${context}\n\nARTICLE:\nHeadline: ${article.headline}\nSummary: ${article.summary || ""}`,
    messages: [{ role: "user", content: locale === "th" ? "ข่าวนี้เกี่ยวข้องกับฉันอย่างไร?" : "How might this news relate to me?" }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const interpretation = textBlock && "text" in textBlock ? textBlock.text : null;

  return NextResponse.json({ interpretation, reason: "ok" });
}
