export function formatStockPrice(value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function percentColorClass(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "text-muted";
  if (value > 0) return "text-green";
  if (value < 0) return "text-red";
  return "text-muted";
}

export function formatVolume(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function formatMarketCap(value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  const suffix = currency === "THB" ? "THB" : currency;
  if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T ${suffix}`;
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B ${suffix}`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M ${suffix}`;
  return `${value.toFixed(0)} ${suffix}`;
}
