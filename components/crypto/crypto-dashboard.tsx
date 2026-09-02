"use client";

import { useEffect, useState } from "react";
import { Card, EmptyState, SectionHead, Btn } from "@/components/ui";
import { CryptoDetailSheet } from "@/components/crypto/crypto-detail-sheet";
import { formatCompactUsd, formatPercent, formatUsdPrice, percentColorClass } from "@/lib/crypto/format";
import { formatRelativeTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";
import { computeBtcPulse, computeCoinsToWatch, computeInterestingNow, computeTopMovers, type TopMovers } from "@/lib/crypto/signals";
import type { BtcPulse, CoinSignal, CryptoAsset, CryptoGlobal, WatchReasonKey } from "@/lib/crypto/types";
import type { CoinSearchResult } from "@/lib/crypto/coingecko";

const REASON_KEY_MAP: Record<WatchReasonKey, string> = {
  unusualVolume: "cryptoPage.reasonUnusualVolume",
  strong24h: "cryptoPage.reasonStrong24h",
  strong7d: "cryptoPage.reasonStrong7d",
  outperformingBtc: "cryptoPage.reasonOutperformingBtc",
  underperformingBtc: "cryptoPage.reasonUnderperformingBtc",
  volatile: "cryptoPage.reasonVolatile",
};

const PULSE_LABEL_KEY: Record<BtcPulse["state"], string> = {
  strong: "cryptoPage.pulseStrong",
  positive: "cryptoPage.pulsePositive",
  neutral: "cryptoPage.pulseNeutral",
  weak: "cryptoPage.pulseWeak",
  risk_off: "cryptoPage.pulseRiskOff",
};

const PULSE_COLOR: Record<BtcPulse["state"], string> = {
  strong: "bg-green/15 text-green",
  positive: "bg-green/10 text-green",
  neutral: "bg-panel2 text-muted",
  weak: "bg-amber/15 text-amber",
  risk_off: "bg-red/15 text-red",
};

type MoverTab = "gainers" | "losers" | "active";

export function CryptoDashboard() {
  const { t, locale } = useI18n();
  const [defaultAssets, setDefaultAssets] = useState<CryptoAsset[] | null>(null);
  const [topAssets, setTopAssets] = useState<CryptoAsset[]>([]);
  const [global, setGlobal] = useState<CryptoGlobal | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [selectedCoinId, setSelectedCoinId] = useState<string | null>(null);
  const [moverTab, setMoverTab] = useState<MoverTab>("gainers");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CoinSearchResult[] | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [defaultsRes, topRes, globalRes] = await Promise.all([
        fetch("/api/crypto/markets").then((r) => r.json()),
        fetch("/api/crypto/markets?scope=top&limit=100").then((r) => r.json()),
        fetch("/api/crypto/global").then((r) => r.json()),
      ]);
      setDefaultAssets(defaultsRes.assets || []);
      setTopAssets(topRes.assets || []);
      setGlobal(globalRes.global || null);
      setFailed((defaultsRes.assets || []).length === 0 && (topRes.assets || []).length === 0);
      setLastUpdated(new Date().toISOString());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/crypto/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => setSearchResults(data.results || []))
        .catch(() => setSearchResults([]));
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const btc = (defaultAssets || []).find((a) => a.symbol === "BTC") || null;
  const eth = (defaultAssets || []).find((a) => a.symbol === "ETH") || null;
  const pulse = computeBtcPulse(btc);
  const watchList: CoinSignal[] = topAssets.length > 0 ? computeCoinsToWatch(topAssets, btc?.change7d ?? null) : [];
  const interesting = computeInterestingNow(watchList);
  const movers: TopMovers = topAssets.length > 0 ? computeTopMovers(topAssets) : { gainers: [], losers: [], mostActive: [] };
  const moverList = moverTab === "gainers" ? movers.gainers : moverTab === "losers" ? movers.losers : movers.mostActive;

  if (failed && !loading) {
    return (
      <Card>
        <p className="text-sm text-muted">{t("cryptoPage.providerUnavailable")}</p>
        <Btn onClick={load} className="mt-3">
          {t("cryptoPage.refresh")}
        </Btn>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-muted">
        <span>{lastUpdated ? t("cryptoPage.lastUpdated", { time: formatRelativeTime(lastUpdated, locale) }) : ""}</span>
        <button onClick={load} className="rounded-full border border-line px-3 py-1 font-semibold text-ink">
          {loading ? t("cryptoPage.refreshing") : t("cryptoPage.refresh")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <AssetQuickCard asset={btc} onOpen={() => btc && setSelectedCoinId(btc.id)} />
        <AssetQuickCard asset={eth} onOpen={() => eth && setSelectedCoinId(eth.id)} />
      </div>

      <Card className="mt-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label={t("cryptoPage.totalMarketCap")} value={formatCompactUsd(global?.totalMarketCap ?? null)} />
          <MiniStat
            label={`${t("cryptoPage.totalMarketCap")} 24h`}
            value={formatPercent(global?.totalMarketCapChange24h ?? null)}
            className={percentColorClass(global?.totalMarketCapChange24h ?? null)}
          />
          <MiniStat label={t("cryptoPage.btcDominance")} value={global?.btcDominance !== undefined && global?.btcDominance !== null ? `${global.btcDominance.toFixed(1)}%` : t("cryptoPage.unavailable")} />
          <MiniStat label={t("cryptoPage.ethDominance")} value={global?.ethDominance !== undefined && global?.ethDominance !== null ? `${global.ethDominance.toFixed(1)}%` : t("cryptoPage.unavailable")} />
        </div>
        {global && <p className="mt-2 text-[11px] text-muted">{t("cryptoPage.source", { source: global.source })}</p>}
      </Card>

      <SectionHead title={t("cryptoPage.btcMarketPulse")} />
      <Card>
        {btc ? (
          <>
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${PULSE_COLOR[pulse.state]}`}>{t(PULSE_LABEL_KEY[pulse.state])}</span>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {pulse.factors.map((f, i) => (
                <li key={i}>• {formatPulseFactor(f, t)}</li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState label={t("cryptoPage.unavailable")} />
        )}
      </Card>

      <SectionHead title={t("cryptoPage.search")} />
      <Card>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("cryptoPage.searchPlaceholder")}
          className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
        />
        {searchResults !== null && (
          <div className="mt-2">
            {searchResults.length === 0 && <p className="py-2 text-sm text-muted">{t("cryptoPage.searchNoResults")}</p>}
            {searchResults.map((r) => (
              <button key={r.id} onClick={() => setSelectedCoinId(r.id)} className="flex w-full items-center justify-between border-b border-line py-2 text-left last:border-0">
                <span className="text-sm">
                  {r.name} <span className="text-muted">{r.symbol}</span>
                </span>
                {r.marketCapRank && <span className="text-xs text-muted">#{r.marketCapRank}</span>}
              </button>
            ))}
          </div>
        )}
      </Card>

      <SectionHead title={t("cryptoPage.interestingNow")} />
      <Card>
        {interesting.length === 0 && <EmptyState label={t("cryptoPage.interestingNowEmpty")} />}
        {interesting.map((s) => (
          <div key={s.asset.id} className="border-b border-line py-3 last:border-0">
            <button className="w-full text-left" onClick={() => setSelectedCoinId(s.asset.id)}>
              <div className="flex items-center justify-between">
                <b className="text-sm">
                  {t("cryptoPage.what")}: {s.asset.name} ({s.asset.symbol})
                </b>
                <span className={`text-sm font-bold ${percentColorClass(s.asset.change7d)}`}>{formatPercent(s.asset.change7d)}</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {t("cryptoPage.why")}: {s.reasons.map((r) => t(REASON_KEY_MAP[r.key], { value: r.value })).join(" · ")}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                {t("cryptoPage.risk")}: {t("cryptoPage.riskHighVolatility")}
              </p>
            </button>
          </div>
        ))}
      </Card>

      <SectionHead title={t("cryptoPage.coinsToWatch")} subtitle={t("cryptoPage.coinsToWatchSubtitle")} />
      <Card>
        {watchList.length === 0 && <EmptyState label={t("cryptoPage.coinsToWatchEmpty")} />}
        {watchList.map((s) => (
          <CoinRow key={s.asset.id} asset={s.asset} onOpen={() => setSelectedCoinId(s.asset.id)} subtitle={s.reasons.map((r) => t(REASON_KEY_MAP[r.key], { value: r.value })).join(" · ")} />
        ))}
      </Card>

      <SectionHead title={t("cryptoPage.topMovers")} />
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {(["gainers", "losers", "active"] as MoverTab[]).map((k) => (
          <button
            key={k}
            onClick={() => setMoverTab(k)}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold ${moverTab === k ? "border-gold bg-gold/10 text-gold" : "border-line text-muted"}`}
          >
            {k === "gainers" ? t("cryptoPage.topGainers") : k === "losers" ? t("cryptoPage.topLosers") : t("cryptoPage.mostActive")}
          </button>
        ))}
      </div>
      <Card>
        {moverList.length === 0 && <EmptyState label={t("cryptoPage.moversEmpty")} />}
        {moverList.map((a) => (
          <CoinRow key={a.id} asset={a} onOpen={() => setSelectedCoinId(a.id)} />
        ))}
      </Card>

      <SectionHead title={t("cryptoPage.defaultAssets")} />
      <Card>
        {defaultAssets === null && <EmptyState label={t("common.loading")} />}
        {defaultAssets?.map((a) => (
          <CoinRow key={a.id} asset={a} onOpen={() => setSelectedCoinId(a.id)} />
        ))}
      </Card>

      <CryptoDetailSheet coinId={selectedCoinId} onClose={() => setSelectedCoinId(null)} />
    </div>
  );
}

function formatPulseFactor(raw: string, t: (key: string, vars?: Record<string, string | number>) => string) {
  const [key, value] = raw.split(":");
  if (key === "btc7d") return t("cryptoPage.factorBtc7d", { value });
  if (key === "btc24h") return t("cryptoPage.factorBtc24h", { value });
  if (key === "volumeRatio") return t("cryptoPage.factorVolumeRatio", { value });
  if (key === "volatility") return t("cryptoPage.factorVolatility", { value });
  return raw;
}

function AssetQuickCard({ asset, onOpen }: { asset: CryptoAsset | null; onOpen: () => void }) {
  const { t } = useI18n();
  if (!asset) {
    return (
      <Card>
        <EmptyState label={t("cryptoPage.unavailable")} />
      </Card>
    );
  }
  return (
    <button onClick={onOpen} className="text-left">
      <Card>
        <div className="flex items-center gap-2">
          {asset.image && <img src={asset.image} alt="" className="h-6 w-6 rounded-full" />}
          <b className="text-sm">{asset.symbol}</b>
        </div>
        <div className="mt-1 text-lg font-extrabold">{formatUsdPrice(asset.price)}</div>
        <div className={`text-xs font-semibold ${percentColorClass(asset.change24h)}`}>{formatPercent(asset.change24h)} (24h)</div>
      </Card>
    </button>
  );
}

function CoinRow({ asset, onOpen, subtitle }: { asset: CryptoAsset; onOpen: () => void; subtitle?: string }) {
  return (
    <button onClick={onOpen} className="flex w-full items-center justify-between gap-3 border-b border-line py-3 text-left last:border-0">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {asset.image && <img src={asset.image} alt="" className="h-6 w-6 shrink-0 rounded-full" />}
        <div className="min-w-0">
          <b className="block truncate text-sm">
            {asset.name} <span className="text-muted">{asset.symbol}</span>
          </b>
          <small className="block truncate text-muted">{subtitle || formatCompactUsd(asset.volume24h)}</small>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-bold">{formatUsdPrice(asset.price)}</div>
        <div className={`text-xs font-semibold ${percentColorClass(asset.change24h)}`}>{formatPercent(asset.change24h)}</div>
      </div>
    </button>
  );
}

function MiniStat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted">{label}</div>
      <div className={`text-sm font-bold ${className || ""}`}>{value}</div>
    </div>
  );
}
