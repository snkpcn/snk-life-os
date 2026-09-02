"use client";

import { useI18n } from "@/lib/i18n/context";
import { formatStockPrice, formatPercent, percentColorClass } from "@/lib/stocks/format";
import { formatRelativeTime } from "@/lib/format";
import type { StockQuote } from "@/lib/stocks/types";

export function StockHeader({ symbol, quote, loading }: { symbol: string; quote: StockQuote | null; loading: boolean }) {
  const { t, locale } = useI18n();

  if (loading && !quote) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold">{symbol}</div>
          <div className="text-sm text-muted">{t("common.loading")}</div>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div>
        <div className="text-lg font-bold">{symbol}</div>
        <div className="text-sm text-muted">{t("stocksPage.providerUnavailable")}</div>
      </div>
    );
  }

  const stateLabel =
    quote.marketState === "open"
      ? t("stocksPage.marketOpen")
      : quote.marketState === "pre"
        ? t("stocksPage.marketPre")
        : quote.marketState === "post"
          ? t("stocksPage.marketPost")
          : quote.marketState === "closed"
            ? t("stocksPage.marketClosed")
            : t("stocksPage.marketUnknown");

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">
            {quote.symbol} <span className="font-normal text-muted">{quote.name}</span>
          </h2>
          <div className="mt-1 text-2xl font-extrabold">{formatStockPrice(quote.price, quote.currency)}</div>
          <div className={`text-sm font-semibold ${percentColorClass(quote.changePercent)}`}>
            {quote.change !== null ? formatStockPrice(quote.change, quote.currency) : t("stocksPage.unavailable")} ({formatPercent(quote.changePercent)})
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${quote.marketState === "open" ? "bg-green/10 text-green" : "bg-panel2 text-muted"}`}>
          {stateLabel}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        {quote.exchange ? `${quote.exchange} · ` : ""}
        {t("stocksPage.source", { source: quote.source })} · {t("stocksPage.lastUpdated", { time: formatRelativeTime(quote.updatedAt, locale) })}
      </p>
    </div>
  );
}
