import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayRange } from "@/lib/date-range";
import { formatDateTime, formatMoney } from "@/lib/format";
import { Card, SectionHead, EmptyState } from "@/components/ui";
import { TodayPriorities } from "@/components/today-priorities";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const supabase = createClient();
  const { startISO, endISO } = todayRange();

  const [
    { data: profile },
    { data: topTasks },
    { data: events },
    { data: projects },
    { data: monthTx },
    { data: assets },
    { data: debts },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name").maybeSingle(),
    supabase
      .from("tasks")
      .select("id, title, status, priority")
      .eq("is_today_priority", true)
      .is("archived_at", null)
      .order("priority_rank", { ascending: true })
      .limit(5),
    supabase
      .from("schedule_events")
      .select("id, title, start_time, end_time, category, status")
      .is("archived_at", null)
      .gte("start_time", startISO)
      .lt("start_time", endISO)
      .order("start_time", { ascending: true }),
    supabase
      .from("projects")
      .select("id, name, status, explicit_progress, priority")
      .is("archived_at", null)
      .order("priority", { ascending: true })
      .limit(4),
    supabase
      .from("transactions")
      .select("type, amount")
      .is("archived_at", null)
      .gte("occurred_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)),
    supabase.from("assets").select("value").is("archived_at", null),
    supabase.from("debts").select("balance").is("archived_at", null),
  ]);

  const income = (monthTx || []).filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = (monthTx || []).filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const totalAssets = (assets || []).reduce((s, a) => s + Number(a.value), 0);
  const totalDebts = (debts || []).reduce((s, d) => s + Number(d.balance), 0);

  return (
    <div>
      <Card className="relative overflow-hidden bg-gradient-to-br from-panel to-panel2">
        <div className="text-[11px] uppercase tracking-[0.12em] text-muted">Today</div>
        <h1 className="my-2 text-[28px] font-extrabold leading-tight tracking-tight">
          Welcome back{profile?.display_name ? `, ${profile.display_name}` : ""}
        </h1>
        <p className="text-muted">Money · Projects · Schedule · Goals — in one screen.</p>
      </Card>

      <SectionHead title="Money Snapshot" action={<Link href="/money" className="text-xs text-gold">Open →</Link>} />
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <b className="block text-xs text-muted">Income (month)</b>
          <span className="mt-2 block text-xl font-bold">{formatMoney(income)}</span>
        </Card>
        <Card>
          <b className="block text-xs text-muted">Expense (month)</b>
          <span className="mt-2 block text-xl font-bold">{formatMoney(expense)}</span>
        </Card>
        <Card>
          <b className="block text-xs text-muted">Total Assets</b>
          <span className="mt-2 block text-xl font-bold">{formatMoney(totalAssets)}</span>
        </Card>
        <Card>
          <b className="block text-xs text-muted">Total Debts</b>
          <span className="mt-2 block text-xl font-bold">{formatMoney(totalDebts)}</span>
        </Card>
      </div>

      <SectionHead title="Top 3 Today" action={<Link href="/tasks" className="text-xs text-gold">All tasks →</Link>} />
      <TodayPriorities tasks={topTasks || []} />

      <SectionHead title="Today's Schedule" action={<Link href="/schedule" className="text-xs text-gold">Full schedule →</Link>} />
      <Card>
        {(events || []).length === 0 && <EmptyState label="Nothing scheduled today." />}
        {(events || []).map((e) => (
          <div key={e.id} className="flex items-center justify-between border-b border-line py-3 last:border-0">
            <div>
              <b className="block text-sm">{e.title}</b>
              <small className="text-muted">{formatDateTime(e.start_time)}</small>
            </div>
            <span className="rounded-full bg-panel2 px-2 py-1 text-[10px] uppercase text-muted">{e.status}</span>
          </div>
        ))}
      </Card>

      <SectionHead title="Project Progress" action={<Link href="/projects" className="text-xs text-gold">All projects →</Link>} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(projects || []).length === 0 && <EmptyState label="No active projects yet." />}
        {(projects || []).map((p) => (
          <Card key={p.id}>
            <b className="block text-sm">{p.name}</b>
            <small className="text-muted">{p.status}</small>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold to-goldDark"
                style={{ width: `${Math.max(0, Math.min(100, p.explicit_progress ?? 0))}%` }}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
