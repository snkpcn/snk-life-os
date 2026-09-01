"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, EmptyState } from "@/components/ui";

type Task = { id: string; title: string; status: string | null; priority: string | null };

export function TodayPriorities({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
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
    router.refresh();
  }

  if (tasks.length === 0) return <EmptyState label="No top priorities set for today. Add one from Tasks." />;

  return (
    <Card>
      {tasks.map((t) => (
        <label key={t.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
          <input
            type="checkbox"
            checked={t.status === "done"}
            disabled={busyId === t.id}
            onChange={() => toggleDone(t)}
            className="h-5 w-5 shrink-0 accent-gold"
          />
          <span className={`flex-1 text-sm ${t.status === "done" ? "text-muted line-through" : ""}`}>
            {t.title}
          </span>
          <span className="rounded-full bg-panel2 px-2 py-1 text-[10px] uppercase text-muted">
            {t.priority}
          </span>
        </label>
      ))}
    </Card>
  );
}
