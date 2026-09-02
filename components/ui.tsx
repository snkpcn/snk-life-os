"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n/context";

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl2 border border-line bg-panel p-4 shadow-lg ${className}`}>{children}</div>
  );
}

export function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 mt-6 flex items-end justify-between gap-3">
      <div>
        <h3 className="text-[17px] font-bold">{title}</h3>
        {subtitle && <small className="text-muted">{subtitle}</small>}
      </div>
      {action}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  variant = "default",
  type = "button",
  disabled,
  className = "",
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "gold" | "danger" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const styles = {
    default: "border border-line bg-panel2 text-ink",
    gold: "bg-gradient-to-br from-gold to-goldDark text-[#17130c] font-bold border-0",
    danger: "border border-red/40 bg-red/10 text-red",
    ghost: "border border-transparent text-muted",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`min-h-[40px] rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ label }: { label: string }) {
  return <div className="py-6 text-center text-sm text-muted">{label}</div>;
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`safe-bottom box-border max-h-[92vh] w-full max-w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} overflow-x-hidden overflow-y-auto rounded-t-[24px] border border-line bg-panel p-5 sm:rounded-[24px]`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmBar({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-red/30 bg-red/10 p-3 text-sm">
      <span>{message}</span>
      <div className="flex gap-2">
        <Btn variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Btn>
        <Btn variant="danger" onClick={onConfirm}>
          {t("common.confirm")}
        </Btn>
      </div>
    </div>
  );
}
