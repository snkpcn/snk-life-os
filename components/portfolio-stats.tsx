"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";

export function PortfolioStats({ refreshKey }: { refreshKey?: number }) {
  const { t, locale } = useI18n();
  const [stats, setStats] = useState<{ costBasis: number; count: number } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.from("holdings").select("quantity, avg_cost").is("archived_at", null);
      const costBasis = (data || []).reduce((s, h) => s + Number(h.quantity) * Number(h.avg_cost || 0), 0);
      setStats({ costBasis, count: (data || []).length });
    })();
  }, [refreshKey]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card>
        <b className="block text-xs text-muted">{t("portfolioPage.holdings")}</b>
        <span className="mt-2 block text-xl font-bold">{stats?.count ?? "—"}</span>
      </Card>
      <Card>
        <b className="block text-xs text-muted">{t("portfolioPage.costBasis")}</b>
        <span className="mt-2 block text-xl font-bold">{formatMoney(stats?.costBasis, "THB", locale)}</span>
        <small className="text-muted">{t("portfolioPage.noLiveMarketData")}</small>
      </Card>
    </div>
  );
}
