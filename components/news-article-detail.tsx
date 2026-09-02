"use client";

import { useState } from "react";
import type { NewsArticle } from "@/lib/news/types";
import { Btn, Sheet } from "@/components/ui";
import { ResourceForm } from "@/components/resource-form";
import { RESOURCES } from "@/lib/resources";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";

type ActionKind = "task" | "decision" | "note" | null;

export function NewsArticleDetail({
  article,
  saved,
  onToggleSave,
  onClose,
}: {
  article: NewsArticle;
  saved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const [action, setAction] = useState<ActionKind>(null);
  const [relevance, setRelevance] = useState<string | null>(null);
  const [relevanceLoading, setRelevanceLoading] = useState(false);
  const [askInput, setAskInput] = useState("");
  const [askReply, setAskReply] = useState<string | null>(null);
  const [askBusy, setAskBusy] = useState(false);

  const importanceLabel =
    article.importance === "critical" ? t("news.critical") : article.importance === "important" ? t("news.important") : t("news.worthKnowing");

  async function loadRelevance() {
    setRelevanceLoading(true);
    try {
      const res = await fetch("/api/news/relevance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, article: { headline: article.headline, summary: article.summary } }),
      });
      const data = await res.json();
      setRelevance(data.interpretation || null);
    } catch {
      setRelevance(null);
    } finally {
      setRelevanceLoading(false);
    }
  }

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || askBusy) return;
    setAskBusy(true);
    setAskReply(null);
    try {
      const res = await fetch("/api/stark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: [],
          locale,
          article: {
            headline: article.headline,
            source: article.source,
            summary: article.summary,
            published_at: article.published_at,
            article_url: article.article_url,
          },
        }),
      });
      const data = await res.json();
      setAskReply(data.reply || data.error || "…");
    } catch {
      setAskReply(t("starkPage.error"));
    } finally {
      setAskBusy(false);
      setAskInput("");
    }
  }

  const storyChips = [t("starkPage.storyChip1"), t("starkPage.storyChip2"), t("starkPage.storyChip3"), t("starkPage.storyChip4")];

  if (action) {
    const resource = action === "task" ? RESOURCES.tasks : action === "decision" ? RESOURCES.decisions : RESOURCES.notes_table;
    const prefill =
      action === "task"
        ? { title: t("news.createTaskTitle", { headline: article.headline }) }
        : action === "decision"
          ? { title: t("news.decisionTitle", { headline: article.headline }), context: `${article.summary}\n\n${article.article_url}` }
          : { title: t("news.noteTitle", { headline: article.headline }), content: `${article.summary}\n\n${article.article_url}` };
    return (
      <div>
        <ResourceForm resource={resource} prefill={prefill} onCancel={() => setAction(null)} onSaved={() => setAction(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <span className="rounded-full bg-panel2 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">{importanceLabel}</span>
        <h2 className="mt-2 text-lg font-bold leading-snug">{article.headline}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{t("news.source")}: {article.source}</span>
          {article.published_at && <span>· {formatDateTime(article.published_at, locale)}</span>}
        </div>
        {article.also_reported_by && article.also_reported_by.length > 0 && (
          <p className="mt-1 text-xs text-muted">{t("news.alsoReportedBy", { sources: article.also_reported_by.join(", ") })}</p>
        )}
      </div>

      <p className="text-sm leading-relaxed">{article.summary}</p>

      <div className="rounded-xl border border-line bg-bg p-3">
        <b className="mb-1 block text-xs uppercase tracking-wide text-gold">{t("news.whyThisMattersToMe")}</b>
        {!relevance && !relevanceLoading && (
          <Btn onClick={loadRelevance} className="mt-1">
            {t("news.whyThisMattersToMe")}
          </Btn>
        )}
        {relevanceLoading && <p className="text-sm text-muted">{t("news.generatingRelevance")}</p>}
        {relevance && (
          <>
            <span className="mb-1 inline-block rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-bold text-gold">
              {t("news.aiInterpretationLabel")}
            </span>
            <p className="text-sm leading-relaxed">{relevance}</p>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={article.article_url} target="_blank" rel="noreferrer">
          <Btn variant="gold">{t("news.openOriginal")}</Btn>
        </a>
        <Btn onClick={onToggleSave}>{saved ? t("news.unsave") : t("news.save")}</Btn>
        <Btn onClick={() => setAction("task")}>{t("news.createTask")}</Btn>
        <Btn onClick={() => setAction("decision")}>{t("news.addToDecision")}</Btn>
        <Btn onClick={() => setAction("note")}>{t("news.saveToNotes")}</Btn>
      </div>

      <div className="rounded-xl border border-line bg-bg p-3">
        <b className="mb-2 block text-xs uppercase tracking-wide text-gold">{t("news.askAboutThis")}</b>
        <div className="mb-2 flex flex-wrap gap-2">
          {storyChips.map((c) => (
            <button key={c} onClick={() => ask(c)} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted">
              {c}
            </button>
          ))}
        </div>
        {askBusy && <p className="text-sm text-muted">{t("starkPage.thinking")}</p>}
        {askReply && <p className="whitespace-pre-wrap text-sm leading-relaxed">{askReply}</p>}
        <div className="mt-2 flex gap-2">
          <input
            value={askInput}
            onChange={(e) => setAskInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(askInput)}
            placeholder={t("starkPage.placeholder")}
            className="h-11 flex-1 rounded-xl border border-line bg-panel px-3 text-sm text-ink outline-none"
          />
          <Btn variant="gold" onClick={() => ask(askInput)} disabled={askBusy}>
            {t("starkPage.aboutStory")}
          </Btn>
        </div>
      </div>
    </div>
  );
}

export function NewsArticleSheet({
  article,
  saved,
  onToggleSave,
  onClose,
}: {
  article: NewsArticle | null;
  saved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Sheet open={article !== null} onClose={onClose} title={t("news.articleDetail")} wide>
      {article && <NewsArticleDetail article={article} saved={saved} onToggleSave={onToggleSave} onClose={onClose} />}
    </Sheet>
  );
}
