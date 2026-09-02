"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FieldDef, ResourceDef } from "@/lib/resources";
import { Btn } from "@/components/ui";
import { toDateInputValue, toDateTimeInputValue } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";
import { translateFieldLabel, translateOption, type Locale } from "@/lib/i18n";

type RelationOption = { value: string; label: string };

function useRelationOptions(fields: FieldDef[]) {
  const [options, setOptions] = useState<Record<string, RelationOption[]>>({});

  useEffect(() => {
    const relFields = fields.filter((f) => f.type === "relation" && f.relationTable);
    if (relFields.length === 0) return;
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const entries = await Promise.all(
        relFields.map(async (f) => {
          const labelKey = f.relationLabelKey || "name";
          const { data } = await supabase
            .from(f.relationTable as any)
            .select(`id, ${labelKey}`)
            .order(labelKey, { ascending: true })
            .limit(500);
          const opts = (data || []).map((row: any) => ({
            value: String(row.id),
            label: String(row[labelKey] ?? row.id),
          }));
          return [f.key, opts] as const;
        })
      );
      if (!cancelled) setOptions(Object.fromEntries(entries));
    })();

    return () => {
      cancelled = true;
    };
  }, [fields]);

  return options;
}

function fieldInitialValue(field: FieldDef, existing: Record<string, unknown> | null, prefill?: Record<string, unknown>) {
  if (existing && field.key in existing) {
    const v = existing[field.key];
    if (field.type === "date") return toDateInputValue(v as string);
    if (field.type === "datetime") return toDateTimeInputValue(v as string);
    if (field.type === "tags") return Array.isArray(v) ? (v as string[]).join(", ") : "";
    if (field.type === "boolean") return Boolean(v);
    return v ?? "";
  }
  if (prefill && field.key in prefill) return prefill[field.key];
  if (field.default !== undefined) return field.default;
  if (field.type === "boolean") return false;
  return "";
}

export function ResourceForm({
  resource,
  existing,
  prefill,
  onCancel,
  onSaved,
}: {
  resource: ResourceDef;
  existing?: Record<string, unknown> | null;
  /** Initial values for a brand-new record (e.g. pre-filling a task title from a news story). Ignored when editing. */
  prefill?: Record<string, unknown>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { t, locale } = useI18n();
  const relationOptions = useRelationOptions(resource.fields);
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    resource.fields.forEach((f) => {
      init[f.key] = fieldInitialValue(f, existing ?? null, prefill);
    });
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setValue(key: string, v: unknown) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const payload: Record<string, unknown> = {};
    resource.fields.forEach((f) => {
      let v = values[f.key];
      if (f.type === "tags") {
        v = String(v || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (f.type === "number" || f.type === "money") {
        v = v === "" || v === null || v === undefined ? null : Number(v);
      }
      if (f.type === "relation") {
        v = v === "" ? null : v;
      }
      if ((f.type === "date" || f.type === "datetime") && v === "") {
        v = null;
      }
      if (f.type === "datetime" && typeof v === "string" && v) {
        v = new Date(v).toISOString();
      }
      payload[f.key] = v;
    });

    const query = existing
      ? supabase.from(resource.table as any).update(payload).eq("id", existing.id as string)
      : supabase.from(resource.table as any).insert(payload);

    const { error } = await query;
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {resource.fields.map((f) => (
        <FieldInput
          key={f.key}
          resourceKey={resource.key}
          field={f}
          value={values[f.key]}
          onChange={(v) => setValue(f.key, v)}
          options={f.type === "relation" ? relationOptions[f.key] : undefined}
          locale={locale}
        />
      ))}

      {error && <div className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</div>}

      <div className="grid grid-cols-2 gap-2 pt-2">
        <Btn variant="ghost" onClick={onCancel} className="border border-line">
          {t("common.cancel")}
        </Btn>
        <Btn variant="gold" type="submit" disabled={busy}>
          {busy ? t("common.saving") : t("common.save")}
        </Btn>
      </div>
    </form>
  );
}

function FieldInput({
  resourceKey,
  field,
  value,
  onChange,
  options,
  locale,
}: {
  resourceKey: string;
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  options?: { value: string; label: string }[];
  locale: Locale;
}) {
  const { t } = useI18n();
  const base =
    "w-full rounded-xl border border-line bg-bg px-3 py-3 text-ink outline-none focus:border-gold min-h-[46px]";
  const label = translateFieldLabel(locale, resourceKey, field.key, field.label);

  if (field.type === "boolean") {
    return (
      <label className="flex items-center justify-between rounded-xl border border-line bg-bg px-3 py-3">
        <span className="text-sm text-muted">{label}</span>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-5 w-5 accent-gold"
        />
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        <label className="mb-1 block text-[11px] text-muted">{label}</label>
        <textarea
          required={field.required}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`${base} min-h-[100px]`}
          placeholder={field.placeholder}
        />
      </div>
    );
  }

  if (field.type === "select" || field.type === "relation") {
    const selectOptions = field.type === "select" ? field.options : options;
    return (
      <div>
        <label className="mb-1 block text-[11px] text-muted">{label}</label>
        <select
          required={field.required}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        >
          <option value="">{field.type === "relation" ? t("common.none") : t("common.select")}</option>
          {(selectOptions || []).map((o) => (
            <option key={o.value} value={o.value}>
              {field.type === "select" ? translateOption(locale, o.value, o.label) : o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const inputType =
    field.type === "number" || field.type === "money"
      ? "number"
      : field.type === "date"
        ? "date"
        : field.type === "datetime"
          ? "datetime-local"
          : "text";

  return (
    <div>
      <label className="mb-1 block text-[11px] text-muted">{label}</label>
      <input
        required={field.required}
        type={inputType}
        step={field.type === "money" ? "0.01" : undefined}
        value={(value as string | number) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={base}
      />
    </div>
  );
}
