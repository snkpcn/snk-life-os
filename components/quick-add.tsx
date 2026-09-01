"use client";

import { useState } from "react";
import { RESOURCES } from "@/lib/resources";
import { Sheet } from "@/components/ui";
import { ResourceForm } from "@/components/resource-form";

const QUICK_KEYS = ["tasks", "schedule_events", "transactions", "notes_table", "wishlist_items"];

export function QuickAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);

  function close() {
    setPicked(null);
    onClose();
  }

  if (picked) {
    const resource = RESOURCES[picked];
    return (
      <Sheet open={open} onClose={close} title={`New ${resource.label}`}>
        <ResourceForm resource={resource} onCancel={close} onSaved={close} />
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={close} title="Quick Add">
      <div className="grid grid-cols-2 gap-2">
        {QUICK_KEYS.map((key) => {
          const r = RESOURCES[key];
          return (
            <button
              key={key}
              onClick={() => setPicked(key)}
              className="rounded-xl border border-line bg-panel2 p-4 text-left text-sm font-semibold active:scale-[0.97]"
            >
              ＋ {r.label}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
