"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, SectionHead } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";

// Connects the private SNK MONEY LINE group.  The signed-in owner mints a one-time code (stored hashed, 15 minutes, single use);
// typing it in the group is what proves the group belongs to this owner.  A group is never trusted by its name.

type Status = {
  active: { group_name: string | null; bound_at: string | null } | null;
  pending_groups: number;
  coach: Array<{ kind: "MORNING" | "EVENING"; date: string; status: "CLAIMED" | "SENT" | "FAILED" }>;
};

export function MoneyLineChannel() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<Status | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await createClient().rpc("finance_binding_status");
    if (err || !data) { setError(true); return; }
    setError(false);
    setStatus(data as unknown as Status);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function generate() {
    setBusy(true);
    setError(false);
    const { data, error: err } = await createClient().rpc("finance_issue_binding_code");
    setBusy(false);
    const issued = data as unknown as { ok?: boolean; code?: string } | null;
    if (err || !issued?.ok || !issued.code) { setError(true); return; }
    setCode(issued.code);
  }

  async function disconnect() {
    if (!window.confirm(t("moneyPage.lineDisconnectConfirm"))) return;
    setBusy(true);
    const { error: err } = await createClient().rpc("finance_unbind_active");
    setBusy(false);
    if (err) { setError(true); return; }
    setCode(null);
    await load();
  }

  const active = status?.active ?? null;
  return (
    <Card>
      <SectionHead title={t("moneyPage.lineTitle")} />
      <p className="mb-3 text-sm text-muted">{t("moneyPage.lineIntro")}</p>
      {status && (
        <div className="mb-3 text-sm">
          {active ? (
            <>
              <div className="font-medium text-green">{t("moneyPage.lineConnected", { name: active.group_name ?? "—" })}</div>
              {active.bound_at && <div className="text-muted">{t("moneyPage.lineConnectedSince", { date: formatDate(active.bound_at, locale) })}</div>}
            </>
          ) : (
            <div className="text-muted">{t("moneyPage.lineNotConnected")}</div>
          )}
          {!active && status.pending_groups > 0 && <div className="text-amber">{t("moneyPage.linePendingGroups", { n: status.pending_groups })}</div>}
        </div>
      )}
      {!active && (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={generate} disabled={busy} className="w-fit rounded-md border border-line bg-panel2 px-3 py-1.5 text-sm hover:border-accent disabled:opacity-60">
            {code ? t("moneyPage.lineRegenerate") : t("moneyPage.lineGenerate")}
          </button>
          {code && (
            <div className="rounded-md border border-line bg-panel2 p-3 text-sm">
              <div className="mb-1 text-muted">{t("moneyPage.lineCodeHelp")}</div>
              <code className="select-all text-base font-semibold">{t("moneyPage.lineCodeCommand", { code })}</code>
              <div className="mt-1 text-xs text-muted">{t("moneyPage.lineCodeExpires")}</div>
            </div>
          )}
        </div>
      )}
      {active && (
        <button type="button" onClick={disconnect} disabled={busy} className="w-fit rounded-md border border-line bg-panel2 px-3 py-1.5 text-sm hover:border-red disabled:opacity-60">
          {t("moneyPage.lineDisconnect")}
        </button>
      )}
      {status && status.coach.length > 0 && (
        <div className="mt-4 text-xs text-muted">
          <div className="mb-1 font-medium">{t("moneyPage.lineCoachTitle")}</div>
          <ul className="space-y-0.5">
            {status.coach.map(c => (
              <li key={`${c.kind}-${c.date}`}>{c.date} · {t(`moneyPage.lineCoach${c.kind}`)} · {t(`moneyPage.lineCoach${c.status}`)}</li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red">{t("moneyPage.lineError")}</p>}
    </Card>
  );
}
