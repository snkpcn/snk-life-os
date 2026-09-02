"use client";

import { useState } from "react";
import { RESOURCES } from "@/lib/resources";
import { Sheet } from "@/components/ui";
import { ResourceForm } from "@/components/resource-form";
import { useI18n } from "@/lib/i18n/context";
import { translateResourceLabel } from "@/lib/i18n";

const QUICK_KEYS = ["tasks", "schedule_events", "transactions", "notes_table", "wishlist_items"];

export function QuickAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [picked, setPicked] = useState<string | null>(null);

  function close() {
    setPicked(null);
    onClose();
  }

  if (picked) {
    const resource = RESOURCES[picked];
    const label = translateResourceLabel(locale, resource.key, "label", resource.label);
    return (
      <Sheet open={open} onClose={close} title={t("common.newItem", { item: label })}>
        <ResourceForm resource={resource} onCancel={close} onSaved={close} />
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={close} title={t("quickAdd.title")}>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_KEYS.map((key) => {
          const r = RESOURCES[key];
          const label = translateResourceLabel(locale, r.key, "label", r.label);
          return (
            <button
              key={key}
              onClick={() => setPicked(key)}
              className="rounded-xl border border-line bg-panel2 p-4 text-left text-sm font-semibold active:scale-[0.97]"
            >
              ＋ {label}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
