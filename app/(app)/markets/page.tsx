"use client";

import { Suspense } from "react";
import { Card, SectionHead } from "@/components/ui";
import { Tabs, useActiveTab } from "@/components/tabs";
import { ResourceSection } from "@/components/resource-section";
import { RESOURCES } from "@/lib/resources";
import { CryptoDashboard } from "@/components/crypto/crypto-dashboard";
import { StockMarketDashboard } from "@/components/stocks/stock-market-dashboard";
import { InstrumentPanel } from "@/components/markets/instrument-panel";
import { useI18n } from "@/lib/i18n/context";

function MarketsContent() {
  const { t } = useI18n();
  const TABS = [
    { key: "overview", label: t("marketsPage.tabOverview") },
    { key: "gold", label: t("marketsPage.tabGold") },
    { key: "fx", label: t("marketsPage.tabFx") },
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

      {active === "gold" && (
        <div className="mt-4">
          <InstrumentPanel
            apiPath="/api/markets/gold"
            fallbackSymbol="XAU/USD"
            fallbackName="Gold Spot"
            resourceMarketLabel="Gold"
            newsKeywords={["gold", "xau", "ทองคำ", "bullion"]}
            showThaiGoldIndicative
          />
        </div>
      )}

      {active === "fx" && (
        <div className="mt-4">
          <InstrumentPanel
            apiPath="/api/markets/fx"
            fallbackSymbol="USD/THB"
            fallbackName="US Dollar / Thai Baht"
            resourceMarketLabel="FX"
            newsKeywords={["baht", "usd/thb", "บาท", "อัตราแลกเปลี่ยน", "exchange rate"]}
          />
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
