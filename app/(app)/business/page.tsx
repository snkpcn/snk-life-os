"use client";

import { ResourceSection } from "@/components/resource-section";
import { RESOURCES } from "@/lib/resources";

export default function BusinessPage() {
  return (
    <div>
      <ResourceSection resource={RESOURCES.businesses} />
      <ResourceSection resource={RESOURCES.kpis} />
      <ResourceSection resource={RESOURCES.kpi_entries} />
    </div>
  );
}
