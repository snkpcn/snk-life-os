"use client";

import { ResourceSection } from "@/components/resource-section";
import { RESOURCES } from "@/lib/resources";

export default function SchedulePage() {
  return (
    <div>
      <ResourceSection resource={RESOURCES.schedule_events} />
    </div>
  );
}
