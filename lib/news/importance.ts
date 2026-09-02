import type { NewsImportance } from "./types";

// Deliberately sparse: CRITICAL should be rare. This is a heuristic over headline + summary
// text only — it never fabricates severity, it just triages using the words the source itself used.
const CRITICAL_PATTERNS = [
  /\bnuclear\b/i,
  /declares? war/i,
  /invasion/i,
  /assassinat/i,
  /coup d'?[ée]tat/i,
  /magnitude 7/i,
  /tsunami warning/i,
  /state of emergency/i,
  /martial law/i,
  /market crash/i,
  /central bank.*(emergency|surprise)/i,
];

const IMPORTANT_PATTERNS = [
  /\bwar\b/i,
  /conflict/i,
  /election/i,
  /central bank/i,
  /interest rate/i,
  /inflation/i,
  /recession/i,
  /earthquake/i,
  /flood/i,
  /storm|typhoon|cyclone/i,
  /policy/i,
  /sanction/i,
  /tariff/i,
  /ceasefire/i,
  /summit/i,
  /regulation/i,
  /acquisition|merger/i,
  /layoffs?/i,
  /outage/i,
  /data breach|cyberattack/i,
];

export function classifyImportance(headline: string, summary: string): NewsImportance {
  const text = `${headline} ${summary}`;
  if (CRITICAL_PATTERNS.some((p) => p.test(text))) return "critical";
  if (IMPORTANT_PATTERNS.some((p) => p.test(text))) return "important";
  return "worth_knowing";
}
