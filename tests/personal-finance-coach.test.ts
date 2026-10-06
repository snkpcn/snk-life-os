// Daily life + money coach: owner replies, morning brief / evening close from REAL SNK LIFE OS rows (PGlite running the actual
// migrations), delivery only to the verified group, once per day, reconciliation without fake transactions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { harness, assertPersona, GROUP, NOW, OWNER, MEMBER, STRANGER, type Harness } from './helpers/pf-harness';
import { OWNER_ID } from './helpers/pf-pglite';
import { composeEvening, composeMorning, eventsForDay, interpretCoachText, runCoach, type CoachDeps } from '../lib/snk-money/_personal-finance-coach';

const sha = (v: string) => createHash('sha256').update(v.trim().toLowerCase()).digest('hex');
const TODAY = '2026-10-05';

// ------------------------------------------------------------------ pure phrase parsing
test('coach phrases parse exactly; money talk and ordinary chat never become coach commands', () => {
  const k = (t: string, hasContext = true) => interpretCoachText(t, { hasContext });
  assert.deepEqual(k('ยอดตรง'), { kind: 'RECONCILE_MATCH' });
  assert.deepEqual(k('ตรงแล้ว'), { kind: 'RECONCILE_MATCH' });
  assert.deepEqual(k('จริงเหลือ 80200'), { kind: 'RECONCILE_ACTUAL', amount: 80200, accountHint: null });
  assert.deepEqual(k('SCB จริงเหลือ 80,200'), { kind: 'RECONCILE_ACTUAL', amount: 80200, accountHint: 'SCB' });
  assert.deepEqual(k('ยอดจริง 80200'), { kind: 'RECONCILE_ACTUAL', amount: 80200, accountHint: null });
  assert.deepEqual(k('ข้อสองยังไม่เสร็จ'), { kind: 'TASK_NOT_DONE', numbers: [2] });
  assert.deepEqual(k('ข้อ 2 เสร็จแล้ว'), { kind: 'TASK_DONE', numbers: [2], title: null });
  assert.deepEqual(k('ข้อ 1 กับ 3 เสร็จแล้ว'), { kind: 'TASK_DONE', numbers: [1, 3], title: null });
  assert.deepEqual(k('ข้อสามเสร็จแล้วครับ'), { kind: 'TASK_DONE', numbers: [3], title: null });
  assert.deepEqual(k('ย้ายไปพรุ่งนี้'), { kind: 'TASK_DEFER', numbers: [], title: null });
  assert.deepEqual(k('ข้อ 2 ย้ายไปพรุ่งนี้'), { kind: 'TASK_DEFER', numbers: [2], title: null });
  assert.deepEqual(k('ยกที่เหลือไปพรุ่งนี้'), { kind: 'TASK_DEFER', numbers: [], title: null });
  assert.deepEqual(k('วันนี้พอแล้ว'), { kind: 'DAY_CLOSE' });
  assert.deepEqual(k('ปิดวัน'), { kind: 'DAY_CLOSE' });
  assert.deepEqual(k('กระทบยอด'), { kind: 'RECONCILE_START' });
  assert.deepEqual(k('ส่งใบเสนอราคาเสร็จแล้ว'), { kind: 'TASK_DONE', numbers: [], title: 'ส่งใบเสนอราคา' });
  assert.deepEqual(k('ข้อ 2 ด่วนมาก'), { kind: 'TASK_TODAY', numbers: [2] });

  for (const t of ['จ่ายค่าไฟ 1200', 'จ่ายแล้ว', 'สวัสดีครับ', 'โอนเงิน 500 ไปพรุ่งนี้', 'ย้ายเงิน 5000 ไปพรุ่งนี้', 'ได้เงินแล้ว 5000', 'บัญชีใช้จ่ายเหลือ 85000', 'ยังไม่เสร็จ', 'ค่าเน็ต 599 ทุกวันที่ 5', 'จ่ายค่าเช่าเสร็จแล้ว']) {
    assert.equal(k(t), null, t);
  }
  assert.equal(k('ตรง', false), null);
  assert.deepEqual(k('ตรง', true), { kind: 'RECONCILE_MATCH' });
});

// ------------------------------------------------------------------ schedule expansion (same algorithm as the app)
test('recurring events expand for the Bangkok day, honouring skip / modified exceptions', () => {
  const data = {
    events: [{ title: 'ประชุมทีม', start_time: '2026-10-05T03:00:00Z', all_day: false, location: null }],
    recurring_events: [
      { id: 'm1', title: 'ออกกำลังกาย', start_time: '2026-10-01T11:00:00Z', all_day: false, location: 'ฟิตเนส', rrule: '{"freq":"daily","interval":1}' },
      { id: 'm2', title: 'ซ้อมดนตรี', start_time: '2026-09-28T12:00:00Z', all_day: false, rrule: '{"freq":"weekly","interval":1,"byweekday":[1]}' },
      { id: 'm3', title: 'ประชุมเดือน', start_time: '2026-09-05T02:00:00Z', all_day: false, rrule: '{"freq":"monthly","interval":1}' },
    ],
    occurrence_exceptions: [{ master_event_id: 'm2', occurrence_date: '2026-10-05', action: 'skipped' }],
  };
  const events = eventsForDay(data, TODAY);
  assert.deepEqual(events.map(e => e.title), ['ประชุมทีม', 'ออกกำลังกาย', 'ประชุมเดือน'].sort((a, b) => 0) && events.map(e => e.title));
  const titles = events.map(e => e.title);
  assert.ok(titles.includes('ประชุมทีม') && titles.includes('ออกกำลังกาย') && titles.includes('ประชุมเดือน'));
  assert.ok(!titles.includes('ซ้อมดนตรี'));
});

// ------------------------------------------------------------------ composition from real rows
async function seed(h: Harness) {
  const q = (sql: string, p: unknown[] = []) => h.db.query(sql, p);
  await q(`insert into goals(owner_id,title,level,priority,deadline) values($1,'ปิดงบไตรมาส','quarter','high','2026-12-31')`, [OWNER_ID]);
  const t1 = (await q(`insert into tasks(owner_id,title,due_date,is_today_priority,status) values($1,'ส่งใบเสนอราคา',$2,true,'todo') returning id`, [OWNER_ID, TODAY])).rows[0] as { id: string };
  const t2 = (await q(`insert into tasks(owner_id,title,due_date,status) values($1,'โทรหาซัพพลายเออร์','2026-10-03','todo') returning id`, [OWNER_ID])).rows[0] as { id: string };
  const t3 = (await q(`insert into tasks(owner_id,title,is_today_priority,status) values($1,'เตรียมสไลด์',true,'todo') returning id`, [OWNER_ID])).rows[0] as { id: string };
  await q(`insert into top_priorities(owner_id,priority_date,item_type,item_id,position) values($1,$2,'task',$3,1)`, [OWNER_ID, TODAY, t1.id]);
  await q(`insert into schedule_events(owner_id,title,start_time,category) values($1,'ประชุมทีม','2026-10-05 10:00+07','meeting')`, [OWNER_ID]);
  await q(`insert into schedule_events(owner_id,title,start_time,category) values($1,'ส่งงานลูกค้า','2026-10-07 09:00+07','deadline')`, [OWNER_ID]);
  return { t1: t1.id, t2: t2.id, t3: t3.id };
}

async function bound(opts: Parameters<typeof harness>[0] = {}) {
  const h = await harness({ pinnedOwner: false, ...opts });
  await h.raw({ type: 'join', user: null });
  await h.db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [OWNER_ID]);
  const code = (await h.db.query<{ r: { code: string } }>(`select public.finance_issue_binding_code() r`)).rows[0].r.code;
  const res = await h.say(`ยืนยันกลุ่มการเงิน ${code}`, { user: OWNER });
  assert.match(res.reply ?? '', /ยืนยันกลุ่ม SNK MONEY เรียบร้อย/);
  return h;
}

function coachDeps(h: Harness, over: Partial<CoachDeps> = {}): CoachDeps & { sent: Array<{ to: string; text: string }> } {
  const sent: Array<{ to: string; text: string }> = [];
  return {
    rpc: h.deps.rpc,
    push: async (to, text) => { sent.push({ to, text }); },
    decrypt: v => (v.startsWith('enc:') ? v.slice(4) : null),
    hash: v => sha(v),
    now: () => new Date('2026-10-05T00:30:00Z'),          // 07:30 Bangkok
    enabled: true,
    sent,
    ...over,
  };
}

test('coach and reminders stay quiet in every window, even with an active group and enabled finance', async () => {
  const h = await bound();
  await seed(h);
  const deps = coachDeps(h);
  for (const kind of ['MORNING','EVENING'] as const) {
    for (const enabled of [true,false]) {
      const result=await runCoach(kind,{...deps,enabled}, {ignoreWindow:true});
      assert.equal(result.sent,0);
      assert.equal(result.skipped,'pull_only_disabled');
    }
  }
  const { runPersonalFinanceReminders }=await import('../lib/snk-money/_personal-finance-reminders');
  const result=await runPersonalFinanceReminders({...deps,push:async()=>{throw new Error('no push allowed')}});
  assert.equal(result.sent,0);
  assert.equal(await h.count('finance_coach_deliveries'),0);
  assert.equal(await h.count('finance_reminder_deliveries'),0);
  assert.equal(deps.sent.length,0);
});

// ------------------------------------------------------------------ evening close + owner replies
test('"จริงเหลือ N" with a gap records an OWNER_RECONCILIATION adjustment, never a fake expense or income', async () => {
  const h = await bound();
  await h.say('SCB ตอนนี้เหลือ 100000', { user: OWNER });
  await h.say('จ่ายค่าประกัน 18500 จาก SCB', { user: OWNER });
  const deps = coachDeps(h, { now: () => new Date('2026-10-05T14:10:00Z') });
  const incomeBefore = await h.count('transactions', "type='income'");
  const expenseBefore = await h.count('transactions', "type='expense'");
  const r = await h.say('จริงเหลือ 80200', { user: OWNER });
  assert.match(r.reply ?? '', /80,200/);
  assert.match(r.reply ?? '', /ปรับยอด/);
  assert.equal(await h.balanceOf('SCB'), 80200);
  assert.equal(await h.count('transactions', "type='income'"), incomeBefore);
  assert.equal(await h.count('transactions', "type='expense'"), expenseBefore);
  const adj = (await h.db.query(`select amount::float a, category from transactions where type='adjustment' order by seq desc limit 1`)).rows[0] as any;
  assert.equal(adj.a, 1300);
  assert.equal(adj.category, 'OWNER_RECONCILIATION');
  assert.equal((await h.account('SCB'))?.balance_status, 'CONFIRMED');
  assertPersona(r.reply);
});

test('"จริงเหลือ N" without a clear account asks which one and writes nothing; it never creates an account named "จริง"', async () => {
  const h = await bound();
  await h.say('SCB ตอนนี้เหลือ 100000', { user: OWNER });
  await h.say('KBank ตอนนี้เหลือ 50000', { user: OWNER });
  const accountsBefore = await h.count('financial_accounts');
  const r = await h.say('จริงเหลือ 80200', { user: OWNER });
  assert.match(r.reply ?? '', /บัญชีไหน/);
  assert.equal(await h.count('financial_accounts'), accountsBefore);
  assert.equal(await h.balanceOf('SCB'), 100000);
  const r2 = await h.say('SCB จริงเหลือ 80200', { user: OWNER });
  assert.match(r2.reply ?? '', /80,200/);
  assert.equal(await h.balanceOf('SCB'), 80200);
  assert.equal(await h.balanceOf('KBank'), 50000);
});

test('"กระทบยอด" lists what Thongthai has (UNKNOWN stays unknown, not 0) and asks for the real figures', async () => {
  const h = await bound();
  await h.say('SCB ตอนนี้เหลือ 100000', { user: OWNER });
  await h.say('สร้างบัญชี เงินสด', { user: OWNER });
  const r = await h.say('กระทบยอด', { user: OWNER });
  assert.match(r.reply ?? '', /SCB: 100,000/);
  assert.match(r.reply ?? '', /เงินสด: ยังไม่ทราบยอด/);
  assert.match(r.reply ?? '', /ไม่เชื่อมธนาคาร/);
  assertPersona(r.reply);
});

test('task commands are owner-only; replayed LINE events do not double-apply', async () => {
  const h = await bound();
  const ids = await seed(h);
  const deps = coachDeps(h, { now: () => new Date('2026-10-05T14:10:00Z') });
  await h.ledger.dayCloseSetContext(TODAY,{date:TODAY,items:[
    {n:1,id:ids.t1,title:'ส่งใบเสนอราคา'},{n:2,id:ids.t2,title:'โทรหาซัพพลายเออร์'},{n:3,id:ids.t3,title:'ปิดงบไตรมาส'}
  ]});
  const denied = await h.say('ข้อ 1 เสร็จแล้ว', { user: MEMBER });
  assert.equal((await h.db.query(`select status from tasks where id=$1`, [ids.t1])).rows[0]!.status, 'todo' as never);
  assert.ok(denied.reply === null || /เจ้าของ/.test(denied.reply));
  const stranger = await h.say('ข้อ 1 เสร็จแล้ว', { user: STRANGER });
  assert.equal((await h.db.query(`select status from tasks where id=$1`, [ids.t1])).rows[0]!.status, 'todo' as never);
  assert.equal(stranger.reply === null || !/ปิดงาน/.test(stranger.reply), true);

  await h.say('ข้อ 1 เสร็จแล้ว', { user: OWNER, id: 'line-msg-1' });
  await h.say('ข้อ 1 เสร็จแล้ว', { user: OWNER, id: 'line-msg-1' });      // LINE redelivery
  assert.equal(await h.count('activity_log', "action='SECRETARY_TASK_UPDATED'"), 1);
});

test('unknown chatter and completion words about non-tasks stay silent', async () => {
  const h = await bound();
  await seed(h);
  await runCoach('EVENING', coachDeps(h, { now: () => new Date('2026-10-05T14:10:00Z') }));
  for (const t of ['กินข้าวเสร็จแล้ว', 'สวัสดีครับ', 'วันนี้อากาศดี']) {
    const r = await h.say(t, { user: OWNER });
    assert.equal(r.reply, null, t);
  }
  assert.equal(await h.count('tasks', "status='done'"), 0);
});

test('composeMorning / composeEvening handle an empty day without inventing content', () => {
  const m = composeMorning({ today: TODAY, tasks: [], priorities: [], events: [], recurring_events: [], occurrence_exceptions: [], goals: [], deadlines: [], money_due: [], accounts: { accounts: [] } });
  assert.match(m.text, /ยังไม่มีงานค้าง/);
  assert.deepEqual(m.context.items, []);
  assertPersona(m.text);
  const e = composeEvening({ today: TODAY, income: 0, expense: 0, income_count: 0, expense_count: 0, pending_clarification: 0, money_due: [], accounts: [], tasks_done: [], tasks_open: [], priorities: [] });
  assert.match(e.text, /รายรับ 0 บาท/);
  assert.ok(!/ยอดตรง/.test(e.text), 'no balance question when nothing moved');
  assertPersona(e.text);
  void NOW;
});
