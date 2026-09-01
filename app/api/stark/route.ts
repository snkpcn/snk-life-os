import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { todayRange } from "@/lib/date-range";

export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };

async function buildContext(supabase: ReturnType<typeof createClient>) {
  const { startISO, endISO } = todayRange();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [
    { data: topTasks },
    { data: overdueTasks },
    { data: events },
    { data: projects },
    { data: goals },
    { data: monthTx },
    { data: assets },
    { data: debts },
  ] = await Promise.all([
    supabase.from("tasks").select("title, status, priority").eq("is_today_priority", true).is("archived_at", null),
    supabase
      .from("tasks")
      .select("title, due_date")
      .neq("status", "done")
      .is("archived_at", null)
      .lt("due_date", startISO.slice(0, 10))
      .limit(10),
    supabase
      .from("schedule_events")
      .select("title, start_time")
      .is("archived_at", null)
      .gte("start_time", startISO)
      .lt("start_time", endISO),
    supabase
      .from("projects")
      .select("name, status, next_action, blocker, explicit_progress")
      .is("archived_at", null)
      .order("priority", { ascending: true })
      .limit(8),
    supabase.from("goals").select("title, status, current_value, target_value, unit").is("archived_at", null).limit(8),
    supabase.from("transactions").select("type, amount").is("archived_at", null).gte("occurred_at", monthStart),
    supabase.from("assets").select("value").is("archived_at", null),
    supabase.from("debts").select("balance").is("archived_at", null),
  ]);

  const income = (monthTx || []).filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = (monthTx || []).filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const totalAssets = (assets || []).reduce((s, a) => s + Number(a.value), 0);
  const totalDebts = (debts || []).reduce((s, d) => s + Number(d.balance), 0);

  return `Live SNK LIFE OS data snapshot (do not invent numbers beyond this; say "unknown" if asked about something not listed here):

TOP 3 TODAY: ${(topTasks || []).map((t) => `${t.title} [${t.status}]`).join("; ") || "none set"}
OVERDUE TASKS: ${(overdueTasks || []).map((t) => `${t.title} (due ${t.due_date})`).join("; ") || "none"}
TODAY'S SCHEDULE: ${(events || []).map((e) => e.title).join("; ") || "nothing scheduled"}
ACTIVE PROJECTS: ${(projects || [])
    .map((p) => `${p.name} [${p.status}, ${p.explicit_progress ?? "?"}%] next: ${p.next_action || "—"}${p.blocker ? ` blocker: ${p.blocker}` : ""}`)
    .join(" | ") || "none"}
GOALS: ${(goals || []).map((g) => `${g.title} [${g.status}] ${g.current_value ?? "?"}/${g.target_value ?? "?"} ${g.unit || ""}`).join("; ") || "none"}
MONEY (this month): income ${income}, expense ${expense}. Total assets ${totalAssets}, total debts ${totalDebts}, net worth ${totalAssets - totalDebts}.`;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      reply:
        "Stark isn't connected yet — the ANTHROPIC_API_KEY environment variable hasn't been set on this deployment. Add it in Vercel project settings, then I'll answer from your live data.",
    });
  }

  const body = await request.json();
  const message: string = body.message || "";
  const history: ChatMessage[] = Array.isArray(body.history) ? body.history.slice(-10) : [];

  const context = await buildContext(supabase);

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 700,
    system: `You are Stark, the executive chief-of-staff inside SNK LIFE OS. Answer only from the live data snapshot provided below — never invent numbers. If something isn't in the snapshot, say it's not tracked yet and suggest where to add it. Be direct, concise, and action-oriented.\n\n${context}`,
    messages: [...history.map((m) => ({ role: m.role, content: m.content })), { role: "user" as const, content: message }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const reply = textBlock && "text" in textBlock ? textBlock.text : "…";

  return NextResponse.json({ reply });
}
