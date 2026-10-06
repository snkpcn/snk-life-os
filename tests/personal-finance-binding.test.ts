// Secure group binding (join -> PENDING -> owner verification -> ACTIVE), channel isolation and
// reminder delivery safety.  No bot is invited anywhere: LINE events are mocked fixtures.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { A, ids } from './helpers/pf-pglite';
import { GROUP, MEMBER, NOW, OTHER_GROUP, OWNER, STRANGER, assertPersona, harness } from './helpers/pf-harness';
import { routePersonalFinanceEvent } from '../lib/snk-money/_personal-finance';
import { PfBindingClient, PfLedgerError } from '../lib/snk-money/_personal-finance-ledger';
import { composeReminder, runPersonalFinanceReminders } from '../lib/snk-money/_personal-finance-reminders';

const lookup = (h: Awaited<ReturnType<typeof harness>>, group: string) => new PfBindingClient(h.deps.rpc).lookup(h.deps.hash(group)!);

test('mocked join captures PENDING silently and grants nothing', async () => {
  const h = await harness();
  const joined = await h.raw({ type: 'join', user: null });
  assert.equal(joined.handled, false, 'a pending group still belongs to the normal chain');
  assert.equal(joined.reply, null, 'an unrelated new group must receive no finance disclosure');
  assert.equal((await lookup(h, GROUP)).status, 'PENDING');
  const row = (await h.db.query<any>('select * from finance_channel_bindings')).rows[0];
  assert.notEqual(row.group_id_enc, GROUP, 'group id is stored encrypted, not in clear');
  assert.equal(row.group_id_hash, h.deps.hash(GROUP));

  // pending = no finance permission, even for the owner's finance sentences
  const out = await h.say('ปรับ SCB เหลือ 70000');
  assert.equal(out.handled, true);
  assert.equal(await h.count('financial_accounts'), 0);
});

test('only the owner can activate: stranger and member are rejected, owner succeeds', async () => {
  const h = await harness();
  await h.raw({ type: 'join', user: null });
  const stranger = await h.say('ยืนยันกลุ่มการเงิน', { user: STRANGER });
  assert.equal(stranger.handled, false);
  assert.equal((await lookup(h, GROUP)).status, 'PENDING');
  const member = await h.say('ยืนยันกลุ่มการเงิน', { user: MEMBER });
  assert.equal(member.handled, false, 'authorized members cannot bind channels either');
  assert.equal((await lookup(h, GROUP)).status, 'PENDING');

  const owner = await h.say('ยืนยันกลุ่มการเงิน', { user: OWNER });
  assertPersona(owner.reply);
  assert.equal(owner.handled, true);
  assert.equal((await lookup(h, GROUP)).status, 'ACTIVE');
  assert.equal(await h.count('activity_log', "action='GROUP_BOUND'"), 1);
});

test('the group NAME is never an identity: the binding is keyed by the hashed group id only', async () => {
  const h = await harness();
  const evt: any = { type: 'join', source: { type: 'group', groupId: OTHER_GROUP }, groupName: 'SNK MONEY', timestamp: NOW.getTime() };
  await (await import('../lib/snk-money/_personal-finance')).handlePersonalFinanceEvent(evt, h.deps);
  assert.equal((await lookup(h, OTHER_GROUP)).status, 'PENDING');
  assert.equal((await lookup(h, GROUP)).status, 'NONE');
  const out = await h.say('ปรับ SCB เหลือ 70000', { group: OTHER_GROUP });
  assert.equal(out.handled, true, 'an unconfigured group is consumed without granting access; a group called "SNK MONEY" is not trusted by name');
  const src = readFileSync('lib/snk-money/_personal-finance.ts', 'utf8');
  // the name is only an informational label stored with the binding; it is never compared or used in a decision
  assert.doesNotMatch(src, /groupName\s*(?:===?|!==?)\s*['"`](?!string)|groupName\.(?:includes|toLowerCase|startsWith)|\.name\s*===?\s*['"]SNK|SNK MONEY['"]\s*===?/i);
});

test('only one finance group can be ACTIVE; a second is refused', async () => {
  const h = await harness();
  await h.activate(GROUP);
  await h.raw({ type: 'join', group: OTHER_GROUP, user: null });
  const second = await h.say('ยืนยันกลุ่มการเงิน', { group: OTHER_GROUP });
  assert.match(second.reply!, /มีกลุ่มการเงินที่ยืนยันไว้แล้ว/);
  assert.equal((await lookup(h, OTHER_GROUP)).status, 'PENDING');
  assert.equal(await h.count('finance_channel_bindings', "status='ACTIVE'"), 1);
  await assert.rejects(() => h.db.query("insert into finance_channel_bindings(owner_id,group_id_hash,status) values($1,'x','ACTIVE')", ['11111111-1111-4111-8111-111111111111']), /finance_bindings_single_active_uq/);
});

test('wrong group: finance sentences in any other group never reach the ledger', async () => {
  const h = await harness();
  await h.activate(GROUP);
  for (const text of ['ปรับ SCB เหลือ 70000', 'จ่ายประกัน 18500', 'ยอดเหลือเท่าไหร่']) {
    const out = await h.say(text, { group: OTHER_GROUP });
    assert.equal(out.handled, true);
    assert.equal(out.reply, null);
  }
  assert.equal(await h.count('financial_accounts'), 0);
  assert.equal(await h.count('transactions'), 0);
});

test('a business-bound group can never become the finance group', async () => {
  const h = await harness({ businessBound: [GROUP] });
  await h.raw({ type: 'join', user: null });
  assert.equal((await lookup(h, GROUP)).status, 'NONE', 'join in a business-bound group is not even captured');
  const out = await h.say('ยืนยันกลุ่มการเงิน', { user: OWNER });
  assert.match(out.reply!, /ผูกกับทีมธุรกิจ/);
  assert.equal(await h.count('finance_channel_bindings'), 0);
  const stranger = await h.say('ยืนยันกลุ่มการเงิน', { user: STRANGER });
  assert.equal(stranger.reply, null);
});

test('owner phrase recovers a missed join event; strangers cannot do that', async () => {
  const h = await harness();
  assert.equal((await h.say('ยืนยันกลุ่มการเงิน', { user: STRANGER })).handled, false);
  assert.equal(await h.count('finance_channel_bindings'), 0);
  assert.equal((await h.say('ยืนยันกลุ่มการเงิน', { user: OWNER })).handled, true);
  assert.equal((await lookup(h, GROUP)).status, 'ACTIVE');
});

test('one-time code activation: wrong code fails and locks, right code works once and expires', async () => {
  const h = await harness();
  await h.raw({ type: 'join', user: null });
  const hash = h.deps.hash(GROUP)!;
  const issued = (await h.ledger['rpc']('finance_binding_issue_code', { p_owner: h.ledger['ownerId'], p_group_hash: hash, p_ttl_minutes: 30 })) as { code: string };
  assert.match(issued.code, /^SNK-\d{6}$/);
  const stored = (await h.db.query<any>('select code_hash from finance_channel_bindings')).rows[0].code_hash;
  assert.notEqual(stored, issued.code, 'only a hash of the code is stored');

  const wrong = await h.say('ยืนยันกลุ่มการเงิน SNK-000000', { user: STRANGER });
  assert.match(wrong.reply!, /ยืนยันกลุ่มนี้ยังไม่ได้/);
  assert.equal((await lookup(h, GROUP)).status, 'PENDING');
  const right = await h.say(issued.code, { user: STRANGER });
  assert.match(right.reply!, /ยืนยันกลุ่ม SNK MONEY เรียบร้อย/);
  assert.equal((await lookup(h, GROUP)).status, 'ACTIVE');
  assert.equal((await h.db.query<any>('select code_hash from finance_channel_bindings')).rows[0].code_hash, null, 'code is burned');
});

test('repeated wrong codes lock the pending binding', async () => {
  const h = await harness();
  await h.raw({ type: 'join', user: null });
  const hash = h.deps.hash(GROUP)!;
  const { code } = (await h.ledger['rpc']('finance_binding_issue_code', { p_owner: h.ledger['ownerId'], p_group_hash: hash, p_ttl_minutes: 30 })) as { code: string };
  for (let i = 0; i < 5; i++) await h.say('ยืนยันกลุ่มการเงิน SNK-111111', { user: STRANGER });
  const locked = await h.say(code, { user: STRANGER });
  assert.match(locked.reply!, /ยืนยันกลุ่มนี้ยังไม่ได้/);
  assert.equal((await lookup(h, GROUP)).status, 'PENDING');
});

test('an ACTIVE finance group is routed exclusively: business commands inside it are swallowed, not executed', async () => {
  const h = await harness();
  await h.activate();
  for (const text of ['ผูกทีม restaurant', 'เบิกเงินเดือน 5000', 'สวัสดีครับ']) {
    const out = await h.say(text);
    assert.equal(out.handled, true, `${text} must not fall through to business handlers`);
  }
  const image = await h.image('img-1', { user: STRANGER });
  assert.equal(image.handled, true);
  assert.equal(image.reply, null);
});

test('bot removed from the group revokes the binding', async () => {
  const h = await harness();
  await h.activate();
  await h.raw({ type: 'leave', user: null });
  assert.equal((await lookup(h, GROUP)).status, 'NONE');
  assert.equal(await h.count('finance_channel_bindings', "status='REVOKED'"), 1);
  assert.equal((await h.say('ปรับ SCB เหลือ 1')).handled, true);
});

test('failure modes: lookup error fails closed, missing migration does not block business groups', async () => {
  const h = await harness();
  const real = h.deps.rpc;
  h.deps.rpc = async (fn, args) => { if (fn === 'finance_binding_lookup_any') throw new Error('db timeout'); return real(fn, args); };
  const closed = await h.say('จ่ายประกัน 100');
  assert.equal(closed.handled, true);
  assert.equal(closed.reply, null);
  h.deps.rpc = async (fn, args) => { if (fn === 'finance_binding_lookup_any') throw new PfLedgerError('pf_rpc_missing'); return real(fn, args); };
  assert.equal((await h.say('จ่ายประกัน 100')).handled, false);
  assert.ok(h.log.some(l => l.event === 'PF_BINDING_LOOKUP_FAILED'));
});

test('feature flag off (default): nothing is routed and nothing is touched', async () => {
  const saved = process.env.SNK_MONEY_ENABLED;
  delete process.env.SNK_MONEY_ENABLED;
  try {
    let sent = 0;
    const handled = await routePersonalFinanceEvent(
      { type: 'message', replyToken: 'x', source: { type: 'group', groupId: GROUP, userId: OWNER }, message: { id: '1', type: 'text', text: 'ปรับ SCB เหลือ 1' } },
      async () => { sent++; },
    );
    assert.equal(handled, false);
    assert.equal(sent, 0);
  } finally {
    if (saved !== undefined) process.env.SNK_MONEY_ENABLED = saved;
  }
});

test('private webhook is signature-gated and only wired to SNK runtime modules', () => {
  const src = readFileSync('app/api/line/snk-money/route.ts', 'utf8');
  assert.ok(src.indexOf('verifyLineSignature') < src.indexOf('JSON.parse(rawBody)'), 'signature is verified before the body is parsed');
  assert.match(src, /routePrivatePersonalEvent/);
  assert.doesNotMatch(src, /_operations-db|_ops-notifications|thongthai/i);
  assert.match(readFileSync('.env.example', 'utf8'), /^SNK_MONEY_ENABLED=0$/m);
});

// ---------------------------------------------------------------- reminders

async function reminderRig() {
  const h = await harness();
  await h.activate();
  await h.say('SCB ตอนนี้ 10000');
  await h.ledger.createRecurring({ title: 'ค่าไฟ', kind: 'EXPENSE', amount: 3000, frequency: 'MONTHLY', firstDue: '2026-10-06', actor: A, ...ids('o') });
  const pushed: Array<{ to: string; text: string }> = [];
  const deps = {
    rpc: h.deps.rpc, now: () => NOW, enabled: true,
    hash: h.deps.hash, decrypt: (v: string) => (v.startsWith('enc:') ? v.slice(4) : null),
    push: async (to: string, text: string) => { pushed.push({ to, text }); },
  };
  return { h, deps, pushed };
}

test('routine personal reminders remain disabled, without claims, retries or LINE delivery', async () => {
  const { h, deps, pushed }=await reminderRig();
  for (const configured of [deps,{...deps,enabled:false},{...deps,decrypt:()=>null}]) {
    const result=await runPersonalFinanceReminders(configured);
    assert.deepEqual([result.claimed,result.sent,result.failed],[0,0,0]);
    assert.equal(result.skipped,'pull_only_disabled');
  }
  assert.equal(pushed.length,0);
  assert.equal(await h.count('finance_reminder_deliveries'),0);
});

test('reminder text covers overdue, today and amounts without a number', () => {
  const [text] = composeReminder([
    { delivery_id: '1', obligation_id: 'a', title: 'ค่าไฟ', kind: 'EXPENSE', amount: 3000, due_date: '2026-10-03', days_until: -2, threshold: -2, overdue: true, default_account: 'SCB' },
    { delivery_id: '2', obligation_id: 'b', title: 'ค่าน้ำ', kind: 'EXPENSE', amount: null, due_date: '2026-10-05', days_until: 0, threshold: 0, overdue: false, default_account: null },
  ]);
  assert.match(text, /เลยกำหนด 2 วัน/);
  assert.match(text, /ครบกำหนดวันนี้/);
  assert.match(text, /ยังไม่ระบุจำนวน/);
  assertPersona(text);
});
