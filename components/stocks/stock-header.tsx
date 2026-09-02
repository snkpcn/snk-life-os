"use client";

import { useI18n } from "@/lib/i18n/context";
import { formatStockPrice, formatPercent, percentColorClass } from "@/lib/stocks/format";
import { formatRelativeTime } from "@/lib/format";
import type { StockQuote } from "@/lib/stocks/types";

/** Symbol + name always come from the current selection (constituent metadata), never from
 * the async-fetched quote — this is what guarantees the header can never keep showing a
 * previously selected stock just because its quote loaded first or the new one hasn't
 * resolved yet. Price/change/market-status are the only parts gated on `quote`. */
export function StockHeader({ symbol, name, quote, loading }: { symbol: string; name: string; quote: StockQuote | null; loading: boolean }) {
  const { t, locale } = useI18n();

  const stateLabel = quote
    ? quote.marketState === "open"
      ? t("stocksPage.marketOpen")
      : quote.marketState === "pre"
        ? t("stocksPage.marketPre")
        : quote.marketState === "post"
          ? t("stocksPage.marketPost")
          : quote.marketState === "closed"
            ? t("stocksPage.marketClosed")
            : t("stocksPage.marketUnknown")
    : null;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold" data-testid="stock-header-symbol">
            {symbol} <span className="font-normal text-muted">{name}</span>
          </h2>

          {quote && quote.price !== null ? (
            <>
              <div className="mt-1 text-2xl font-extrabold" data-testid="stock-header-price">
                {formatStockPrice(quote.price, quote.currency)}
              </div>
              <div className={`text-sm font-semibold ${percentColorClass(quote.changePercent)}`}>
                {quote.change !== null ? formatStockPrice(quote.change, quote.currency) : t("stocksPage.unavailable")} ({formatPercent(quote.changePercent)})
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-muted">{loading ? t("common.loading") : t("stocksPage.providerUnavailable")}</div>
          )}
        </div>
        {stateLabel && (
          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${quote?.marketState === "open" ? "bg-green/10 text-green" : "bg-panel2 text-muted"}`}>
            {stateLabel}
          </span>
        )}
      </div>
      {quote && (
        <p className="mt-2 text-[11px] text-muted">
          {quote.exchange ? `${quote.exchange} · ` : ""}
          {t("stocksPage.source", { source: quote.source })} · {t("stocksPage.lastUpdated", { time: formatRelativeTime(quote.updatedAt, locale) })}
        </p>
      )}
    </div>
  );
}
