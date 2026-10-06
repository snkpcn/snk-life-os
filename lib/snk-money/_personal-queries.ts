import { buildOccurrenceList, type ScheduleMaster, type ScheduleOccurrenceException } from '../schedule-occurrences';
import { addDays, finalizeReply, money, normalizeText, thaiDate } from './_personal-finance-core';
import type { PfLedger } from './_personal-finance-ledger';

export const PERSONAL_MODULES = ['money', 'tasks', 'schedule', 'projects', 'notes', 'coach', 'personal_summary'] as const;
export type PersonalModule = typeof PERSONAL_MODULES[number];
type Row = Record<string, any>;
export type PersonalQuery = { kind: 'summary' | 'tasks' | 'schedule' | 'projects' | 'money' | 'notes'; modules: PersonalModule[]; filter?: string; period?: string };
export type PersonalRequest =
  | { action: 'query'; query: PersonalQuery }
  | { action: 'cancel_task'; title_hint: string }
  | { action: 'complete_task'; title_hint: string }
  | { action: 'reschedule_task'; title_hint: string; due_date: string }
  | { action: 'clarify_task_change' }
  | { action: 'none' };
export type PersonalRequestInterpreter = (raw: string, today: string, allowed: readonly string[]) => Promise<PersonalRequest | null>;
type Query = PersonalQuery;

const QUERY_KINDS = ['summary', 'tasks', 'schedule', 'projects', 'money', 'notes', 'none'] as const;
const QUERY_FILTERS = ['open', 'overdue', 'owner', 'waiting', 'total', 'items', 'categories', 'food', 'recent', 'recent_expense', 'none'] as const;
const QUERY_PERIODS = ['today', 'tomorrow', 'week', 'upcoming', 'month', 'yesterday', 'last_month', 'none'] as const;

/** Gemini understands open Thai phrasing. It proposes a small, validated SNK query;
 * it never receives ledger rows and cannot issue SQL or pick an owner. */
export const geminiPersonalRequestInterpreter: PersonalRequestInterpreter = async (raw, today, allowed) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !raw.trim() || raw.length > 1000) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  const schema = {
    type: 'OBJECT',
    properties: {
      action: { type: 'STRING', enum: ['query', 'cancel_task', 'complete_task', 'reschedule_task', 'clarify_task_change', 'none'] },
      kind: { type: 'STRING', enum: [...QUERY_KINDS] },
      filter: { type: 'STRING', enum: [...QUERY_FILTERS] },
      period: { type: 'STRING', enum: [...QUERY_PERIODS] },
      title_hint: { type: 'STRING' },
      due_date: { type: 'STRING' },
    },
    required: ['action', 'kind', 'filter', 'period', 'title_hint', 'due_date'],
    propertyOrdering: ['action', 'kind', 'filter', 'period', 'title_hint', 'due_date'],
  };
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: [
          'Interpret one message from the owner in a private personal secretary chat.',
          'Understand whether it asks to READ personal SNK data or clearly change an existing personal task. Never classify business/customer/Tamma requests as personal.',
          'Understand natural Thai, paraphrases, pronouns and casual wording. Do not require fixed command phrases.',
          'For reading use action=query and the query fields. For a clear request to remove/cancel a task use cancel_task; to mark done use complete_task; to move its due date use reschedule_task with a Bangkok YYYY-MM-DD date. Extract title_hint from the task named in the message.',
          'Use clarify_task_change when the owner clearly wants to edit a task but has not said which task or what change. Never guess a task or the intended change.',
          'Use action=none for ordinary conversation, task creation (the existing secretary handles that), finance writes, business requests, or unclear intent.',
          'Supported read kinds: summary, tasks (open/overdue/owner/waiting), schedule (today/tomorrow/week/upcoming), projects, notes, money (total/items/categories/food/recent/recent_expense).',
          'Use the supplied Bangkok date to resolve relative periods. If the user says this month, period=month. Money default period=month; other kinds use their natural default.',
          'This model proposes intent only; the server checks permissions, resolves task names against current SNK rows, and loads any query evidence from SNK.',
          'Bangkok date and allowed modules are provided alongside the user message.',
        ].join(' ') }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify({ message: raw, today, allowed_modules: allowed }) }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 120, responseMimeType: 'application/json', responseSchema: schema },
      }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const content = (data.candidates?.[0]?.content?.parts ?? []).map(part => part.text ?? '').join('').trim();
    if (!content) return null;
    const candidate = JSON.parse(content) as { action?: string; kind?: string; filter?: string; period?: string; title_hint?: string; due_date?: string };
    if (candidate.action === 'none') return { action: 'none' };
    if (candidate.action === 'clarify_task_change') return { action: 'clarify_task_change' };
    if (['cancel_task', 'complete_task'].includes(candidate.action ?? '')) {
      const title_hint = (candidate.title_hint ?? '').trim().slice(0, 120);
      if (!title_hint) return { action: 'clarify_task_change' };
      return candidate.action === 'cancel_task' ? { action: 'cancel_task', title_hint } : { action: 'complete_task', title_hint };
    }
    if (candidate.action === 'reschedule_task') {
      const title_hint = (candidate.title_hint ?? '').trim().slice(0, 120);
      const due_date = candidate.due_date ?? '';
      if (!title_hint) return { action: 'clarify_task_change' };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due_date) || new Date(`${due_date}T00:00:00Z`).toISOString().slice(0, 10) !== due_date) return { action: 'clarify_task_change' };
      return { action: 'reschedule_task', title_hint, due_date };
    }
    if (candidate.action !== 'query') return null;
    if (!QUERY_KINDS.includes(candidate.kind as typeof QUERY_KINDS[number]) || candidate.kind === 'none') return null;
    if (!QUERY_FILTERS.includes((candidate.filter ?? 'none') as typeof QUERY_FILTERS[number])
      || !QUERY_PERIODS.includes((candidate.period ?? 'none') as typeof QUERY_PERIODS[number])) return null;
    const kind = candidate.kind as Query['kind'];
    const filter = candidate.filter === 'none' ? undefined : candidate.filter;
    const period = candidate.period === 'none' ? undefined : candidate.period;
    let modules: PersonalModule[];
    if (kind === 'summary') modules = ['personal_summary', 'tasks', 'schedule', 'projects', 'money'];
    else if (kind === 'tasks') modules = ['tasks'];
    else if (kind === 'schedule') modules = ['schedule', 'tasks'];
    else modules = [kind];
    if (kind === 'tasks' && !['open', 'overdue', 'owner', 'waiting', undefined].includes(filter)) return null;
    if (kind === 'schedule' && !['today', 'tomorrow', 'week', 'upcoming', undefined].includes(period)) return null;
    if (kind === 'money' && !['total', 'items', 'categories', 'food', 'recent', 'recent_expense', undefined].includes(filter)) return null;
    return { action: 'query', query: { kind, modules, ...(filter ? { filter } : {}), ...(period ? { period } : {}) } };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

/** Resolve common requests locally. Gemini is used only for unfamiliar wording. */
export async function understandPersonalRequest(raw: string, today: string, allowed: readonly string[], isOwner: boolean, interpreter: PersonalRequestInterpreter = geminiPersonalRequestInterpreter): Promise<PersonalRequest | null> {
  const known = personalQuery(raw);
  if (known) return { action: 'query', query: known };
  if (!isOwner) return null;
  return interpreter(raw, today, allowed);
}

export function personalQuery(raw: string): Query | null {
  const text = normalizeText(raw).replace(/^(?:น้อง)?ทองไทย\s*/u, '').trim();
  if (/(?:ยกเลิก|ลงผิด|เปลี่ยน|ปรับยอด|ลบรายการ|แก้รายการ|จ่ายแล้ว|ต้องจ่าย|จะจ่าย|ถึงกำหนด|คงเหลือ|เงินเหลือ|ยอดเหลือ|กระทบยอด)/u.test(text)) return null;
  if (/^(?:สรุป(?:มา|หน่อย|ให้(?:หน่อย|ดู)?|ตอนนี้)?|สรุปส่วนตัว|สรุปภาพรวม|มีอะไรต้องตาม|ตอนนี้มีอะไรต้องทำ)(?:ครับ|ที|หน่อย)?[?!？]*$/u.test(text)) {
    return { kind: 'summary', modules: ['personal_summary', 'tasks', 'schedule', 'projects', 'money'] };
  }
  if (/(?:โปรเจ[คก](?:ต์)?|โครงการ)ส่วนตัว.*(?:ถึงไหน|เป็นไง|คืบหน้า|มีอะไร)|(?:โปรเจ[คก](?:ต์)?|โครงการ).*ถึงไหน/u.test(text)) return { kind: 'projects', modules: ['projects'] };
  // A declaration such as “มีงานใหม่ต้องทำ ต้องอ่าน...” is a write, not a request
  // to list existing tasks. Keep the query vocabulary limited to questions.
  if (/(?:มีอะไรค้าง|เหลืออะไร|งานไหน|งานอะไร|งานที่(?:ค้าง|รอ|เลยกำหนด)|งานค้าง|มีงาน(?:ค้าง|อะไร|ไหน|ไหม|หรือเปล่า|ใหม่(?:ไหม|หรือเปล่า))?\s*[?？]?$)/u.test(text) && !/(?:เสร็จแล้ว|เพิ่มงาน|บันทึกงาน)/u.test(text)) {
    return { kind: 'tasks', modules: ['tasks'], filter: /เลยกำหนด|เกินกำหนด/u.test(text) ? 'overdue' : /รอกู|รอผม|รอพี่|รอเรา|รอยืนยัน/u.test(text) ? 'owner' : /รอ|ติดตาม/u.test(text) ? 'waiting' : 'open' };
  }
  if (/^(?:วันนี้|พรุ่งนี้|(?:สัปดาห์|อาทิตย์)นี้)มีอะไร|(?:มีนัดอะไร|มีนัดไหม|(?:วันนี้|พรุ่งนี้|(?:สัปดาห์|อาทิตย์)นี้).*มีนัดอะไร)/u.test(text)) {
    return { kind: 'schedule', modules: ['schedule', 'tasks'], period: /พรุ่งนี้/u.test(text) ? 'tomorrow' : /สัปดาห์|อาทิตย์/u.test(text) ? 'week' : /วันนี้/u.test(text) ? 'today' : 'upcoming' };
  }
  const question = /เท่าไหร่|เท่าไร|อะไร|เป็นไง|ยังไง|เยอะสุด|สูงสุด|ล่าสุด|สรุป|ดู|ขอดู|บ้าง/u.test(text);
  if (question && /เงิน|จ่าย|ใช้ไป|ใช้เงิน|ค่าอาหาร|รายจ่าย|รายการล่าสุด|รายการ(?:เงิน)?ล่าสุด/u.test(text)) {
    return { kind: 'money', modules: ['money'], filter: /ล่าสุด/u.test(text) ? /จ่าย|รายจ่าย/u.test(text) ? 'recent_expense' : 'recent' : /ค่าอาหาร/u.test(text) ? 'food' : /เยอะสุด|สูงสุด/u.test(text) ? 'categories' : /อะไร|บ้าง/u.test(text) ? 'items' : 'total', period: /เมื่อวาน/u.test(text) ? 'yesterday' : /วันนี้/u.test(text) ? 'today' : /เดือน(?:ก่อน|ที่แล้ว)/u.test(text) ? 'last_month' : 'month' };
  }
  if (/^(?:มี|ดู|ขอดู|สรุป)(?:โน้ต|บันทึกส่วนตัว)/u.test(text)) return { kind: 'notes', modules: ['notes'] };
  return null;
}

function periodRange(period: string | undefined, today: string): [string, string] {
  if (period === 'yesterday') { const date = addDays(today, -1); return [date, date]; }
  if (period === 'today') return [today, today];
  if (period === 'tomorrow') { const date = addDays(today, 1); return [date, date]; }
  if (period === 'last_month') { const last = addDays(today.slice(0, 8) + '01', -1); return [last.slice(0, 8) + '01', last]; }
  return [today.slice(0, 8) + '01', today];
}

function taskLine(task: Row): string {
  const when = task.state === 'OVERDUE' ? ` — เลยกำหนด (${thaiDate(task.due_date)})` : task.due_date ? ` — ${thaiDate(task.due_date)}` : '';
  const next = task.next_action ? `; ต่อไป: ${task.next_action}` : task.waiting_for ? `; รอ ${task.waiting_for}` : task.blocker ? `; ติด ${task.blocker}` : '';
  return `• ${task.title}${when}${next}`;
}

function moneyLines(data: Row, filter = 'total'): string[] {
  const expense = (data.recent ?? []).filter((row: Row) => row.kind === 'EXPENSE');
  if (filter === 'recent' || filter === 'recent_expense') {
    const row = filter === 'recent_expense' ? data.latest_expense : data.latest;
    return row ? [`ล่าสุด ${thaiDate(row.occurred_on)}: ${row.kind === 'INCOME' ? 'รับ' : row.kind === 'TRANSFER' ? 'โอนระหว่างบัญชี' : row.kind === 'ADJUSTMENT' ? 'ปรับยอด' : 'จ่าย'} ${row.note || row.payee || row.category || 'ไม่ระบุรายการ'} ${money(row.amount)}`] : [filter === 'recent_expense' ? 'ยังไม่มีรายจ่ายส่วนตัวที่บันทึกไว้ครับ' : 'ยังไม่มีรายการเงินครับ'];
  }
  if (!data.transaction_count && filter === 'items') return ['ยังไม่มีรายจ่ายที่บันทึกในช่วงที่ถามครับ'];
  const categories = (data.by_category ?? []).filter((row: Row) => row.kind === 'EXPENSE');
  if (filter === 'food') {
    const rows = categories.filter((row: Row) => /อาหาร|กิน|กาแฟ|เครื่องดื่ม/u.test(row.category));
    return rows.length ? rows.map((row: Row) => `• ${row.category}: ${money(row.total)}`) : ['ยังไม่มีรายจ่ายหมวดอาหารในช่วงที่ถามครับ'];
  }
  const lines = [`รายจ่ายส่วนตัว ${money(data.expense)} (${thaiDate(data.from)}–${thaiDate(data.to)})`];
  if (filter === 'categories') lines.push(...categories.slice(0, 4).map((row: Row) => `• ${row.category}: ${money(row.total)}`));
  if (filter === 'items') lines.push(...expense.slice(0, 5).map((row: Row) => `• ${thaiDate(row.occurred_on)} ${row.note || row.payee || row.category || 'ไม่ระบุรายการ'} ${money(row.amount)}`));
  if (data.pending_clarification_count) lines.push(`มี ${data.pending_clarification_count} รายการที่ยังรอระบุบัญชีครับ`);
  return lines;
}

/** Every status answer is generated from a fresh owner-scoped SNK RPC, never chat memory. */
export async function answerPersonalQuery(ledger: PfLedger, raw: string, today: string, allowed: readonly string[], isOwner: boolean, queryOverride?: PersonalQuery | null): Promise<string | null> {
  const query = queryOverride === undefined ? personalQuery(raw) : queryOverride;
  if (!query) return null;
  if (!isOwner && query.modules.some(module => module !== 'money')) return finalizeReply('ข้อมูลส่วนตัวเรื่องนี้ให้เจ้าของกลุ่มเรียกดูได้ครับ');
  if (query.modules.some(module => !allowed.includes(module))) return finalizeReply('กลุ่มนี้ยังไม่ได้เปิดสิทธิ์ดูข้อมูลส่วนตัวหมวดที่ถามครับ');
  const [from, to] = periodRange(query.period, today);
  const data = await ledger.personalSnapshot(query.modules, today, from, to);
  const tasks: Row[] = data.tasks ?? [];
  const waiting = tasks.filter(task => ['WAITING', 'BLOCKED'].includes(task.state));
  const overdue = tasks.filter(task => task.due_date && task.due_date < today);
  const needsOwner = tasks.filter(task => task.owner_action || /เจ้าของ|พี่|ยืนยัน|อนุมัติ|กู|ผม/u.test(task.waiting_for ?? ''));
  const calendarStart = query.period === 'tomorrow' ? addDays(today, 1) : today;
  const days = query.period === 'week' ? 7 - ((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7) : query.period === 'upcoming' ? 31 : query.kind === 'summary' ? 7 : 1;
  const start = new Date(calendarStart + 'T00:00:00+07:00');
  const end = new Date(new Date(addDays(calendarStart, days) + 'T00:00:00+07:00').getTime() - 1);
  const events = buildOccurrenceList((data.schedule_masters ?? []) as ScheduleMaster[], (data.schedule_exceptions ?? []) as ScheduleOccurrenceException[], start, end)
    .filter(event => event.status === 'scheduled' && new Date(event.start_time) >= start && new Date(event.start_time) <= end);
  const eventLines = events.slice(0, 4).map(event => `• ${thaiDate(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(event.start_time)))} ${event.title}${event.start_time ? ` ${new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(event.start_time))}` : ''}`);
  let lines: string[] = [];
  if (query.kind === 'money') lines = moneyLines(data.money ?? {}, query.filter);
  if (query.kind === 'tasks') {
    const rows = query.filter === 'overdue' ? overdue : query.filter === 'owner' ? needsOwner : query.filter === 'waiting' ? waiting : tasks;
    lines = rows.length ? ['งานส่วนตัวที่ต้องตามครับ', ...rows.slice(0, 5).map(taskLine), ...(rows.length > 5 ? [`ยังมีอีก ${rows.length - 5} งานใน SNK ครับ`] : [])] : ['ไม่พบงานส่วนตัวที่ค้างตามเงื่อนไขที่ถามครับ'];
  }
  if (query.kind === 'schedule') {
    const due = tasks.filter(task => task.due_date >= calendarStart && task.due_date <= addDays(calendarStart, days - 1));
    lines = ['ตารางส่วนตัวครับ', ...(eventLines.length ? eventLines : ['ไม่มีนัดที่บันทึกไว้ในช่วงนี้ครับ']), ...due.slice(0, 3).map(taskLine)];
  }
  if (query.kind === 'projects') {
    lines = data.projects?.length ? ['โปรเจคส่วนตัวครับ', ...data.projects.slice(0, 5).map((row: Row) => `• ${row.name} — ${row.status}${row.next_action ? `; ต่อไป: ${row.next_action}` : ''}${row.blocker ? `; ติด ${row.blocker}` : ''}`)] : ['ยังไม่มีโปรเจคส่วนตัวที่กำลังดำเนินการใน SNK ครับ'];
  }
  if (query.kind === 'notes') lines = data.notes?.length ? ['บันทึกส่วนตัวล่าสุดครับ', ...data.notes.slice(0, 5).map((row: Row) => `• ${row.title}`)] : ['ยังไม่มีบันทึกส่วนตัวใน SNK ครับ'];
  if (query.kind === 'summary') {
    const urgent = [...overdue, ...needsOwner.filter(task => !overdue.some(over => over.id === task.id))];
    const active = tasks.filter(task => !urgent.includes(task) && !waiting.includes(task));
    lines = ['สรุปตอนนี้จาก SNK ครับ'];
    if (urgent.length) lines.push('🔴 ต้องจัดการ', ...urgent.slice(0, 3).map(taskLine));
    if (active.length) lines.push('🟡 งานที่ยังต้องทำ', ...active.slice(0, 2).map(taskLine));
    const otherWaiting = waiting.filter(task => !urgent.includes(task));
    if (otherWaiting.length) lines.push('⏳ รอติดตาม', ...otherWaiting.slice(0, 2).map(taskLine));
    if (eventLines.length) lines.push('📅 ใกล้ถึง', ...eventLines.slice(0, 2));
    if (data.decisions?.length) lines.push('รอตัดสินใจ', ...data.decisions.slice(0, 2).map((row: Row) => `• ${row.title}`));
    if (data.projects?.length) lines.push('โปรเจคส่วนตัว', ...data.projects.slice(0, 2).map((row: Row) => `• ${row.name}${row.next_action ? `; ต่อไป: ${row.next_action}` : ''}`));
    if (data.money?.latest) lines.push('💰 เงิน', ...moneyLines(data.money, 'recent'));
    const next = urgent[0] ?? active[0];
    if (next) lines.push(`ทำต่อ: ${next.next_action || next.title}`);
    if (lines.length === 1) lines.push('ยังไม่มีงาน นัด หรือรายการเงินที่ต้องตามในข้อมูลส่วนตัวครับ');
  }
  return finalizeReply(lines.join('\n'));
}
