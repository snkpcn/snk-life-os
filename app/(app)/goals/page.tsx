"use client";

import { ResourceSection } from "@/components/resource-section";
import { RESOURCES } from "@/lib/resources";

export default function GoalsPage() {
  return (
    <div>
      <ResourceSection resource={RESOURCES.goals} />
    </div>
  );
}
