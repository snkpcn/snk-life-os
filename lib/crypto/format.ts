export function formatUsdPrice(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toPrecision(3)}`;
}

export function formatCompactUsd(value: number | null): string {
  if (value === null) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) return `${sign}$${(abs / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function percentColorClass(value: number | null): string {
  if (value === null) return "text-muted";
  return value >= 0 ? "text-green" : "text-red";
}
