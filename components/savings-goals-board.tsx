"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RESOURCES } from "@/lib/resources";
import { ResourceForm } from "@/components/resource-form";
import { Btn, Card, EmptyState, SectionHead, Sheet } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { computeSavingsBalance } from "@/lib/wishlist-actions";
import { useI18n } from "@/lib/i18n/context";

type Goal = { id: string; name: string; target_amount: number; currency: string | null; status: string };

export function SavingsGoalsBoard() {
  const { t, locale } = useI18n();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<Goal | null | "new">(null);
  const [contributingTo, setContributingTo] = useState<Goal | null>(null);
  const [amount, setAmount] = useState("");
  const [entryType, setEntryType] = useState<"contribution" | "withdrawal">("contribution");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: g } = await supabase
      .from("savings_goals")
      .select("id, name, target_amount, currency, status")
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    setGoals(g || []);
    if (g && g.length > 0) {
      const { data: contributions } = await supabase
        .from("savings_contributions")
        .select("savings_goal_id, amount, entry_type")
        .in(
          "savings_goal_id",
          g.map((x) => x.id)
        );
      const byGoal: Record<string, { amount: number; entry_type: string }[]> = {};
      (contributions || []).forEach((c) => {
        (byGoal[c.savings_goal_id] ||= []).push({ amount: Number(c.amount), entry_type: c.entry_type });
      });
      const map: Record<string, number> = {};
      Object.entries(byGoal).forEach(([goalId, entries]) => {
        map[goalId] = computeSavingsBalance(entries);
      });
      setBalances(map);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submitContribution() {
    if (!contributingTo || !amount) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.from("savings_contributions").insert({
      savings_goal_id: contributingTo.id,
      amount: Number(amount),
      entry_type: entryType,
      contributed_on: new Date().toISOString().slice(0, 10),
    });
    setBusy(false);
    setContributingTo(null);
    setAmount("");
    load();
  }

  return (
    <div>
      <SectionHead
        title={t("wishlistPage.goals")}
        action={
          <Btn variant="gold" onClick={() => setEditing("new")}>
            ＋ {t("wishlistPage.newGoal")}
          </Btn>
        }
      />
      <Card>
        {goals === null && <EmptyState label={t("common.loading")} />}
        {goals !== null && goals.length === 0 && <EmptyState label={t("wishlistPage.noSavingsGoals")} />}
        {goals?.map((g) => {
          const saved = balances[g.id] || 0;
          const pct = g.target_amount ? Math.max(0, Math.min(100, (saved / g.target_amount) * 100)) : 0;
          return (
            <div key={g.id} className="border-b border-line py-3 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <button className="flex-1 text-left" onClick={() => setEditing(g)}>
                  <b className="block text-sm">{g.name}</b>
                  <small className="text-muted">
                    {formatMoney(saved, g.currency || "THB", locale)} / {formatMoney(g.target_amount, g.currency || "THB", locale)}
                  </small>
                </button>
                <Btn variant="gold" onClick={() => setContributingTo(g)}>
                  ＋ {t("wishlistPage.contribute")}
                </Btn>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel2">
                <div className="h-full rounded-full bg-gradient-to-r from-gold to-goldDark" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </Card>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t("common.newItem", { item: t("wishlistPage.newGoal") }) : t("common.editItem", { item: t("wishlistPage.newGoal") })}
      >
        <ResourceForm
          resource={RESOURCES.savings_goals}
          existing={editing && editing !== "new" ? editing : null}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      </Sheet>

      <Sheet open={contributingTo !== null} onClose={() => setContributingTo(null)} title={t("wishlistPage.contribute")}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] text-muted">{t("wishlistPage.contributionType")}</label>
            <select
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as "contribution" | "withdrawal")}
              className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
            >
              <option value="contribution">{t("wishlistPage.contribution")}</option>
              <option value="withdrawal">{t("wishlistPage.withdrawal")}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-muted">{t("wishlistPage.amount")}</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Btn onClick={() => setContributingTo(null)}>{t("common.cancel")}</Btn>
            <Btn variant="gold" disabled={busy} onClick={submitContribution}>
              {busy ? t("common.saving") : t("common.save")}
            </Btn>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
