"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { todayRange } from "@/lib/date-range";
import { formatDateTime, formatMoney } from "@/lib/format";
import { Card, SectionHead, EmptyState } from "@/components/ui";
import { TodayPriorities } from "@/components/today-priorities";
import { DailyNewsBrief } from "@/components/daily-news-brief";
import { useI18n } from "@/lib/i18n/context";
import { translateOption } from "@/lib/i18n";
import { buildOccurrenceList, type ScheduleMaster, type ScheduleOccurrenceException, type ScheduleOccurrence } from "@/lib/schedule-occurrences";

type Task = { id: string; title: string; status: string | null; priority: string | null; due_date?: string | null };
type Project = { id: string; name: string; status: string | null; explicit_progress: number | null; priority: string | null };

export default function TodayPage() {
  const { t, locale } = useI18n();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [topTasks, setTopTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<ScheduleOccurrence[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [money, setMoney] = useState({ income: 0, expense: 0, totalAssets: 0, totalDebts: 0 });
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { startISO, endISO, dateOnly } = todayRange();
    const monthStart = `${dateOnly.slice(0, 7)}-01`;

    const [{ data: profile }, { data: top }, { data: masters }, { data: proj }, { data: monthTx }, { data: assets }, { data: debts }, { data: overdue }] =
      await Promise.all([
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
          .select("id, title, start_time, end_time, all_day, category, status, priority, location, notes, rrule")
          .is("archived_at", null)
          .or(`rrule.not.is.null,and(start_time.gte.${startISO},start_time.lt.${endISO})`),
        supabase
          .from("projects")
          .select("id, name, status, explicit_progress, priority")
          .is("archived_at", null)
          .order("priority", { ascending: true })
          .limit(4),
        supabase.from("transactions").select("type, amount").is("archived_at", null).gte("occurred_at", monthStart),
        supabase.from("assets").select("value").is("archived_at", null),
        supabase.from("debts").select("balance").is("archived_at", null),
        supabase
          .from("tasks")
          .select("id, title, status, priority, due_date")
          .is("archived_at", null)
          .neq("status", "done")
          .lt("due_date", dateOnly)
          .order("due_date", { ascending: true })
          .limit(3),
      ]);

    setDisplayName(profile?.display_name ?? null);
    setTopTasks(top || []);

    const masterList = (masters || []) as ScheduleMaster[];
    const masterIds = masterList.map((m) => m.id);
    let exceptionRows: ScheduleOccurrenceException[] = [];
    if (masterIds.length > 0) {
      const { data: exData } = await supabase
        .from("schedule_event_occurrences")
        .select("*")
        .in("master_event_id", masterIds)
        .gte("occurrence_date", startISO.slice(0, 10))
        .lte("occurrence_date", dateOnly);
      exceptionRows = (exData || []) as ScheduleOccurrenceException[];
    }
    setEvents(buildOccurrenceList(masterList, exceptionRows, new Date(startISO), new Date(endISO)));
    setProjects(proj || []);
    setOverdueTasks(overdue || []);
    const income = (monthTx || []).filter((x) => x.type === "income").reduce((s, x) => s + Number(x.amount), 0);
    const expense = (monthTx || []).filter((x) => x.type === "expense").reduce((s, x) => s + Number(x.amount), 0);
    const totalAssets = (assets || []).reduce((s, a) => s + Number(a.value), 0);
    const totalDebts = (debts || []).reduce((s, d) => s + Number(d.balance), 0);
    setMoney({ income, expense, totalAssets, totalDebts });
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const nowMs = Date.now();
  const nowEvent = events.find((e) => {
    const start = new Date(e.start_time).getTime();
    const end = e.end_time ? new Date(e.end_time).getTime() : start + 60 * 60 * 1000;
    return start <= nowMs && nowMs <= end;
  });
  const nextEvent = events
    .filter((e) => new Date(e.start_time).getTime() > nowMs)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

  return (
    <div>
      <Card className="relative overflow-hidden bg-gradient-to-br from-panel to-panel2">
        <div className="text-[11px] uppercase tracking-[0.12em] text-muted">{t("nav.today")}</div>
        <h1 className="my-2 text-[28px] font-extrabold leading-tight tracking-tight">
          {displayName ? t("today.welcomeBackNamed", { name: displayName }) : t("today.welcomeBack")}
        </h1>
        <p className="text-muted">{t("today.tagline")}</p>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <b className="block text-xs text-muted">{t("today.now")}</b>
          {nowEvent ? (
            <>
              <span className="mt-1 block text-sm font-semibold">{nowEvent.title}</span>
              <small className="text-muted">{formatDateTime(nowEvent.start_time, locale)}</small>
            </>
          ) : (
            <span className="mt-1 block text-sm text-muted">{t("today.nothingInProgress")}</span>
          )}
        </Card>
        <Card>
          <b className="block text-xs text-muted">{t("today.next")}</b>
          {nextEvent ? (
            <>
              <span className="mt-1 block text-sm font-semibold">{nextEvent.title}</span>
              <small className="text-muted">{formatDateTime(nextEvent.start_time, locale)}</small>
            </>
          ) : (
            <span className="mt-1 block text-sm text-muted">{t("today.nothingUpNext")}</span>
          )}
        </Card>
      </div>

      <SectionHead title={t("today.moneySnapshot")} action={<Link href="/money" className="text-xs text-gold">{t("today.open")}</Link>} />
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <b className="block text-xs text-muted">{t("today.incomeMonth")}</b>
          <span className="mt-2 block text-xl font-bold">{formatMoney(money.income, "THB", locale)}</span>
        </Card>
        <Card>
          <b className="block text-xs text-muted">{t("today.expenseMonth")}</b>
          <span className="mt-2 block text-xl font-bold">{formatMoney(money.expense, "THB", locale)}</span>
        </Card>
        <Card>
          <b className="block text-xs text-muted">{t("today.totalAssets")}</b>
          <span className="mt-2 block text-xl font-bold">{formatMoney(money.totalAssets, "THB", locale)}</span>
        </Card>
        <Card>
          <b className="block text-xs text-muted">{t("today.totalDebts")}</b>
          <span className="mt-2 block text-xl font-bold">{formatMoney(money.totalDebts, "THB", locale)}</span>
        </Card>
      </div>

      <SectionHead title={t("today.top3Today")} action={<Link href="/tasks" className="text-xs text-gold">{t("today.allTasks")}</Link>} />
      <TodayPriorities tasks={topTasks} onChanged={() => setRefreshKey((k) => k + 1)} />

      {overdueTasks.length > 0 && (
        <>
          <SectionHead title={t("today.attentionRequired")} />
          <Card>
            {overdueTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between border-b border-line py-2 last:border-0">
                <b className="text-sm">{task.title}</b>
                <span className="rounded-full bg-red/10 px-2 py-1 text-[10px] uppercase text-red">{task.due_date}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      <SectionHead title={t("today.todaysSchedule")} action={<Link href="/schedule" className="text-xs text-gold">{t("today.fullSchedule")}</Link>} />
      <Card>
        {events.length === 0 && <EmptyState label={t("today.nothingScheduled")} />}
        {events.map((e) => (
          <div key={e.key} className="flex items-center justify-between border-b border-line py-3 last:border-0">
            <div>
              <b className="block text-sm">{e.title}</b>
              <small className="text-muted">{formatDateTime(e.start_time, locale)}</small>
            </div>
            <span className="rounded-full bg-panel2 px-2 py-1 text-[10px] uppercase text-muted">
              {translateOption(locale, e.status || "", e.status || "")}
            </span>
          </div>
        ))}
      </Card>

      <SectionHead title={t("today.projectProgress")} action={<Link href="/projects" className="text-xs text-gold">{t("today.allProjects")}</Link>} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {projects.length === 0 && <EmptyState label={t("today.noActiveProjects")} />}
        {projects.map((p) => (
          <Card key={p.id}>
            <b className="block text-sm">{p.name}</b>
            <small className="text-muted">{translateOption(locale, p.status || "", p.status || "")}</small>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold to-goldDark"
                style={{ width: `${Math.max(0, Math.min(100, p.explicit_progress ?? 0))}%` }}
              />
            </div>
          </Card>
        ))}
      </div>

      <SectionHead title={t("today.dailyNewsBrief")} action={<Link href="/news" className="text-xs text-gold">{t("today.viewAllNews")}</Link>} />
      <DailyNewsBrief />
    </div>
  );
}
