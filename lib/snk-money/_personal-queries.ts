import { buildOccurrenceList, type ScheduleMaster, type ScheduleOccurrenceException } from '../schedule-occurrences';
import { addDays, finalizeReply, money, normalizeText, thaiDate } from './_personal-finance-core';
import type { PfLedger } from './_personal-finance-ledger';

export const PERSONAL_MODULES = ['money', 'tasks', 'schedule', 'projects', 'notes', 'coach', 'personal_summary'] as const;
export type PersonalModule = typeof PERSONAL_MODULES[number];
type Row = Record<string, any>;
type Query = { kind: 'summary' | 'tasks' | 'schedule' | 'projects' | 'money' | 'notes'; modules: PersonalModule[]; filter?: string; period?: string };

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
export async function answerPersonalQuery(ledger: PfLedger, raw: string, today: string, allowed: readonly string[], isOwner: boolean): Promise<string | null> {
  const query = personalQuery(raw);
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
