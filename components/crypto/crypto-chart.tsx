"use client";

import type { CryptoChartPoint } from "@/lib/crypto/types";

export function CryptoChart({ points, height = 160 }: { points: CryptoChartPoint[]; height?: number }) {
  if (points.length < 2) {
    return <div className="flex items-center justify-center text-xs text-muted" style={{ height }} />;
  }

  const width = 600;
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const up = points[points.length - 1].price >= points[0].price;
  const color = up ? "#7fbf95" : "#e27b78";

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p.price - min) / range) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const linePath = `M${coords.join(" L")}`;
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full" style={{ height }}>
      <path d={areaPath} fill={color} opacity={0.12} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
