"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, EmptyState } from "@/components/ui";
import { useI18n } from "@/lib/i18n/context";
import { translateOption } from "@/lib/i18n";

type Task = { id: string; title: string; status: string | null; priority: string | null };

export function TodayPriorities({ tasks, onChanged }: { tasks: Task[]; onChanged?: () => void }) {
  const { t, locale } = useI18n();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleDone(task: Task) {
    setBusyId(task.id);
    const supabase = createClient();
    const nextStatus = task.status === "done" ? "todo" : "done";
    await supabase
      .from("tasks")
      .update({ status: nextStatus, completed_at: nextStatus === "done" ? new Date().toISOString() : null })
      .eq("id", task.id);
    setBusyId(null);
    onChanged?.();
  }

  if (tasks.length === 0) return <EmptyState label={t("tasksPage.noPriorities")} />;

  return (
    <Card>
      {tasks.map((t2) => (
        <label key={t2.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
          <input
            type="checkbox"
            checked={t2.status === "done"}
            disabled={busyId === t2.id}
            onChange={() => toggleDone(t2)}
            className="h-5 w-5 shrink-0 accent-gold"
          />
          <span className={`flex-1 text-sm ${t2.status === "done" ? "text-muted line-through" : ""}`}>{t2.title}</span>
          <span className="rounded-full bg-panel2 px-2 py-1 text-[10px] uppercase text-muted">
            {translateOption(locale, t2.priority || "", t2.priority || "")}
          </span>
        </label>
      ))}
    </Card>
  );
}
