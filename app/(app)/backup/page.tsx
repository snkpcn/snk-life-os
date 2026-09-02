"use client";

import { useRef, useState } from "react";
import { Btn, Card, SectionHead } from "@/components/ui";
import { exportAllData, restoreFromExport, importLegacyData, detectPayloadKind } from "@/lib/backup";
import { useI18n } from "@/lib/i18n/context";

export default function BackupPage() {
  const { t } = useI18n();
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
      setLog(t("backup.exportedDone"));
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
        setLog(t("backup.restoredDone", { count: inserted }) + (errors.length ? ` (${errors.join("; ")})` : ""));
      } else if (kind === "legacy") {
        const { imported, errors } = await importLegacyData(json);
        setLog(t("backup.importedDone", { count: imported }) + (errors.length ? ` (${errors.join("; ")})` : ""));
      } else {
        setLog(t("backup.unrecognized"));
      }
    } catch (err) {
      setLog(t("backup.readError", { error: (err as Error).message }));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <SectionHead title={t("backup.title")} subtitle={t("backup.subtitle")} />
      <Card className="space-y-3">
        <p className="text-sm text-muted">{t("backup.exportHint")}</p>
        <Btn variant="gold" onClick={handleExport} disabled={busy}>
          {busy ? t("common.workingEllipsis") : t("backup.exportButton")}
        </Btn>
      </Card>

      <SectionHead title={t("backup.restoreTitle")} subtitle={t("backup.restoreSubtitle")} />
      <Card className="space-y-3">
        <p className="text-sm text-muted">{t("backup.restoreHint")}</p>
        <input ref={fileRef} type="file" accept="application/json" onChange={handleFile} className="text-sm" />
        {log && <div className="rounded-lg bg-panel2 px-3 py-2 text-sm">{log}</div>}
      </Card>
    </div>
  );
}
