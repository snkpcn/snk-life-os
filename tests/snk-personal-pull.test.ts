import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac, randomBytes } from 'node:crypto';
import { harness, GROUP, OWNER, OTHER_GROUP } from './helpers/pf-harness';
import { OWNER_ID, ids, A } from './helpers/pf-pglite';
import { geminiPersonalQueryInterpreter, personalQuery } from '../lib/snk-money/_personal-queries';
import { personalReadiness } from '../lib/snk-money/readiness';
import { SNK_OS_DEFAULT_URL, supabaseRpc } from '../lib/snk-money/_personal-finance-ledger';
import { replyToLine } from '../lib/snk-money/line-reply';
import { handlePersonalFinanceEvent } from '../lib/snk-money/_personal-finance';

test('natural personal commands resolve the requested modules without requiring slash commands', () => {
  const cases: Record<string,string> = {
    'สรุปมา':'summary','มีอะไรค้าง':'tasks','ตอนนี้มีอะไรต้องทำ':'summary','มีอะไรต้องตาม':'summary',
    'งานไหนรอกู':'tasks','งานไหนเลยกำหนด':'tasks','เหลืออะไร':'tasks',
    'เงินเดือนนี้เป็นไง':'money','ล่าสุดจ่ายอะไรไป':'money','เดือนนี้ใช้เงินไปเท่าไหร่':'money',
    'เดือนนี้กูจ่ายอะไรไปบ้าง':'money','เมื่อวานจ่ายอะไร':'money','ค่าอาหารเดือนนี้เท่าไหร่':'money','เงินออกเยอะสุดตรงไหน':'money',
    'วันนี้มีอะไร':'schedule','พรุ่งนี้มีอะไร':'schedule','มีนัดอะไร':'schedule','สัปดาห์นี้มีนัดอะไร':'schedule',
    'โปรเจคส่วนตัวถึงไหนแล้ว':'projects',
  };
  for (const [phrase,kind] of Object.entries(cases)) assert.equal(personalQuery(phrase)?.kind,kind,phrase);
  for (const phrase of ['เมื่อกี้จ่ายค่าน้ำมัน 1800','พรุ่งนี้เตือนให้โทรหาช่างตอนบ่าย','มีงานใหม่ต้องทำ ต้องอ่านสรุปงาน thesis ภายในพรุ่งนี้','คุยกับแม่อยู่']) assert.equal(personalQuery(phrase),null,phrase);
  assert.equal(personalQuery('มีงานใหม่ไหม')?.kind,'tasks');
});

test('an AI-understood Thai paraphrase reads the requested facts from owner-scoped SNK RPC data', async()=>{
  const h=await harness({personalQueryInterpreter:async(message,today,allowed)=>{
    assert.equal(message,'คืนนี้มีเรื่องไหนที่ยังค้างให้กูจัดการบ้าง');
    assert.equal(today,'2026-10-05');
    assert.ok(allowed.includes('tasks'));
    return {kind:'tasks',modules:['tasks'],filter:'open'};
  }});
  try{
    await h.activate();
    await h.db.query("insert into tasks(owner_id,title,status,secretary_state) values($1,'โทรหาช่างเรื่องหลังคา','todo','OPEN')",[OWNER_ID]);
    const calls:string[]=[];const original=h.deps.rpc;
    h.deps.rpc=async(fn,args)=>{calls.push(fn);return original(fn,args)};
    const answer=await h.say('คืนนี้มีเรื่องไหนที่ยังค้างให้กูจัดการบ้าง');
    assert.match(answer.reply??'',/โทรหาช่างเรื่องหลังคา/);
    assert.ok(calls.includes('snk_personal_snapshot'));
    assert.doesNotMatch(answer.reply??'',/TAMMA|ไม่มีข้อมูล/);
  }finally{await h.db.close()}
});

test('Gemini query adapter uses the selected model and receives no backend rows',async()=>{
  const oldKey=process.env.GEMINI_API_KEY;const oldFetch=globalThis.fetch;
  process.env.GEMINI_API_KEY='test-key';
  try{
    globalThis.fetch=(async(input:any,init:any)=>{
      assert.match(String(input),/models\/gemini-3\.1-flash-lite:generateContent/);
      const body=JSON.parse(init.body);
      assert.equal(body.generationConfig.responseMimeType,'application/json');
      assert.equal(body.contents[0].parts[0].text,JSON.stringify({message:'คืนนี้มีเรื่องไหนที่ยังค้างให้กูจัดการบ้าง',today:'2026-10-05',allowed_modules:['tasks']}));
      assert.doesNotMatch(init.body,/TAMMA_SECRET|OWNER_ID|transaction_rows/);
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({kind:'tasks',filter:'open',period:'none'})}]}}]}),{status:200});
    }) as typeof fetch;
    const query=await geminiPersonalQueryInterpreter('คืนนี้มีเรื่องไหนที่ยังค้างให้กูจัดการบ้าง','2026-10-05',['tasks']);
    assert.deepEqual(query,{kind:'tasks',modules:['tasks'],filter:'open'});
  }finally{
    globalThis.fetch=oldFetch;
    if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;
  }
});

test('AI-selected modules still pass the group allowlist before any SNK data query',async()=>{
  const h=await harness({personalQueryInterpreter:async()=>({kind:'tasks',modules:['tasks'],filter:'open'})});
  try{
    await h.activate();
    await h.db.query("update finance_channel_bindings set allowed_modules=array['money'] where status='ACTIVE'");
    const calls:string[]=[];const original=h.deps.rpc;
    h.deps.rpc=async(fn,args)=>{calls.push(fn);return original(fn,args)};
    const answer=await h.say('คืนนี้มีเรื่องไหนที่ยังค้างให้กูจัดการบ้าง');
    assert.match(answer.reply??'',/ยังไม่ได้เปิดสิทธิ์/);
    assert.ok(!calls.includes('snk_personal_snapshot'));
  }finally{await h.db.close()}
});

test('owner statement creates the thesis task in canonical SNK data, and the next question reads it', async()=>{
  const h=await harness();
  try {
    await h.activate();
    const saved=await h.say('มีงานใหม่ต้องทำ ต้องอ่านสรุปงาน thesis ภายในพรุ่งนี้');
    assert.match(saved.reply??'',/จัดเข้าระบบแล้ว 1 รายการ/);
    const rows=await h.db.query<{title:string;due_date:string}>("select title,due_date::text due_date from tasks where title ilike '%thesis%'");
    assert.deepEqual(rows.rows,[{title:'อ่านสรุปงาน thesis',due_date:'2026-10-06'}]);
    const listed=await h.say('มีอะไรค้าง');
    assert.match(listed.reply??'',/อ่านสรุปงาน thesis/);
    assert.doesNotMatch(listed.reply??'',/TAMMA/);
  }finally{await h.db.close()}
});

test('acceptance: fresh real SQL backs summaries/tasks/money/schedule; business rows and other owners stay isolated', async t => {
  const h=await harness();
  try {
    await h.activate();
    await h.say('SCB ตอนนี้เหลือ 10000');
    await h.say('จ่ายค่าอาหาร 250 จาก SCB');
    await h.say('เมื่อกี้จ่ายค่าน้ำมัน 1800 จาก SCB');
    await h.db.query("insert into tasks(owner_id,title,status,due_date,next_action) values($1,'โทรหาช่าง','todo','2026-10-04','โทรแจ้งเวลา')",[OWNER_ID]);
    await h.db.query("insert into tasks(owner_id,title,status,secretary_state,waiting_for) values($1,'เลือกสีสูท','todo','WAITING','เจ้าของยืนยัน')",[OWNER_ID]);
    await h.db.query("insert into tasks(owner_id,title,status,secretary_state) values($1,'อ่านหนังสือ','doing','IN_PROGRESS')",[OWNER_ID]);
    await h.db.query("insert into tasks(owner_id,title,status,completed_at) values($1,'งานเสร็จแล้ว','done',now())",[OWNER_ID]);
    const business='22222222-2222-4222-8222-222222222222';
    await h.db.query("insert into businesses(id,name,status) values($1,'ธุรกิจทดสอบ','active')",[business]);
    await h.db.query("insert into tasks(owner_id,title,status,business_id) values($1,'TAMMA_SECRET_TASK','todo',$2)",[OWNER_ID,business]);
    const businessTx=await h.ledger.createTransaction({kind:'EXPENSE',amount:999999,accountId:(await h.account('SCB'))!.id,payee:'TAMMA_SECRET_PAYMENT',occurredOn:'2026-10-05',actor:A,...ids('business')});
    await h.db.query("update transactions set business_id=$1 where id=$2",[business,businessTx.transaction.id]);
    await h.db.query("insert into schedule_events(owner_id,title,start_time) values($1,'เรียน MBA','2026-10-05 14:00+07'),($1,'นัดตัดสูท','2026-10-06 14:00+07')",[OWNER_ID]);
    await h.db.query("insert into schedule_events(owner_id,title,start_time,business_id) values($1,'TAMMA_SECRET_APPOINTMENT','2026-10-05 15:00+07',$2)",[OWNER_ID,business]);
    await h.db.query("insert into auth.users(id) values('33333333-3333-4333-8333-333333333333')");
    await h.db.query("insert into tasks(owner_id,title,status) values('33333333-3333-4333-8333-333333333333','OTHER_OWNER_SECRET','todo')");
    await h.db.query("insert into projects(owner_id,name,status,next_action) values($1,'เที่ยวสวีเดน','active','จองที่พัก')",[OWNER_ID]);
    await h.db.query("insert into decisions(owner_id,title) values($1,'เลือกวันเดินทาง')",[OWNER_ID]);
    await t.test('1: summary reads real tasks, decisions, projects, schedule and money',async()=>{
      const r=await h.say('สรุปมา');
      for(const item of ['โทรหาช่าง','เลือกสีสูท','เรียน MBA','เที่ยวสวีเดน','เลือกวันเดินทาง','1,800']) assert.ok(r.reply?.includes(item),item+'\n'+r.reply);
      assert.doesNotMatch(r.reply??'',/TAMMA_SECRET|OTHER_OWNER_SECRET|งานเสร็จแล้ว/);
      assert.ok((r.reply??'').length<1600);
    });
    await t.test('2: pending/overdue/owner actions come from current personal task rows',async()=>{
      assert.match((await h.say('มีอะไรค้าง')).reply??'',/โทรหาช่าง/);
      assert.match((await h.say('งานไหนรอกู')).reply??'',/เลือกสีสูท/);
      assert.doesNotMatch((await h.say('งานไหนเลยกำหนด')).reply??'',/อ่านหนังสือ|TAMMA_SECRET/);
      await h.db.query("update tasks set status='done',completed_at=now() where title='โทรหาช่าง'");
      assert.doesNotMatch((await h.say('มีอะไรค้าง')).reply??'',/โทรหาช่าง/,'query must reflect new backend state, not memory');
    });
    await t.test('3 and 7: money query touches only owner-scoped SNK and excludes business rows',async()=>{
      const calls:string[]=[];const original=h.deps.rpc;
      h.deps.rpc=async(fn,args)=>{calls.push(fn);return original(fn,args)};
      const r=await h.say('เดือนนี้ใช้เงินไปเท่าไหร่');
      assert.match(r.reply??'',/2,050/);
      assert.doesNotMatch(r.reply??'',/999,999|TAMMA_SECRET/);
      assert.ok(calls.includes('snk_personal_snapshot'));
      assert.ok(calls.every(fn=>/^(finance_|snk_)/.test(fn)));
      h.deps.rpc=original;
      const rows=await h.say('เดือนนี้กูจ่ายอะไรไปบ้าง');
      assert.match(rows.reply??'',/1,800/);
      assert.match(rows.reply??'',/250/);
      assert.doesNotMatch(rows.reply??'',/TAMMA_SECRET/);
    });
    await t.test('4: today/tomorrow use the canonical personal calendar',async()=>{
      const today=await h.say('วันนี้มีอะไร');assert.match(today.reply??'',/เรียน MBA/);assert.doesNotMatch(today.reply??'',/นัดตัดสูท|TAMMA_SECRET/);
      const tomorrow=await h.say('พรุ่งนี้มีอะไร');assert.match(tomorrow.reply??'',/นัดตัดสูท/);assert.doesNotMatch(tomorrow.reply??'',/เรียน MBA/);
    });
    await t.test('unknown group is logged as unconfigured and never guessed',async()=>{
      const r=await h.say('สรุปมา',{group:OTHER_GROUP});
      assert.equal(r.handled,true);assert.equal(r.reply,null);
      assert.ok(h.log.some(entry=>entry.event==='SNK_GROUP_UNCONFIGURED'));
    });
    await t.test('binding allowed_modules are enforced before personal queries',async()=>{
      await h.db.query("update finance_channel_bindings set allowed_modules=array['money'] where status='ACTIVE'");
      assert.match((await h.say('มีอะไรค้าง')).reply??'',/ยังไม่ได้เปิดสิทธิ์/);
      assert.match((await h.say('เดือนนี้ใช้เงินไปเท่าไหร่')).reply??'',/2,050/);
      await h.db.query("update finance_channel_bindings set allowed_modules=array['money','tasks','schedule','projects','notes','coach','personal_summary'] where status='ACTIVE'");
    });
    await t.test('explicit business requests in personal context do not query business or write personal money',async()=>{
      const before=await h.count('transactions');
      assert.match((await h.say('จ่ายให้ร้านอาหารตำมา-ชาติ 800')).reply??'',/กลุ่มทำมา-ชาติ/);
      assert.equal(await h.count('transactions'),before);
    });
    await t.test('existing secretary writes stay in the canonical personal task table',async()=>{
      assert.match((await h.say('พรุ่งนี้เตือนให้โทรหาช่างตอนบ่าย')).reply??'',/จัดเข้าระบบ/);
      assert.equal(await h.count('tasks',"title like '%โทรหาช่าง%' and completed_at is null"),1);
    });
    await t.test('read RPC works under the actual service role privileges, not only a migration-owner connection',async()=>{
      await h.db.exec('set role service_role');
      try {
        const result=await h.ledger.personalSnapshot(['money','tasks','schedule','projects','personal_summary'],'2026-10-05','2026-10-01','2026-10-05');
        assert.equal(result.system,'snk');assert.equal(result.money.expense,2050);
        assert.doesNotMatch(JSON.stringify(result),/TAMMA_SECRET|OTHER_OWNER_SECRET/);
      } finally {await h.db.exec('reset role')}
    });
    await t.test('read RPC is service-only and never exposes data to anonymous or dashboard callers',async()=>{
      await h.db.exec('set role anon');
      try { await assert.rejects(()=>h.db.query("select snk_personal_snapshot($1,'2026-10-05',array['money'],'2026-10-01','2026-10-05')",[OWNER_ID]),/permission denied/); }
      finally {await h.db.exec('reset role')}
    });
  } finally {await h.db.close()}
});

test('5: LINE responses use Reply exactly once and never fallback to Push, even on failure',async()=>{
  const old=process.env.LINE_CHANNEL_ACCESS_TOKEN;process.env.LINE_CHANNEL_ACCESS_TOKEN='test-token';
  const calls:string[]=[];
  try {
    const fetcher=(async(url:any,init:any)=>{calls.push(String(url));assert.equal(JSON.parse(init.body).replyToken,'rt');return new Response('{}',{status:200})}) as typeof fetch;
    await replyToLine('rt','สรุปจาก SNK ครับ',fetcher);
    assert.deepEqual(calls,['https://api.line.me/v2/bot/message/reply']);
    await replyToLine('','ไม่มีโทเคนครับ',fetcher);assert.equal(calls.length,1);
    await assert.rejects(()=>replyToLine('rt','ลองอีกครั้งครับ',(async(url:any)=>{calls.push(String(url));return new Response('{}',{status:400})}) as typeof fetch),/LINE reply failed/);
    assert.ok(calls.every(url=>url.endsWith('/reply')));
  } finally {if(old===undefined)delete process.env.LINE_CHANNEL_ACCESS_TOKEN;else process.env.LINE_CHANNEL_ACCESS_TOKEN=old}
});

test('zero spending, adjustments and all-time latest expense are distinguished from real ledger evidence',async()=>{
  const h=await harness();
  try {
    await h.activate();await h.say('SCB ตอนนี้เหลือ 10000');
    assert.match((await h.say('เดือนนี้ใช้เงินไปเท่าไหร่')).reply??'',/รายจ่ายส่วนตัว 0/);
    assert.match((await h.say('รายการล่าสุดคืออะไร')).reply??'',/ปรับยอด/);
    assert.match((await h.say('ล่าสุดจ่ายอะไรไป')).reply??'',/ยังไม่มีรายจ่ายส่วนตัว/);
    await h.ledger.createTransaction({kind:'EXPENSE',amount:125,accountId:(await h.account('SCB'))!.id,payee:'อาหารเดือนก่อน',occurredOn:'2026-09-30',actor:A,...ids('old-expense')});
    await h.say('SCB ตอนนี้เหลือ 9000');
    const latest=await h.say('ล่าสุดจ่ายอะไรไป');
    assert.match(latest.reply??'',/อาหารเดือนก่อน.*125/);assert.doesNotMatch(latest.reply??'',/ปรับยอด|9,000/);
    assert.match((await h.say('เดือนนี้ใช้เงินไปเท่าไหร่')).reply??'',/รายจ่ายส่วนตัว 0/);
    assert.match((await h.say('สรุปมา')).reply??'',/ปรับยอด/);
  }finally{await h.db.close()}
});

test('personal schedule honors existing recurrence and skipped/modified occurrence records',async()=>{
  const h=await harness();
  try {
    await h.activate();
    const result=await h.db.query<{id:string}>("insert into schedule_events(owner_id,title,start_time,rrule) values($1,'เรียนภาษา','2026-09-28 14:00+07',$2) returning id",[OWNER_ID,JSON.stringify({freq:'daily',interval:1})]);
    const id=result.rows[0].id;
    await h.db.query("insert into schedule_event_occurrences(owner_id,master_event_id,occurrence_date,action) values($1,$2,'2026-10-05','skipped')",[OWNER_ID,id]);
    await h.db.query("insert into schedule_event_occurrences(owner_id,master_event_id,occurrence_date,action,title,start_time) values($1,$2,'2026-10-06','modified','เรียนภาษากับครูใหม่','2026-10-06 15:00+07')",[OWNER_ID,id]);
    assert.doesNotMatch((await h.say('วันนี้มีอะไร')).reply??'',/เรียนภาษา/);
    assert.match((await h.say('พรุ่งนี้มีอะไร')).reply??'',/เรียนภาษากับครูใหม่ 15:00/);
  }finally{await h.db.close()}
});

test('an owner-issued dashboard code binds a room to SNK without a duplicate group or task system',async()=>{
  const h=await harness({pinnedOwner:false});
  try{
    await h.db.query("select set_config('request.jwt.claim.sub',$1,false)",[OWNER_ID]);
    const issued=await h.db.query<{r:{code:string}}>("select finance_issue_binding_code() r");
    const event=(text:string)=>({type:'message',replyToken:'rt',source:{type:'room',roomId:'R_personal_0001',userId:OWNER},message:{type:'text',id:'room-'+text,text}});
    assert.match((await handlePersonalFinanceEvent(event(issued.rows[0].r.code),h.deps)).reply??'',/เรียบร้อย/);
    assert.equal(await h.count('finance_channel_bindings',"status='ACTIVE' and system='snk' and source_type='room'"),1);
    assert.match((await handlePersonalFinanceEvent(event('สรุปมา'),h.deps)).reply??'',/จาก SNK/);
  }finally{await h.db.close()}
});

test('SNK readiness is dependency-complete and independent of all Tamma endpoints/flags',async()=>{
  const env={SNK_OS_SERVICE_ROLE_KEY:'test-secret',SNK_MONEY_ENABLED:'1',LINE_CHANNEL_SECRET:'test-line',LINE_CHANNEL_ACCESS_TOKEN:'test-token',GEMINI_API_KEY:'test-gemini',SNK_OS_GROUP_ENCRYPTION_KEY:randomBytes(32).toString('base64url')};
  const calls:string[]=[];
  const result=await personalReadiness(env,async(fn)=>{calls.push(fn);return {backend:true,money:true,secretary:true,snapshot:true,binding:true,active_group:true}});
  assert.equal(result.ready,true);assert.equal(result.pullOnly,true);assert.equal(result.secretaryAiConfigured,true);assert.deepEqual(calls,['snk_personal_readiness']);
  assert.doesNotMatch(JSON.stringify(result),/test-secret|test-line|test-token|test-gemini/);
  assert.equal((await personalReadiness({...env,LINE_CHANNEL_SECRET:''},async()=>({backend:true,money:true,secretary:true,snapshot:true,binding:true,active_group:true}))).ready,false);
  assert.equal((await personalReadiness({...env,GEMINI_API_KEY:''},async()=>({backend:true,money:true,secretary:true,snapshot:true,binding:true,active_group:true}))).ready,false);
  let queried=false;
  assert.equal((await personalReadiness({...env,SNK_OS_SUPABASE_URL:'https://tamma.supabase.co'},async()=>{queried=true})).ready,false);
  assert.equal(queried,false);
});

test('signed SNK webhook runs through the real SQL transport and Replies while Tamma is unavailable',async()=>{
  const h=await harness();await h.activate();
  const previousFetch=globalThis.fetch;
  const envKeys=['SNK_OS_SERVICE_ROLE_KEY','SNK_MONEY_ENABLED','LINE_CHANNEL_SECRET','LINE_CHANNEL_ACCESS_TOKEN','SNK_OS_GROUP_ENCRYPTION_KEY','PF_OWNER_LINE_USER_IDS','SNK_MONEY_OWNER_ID','SNK_OS_SUPABASE_URL'];
  const saved=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
  const calls:string[]=[];
  Object.assign(process.env,{SNK_OS_SUPABASE_URL:SNK_OS_DEFAULT_URL,SNK_OS_SERVICE_ROLE_KEY:'test-secret',SNK_MONEY_ENABLED:'1',LINE_CHANNEL_SECRET:'test-line',LINE_CHANNEL_ACCESS_TOKEN:'test-token',SNK_OS_GROUP_ENCRYPTION_KEY:randomBytes(32).toString('base64url'),PF_OWNER_LINE_USER_IDS:OWNER,SNK_MONEY_OWNER_ID:OWNER_ID});
  globalThis.fetch=(async(url:any,init:any)=>{
    calls.push(String(url));
    if(String(url).startsWith(SNK_OS_DEFAULT_URL+'/rest/v1/rpc/')) return new Response(JSON.stringify(await h.deps.rpc(String(url).split('/').pop()!,JSON.parse(init.body))),{status:200});
    if(String(url)==='https://api.line.me/v2/bot/message/reply') return new Response('{}',{status:200});
    throw new Error('Tamma and all other network destinations are unavailable');
  }) as typeof fetch;
  try {
    const {POST}=await import('../app/api/line/snk-money/route');
    for (const text of ['สรุปมา','มีอะไรค้าง','เดือนนี้ใช้เงินไปเท่าไหร่','วันนี้มีอะไร']) {
      const body=JSON.stringify({events:[{type:'message',replyToken:'rt',source:{type:'group',groupId:GROUP,userId:OWNER},message:{type:'text',id:'real-'+text,text}}]});
      const response=await POST(new Request('https://snk.test/api/line/snk-money',{method:'POST',body,headers:{'x-line-signature':createHmac('sha256','test-line').update(body).digest('base64')}}));
      assert.equal(response.status,200);assert.deepEqual((await response.json()).handledIndexes,[0]);
    }
    assert.equal(calls.filter(url=>url.endsWith('/message/reply')).length,4);
    assert.ok(calls.every(url=>url.startsWith(SNK_OS_DEFAULT_URL)||url==='https://api.line.me/v2/bot/message/reply'));
  } finally {
    globalThis.fetch=previousFetch;
    for(const key of envKeys)if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];
    await h.db.close();
  }
});
