"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ResourceDef } from "@/lib/resources";
import { Btn, Card, EmptyState, SectionHead, Sheet, ConfirmBar } from "@/components/ui";
import { ResourceForm } from "@/components/resource-form";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";
import { translateResourceLabel, translateFieldLabel, translateOption, type Locale } from "@/lib/i18n";

function displayValue(resource: ResourceDef, row: Record<string, any>, key: string, locale: Locale) {
  const field = resource.fields.find((f) => f.key === key);
  const v = row[key];
  if (v === null || v === undefined || v === "") return null;
  if (field?.type === "money") return formatMoney(Number(v), (row.currency as string) || "THB", locale);
  if (field?.type === "date") return formatDate(v, locale);
  if (field?.type === "datetime") return formatDateTime(v, locale);
  if (field?.type === "boolean") return v ? translateFieldLabel(locale, resource.key, field.key, field.label) : null;
  if (field?.type === "select" && typeof v === "string") return translateOption(locale, v, v);
  if (Array.isArray(v)) return v.join(", ");
  if (key === row.id) return null;
  return String(v);
}

export function ResourceSection({
  resource,
  filter,
  hideCreate,
  compact,
  onChange,
  limit,
}: {
  resource: ResourceDef;
  filter?: Record<string, string | number | boolean>;
  hideCreate?: boolean;
  compact?: boolean;
  onChange?: () => void;
  limit?: number;
}) {
  const { t, locale } = useI18n();
  const label = translateResourceLabel(locale, resource.key, "label", resource.label);
  const labelPlural = translateResourceLabel(locale, resource.key, "labelPlural", resource.labelPlural);
  const [rows, setRows] = useState<Record<string, any>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    let query = supabase.from(resource.table as any).select("*");
    if (resource.softDeleteColumn) {
      query = query.is(resource.softDeleteColumn, null);
    }
    if (filter) {
      Object.entries(filter).forEach(([k, v]) => {
        query = query.eq(k, v as any);
      });
    }
    if (resource.orderBy) {
      query = query.order(resource.orderBy.column, { ascending: resource.orderBy.ascending ?? true });
    }
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) setError(error.message);
    else setRows(data || []);
  }, [resource, filter, limit]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    const supabase = createClient();
    const result = resource.softDeleteColumn
      ? await supabase.from(resource.table as any).update({ [resource.softDeleteColumn]: new Date().toISOString() }).eq("id", id)
      : await supabase.from(resource.table as any).delete().eq("id", id);
    if (!result.error) {
      setConfirmId(null);
      load();
      onChange?.();
    } else {
      setError(result.error.message);
    }
  }

  return (
    <div>
      {!hideCreate && (
        <SectionHead
          title={labelPlural}
          action={
            <Btn
              variant="gold"
              onClick={() => {
                setEditing(null);
                setOpenForm(true);
              }}
            >
              ＋ {label}
            </Btn>
          }
        />
      )}

      {error && <div className="mb-2 rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</div>}

      <Card className={compact ? "p-2" : undefined}>
        {rows === null && <EmptyState label={t("common.loading")} />}
        {rows !== null && rows.length === 0 && (
          <EmptyState label={t("common.noItemsYet", { items: labelPlural.toLowerCase() })} />
        )}
        {rows !== null &&
          rows.map((row) => {
            const subtitle = (resource.subtitleKeys || [])
              .map((k) => displayValue(resource, row, k, locale))
              .filter(Boolean)
              .join(" · ");
            return (
              <div key={row.id} className="border-b border-line py-3 last:border-b-0">
                {confirmId === row.id ? (
                  <ConfirmBar
                    message={t("common.confirmRemove", { item: label.toLowerCase() })}
                    onConfirm={() => handleDelete(row.id)}
                    onCancel={() => setConfirmId(null)}
                  />
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <button
                      className="flex-1 text-left"
                      onClick={() => {
                        setEditing(row);
                        setOpenForm(true);
                      }}
                    >
                      <b className="block text-sm">{displayValue(resource, row, resource.titleKey, locale) || "(untitled)"}</b>
                      {subtitle && <small className="mt-1 block text-muted">{subtitle}</small>}
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <Btn
                        onClick={() => {
                          setEditing(row);
                          setOpenForm(true);
                        }}
                      >
                        {t("common.edit")}
                      </Btn>
                      <Btn variant="danger" onClick={() => setConfirmId(row.id)}>
                        {resource.softDeleteColumn ? t("common.archive") : t("common.delete")}
                      </Btn>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </Card>

      <Sheet
        open={openForm}
        onClose={() => setOpenForm(false)}
        title={editing ? t("common.editItem", { item: label }) : t("common.newItem", { item: label })}
      >
        <ResourceForm
          resource={resource}
          existing={editing}
          onCancel={() => setOpenForm(false)}
          onSaved={() => {
            setOpenForm(false);
            load();
            onChange?.();
          }}
        />
      </Sheet>
    </div>
  );
}
