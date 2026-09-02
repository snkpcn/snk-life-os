"use client";

import { Suspense, useState } from "react";
import { Card, SectionHead } from "@/components/ui";
import { Tabs, useActiveTab } from "@/components/tabs";
import { TradingViewChart } from "@/components/tradingview-widget";
import { ResourceSection } from "@/components/resource-section";
import { RESOURCES } from "@/lib/resources";
import { CryptoDashboard } from "@/components/crypto/crypto-dashboard";
import { useI18n } from "@/lib/i18n/context";

const PRESETS = [
  { label: "ADVANC", symbol: "SET:ADVANC" },
  { label: "CPALL", symbol: "SET:CPALL" },
  { label: "AOT", symbol: "SET:AOT" },
  { label: "KBANK", symbol: "SET:KBANK" },
  { label: "PTT", symbol: "SET:PTT" },
  { label: "NVDA", symbol: "NASDAQ:NVDA" },
  { label: "GOLD", symbol: "OANDA:XAUUSD" },
  { label: "USD/THB", symbol: "FX_IDC:USDTHB" },
];

function MarketsContent() {
  const { t } = useI18n();
  const [symbol, setSymbol] = useState(PRESETS[0].symbol);
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
          <div className="my-4 flex gap-2 overflow-x-auto pb-1">
            {PRESETS.map((p) => (
              <button
                key={p.symbol}
                onClick={() => setSymbol(p.symbol)}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold ${
                  symbol === p.symbol ? "border-gold bg-gold/10 text-gold" : "border-line text-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <Card className="p-2">
            <TradingViewChart symbol={symbol} />
          </Card>

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
