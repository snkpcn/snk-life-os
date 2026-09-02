"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { todayRange } from "@/lib/date-range";
import { useI18n } from "@/lib/i18n/context";

export function MoneyStats({ refreshKey }: { refreshKey?: number }) {
  const { t, locale } = useI18n();
  const [stats, setStats] = useState<{ income: number; expense: number; assets: number; debts: number } | null>(
    null
  );

  useEffect(() => {
    const supabase = createClient();
    const { dateOnly } = todayRange();
    const monthStart = `${dateOnly.slice(0, 7)}-01`;
    (async () => {
      const [{ data: tx }, { data: assets }, { data: debts }] = await Promise.all([
        supabase.from("transactions").select("type, amount").is("archived_at", null).gte("occurred_at", monthStart),
        supabase.from("assets").select("value").is("archived_at", null),
        supabase.from("debts").select("balance").is("archived_at", null),
      ]);
      const income = (tx || []).filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const expense = (tx || []).filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      const totalAssets = (assets || []).reduce((s, a) => s + Number(a.value), 0);
      const totalDebts = (debts || []).reduce((s, d) => s + Number(d.balance), 0);
      setStats({ income, expense, assets: totalAssets, debts: totalDebts });
    })();
  }, [refreshKey]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card>
        <b className="block text-xs text-muted">{t("moneyPage.incomeMo")}</b>
        <span className="mt-2 block text-lg font-bold">{formatMoney(stats?.income, "THB", locale)}</span>
      </Card>
      <Card>
        <b className="block text-xs text-muted">{t("moneyPage.expenseMo")}</b>
        <span className="mt-2 block text-lg font-bold">{formatMoney(stats?.expense, "THB", locale)}</span>
      </Card>
      <Card>
        <b className="block text-xs text-muted">{t("moneyPage.netWorth")}</b>
        <span className="mt-2 block text-lg font-bold">
          {stats ? formatMoney(stats.assets - stats.debts, "THB", locale) : "—"}
        </span>
      </Card>
      <Card>
        <b className="block text-xs text-muted">{t("moneyPage.totalDebts")}</b>
        <span className="mt-2 block text-lg font-bold">{formatMoney(stats?.debts, "THB", locale)}</span>
      </Card>
    </div>
  );
}
