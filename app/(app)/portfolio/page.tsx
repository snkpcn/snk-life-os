"use client";

import { useState } from "react";
import { PortfolioStats } from "@/components/portfolio-stats";
import { ResourceSection } from "@/components/resource-section";
import { RESOURCES } from "@/lib/resources";

export default function PortfolioPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div>
      <PortfolioStats refreshKey={refreshKey} />
      <ResourceSection resource={RESOURCES.holdings} onChange={() => setRefreshKey((k) => k + 1)} />
      <ResourceSection resource={RESOURCES.watchlists} />
      <ResourceSection resource={RESOURCES.watchlist_items} />
    </div>
  );
}
