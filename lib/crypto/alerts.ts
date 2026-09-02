import type { CryptoAsset } from "./types";

export type CryptoPriceAlertRow = {
  id: string;
  symbol: string;
  condition_type: string | null;
  target_value: number | null;
  is_active: boolean | null;
};

export type TriggeredCryptoAlert = { alert: CryptoPriceAlertRow; asset: CryptoAsset };

/** Live, on-view check only — this app has no background job runner, so alerts are never
 * silently "watched"; they're evaluated against fresh data whenever this is called. */
export function checkTriggeredAlerts(alerts: CryptoPriceAlertRow[], assets: CryptoAsset[]): TriggeredCryptoAlert[] {
  const bySymbol = new Map(assets.map((a) => [a.symbol.toUpperCase(), a]));
  const triggered: TriggeredCryptoAlert[] = [];

  for (const alert of alerts) {
    if (!alert.is_active || alert.target_value === null) continue;
    const asset = bySymbol.get(alert.symbol.toUpperCase());
    if (!asset || asset.price === null) continue;

    if (alert.condition_type === "above" && asset.price >= alert.target_value) triggered.push({ alert, asset });
    else if (alert.condition_type === "below" && asset.price <= alert.target_value) triggered.push({ alert, asset });
  }

  return triggered;
}
