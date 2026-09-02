"use client";

import { ResourceSection } from "@/components/resource-section";
import { RESOURCES } from "@/lib/resources";

export default function DecisionsPage() {
  return (
    <div>
      <ResourceSection resource={RESOURCES.decisions} />
    </div>
  );
}
