"use client";

import { ResourceSection } from "@/components/resource-section";
import { RESOURCES } from "@/lib/resources";

export default function ReviewsPage() {
  return (
    <div>
      <ResourceSection resource={RESOURCES.reviews} />
    </div>
  );
}
