"use client";

import { Suspense } from "react";
import { Card, SectionHead } from "@/components/ui";
import { Tabs, useActiveTab } from "@/components/tabs";
import { ResourceSection } from "@/components/resource-section";
import { RESOURCES } from "@/lib/resources";
import { CryptoDashboard } from "@/components/crypto/crypto-dashboard";
import { StockMarketDashboard } from "@/components/stocks/stock-market-dashboard";
import { useI18n } from "@/lib/i18n/context";

function MarketsContent() {
  const { t } = useI18n();
  const TABS = [
    { key: "overview", label: t("marketsPage.tabOverview") },
    { key: "crypto", label: t("marketsPage.tabCrypto") },
  ];
  const active = useActiveTab(TABS);

  return (
    <div>
      <Card className="bg-gradient-to-br from-panel to-panel2">
        <div className="text-[11px] uppercase tracking-[0.12em] text-gold">{t("marketsPage.kicker")}</div>
        <h1 className="my-2 text-2xl font-extrabold">{t("marketsPage.title")}</h1>
        <p className="text-muted">{t("marketsPage.subtitle")}</p>
      </Card>

      <Tabs tabs={TABS} />

      {active === "overview" && (
        <div>
          <StockMarketDashboard />

          <SectionHead title={t("marketsPage.priceAlerts")} />
          <ResourceSection resource={RESOURCES.price_alerts} hideCreate={false} />
        </div>
      )}

      {active === "crypto" && <CryptoDashboard />}
    </div>
  );
}

export default function MarketsPage() {
  return (
    <Suspense>
      <MarketsContent />
    </Suspense>
  );
}
