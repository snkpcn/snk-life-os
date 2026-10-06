import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runStark,geminiStarkModel,STARK_TOOLS,type StarkBackend,type StarkMessage} from '../lib/stark/agent';
import {createStarkBackend} from '../lib/stark/backend';
import {freshDb,OWNER_ID} from './helpers/pf-pglite';
const migration=readFileSync('supabase/migrations/20261006130955_stark_personal_agent.sql','utf8');
const id='22222222-2222-4222-8222-222222222222';
function fake(){
 let history:StarkMessage[]=[];const operations:string[]=[];
 const backend:StarkBackend={read:async r=>{operations.push('read:'+r);return r==='tasks'?{rows:[{id,title:'อ่าน thesis'}]}:{tasks:[]};},create:async(r,d)=>{operations.push('create:'+r);return {ok:true,label:d.title};},update:async(r,i,p)=>{operations.push('update:'+r+':'+p.state);return{ok:true,label:'อ่าน thesis'};},finance:async()=>{operations.push('finance:snk');return'บันทึกแล้วครับ';},market:async()=>({}),news:async()=>({}),load:async()=>({history}),save:async h=>{history=h;}};
 return{backend,operations,history:()=>history};
}
test('fresh backend then tool read and cancel; conversation remains server-side',async()=>{
 const f=fake();let turn=0;
 await runStark({message:'มีงานใหม่ทองไทย',today:'2026-10-06',casualOwner:true,backend:f.backend,model:async()=>[{text:'งานอะไรครับ'}]});
 assert.equal(f.operations.filter(x=>x.startsWith('create')).length,0);
 const reply=await runStark({message:'ลบอันเมื่อกี้',today:'2026-10-06',casualOwner:true,backend:f.backend,model:async(system,contents)=>{
 assert.match(system,/SNK/);assert.ok(contents.some(c=>c.parts.some(p=>p.text==='มีงานใหม่ทองไทย')));
 return ++turn===1?[{functionCall:{name:'read_os',args:{resource:'tasks'}}}]:turn===2?[{functionCall:{name:'update_record',args:{resource:'tasks',id,patch:{state:'CANCELLED'}}}}]:[{text:'ยกเลิกงานอ่าน thesis แล้วครับ'}];}});
 assert.match(reply,/ยกเลิก/);assert.deepEqual(f.operations,['read:overview','read:overview','read:tasks','update:tasks:CANCELLED']);
});
test('unseen IDs cannot mutate; only finance tool reaches ledger; no push tool exists',async()=>{
 const f=fake();let n=0;
 await runStark({message:'ลบงาน',today:'2026-10-06',casualOwner:true,backend:f.backend,model:async(_,contents,tools)=>{assert.ok(!JSON.stringify(tools).match(/push|tamma/i));if(++n===1)return[{functionCall:{name:'update_record',args:{resource:'tasks',id,patch:{state:'CANCELLED'}}}}];assert.match(JSON.stringify(contents),/read_current_record_before_update/);return[{text:'ต้องเลือกงานก่อนครับ'}];}});
 assert.equal(f.operations.filter(x=>x.startsWith('update')).length,0);
 await runStark({message:'จ่ายน้ำมัน 1800',today:'2026-10-06',casualOwner:true,backend:f.backend,model:async()=>[{functionCall:{name:'finance_action',args:{kind:'EXPENSE',amount:1800}}}]});assert.ok(f.operations.includes('finance:snk'));
});
test('successful writes survive model and memory errors without false failure or duplicate writes',async()=>{
 const f=fake();f.backend.save=async()=>{throw Error('memory unavailable');};let n=0;
 const reply=await runStark({message:'เพิ่มงานอ่านหนังสือ',today:'2026-10-06',casualOwner:true,backend:f.backend,model:async()=>{if(++n===1)return[{functionCall:{name:'create_record',args:{resource:'tasks',data:{title:'อ่านหนังสือ'}}}}];throw Error('model down');}});
 assert.match(reply,/อ่านหนังสือ.*สำเร็จ/);assert.equal(f.operations.filter(x=>x.startsWith('create')).length,1);
});
test('Gemini transport uses function calling and preserves thought signatures',async()=>{
 const original=globalThis.fetch;const key=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-secret';
 globalThis.fetch=async(_,init)=>{const payload=JSON.parse(String(init?.body));assert.equal(payload.toolConfig.functionCallingConfig.mode,'AUTO');assert.equal(payload.tools[0].functionDeclarations[0].name,'read_os');assert.ok(!String(init?.body).includes('test-secret'));return new Response(JSON.stringify({candidates:[{content:{parts:[{functionCall:{name:'read_os',args:{resource:'money'}},thoughtSignature:'keep-me'}]}}]}));};
 try{const parts=await geminiStarkModel('test',[{role:'user',parts:[{text:'เงิน'}]}],[{name:'read_os'}],1000);assert.equal(parts[0].thoughtSignature,'keep-me');}finally{globalThis.fetch=original;if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;}
});
test('Gemini retries transient 503 before any tools run, then returns the successful function call',async()=>{
 const original=globalThis.fetch;const key=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-secret';let calls=0;
 globalThis.fetch=async()=>{
  calls++;
  if(calls===1)return new Response('overloaded',{status:503,headers:{'retry-after':'0'}});
  const payload={candidates:[{content:{parts:[{functionCall:{name:'create_record',args:{resource:'tasks',data:{title:'เซ็นสัญญา'}}}}]}}]};
  return new Response(JSON.stringify(payload));
 };
 try{const parts=await geminiStarkModel('test',[{role:'user',parts:[{text:'เพิ่มงาน'}]}],[{name:'create_record'}],3000);assert.equal(calls,2);assert.equal(parts[0].functionCall?.name,'create_record');}finally{globalThis.fetch=original;if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;}
});
test('Gemini stops after bounded transient retries and returns the actual 503 code',async()=>{
 const original=globalThis.fetch;const key=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-secret';let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response('overloaded',{status:503,headers:{'retry-after':'0'}});};
 try{await assert.rejects(geminiStarkModel('test',[{role:'user',parts:[{text:'สรุปมา'}]}],[],3000),/gemini_http_503/);assert.equal(calls,3);}finally{globalThis.fetch=original;if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;}
});
test('fixed-time recurring commitments use the existing SNK schedule recurrence without push delivery',async()=>{
 const calls:any[]=[];
 const backend=createStarkBackend({owner:OWNER_ID,actor:'line:owner',messageId:'repeat-call',today:'2026-10-06',allowed:['schedule'],finance:async()=>null,db:{} as any,rpc:async(fn,args)=>{calls.push({fn,args});return{ok:true,count:1};}});
 const data={title:'โทรหาแฟน',start_at:'2026-10-07T09:00:00+07:00',recurrence:{freq:'daily',interval:1}};
 const result=await backend.create('schedule',data,'repeat-call');
 assert.equal(calls[0].fn,'secretary_apply_batch');
 assert.deepEqual(calls[0].args.p_items,[{...data,kind:'CALENDAR_EVENT'}]);
 assert.equal(result.delivery_enabled,false);
 assert.match(JSON.stringify(STARK_TOOLS.find((tool:any)=>tool.name==='create_record')),/recurrence/);
 await assert.rejects(backend.create('schedule',{...data,recurrence:{freq:'hourly',interval:1}},'bad-repeat'),/invalid_recurrence/);
 assert.equal(calls.length,1,'invalid recurrence never reaches the SNK write RPC');
 const f=fake();f.backend.load=async()=>({history:[{role:'user',content:'เพิ่มงานที่ต้องทำทุกวันให้หน่อยสิ'},{role:'assistant',content:'อยากให้ทำงานอะไรทุกวันครับ'}]});let turn=0;
 const reply=await runStark({message:'โทรหาแฟนทุก 9 โมงเช้า',today:'2026-10-06',casualOwner:true,backend:f.backend,model:async(system,contents)=>{
  assert.match(system,/Recurring requests/);assert.ok(contents.some(c=>c.parts.some(p=>p.text==='เพิ่มงานที่ต้องทำทุกวันให้หน่อยสิ')));
  if(++turn===1)return[{functionCall:{name:'create_record',args:{resource:'schedule',data}}}];
  return[{text:'บันทึกตารางโทรหาแฟนทุกวัน เวลา 09:00 น. แล้วครับ ตอนนี้ยังไม่มี LINE เตือนอัตโนมัติครับ'}];
 }});
 assert.deepEqual(f.operations,['read:overview','create:schedule']);assert.match(reply,/09:00/);assert.match(reply,/ไม่มี LINE เตือนอัตโนมัติ/);
});
test('real SQL writes, idempotence, cross-owner isolation, context isolation and service-only grants',async()=>{
 const{db,rpc,ledger,owner}=await freshDb();
 try{
 await db.exec('alter table public.notes add column content text; alter table public.projects add column description text, add column priority text, add column notes text;');
 await db.exec(migration);
 await db.exec(readFileSync('supabase/migrations/20261006141000_stark_personal_binding_scope.sql','utf8'));
 await db.exec('set role service_role');
 const result:any=await rpc('stark_resource_write',{p_owner:owner,p_resource:'goals',p_id:null,p_data:{title:'เรียนจบ',level:'quarter',current_value:1,target_value:10},p_actor:'web:a',p_message:'goal1',p_idem:'goal1'});assert.equal(result.ok,true);
 const repeat:any=await rpc('stark_resource_write',{p_owner:owner,p_resource:'goals',p_id:null,p_data:{title:'เรียนจบ',level:'quarter'},p_actor:'web:a',p_message:'goal1',p_idem:'goal1'});assert.equal(result.record.id,repeat.record.id);
 const other='33333333-3333-4333-8333-333333333333';await db.exec('reset role');await db.query('insert into auth.users(id) values($1)',[other]);await db.exec('set role service_role');
 const forbidden:any=await rpc('stark_resource_write',{p_owner:other,p_resource:'goals',p_id:result.record.id,p_data:{title:'leak'},p_actor:'other',p_message:'x',p_idem:'x'});assert.equal(forbidden.ok,false);
 const recurring=await ledger.secretaryApplyBatch([{kind:'CALENDAR_EVENT',title:'โทรหาแฟน',start_at:'2026-10-07T09:00:00+07:00',recurrence:{freq:'daily',interval:1}}],'line:a','repeat-call','repeat-call','2026-10-06');assert.equal(recurring.ok,true);
 const event=await db.query<{rrule:string;start_time:string}>("select rrule,start_time::text from public.schedule_events where owner_id=$1 and title='โทรหาแฟน'",[owner]);assert.equal(event.rows.length,1);assert.deepEqual(JSON.parse(event.rows[0].rrule),{freq:'daily',interval:1});assert.equal(Date.parse(event.rows[0].start_time),Date.parse('2026-10-07T09:00:00+07:00'));
 const batch=await ledger.secretaryApplyBatch([{kind:'TASK',title:'อ่าน thesis'}],'a','task1','task1','2026-10-06');const task=(batch.items as any[])[0];
 const update:any=await rpc('stark_secretary_update',{p_owner:owner,p_resource:'tasks',p_id:task.id,p_patch:{title:'อ่านสรุป thesis',priority:'high',state:'CANCELLED'},p_actor:'a',p_message:'u',p_idem:'u'});assert.equal(update.record.title,'อ่านสรุป thesis');assert.equal(update.record.secretary_state,'CANCELLED');assert.ok(update.record.archived_at);
 await rpc('stark_context_save',{p_owner:owner,p_actor:'line:a',p_message:'m1',p_history:[{role:'user',content:'ความลับ'},{role:'assistant',content:'ครับ'}],p_reply:'ครับ',p_revision:0});
 const web:any=await rpc('stark_context_load',{p_owner:owner,p_actor:'web:a',p_message:'m2'});assert.deepEqual(web.history,[]);
 const line:any=await rpc('stark_context_load',{p_owner:owner,p_actor:'line:a',p_message:'m1'});assert.equal(line.cached_reply,'ครับ');
 const grants=await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','public.stark_resource_write(uuid,text,uuid,jsonb,text,text,text)','execute') as allowed");assert.equal(grants.rows[0].allowed,false);
 const health:any=await rpc('stark_agent_readiness',{});assert.equal(health.backend,true);
 }finally{await db.close();}
});
test('backend module allowlist and correct personal owner filter prevent alternate-domain reads',async()=>{
 const calls:any[]=[];const db:any={from:(table:string)=>{calls.push(table);return{select:()=>({eq:(key:string,value:string)=>{assert.equal(key,'owner_id');assert.equal(value,OWNER_ID);return{is:()=>({limit:async()=>({data:[],error:null})}),limit:async()=>({data:[],error:null})};}})};}};
 const backend=createStarkBackend({owner:OWNER_ID,actor:'a',messageId:'m',today:'2026-10-06',allowed:['goals'],finance:async()=>null,db,rpc:async()=>({})});
 await backend.read('goals',{});await assert.rejects(backend.read('money',{}),/module_not_allowed/);await assert.rejects(backend.read('tamma_ledger',{}),/module_not_allowed/);assert.deepEqual(calls,['goals']);
});

test('only a verified owner in a bound personal group enters Stark; incoming reply uses existing transport',async()=>{
 const {harness,OWNER,GROUP}=await import('./helpers/pf-harness');
 const h=await harness();
 try{
 await h.activate();let entered=0;
 h.deps.starkAgent=async input=>{entered++;assert.equal(input.owner,OWNER_ID);assert.match(input.actor,/:line:/);assert.equal(input.message,'สรุปมา');return 'อ่าน SNK แล้วครับ';};
 assert.equal((await h.say('สรุปมา')).reply,'อ่าน SNK แล้วครับ');assert.equal(entered,1);
 const {handlePersonalFinanceEvent}=await import('../lib/snk-money/_personal-finance');
 await handlePersonalFinanceEvent({type:'message',source:{type:'group',groupId:GROUP,userId:'outsider'},message:{id:'outsider1',type:'text',text:'สรุปมา'}},h.deps);assert.equal(entered,1);
 await handlePersonalFinanceEvent({type:'message',source:{type:'group',groupId:'unknown',userId:OWNER},message:{id:'unknown1',type:'text',text:'สรุปมา'}},h.deps);assert.equal(entered,1);
 }finally{await h.db.close();}
});

test('Gemini failure has an actionable status without leaking request or key data',async()=>{
 const f=fake();const reply=await runStark({message:'ข่าววันนี้มีอะไร',today:'2026-10-06',casualOwner:true,backend:f.backend,model:async()=>{throw new Error('gemini_http_401');}});
 assert.match(reply,/API key \(401\)/);assert.match(reply,/gemini_http_401/);assert.doesNotMatch(reply,/secret|https?:\/\//i);
});
