"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, SectionHead } from "@/components/ui";
import { useI18n } from "@/lib/i18n/context";
import { formatPercent, percentColorClass } from "@/lib/crypto/format";
import { checkTriggeredAlerts, type CryptoPriceAlertRow, type TriggeredCryptoAlert } from "@/lib/crypto/alerts";
import type { CryptoAsset } from "@/lib/crypto/types";

const BIG_MOVE_THRESHOLD = 8;

export function CryptoTodayWidget() {
  const { t } = useI18n();
  const [triggered, setTriggered] = useState<TriggeredCryptoAlert[]>([]);
  const [btcBigMove, setBtcBigMove] = useState<CryptoAsset | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const [marketsRes, alertsRes] = await Promise.all([
          fetch("/api/crypto/markets").then((r) => (r.ok ? r.json() : { assets: [] })),
          supabase.from("price_alerts").select("id, symbol, condition_type, target_value, is_active, market").eq("market", "Crypto").eq("is_active", true),
        ]);
        if (cancelled) return;
        const assets: CryptoAsset[] = marketsRes.assets || [];
        const alerts: CryptoPriceAlertRow[] = (alertsRes.data || []) as CryptoPriceAlertRow[];
        setTriggered(checkTriggeredAlerts(alerts, assets));
        const btc = assets.find((a) => a.symbol === "BTC");
        setBtcBigMove(btc && btc.change24h !== null && Math.abs(btc.change24h) >= BIG_MOVE_THRESHOLD ? btc : null);
      } catch {
        // silent — this widget only ever adds signal, never breaks Today
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (triggered.length === 0 && !btcBigMove) return null;

  return (
    <div>
      <SectionHead title={t("marketsPage.tabCrypto")} />
      <Card>
        {btcBigMove && (
          <Link href="/markets?tab=crypto" className="block border-b border-line py-2 last:border-0">
            <b className="text-sm">BTC</b>{" "}
            <span className={`text-sm font-semibold ${percentColorClass(btcBigMove.change24h)}`}>{formatPercent(btcBigMove.change24h)} (24h)</span>
          </Link>
        )}
        {triggered.map((tr) => (
          <Link key={tr.alert.id} href="/markets?tab=crypto" className="block border-b border-line py-2 text-sm last:border-0">
            {tr.alert.symbol} {tr.alert.condition_type === "above" ? ">" : "<"} {tr.alert.target_value}
          </Link>
        ))}
      </Card>
    </div>
  );
}
