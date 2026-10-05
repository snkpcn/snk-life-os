"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, SectionHead } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { todayRange } from "@/lib/date-range";
import { useI18n } from "@/lib/i18n/context";

// Cash overview for SNK MONEY.  Reads the owner-scoped finance_* views (security_invoker => RLS applies, so
// this only ever shows the signed-in owner's rows).  It never computes a balance: current_balance comes from
// the database's single derivation, and an UNKNOWN balance is shown as "—", never as 0.

type BalanceStatus = "CONFIRMED" | "DERIVED" | "UNKNOWN";
type AccountRow = { id: string; name: string; account_type: string; currency: string; current_balance: number | string | null; balance_status: BalanceStatus };
type UpcomingRow = { id: string; title: string; type: "income" | "expense"; amount: number | string | null; frequency: string; due_date: string; days_until: number; overdue: boolean; account_name: string | null };
type TxRow = { id: string; type: string; status: string; amount: number | string; occurred_at: string; account_name: string | null; to_account_name: string | null; category: string | null; merchant: string | null; description: string | null };
type Spend = { today: number; week: number; month: number; income: number; pending: number };

const BADGE: Record<BalanceStatus, string> = {
  CONFIRMED: "border-green/50 bg-green/10 text-green",
  DERIVED: "border-amber/50 bg-amber/10 text-amber",
  UNKNOWN: "border-line bg-panel2 text-muted",
};

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function bangkokYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function weekStart(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(ymd, -((dow + 6) % 7));
}

export function MoneyCashOverview({ refreshKey }: { refreshKey?: number }) {
  const { t, locale } = useI18n();
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingRow[]>([]);
  const [recent, setRecent] = useState<TxRow[]>([]);
  const [spend, setSpend] = useState<Spend | null>(null);
  const [horizon, setHorizon] = useState<7 | 30>(7);
  const [error, setError] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const today = todayRange().dateOnly;
    const monthStart = `${today.slice(0, 7)}-01`;
    const wk = weekStart(today);
    (async () => {
      try {
        const [acc, up, rec, flow] = await Promise.all([
          supabase.from("finance_account_balances_v1").select("id,name,account_type,currency,current_balance,balance_status").order("name"),
          supabase.from("finance_upcoming_v1").select("id,title,type,amount,frequency,due_date,days_until,overdue,account_name").lte("days_until", 30).order("due_date"),
          supabase.from("finance_recent_transactions_v1").select("id,type,status,amount,occurred_at,account_name,to_account_name,category,merchant,description").order("seq", { ascending: false }).limit(8),
          supabase.from("finance_recent_transactions_v1").select("type,status,amount,occurred_on").in("type", ["income", "expense"]).gte("occurred_on", monthStart),
        ]);
        if (acc.error || up.error || rec.error || flow.error) throw new Error("finance overview query failed");
        setAccounts((acc.data || []) as AccountRow[]);
        setUpcoming((up.data || []) as UpcomingRow[]);
        setRecent((rec.data || []) as TxRow[]);
        const rows = (flow.data || []) as Array<{ type: string; status: string; amount: number | string; occurred_on: string }>;
        const sum = (pred: (r: (typeof rows)[number]) => boolean) => rows.filter(pred).reduce((s, r) => s + (num(r.amount) ?? 0), 0);
        setSpend({
          today: sum((r) => r.type === "expense" && r.occurred_on === today),
          week: sum((r) => r.type === "expense" && r.occurred_on >= wk),
          month: sum((r) => r.type === "expense"),
          income: sum((r) => r.type === "income"),
          pending: rows.filter((r) => r.status === "PENDING_CLARIFICATION").length,
        });
        setError(false);
      } catch {
        setError(true);
      }
    })();
  }, [refreshKey]);

  const known = (accounts || []).filter((a) => a.balance_status !== "UNKNOWN" && num(a.current_balance) !== null);
  const unknownCount = (accounts || []).length - known.length;
  const totalKnown = known.reduce((s, a) => s + (num(a.current_balance) ?? 0), 0);
  const visibleUpcoming = upcoming.filter((u) => u.overdue || u.days_until <= horizon);
  const overdue = visibleUpcoming.filter((u) => u.overdue);
  const due = visibleUpcoming.filter((u) => !u.overdue);
  const outflow = due.filter((u) => u.type === "expense").reduce((s, u) => s + (num(u.amount) ?? 0), 0);
  const label = (s: BalanceStatus) => (s === "CONFIRMED" ? t("moneyPage.balanceConfirmed") : s === "DERIVED" ? t("moneyPage.balanceDerived") : t("moneyPage.balanceUnknown"));
  const hint = (s: BalanceStatus) => (s === "CONFIRMED" ? t("moneyPage.balanceConfirmedHint") : s === "DERIVED" ? t("moneyPage.balanceDerivedHint") : t("moneyPage.balanceUnknownHint"));

  if (error) return <Card className="mb-4 text-sm text-red">{t("moneyPage.loadError")}</Card>;

  return (
    <div className="mb-4 space-y-3">
      <Card>
        <b className="block text-xs text-muted">{t("moneyPage.totalAvailable")}</b>
        <span className="mt-2 block text-3xl font-bold">{accounts ? formatMoney(totalKnown, "THB", locale) : "—"}</span>
        {accounts && (
          <small className="mt-1 block text-muted">
            {t("moneyPage.totalAvailableNote", { n: known.length })}
            {unknownCount > 0 && <> {t("moneyPage.unknownExcluded", { n: unknownCount })}</>}
          </small>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <b className="block text-[11px] text-muted">{t("moneyPage.incomeMo")}</b>
          <span className="mt-1 block text-sm font-bold text-green">{formatMoney(spend?.income, "THB", locale)}</span>
        </Card>
        <Card>
          <b className="block text-[11px] text-muted">{t("moneyPage.expenseMo")}</b>
          <span className="mt-1 block text-sm font-bold text-red">{formatMoney(spend?.month, "THB", locale)}</span>
        </Card>
        <Card>
          <b className="block text-[11px] text-muted">{t("moneyPage.netCashflow")}</b>
          <span className="mt-1 block text-sm font-bold">{spend ? formatMoney(spend.income - spend.month, "THB", locale) : "—"}</span>
        </Card>
      </div>

      <Card className="grid grid-cols-3 gap-2 text-center">
        {([["today", spend?.today], ["thisWeek", spend?.week], ["thisMonth", spend?.month]] as const).map(([k, v]) => (
          <div key={k}>
            <small className="block text-muted">{t(`moneyPage.${k}`)} · {t("moneyPage.spent")}</small>
            <b className="text-sm">{formatMoney(v, "THB", locale)}</b>
          </div>
        ))}
      </Card>
      {spend && spend.pending > 0 && <small className="block px-1 text-amber">{t("moneyPage.pendingClarification", { n: spend.pending })}</small>}

      <SectionHead
        title={t("moneyPage.upcoming")}
        subtitle={t("moneyPage.forecastNote")}
        action={
          <div className="flex gap-1">
            {([7, 30] as const).map((h) => (
              <button key={h} onClick={() => setHorizon(h)} className={`rounded-full border px-3 py-1 text-xs font-bold ${horizon === h ? "border-gold bg-gold/10 text-gold" : "border-line text-muted"}`}>
                {t(h === 7 ? "moneyPage.upcoming7" : "moneyPage.upcoming30")}
              </button>
            ))}
          </div>
        }
      />
      <Card>
        {overdue.length === 0 && due.length === 0 && <div className="py-3 text-center text-sm text-muted">{t("moneyPage.nothingUpcoming")}</div>}
        {overdue.length > 0 && (
          <div className="mb-3">
            <b className="mb-1 block text-xs text-red">{t("moneyPage.overdue")}</b>
            {overdue.map((u) => <UpcomingLine key={`o-${u.id}`} u={u} />)}
          </div>
        )}
        {due.map((u) => <UpcomingLine key={u.id} u={u} />)}
        {due.length > 0 && <div className="mt-2 border-t border-line pt-2 text-right text-sm font-bold">{formatMoney(outflow, "THB", locale)}</div>}
      </Card>

      <SectionHead title={t("moneyPage.accountBalances")} action={<Link href="/money?tab=accounts" className="text-xs text-gold">{t("moneyPage.viewAll")}</Link>} />
      <Card>
        {accounts && accounts.length === 0 && <div className="py-3 text-center text-sm text-muted">{t("moneyPage.noAccounts")}</div>}
        {(accounts || []).map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0">
            <div className="min-w-0">
              <b className="block truncate text-sm">{a.name}</b>
              <small className="text-muted">{hint(a.balance_status)}</small>
            </div>
            <div className="text-right">
              <b className="block text-sm">{a.balance_status === "UNKNOWN" ? "—" : formatMoney(num(a.current_balance), a.currency, locale)}</b>
              <span className={`mt-1 inline-block rounded-full border px-2 py-[1px] text-[10px] font-bold ${BADGE[a.balance_status]}`}>{label(a.balance_status)}</span>
            </div>
          </div>
        ))}
      </Card>

      <SectionHead title={t("moneyPage.recentActivity")} action={<Link href="/money?tab=transactions" className="text-xs text-gold">{t("moneyPage.viewAll")}</Link>} />
      <Card>
        {recent.map((r) => {
          const title = r.type === "adjustment" ? t("moneyPage.adjustment") : r.type === "transfer" ? t("moneyPage.transfer") : r.description || r.merchant || r.category || "—";
          const sign = r.type === "income" ? "+" : r.type === "expense" ? "−" : "";
          return (
            <div key={r.id} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0">
              <div className="min-w-0">
                <b className="block truncate text-sm">{title}</b>
                <small className="text-muted">
                  {formatDate(r.occurred_at, locale)}
                  {r.account_name ? ` · ${r.account_name}` : ""}
                  {r.to_account_name ? ` → ${r.to_account_name}` : ""}
                  {r.category && r.type !== "adjustment" ? ` · ${r.category}` : ""}
                </small>
              </div>
              <b className={`text-sm ${r.type === "income" ? "text-green" : r.type === "expense" ? "text-red" : "text-muted"}`}>
                {r.type === "adjustment" ? "±" : sign}
                {formatMoney(num(r.amount), "THB", locale)}
              </b>
            </div>
          );
        })}
      </Card>
    </div>
  );

  function UpcomingLine({ u }: { u: UpcomingRow }) {
    const when = u.overdue ? t("moneyPage.daysAgo", { n: Math.abs(u.days_until) }) : u.days_until === 0 ? t("moneyPage.dueToday") : t("moneyPage.inDays", { n: u.days_until });
    return (
      <div className="flex items-center justify-between gap-3 py-1.5">
        <div className="min-w-0">
          <b className="block truncate text-sm">{u.title}</b>
          <small className={u.overdue ? "text-red" : "text-muted"}>
            {formatDate(u.due_date, locale)} · {when}
            {u.account_name ? ` · ${u.account_name}` : ""}
          </small>
        </div>
        <b className="text-sm">{u.amount === null ? "—" : formatMoney(num(u.amount), "THB", locale)}</b>
      </div>
    );
  }
}
