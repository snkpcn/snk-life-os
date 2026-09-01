"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RESOURCES } from "@/lib/resources";
import { ResourceForm } from "@/components/resource-form";
import { Btn, Card, EmptyState, SectionHead, Sheet } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { computeSavingsBalance } from "@/lib/wishlist-actions";

type Goal = { id: string; name: string; target_amount: number; currency: string | null; status: string };

export function SavingsGoalsBoard() {
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
        title="Savings Goals"
        action={
          <Btn variant="gold" onClick={() => setEditing("new")}>
            ＋ Goal
          </Btn>
        }
      />
      <Card>
        {goals === null && <EmptyState label="Loading…" />}
        {goals !== null && goals.length === 0 && <EmptyState label="No savings goals yet." />}
        {goals?.map((g) => {
          const saved = balances[g.id] || 0;
          const pct = g.target_amount ? Math.max(0, Math.min(100, (saved / g.target_amount) * 100)) : 0;
          return (
            <div key={g.id} className="border-b border-line py-3 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <button className="flex-1 text-left" onClick={() => setEditing(g)}>
                  <b className="block text-sm">{g.name}</b>
                  <small className="text-muted">
                    {formatMoney(saved, g.currency || "THB")} / {formatMoney(g.target_amount, g.currency || "THB")}
                  </small>
                </button>
                <Btn variant="gold" onClick={() => setContributingTo(g)}>
                  ＋ Contribute
                </Btn>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel2">
                <div className="h-full rounded-full bg-gradient-to-r from-gold to-goldDark" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </Card>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New Savings Goal" : "Edit Savings Goal"}>
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

      <Sheet open={contributingTo !== null} onClose={() => setContributingTo(null)} title="Add Contribution">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] text-muted">Type</label>
            <select
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as "contribution" | "withdrawal")}
              className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
            >
              <option value="contribution">Contribution (+)</option>
              <option value="withdrawal">Withdrawal (-)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-muted">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Btn onClick={() => setContributingTo(null)}>Cancel</Btn>
            <Btn variant="gold" disabled={busy} onClick={submitContribution}>
              {busy ? "Saving…" : "Save"}
            </Btn>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
