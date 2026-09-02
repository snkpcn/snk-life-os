"use client";

import { useRef, useState } from "react";
import { Card } from "@/components/ui";
import { useI18n } from "@/lib/i18n/context";

type Message = { role: "user" | "assistant"; content: string };

export default function StarkPage() {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: t("starkPage.intro") }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chips = [t("starkPage.chip1"), t("starkPage.chip2"), t("starkPage.chip3"), t("starkPage.chip4")];

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const nextMessages = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/stark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history: nextMessages, locale }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply || data.error || "…" }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: t("starkPage.error") }]);
    } finally {
      setBusy(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div>
      <Card className="mb-4 flex items-center gap-4 bg-gradient-to-br from-panel to-panel2">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-gold to-goldDark text-xl font-black text-[#17130c]">
          S
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-gold">{t("starkPage.kicker")}</div>
          <h1 className="text-lg font-bold">{t("starkPage.title")}</h1>
        </div>
      </Card>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => send(c)}
            className="shrink-0 rounded-full border border-line px-3 py-2 text-xs text-muted"
          >
            {c}
          </button>
        ))}
      </div>

      <Card className="space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-auto rounded-br-md bg-gold text-[#15120c]"
                : "rounded-bl-md border border-line bg-panel2"
            }`}
          >
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-panel2 px-4 py-3 text-sm text-muted">
            {t("starkPage.thinking")}
          </div>
        )}
        <div ref={bottomRef} />
      </Card>

      <div className="sticky bottom-24 mt-3 flex gap-2 rounded-2xl border border-line bg-panel p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder={t("starkPage.placeholder")}
          className="h-11 flex-1 rounded-xl bg-bg px-3 text-ink outline-none"
        />
        <button
          onClick={() => send(input)}
          disabled={busy}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-gold to-goldDark font-bold text-[#17130c] disabled:opacity-50"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
