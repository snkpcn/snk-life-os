"use client";

import { ResourceSection } from "@/components/resource-section";
import { RESOURCES } from "@/lib/resources";

export default function ProjectsPage() {
  return (
    <div>
      <ResourceSection resource={RESOURCES.projects} />
      <ResourceSection resource={RESOURCES.milestones} />
    </div>
  );
}
