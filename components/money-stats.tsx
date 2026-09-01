"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui";
import { formatMoney } from "@/lib/format";

export function MoneyStats({ refreshKey }: { refreshKey?: number }) {
  const [stats, setStats] = useState<{ income: number; expense: number; assets: number; debts: number } | null>(
    null
  );

  useEffect(() => {
    const supabase = createClient();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
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
        <b className="block text-xs text-muted">Income (mo)</b>
        <span className="mt-2 block text-lg font-bold">{formatMoney(stats?.income)}</span>
      </Card>
      <Card>
        <b className="block text-xs text-muted">Expense (mo)</b>
        <span className="mt-2 block text-lg font-bold">{formatMoney(stats?.expense)}</span>
      </Card>
      <Card>
        <b className="block text-xs text-muted">Net Worth</b>
        <span className="mt-2 block text-lg font-bold">
          {stats ? formatMoney(stats.assets - stats.debts) : "—"}
        </span>
      </Card>
      <Card>
        <b className="block text-xs text-muted">Total Debts</b>
        <span className="mt-2 block text-lg font-bold">{formatMoney(stats?.debts)}</span>
      </Card>
    </div>
  );
}
