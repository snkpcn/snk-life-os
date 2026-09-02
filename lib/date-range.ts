// SNK LIFE OS always reasons about "today" in Asia/Bangkok wall-clock time,
// regardless of the server's own timezone (Vercel serverless functions run in UTC).
// Naively using `new Date()` + `setHours(0,0,0,0)` would compute midnight in the
// SERVER's timezone, silently shifting "today" by up to 7 hours for a Bangkok user.
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function todayRange(now: Date = new Date()) {
  const bangkokNow = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const y = bangkokNow.getUTCFullYear();
  const m = bangkokNow.getUTCMonth();
  const d = bangkokNow.getUTCDate();
  const startUtcMs = Date.UTC(y, m, d) - BANGKOK_OFFSET_MS;
  const start = new Date(startUtcMs);
  const end = new Date(startUtcMs + 24 * 60 * 60 * 1000);
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    dateOnly: `${y}-${pad(m + 1)}-${pad(d)}`,
  };
}
