"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { todayRange } from "@/lib/date-range";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";
import { buildOccurrenceList, type ScheduleMaster, type ScheduleOccurrence, type ScheduleOccurrenceException } from "@/lib/schedule-occurrences";
import { DailyNewsBrief } from "@/components/daily-news-brief";
import { CryptoTodayWidget } from "@/components/crypto/crypto-today-widget";

type Task = { id: string; title: string; status: string | null; priority: string | null; due_date: string | null };
type Project = { id: string; name: string; status: string | null; explicit_progress: number | null; priority: string | null; next_action: string | null; blocker: string | null; due_date: string | null };
type Goal = { id: string; title: string; current_value: number | null; target_value: number | null; unit: string | null; deadline: string | null; priority: string | null };
type Review = { id: string; title: string; review_date: string | null };
type CashAccount = { id: string; current_balance: number | string | null; balance_status: "CONFIRMED" | "DERIVED" | "UNKNOWN" };
type DashboardData = {
  displayName: string | null;
  priorities: Task[];
  overdue: Task[];
  events: ScheduleOccurrence[];
  projects: Project[];
  goals: Goal[];
  reviews: Review[];
  cash: CashAccount[];
  income: number;
  expense: number;
};

const EMPTY: DashboardData = { displayName: null, priorities: [], overdue: [], events: [], projects: [], goals: [], reviews: [], cash: [], income: 0, expense: 0 };
const BLACK_CARD = "rounded-2xl border border-[#292722] bg-[#111213] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.22)]";

function numeric(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function percent(value: number | null | undefined): number | null {
  return value === null || value === undefined || !Number.isFinite(value) ? null : Math.round(value);
}

function monthStartBangkok(dateOnly: string): string {
  const [year, month] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1) - 7 * 60 * 60 * 1000).toISOString();
}

export function CeoDashboard() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { startISO, endISO, dateOnly } = todayRange();

  const load = useCallback(async () => {
    const supabase = createClient();
    const today = todayRange();
    const monthStart = monthStartBangkok(today.dateOnly);
    try {
      const [profileRes, prioritiesRes, mastersRes, projectsRes, goalsRes, reviewsRes, cashRes, flowRes, overdueRes] = await Promise.all([
        supabase.from("profiles").select("display_name").maybeSingle(),
        supabase.from("tasks").select("id,title,status,priority,due_date").eq("is_today_priority", true).is("archived_at", null).neq("status", "done").order("priority_rank", { ascending: true }).limit(3),
        supabase.from("schedule_events").select("id,title,start_time,end_time,all_day,category,status,priority,location,notes,rrule").is("archived_at", null).or(`rrule.not.is.null,and(start_time.gte.${today.startISO},start_time.lt.${today.endISO})`),
        supabase.from("projects").select("id,name,status,explicit_progress,priority,next_action,blocker,due_date").is("archived_at", null).in("status", ["active", "building", "blocked"]).order("priority", { ascending: true }).limit(4),
        supabase.from("goals").select("id,title,current_value,target_value,unit,deadline,priority").is("archived_at", null).eq("status", "active").order("priority", { ascending: true }).limit(4),
        supabase.from("decisions").select("id,title,review_date").is("archived_at", null).not("review_date", "is", null).lte("review_date", today.dateOnly).is("outcome", null).order("review_date", { ascending: true }).limit(3),
        supabase.from("finance_account_balances_v1").select("id,current_balance,balance_status"),
        supabase.from("transactions").select("type,amount").is("archived_at", null).in("status", ["CONFIRMED", "PENDING_CLARIFICATION"]).in("type", ["income", "expense"]).gte("occurred_at", monthStart),
        supabase.from("tasks").select("id,title,status,priority,due_date").is("archived_at", null).neq("status", "done").lt("due_date", today.dateOnly).order("due_date", { ascending: true }).limit(3),
      ]);

      const errors = [profileRes, prioritiesRes, mastersRes, projectsRes, goalsRes, reviewsRes, cashRes, flowRes, overdueRes].filter((result) => result.error);
      if (errors.length) throw new Error("dashboard_query_failed");

      const masters = (mastersRes.data || []) as ScheduleMaster[];
      let exceptions: ScheduleOccurrenceException[] = [];
      if (masters.length) {
        const { data: exceptionData, error } = await supabase.from("schedule_event_occurrences").select("*").in("master_event_id", masters.map((event) => event.id)).gte("occurrence_date", today.dateOnly).lte("occurrence_date", today.dateOnly);
        if (error) throw new Error("schedule_occurrences_failed");
        exceptions = (exceptionData || []) as ScheduleOccurrenceException[];
      }
      const flow = flowRes.data || [];
      setData({
        displayName: profileRes.data?.display_name ?? null,
        priorities: (prioritiesRes.data || []) as Task[],
        overdue: (overdueRes.data || []) as Task[],
        events: buildOccurrenceList(masters, exceptions, new Date(today.startISO), new Date(today.endISO)).sort((a, b) => a.start_time.localeCompare(b.start_time)),
        projects: (projectsRes.data || []) as Project[],
        goals: (goalsRes.data || []) as Goal[],
        reviews: (reviewsRes.data || []) as Review[],
        cash: (cashRes.data || []) as CashAccount[],
        income: flow.filter((row) => row.type === "income").reduce((sum, row) => sum + (numeric(row.amount) ?? 0), 0),
        expense: flow.filter((row) => row.type === "expense").reduce((sum, row) => sum + (numeric(row.amount) ?? 0), 0),
      });
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const knownAccounts = data.cash.filter((account) => account.balance_status !== "UNKNOWN" && numeric(account.current_balance) !== null);
  const totalKnownCash = knownAccounts.reduce((sum, account) => sum + (numeric(account.current_balance) ?? 0), 0);
  const savingsRate = data.income > 0 ? ((data.income - data.expense) / data.income) * 100 : null;
  const trackedGoals = data.goals.map((goal) => {
    const current = numeric(goal.current_value);
    const target = numeric(goal.target_value);
    return { ...goal, progress: current !== null && target !== null && target > 0 ? Math.max(0, (current / target) * 100) : null };
  });
  const measuredGoals = trackedGoals.filter((goal) => goal.progress !== null);
  const averageGoalProgress = measuredGoals.length ? measuredGoals.reduce((sum, goal) => sum + (goal.progress ?? 0), 0) / measuredGoals.length : null;
  const measuredProjects = data.projects.map((project) => project.explicit_progress).filter((value): value is number => value !== null && Number.isFinite(value));
  const averageProjectProgress = measuredProjects.length ? measuredProjects.reduce((sum, value) => sum + value, 0) / measuredProjects.length : null;
  const attentionCount = data.overdue.length + data.reviews.length;
  const now = Date.now();
  const currentEvent = data.events.find((event) => {
    const start = new Date(event.start_time).getTime();
    const end = event.end_time ? new Date(event.end_time).getTime() : start + 60 * 60 * 1000;
    return start <= now && now <= end;
  });
  const nextEvent = data.events.find((event) => new Date(event.start_time).getTime() > now);
  const dateLabel = useMemo(() => new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date()), [locale]);

  async function toggleTask(task: Task) {
    setBusyTask(task.id);
    const next = task.status === "done" ? "todo" : "done";
    const supabase = createClient();
    const { error } = await supabase.from("tasks").update({ status: next, completed_at: next === "done" ? new Date().toISOString() : null }).eq("id", task.id);
    setBusyTask(null);
    if (!error) setRefreshKey((key) => key + 1);
  }

  return (
    <div className="-mx-4 -my-4 min-h-[calc(100vh-70px)] space-y-5 bg-[#08090a] px-4 pb-8 pt-5 text-[#f2efe8] sm:px-6 sm:pt-7">
      <section className="relative overflow-hidden rounded-3xl border border-[#393328] bg-[radial-gradient(ellipse_at_top_right,rgba(177,143,83,0.14),transparent_42%),linear-gradient(135deg,#151514_0%,#0c0d0e_58%,#10100f_100%)] p-5 sm:p-8">
        <div className="absolute right-[-3rem] top-[-5rem] h-56 w-56 rounded-full border border-[#9b814c]/15 sm:right-[-1rem] sm:top-[-7rem] sm:h-80 sm:w-80" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#c8a96d]">{t("today.ceoEyebrow")}</div>
            <h1 className="mt-3 font-serif text-3xl leading-tight tracking-wide text-[#f4efe3] sm:text-5xl">{t("today.ceoTitle")}</h1>
            <p className="mt-2 text-sm text-[#aaa69c]">{data.displayName ? t("today.ceoGreeting", { name: data.displayName }) : t("today.ceoSubtitle")}</p>
          </div>
          <div className="rounded-xl border border-[#3a352b] bg-black/20 px-3 py-2 text-right">
            <div className="text-[9px] uppercase tracking-[0.2em] text-[#938a78]">{t("today.boardDate")}</div>
            <div className="mt-1 text-sm font-medium text-[#ded6c6]">{dateLabel}</div>
          </div>
        </div>
        <div className={`relative mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${attentionCount ? "border-[#713c37]/60 bg-[#421c19]/30" : "border-[#55472e]/70 bg-[#332a1b]/30"}`}>
          <div className="flex items-center gap-3">
            <span className={`h-2 w-2 rounded-full ${attentionCount ? "bg-[#e17c6d]" : "bg-[#c8a96d]"}`} />
            <span className="text-sm font-medium text-[#e7dfd1]">{attentionCount ? t("today.attentionCount", { count: attentionCount }) : t("today.noUrgentAttention")}</span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.16em] text-[#a9a08f]">{t("today.personalOnly")}</span>
        </div>
      </section>

      {loadError && <div className="rounded-xl border border-[#713c37] bg-[#421c19]/30 px-4 py-3 text-sm text-[#f0a298]">{t("today.dashboardLoadError")}</div>}

      <section aria-label={t("today.ceoScorecard")}>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#8e887d]">{t("today.ceoScorecard")}</div>
            <h2 className="mt-1 font-serif text-xl text-[#e9e2d5]">{t("today.keyNumbers")}</h2>
          </div>
          <Link href="/money" className="text-xs text-[#c8a96d]">{t("today.moneyDetails")}</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Metric label={t("today.knownCash")} value={loaded ? formatMoney(totalKnownCash, "THB", locale) : "—"} note={t("today.knownCashNote", { count: data.cash.length - knownAccounts.length })} />
          <Metric label={t("today.netCashflowMonth")} value={loaded ? formatMoney(data.income - data.expense, "THB", locale) : "—"} note={`${t("today.incomeMonth")}: ${formatMoney(data.income, "THB", locale)} · ${t("today.expenseMonth")}: ${formatMoney(data.expense, "THB", locale)}`} tone={data.income - data.expense < 0 ? "red" : "gold"} />
          <Metric label={t("today.savingsRate")} value={loaded && savingsRate !== null ? `${Math.round(savingsRate)}%` : "—"} note={savingsRate === null ? t("today.noIncomeRecorded") : t("today.fromRecordedFlow")} tone="gold" />
          <Metric label={t("today.goalProgressAvg")} value={loaded && averageGoalProgress !== null ? `${Math.round(averageGoalProgress)}%` : "—"} note={measuredGoals.length ? t("today.measuredGoals", { count: measuredGoals.length }) : t("today.noGoalMetrics")} tone="gold" />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className={BLACK_CARD}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.19em] text-[#8e887d]">01 · {t("today.priorityBrief")}</div>
              <h2 className="mt-1 font-serif text-xl text-[#eee8dc]">{t("today.handleFirst")}</h2>
            </div>
            <Link href="/tasks" className="text-xs text-[#c8a96d]">{t("today.allTasks")}</Link>
          </div>
          {data.overdue.length > 0 && <div className="mb-4 rounded-xl border border-[#663932] bg-[#391a17]/35 p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#e28a7c]">{t("today.overdue")}</div>
            {data.overdue.map((task) => <div key={task.id} className="flex items-center justify-between gap-3 border-t border-[#60332e]/70 py-2 first:border-0">
              <span className="min-w-0 truncate text-sm text-[#f0ddd8]">{task.title}</span>
              <span className="shrink-0 text-[10px] text-[#c98b80]">{formatDate(task.due_date, locale)}</span>
            </div>)}
          </div>}
          {data.reviews.map((decision) => <Link key={decision.id} href="/decisions" className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[#56472d] bg-[#2d261a]/30 px-3 py-3">
            <span className="min-w-0"><small className="block text-[9px] uppercase tracking-[0.14em] text-[#c8a96d]">{t("today.reviewDecision")}</small><b className="mt-1 block truncate text-sm font-medium">{decision.title}</b></span>
            <span className="shrink-0 text-[10px] text-[#aaa08e]">{formatDate(decision.review_date, locale)}</span>
          </Link>)}
          {data.priorities.length > 0 ? <div className="divide-y divide-[#292722]">
            {data.priorities.map((task) => <div key={task.id} className="flex items-center gap-3 py-3">
              <button type="button" aria-label={task.status === "done" ? t("today.markUndone") : t("today.markDone")} disabled={busyTask === task.id} onClick={() => void toggleTask(task)} className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#826b40] text-xs text-[#d0b374] disabled:opacity-40">{task.status === "done" ? "✓" : ""}</button>
              <div className="min-w-0 flex-1"><b className="block truncate text-sm font-medium text-[#e8e2d7]">{task.title}</b>{task.due_date && <small className="text-[#918b80]">{formatDate(task.due_date, locale)}</small>}</div>
              <span className="rounded-full border border-[#36332d] px-2 py-1 text-[9px] uppercase tracking-wide text-[#aaa397]">{task.priority || "—"}</span>
            </div>)}
          </div> : <div className="py-4 text-sm text-[#8e887d]">{t("today.noPriorityTasks")}</div>}
          {attentionCount === 0 && data.priorities.length === 0 && <div className="mt-2 border-t border-[#292722] pt-3 text-xs text-[#9b9488]">{t("today.clearForNow")}</div>}
        </div>

        <div className={BLACK_CARD}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div><div className="text-[10px] uppercase tracking-[0.19em] text-[#8e887d]">02 · {t("today.scheduleLabel")}</div><h2 className="mt-1 font-serif text-xl text-[#eee8dc]">{t("today.todayAtAGlance")}</h2></div>
            <Link href="/schedule" className="text-xs text-[#c8a96d]">{t("today.fullSchedule")}</Link>
          </div>
          {(currentEvent || nextEvent) && <div className="mb-3 rounded-xl border border-[#56472d] bg-[#2d261a]/30 p-3">
            <small className="text-[9px] uppercase tracking-[0.15em] text-[#c8a96d]">{currentEvent ? t("today.now") : t("today.next")}</small>
            <b className="mt-1 block text-sm">{(currentEvent || nextEvent)?.title}</b>
            <span className="mt-1 block text-xs text-[#aaa397]">{formatDateTime((currentEvent || nextEvent)?.start_time, locale)}</span>
          </div>}
          {data.events.length ? <div className="divide-y divide-[#292722]">
            {data.events.map((event) => <div key={event.key} className="flex items-start gap-3 py-3">
              <span className="min-w-[52px] pt-0.5 text-xs tabular-nums text-[#c8a96d]">{new Date(event.start_time).toLocaleTimeString(locale === "th" ? "th-TH" : "en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })}</span>
              <div className="min-w-0"><b className="block truncate text-sm font-medium">{event.title}</b>{event.location && <small className="text-[#8e887d]">{event.location}</small>}</div>
            </div>)}
          </div> : <div className="py-4 text-sm text-[#8e887d]">{t("today.nothingScheduled")}</div>}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={BLACK_CARD}>
          <div className="mb-4 flex items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-[0.19em] text-[#8e887d]">03 · {t("today.lifeGoals")}</div><h2 className="mt-1 font-serif text-xl text-[#eee8dc]">{t("today.mainGoals")}</h2></div><Link href="/goals" className="text-xs text-[#c8a96d]">{t("today.allGoals")}</Link></div>
          {trackedGoals.length ? <div className="space-y-4">
            {trackedGoals.map((goal) => <div key={goal.id}>
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><b className="block truncate text-sm font-medium">{goal.title}</b>{goal.deadline && <small className="text-[#8e887d]">{t("today.goalDeadline", { date: formatDate(goal.deadline, locale) })}</small>}</div><strong className="shrink-0 font-serif text-lg text-[#d2b578]">{goal.progress === null ? "—" : `${Math.round(goal.progress)}%`}</strong></div>
              {goal.progress !== null ? <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#292722]"><div className="h-full rounded-full bg-gradient-to-r from-[#91713b] to-[#d4b778]" style={{ width: `${Math.min(100, goal.progress)}%` }} /></div> : <div className="mt-2 text-[10px] text-[#8e887d]">{t("today.goalNotMeasured")}</div>}
            </div>)}
          </div> : <div className="py-4 text-sm text-[#8e887d]">{t("today.noActiveGoals")}</div>}
        </div>

        <div className={BLACK_CARD}>
          <div className="mb-4 flex items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-[0.19em] text-[#8e887d]">04 · {t("today.projectsLabel")}</div><h2 className="mt-1 font-serif text-xl text-[#eee8dc]">{t("today.execution")}</h2></div><Link href="/projects" className="text-xs text-[#c8a96d]">{t("today.allProjects")}</Link></div>
          {data.projects.length ? <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-[#3a352b] bg-black/15 px-3 py-3"><span className="text-xs text-[#aaa397]">{t("today.averageProjectProgress")}</span><strong className="font-serif text-2xl text-[#d2b578]">{averageProjectProgress === null ? "—" : `${Math.round(averageProjectProgress)}%`}</strong></div>
            {data.projects.slice(0, 3).map((project) => {
              const progress = percent(project.explicit_progress);
              return <div key={project.id}>
                <div className="flex items-center justify-between gap-3"><b className="min-w-0 truncate text-sm font-medium">{project.name}</b><span className="shrink-0 text-xs tabular-nums text-[#c8a96d]">{progress === null ? "—" : `${progress}%`}</span></div>
                {progress !== null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#292722]"><div className="h-full rounded-full bg-gradient-to-r from-[#91713b] to-[#d4b778]" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div>}
                {(project.blocker || project.next_action) && <small className={`mt-1 block truncate ${project.blocker ? "text-[#dc8d7e]" : "text-[#8e887d]"}`}>{project.blocker || project.next_action}</small>}
              </div>;
            })}
          </div> : <div className="py-4 text-sm text-[#8e887d]">{t("today.noActiveProjects")}</div>}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3"><div><div className="text-[10px] uppercase tracking-[0.2em] text-[#8e887d]">05 · {t("today.marketPulse")}</div><h2 className="mt-1 font-serif text-xl text-[#e9e2d5]">{t("today.outsideSignals")}</h2></div><Link href="/markets" className="text-xs text-[#c8a96d]">{t("today.openMarkets")}</Link></div>
        <CryptoTodayWidget />
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3"><div><div className="text-[10px] uppercase tracking-[0.2em] text-[#8e887d]">06 · {t("today.briefing")}</div><h2 className="mt-1 font-serif text-xl text-[#e9e2d5]">{t("today.newsForContext")}</h2></div><Link href="/news" className="text-xs text-[#c8a96d]">{t("today.viewAllNews")}</Link></div>
        <DailyNewsBrief />
      </section>
      <div className="pb-2 text-center text-[9px] uppercase tracking-[0.2em] text-[#655f55]">SNK LIFE OS · PRIVATE EXECUTIVE VIEW</div>
    </div>
  );
}

function Metric({ label, value, note, tone = "neutral" }: { label: string; value: string; note: string; tone?: "neutral" | "gold" | "red" }) {
  const color = tone === "red" ? "text-[#dc8d7e]" : tone === "gold" ? "text-[#d7bb82]" : "text-[#f0eadf]";
  return <div className="rounded-2xl border border-[#292722] bg-[#111213] p-4 sm:p-5">
    <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#969084] sm:text-[10px]">{label}</div>
    <div className={`mt-3 break-words font-serif text-2xl tracking-tight sm:text-3xl ${color}`}>{value}</div>
    <div className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-[#827d73] sm:text-[11px]">{note}</div>
  </div>;
}
