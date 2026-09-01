"use client";

import { useRef, useState } from "react";
import { Btn, Card, SectionHead } from "@/components/ui";
import { exportAllData, restoreFromExport, importLegacyData, detectPayloadKind } from "@/lib/backup";

export default function BackupPage() {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setBusy(true);
    setLog(null);
    try {
      const payload = await exportAllData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `snk-life-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setLog("Export downloaded.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setLog(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const kind = detectPayloadKind(json);
      if (kind === "backup") {
        const { inserted, errors } = await restoreFromExport(json);
        setLog(`Restored ${inserted} rows.${errors.length ? ` Errors: ${errors.join("; ")}` : ""}`);
      } else if (kind === "legacy") {
        const { imported, errors } = await importLegacyData(json);
        setLog(`Imported ${imported} items from legacy Life OS.${errors.length ? ` Errors: ${errors.join("; ")}` : ""}`);
      } else {
        setLog("Unrecognized file format.");
      }
    } catch (err) {
      setLog(`Could not read file: ${(err as Error).message}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <SectionHead title="Backup & Export" subtitle="Your full source of truth as JSON" />
      <Card className="space-y-3">
        <p className="text-sm text-muted">Export every table (tasks, money, projects, goals, wishlist, portfolio…) as a single JSON file.</p>
        <Btn variant="gold" onClick={handleExport} disabled={busy}>
          {busy ? "Working…" : "Export JSON"}
        </Btn>
      </Card>

      <SectionHead title="Restore or Import" subtitle="Restore a SNK LIFE OS export, or import from the legacy localStorage prototype" />
      <Card className="space-y-3">
        <p className="text-sm text-muted">
          Restoring inserts rows as new records (it never overwrites existing data). Legacy imports (from the
          original single-file prototype's <code>metrics</code>/<code>projects</code> localStorage export) are
          mapped into Goals and Projects.
        </p>
        <input ref={fileRef} type="file" accept="application/json" onChange={handleFile} className="text-sm" />
        {log && <div className="rounded-lg bg-panel2 px-3 py-2 text-sm">{log}</div>}
      </Card>
    </div>
  );
}
