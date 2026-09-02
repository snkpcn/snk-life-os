"use client";

import { ResourceSection } from "@/components/resource-section";
import { RESOURCES } from "@/lib/resources";

export default function NotesPage() {
  return (
    <div>
      <ResourceSection resource={RESOURCES.notes_table} />
    </div>
  );
}
