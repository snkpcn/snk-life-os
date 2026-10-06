import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { PfLedger, SNK_OS_DEFAULT_URL, supabaseRpc, type Rpc } from '../snk-money/_personal-finance-ledger';
import { buildOccurrenceList } from '../schedule-occurrences';
import { addDays } from '../snk-money/_personal-finance-core';
import { fetchMarketsByIds } from '../crypto/coingecko';
import { fetchQuotes, fetchRawInstrumentQuote } from '../stocks/yahoo';
import { GOLD_YAHOO_SYMBOL, USDTHB_YAHOO_SYMBOL, estimateThaiGoldPerBaht } from '../gold-fx/constants';
import { fetchCategory } from '../news/aggregate';
import type { StarkBackend, StarkMessage } from './agent';

type Json=Record<string,any>;
export const STARK_MODULES=['money','tasks','schedule','projects','notes','coach','personal_summary','goals','portfolio','markets','news','wishlist','reviews'];
const RESOURCE_GROUP:Record<string,string>={tasks:'tasks',schedule:'schedule',money:'money',goals:'goals',projects:'projects',notes:'notes',decisions:'projects',holdings:'portfolio',watchlists:'portfolio',watchlist_items:'portfolio',price_alerts:'portfolio',assets:'money',debts:'money',budgets:'money',savings_goals:'money',savings_contributions:'money',wishlist_items:'wishlist',wishlist_categories:'wishlist',wishlist_price_history:'wishlist',milestones:'projects',kpis:'goals',kpi_entries:'goals',reviews:'reviews',top_priorities:'tasks',businesses:'projects',saved_news:'news',financial_accounts:'money',recurring_transactions:'money',transaction_categories:'money'};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateValid=(v:any)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const titleKey=(r:string)=>['projects','businesses','financial_accounts','savings_goals','wishlist_items','wishlist_categories','watchlists','transaction_categories','assets','debts','kpis'].includes(r)?'name':['holdings','watchlist_items'].includes(r)?'ticker':r==='price_alerts'?'symbol':r==='budgets'?'category':r==='reviews'?'content':r==='saved_news'?'headline':'title';
const NO_ARCHIVE=new Set(['saved_news','savings_contributions','wishlist_price_history','schedule_event_occurrences','kpi_entries','top_priorities','milestones','price_alerts','reviews']);
function clean(row:Json):Json {const out:Json={};for(const[k,v]of Object.entries(row)){if(['owner_id','source_metadata','file_hash','group_id_enc','actor_hash'].includes(k))continue;out[k]=typeof v==='string'?v.slice(0,1600):v;}return out;}

export function starkServiceClient(){
  const url=(process.env.SNK_OS_SUPABASE_URL||SNK_OS_DEFAULT_URL).replace(/\/$/,'');
  if(url!==SNK_OS_DEFAULT_URL||!process.env.SNK_OS_SERVICE_ROLE_KEY)throw new Error('snk_service_not_configured');
  return createClient(url,process.env.SNK_OS_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:init?.signal||AbortSignal.timeout(8000)})}});
}

/** Identity is supplied by authenticated web/verified LINE binding, never model arguments. */
export function createStarkBackend(input:{owner:string;actor:string;messageId:string;today:string;allowed:string[];finance:(proposal:Json)=>Promise<string|null>;rpc?:Rpc;db?:ReturnType<typeof starkServiceClient>}):StarkBackend{
  if(!UUID.test(input.owner))throw new Error('invalid_owner');
  const rpc=input.rpc||supabaseRpc; const ledger=new PfLedger(rpc,input.owner); const db=input.db||starkServiceClient();let revision=0;
  const permit=(resource:string)=>{const group=RESOURCE_GROUP[resource];if(!group||!input.allowed.includes(group))throw new Error('module_not_allowed');};
  const idem=(resource:string,data:Json,id?:string)=>`${input.messageId}:stark:${createHash('sha256').update(JSON.stringify({resource,id,data:Object.fromEntries(Object.entries(data).sort())})).digest('hex').slice(0,24)}`;
  const call=async(fn:string,args:Json):Promise<Json>=>{
    const params={p_owner:input.owner,...args};
    if(!input.rpc&&fn.startsWith('stark_context_')){const{data,error}=await db.rpc(fn,params).abortSignal(AbortSignal.timeout(2000));if(error)throw new Error('context_unavailable');return data;}
    return await rpc(fn,params) as Json;
  };
  async function rows(resource:string,args:Json={}){
    permit(resource);const limit=Math.max(1,Math.min(30,Number.isInteger(args.limit)?args.limit:20));
    let query=db.from(resource).select('*').eq('owner_id',input.owner);
    if(['projects','notes','decisions','kpis','recurring_transactions'].includes(resource))query=query.is('business_id',null);
    if(!NO_ARCHIVE.has(resource))query=query.is('archived_at',null);
    if(typeof args.search==='string'&&args.search.trim())query=query.ilike(titleKey(resource),`%${args.search.trim().slice(0,100)}%`);
    const {data,error}=await query.limit(limit+1);if(error)throw new Error('snk_read_failed');
    return{system:'snk',resource,read_at:new Date().toISOString(),rows:(data||[]).slice(0,limit).map(clean),partial:(data||[]).length>limit,limit};
  }
  async function read(resource:string,args:Json):Promise<Json>{
    if(resource==='overview'){
      const modules=['tasks','schedule','projects'].filter(m=>input.allowed.includes(m));
      const snapshot=modules.length?await ledger.personalSnapshot(modules,input.today,input.today,addDays(input.today,7)):{};
      return{system:'snk',read_at:new Date().toISOString(),tasks:(snapshot.tasks||[]).slice(0,8),projects:(snapshot.projects||[]).slice(0,4),
        goals:input.allowed.includes('goals')?(await rows('goals',{limit:6})).rows:[],available_resources:Object.keys(RESOURCE_GROUP).filter(r=>input.allowed.includes(RESOURCE_GROUP[r])),
        pending_finance:input.allowed.includes('money')?await ledger.pendingGet(input.actor.replace(/:line:.+$/,'')):null};
    }
    permit(resource);
    const from=args.from||input.today.slice(0,8)+'01';const to=args.to||(args.from||input.today);
    if(!dateValid(from)||!dateValid(to)||from>to||(Date.parse(to)-Date.parse(from))/86400000>366)throw new Error('invalid_date_range');
    if(resource==='money')return{...(await ledger.personalSnapshot(['money'],input.today,from,to)),accounts:(await ledger.getAccounts()).accounts};
    if(resource==='tasks'){
      const snapshot=await ledger.personalSnapshot(['tasks'],input.today,input.today,input.today);
      return{system:'snk',read_at:new Date().toISOString(),rows:snapshot.tasks||[],partial:(snapshot.tasks||[]).length>=200};
    }
    if(resource==='schedule'){
      const start=args.from||input.today;const end=args.to||addDays(start,7);
      if(!dateValid(start)||!dateValid(end)||start>end||(Date.parse(end)-Date.parse(start))/86400000>366)throw new Error('invalid_date_range');
      if(end>addDays(start,31))throw new Error('schedule_range_max_32_days');
      const snapshot=await ledger.personalSnapshot(['schedule'],start,start,end);
      const occurrences=buildOccurrenceList(snapshot.schedule_masters||[],snapshot.schedule_exceptions||[],new Date(start+'T00:00:00+07:00'),new Date(end+'T23:59:59+07:00'));
      return{system:'snk',read_at:new Date().toISOString(),from:start,to:end,rows:(snapshot.schedule_masters||[]).map(clean),occurrences:occurrences.slice(0,40),partial:occurrences.length>40};
    }
    return rows(resource,args);
  }
  const fields:Record<string,string[]>={tasks:['title','due_date','due_time','priority','state','progress','next_action','blocker','waiting_for','recurrence'],schedule:['title','start_at','end_at','location','notes','reminder_at','status','recurrence'],goals:['title','description','level','status','current_value','target_value','unit','deadline','priority','notes'],projects:['name','description','status','due_date','priority','next_action','blocker','explicit_progress','notes'],notes:['title','content']};
  function validate(resource:string,data:Json,creating:boolean):Json{
    permit(resource);const allowed=fields[resource];if(!allowed||!data||Array.isArray(data)||typeof data!=='object')throw new Error('invalid_record');
    if(Object.keys(data).some(k=>!allowed.includes(k)))throw new Error('field_not_allowed');
    const out={...data};
    for(const[k,v]of Object.entries(out)){
      if(k==='recurrence'){
        if(v===null)continue;
        if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(key=>!['freq','interval'].includes(key))||!['daily','weekly','monthly'].includes(v.freq)||!Number.isInteger(v.interval??1)||(v.interval??1)<1||(v.interval??1)>12)throw new Error('invalid_recurrence');
        out[k]={freq:v.freq,interval:v.interval??1};continue;
      }
      if(v!==null&&typeof v!=='string'&&typeof v!=='number')throw new Error('invalid_value');
      if(typeof v==='string'&&(v.length>2000||/[\u0000]/u.test(v)))throw new Error('invalid_value');
      if(typeof v==='number'&&!Number.isFinite(v))throw new Error('invalid_value');
      if(['due_date','deadline'].includes(k)&&v!==null&&!dateValid(v))throw new Error('invalid_date');
      if(['start_at','end_at','reminder_at'].includes(k)&&v!==null&&(typeof v!=='string'||!/(?:Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v))))throw new Error('time_and_timezone_required');
    }
    if(creating&&!String(out[resource==='projects'?'name':'title']||'').trim())throw new Error('title_required');
    if(out.progress!==undefined&&(out.progress<0||out.progress>100||!Number.isInteger(out.progress)))throw new Error('invalid_progress');
    if(out.explicit_progress!==undefined&&(out.explicit_progress<0||out.explicit_progress>100))throw new Error('invalid_progress');
    if(resource==='tasks'&&out.state&&!['OPEN','IN_PROGRESS','WAITING','BLOCKED','DONE','SNOOZED','CANCELLED'].includes(out.state))throw new Error('invalid_state');
    if(resource==='goals'&&out.level&&!['north_star','annual','quarter'].includes(out.level))throw new Error('invalid_goal_level');
    if(resource==='goals'&&out.status&&!['active','paused','achieved','dropped'].includes(out.status))throw new Error('invalid_goal_status');
    if(resource==='projects'&&out.status&&!['active','needs_attention','completed','paused'].includes(out.status))throw new Error('invalid_project_status');
    if(resource==='schedule'&&out.status&&!['scheduled','completed','overdue','cancelled'].includes(out.status))throw new Error('invalid_schedule_status');
    if(out.priority&&!['low','medium','high'].includes(out.priority))throw new Error('invalid_priority');
    if(out.due_time&&!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(out.due_time))throw new Error('invalid_time');
    if(out.title)out.title=out.title.trim().slice(0,160);return out;
  }
  return{
    read,
    async create(resource,data){
      const vetted=validate(resource,data,true);const key=idem(resource,vetted);
      if(resource==='tasks'||resource==='schedule'){
        if(resource==='schedule'&&!vetted.start_at)throw new Error('appointment_time_required');
        if(resource==='schedule'&&vetted.end_at&&Date.parse(vetted.end_at)<Date.parse(vetted.start_at))throw new Error('invalid_end_time');
        if(resource==='tasks'&&(vetted.progress!==undefined||(vetted.state&&!['OPEN','WAITING'].includes(vetted.state))))throw new Error('create_open_task_then_update');
        if(resource==='schedule'&&vetted.status&&vetted.status!=='scheduled')throw new Error('create_scheduled_event_then_update');
        const kind=resource==='tasks'?(vetted.recurrence?'RECURRING_TASK':vetted.state==='WAITING'?'WAITING':'TASK'):'CALENDAR_EVENT';
        const result=await ledger.secretaryApplyBatch([{...vetted,kind}],input.actor,input.messageId,key,input.today);
        return{...result,label:vetted.title,delivery_enabled:false,reminder_note:vetted.reminder_at?'Calendar saved; automatic notifications are not enabled.':undefined,recurring_note:vetted.recurrence?'Recurring SNK record saved; automatic LINE notifications are not enabled.':undefined};
      }
      if(resource==='goals'&&!vetted.level)vetted.level='quarter';
      if(resource==='projects'&&!vetted.status)vetted.status='active';
      return call('stark_resource_write',{p_resource:resource,p_id:null,p_data:vetted,p_actor:input.actor,p_message:input.messageId,p_idem:key});
    },
    async update(resource,id,patch){
      if(!UUID.test(id))throw new Error('invalid_id');const vetted=validate(resource,patch,false);if(!Object.keys(vetted).length)throw new Error('change_required');const key=idem(resource,vetted,id);
      if(resource==='tasks'||resource==='schedule')return{...await call('stark_secretary_update',{p_resource:resource,p_id:id,p_patch:vetted,p_actor:input.actor,p_message:input.messageId,p_idem:key}),delivery_enabled:false};
      return call('stark_resource_write',{p_resource:resource,p_id:id,p_data:vetted,p_actor:input.actor,p_message:input.messageId,p_idem:key});
    },
    finance:input.finance,
    async market(args){
      if(!input.allowed.includes('markets'))throw new Error('module_not_allowed');const stamp=new Date().toISOString();
      if(args.kind==='stocks'){
        const symbols=Array.isArray(args.symbols)?args.symbols:[];if(!symbols.length||symbols.length>8||symbols.some((s:any)=>typeof s!=='string'||!/^\^?[A-Za-z0-9.-]{1,20}$/.test(s)))throw new Error('valid_stock_symbols_required');
        return{source:'Yahoo Finance',fetched_at:stamp,quotes:await fetchQuotes(symbols,args.market==='US'?'US':'TH')};
      }
      if(args.kind==='crypto'){
        const symbols=args.symbols?.length?args.symbols:['bitcoin','ethereum'];if(!Array.isArray(symbols)||symbols.length>8||symbols.some((s:any)=>typeof s!=='string'||!/^[-a-z0-9]{1,80}$/.test(s)))throw new Error('valid_crypto_ids_required');
        return{source:'CoinGecko',fetched_at:stamp,quotes:await fetchMarketsByIds(symbols)};
      }
      if(args.kind==='fx')return{source:'Yahoo Finance',fetched_at:stamp,quote:await fetchRawInstrumentQuote(USDTHB_YAHOO_SYMBOL,'USD/THB','US Dollar / Thai Baht','THB')};
      if(args.kind==='gold'){
        const[gold,fx]=await Promise.all([fetchRawInstrumentQuote(GOLD_YAHOO_SYMBOL,'GOLD','Gold Futures (COMEX)','USD'),fetchRawInstrumentQuote(USDTHB_YAHOO_SYMBOL,'USD/THB','US Dollar / Thai Baht','THB')]);
        return{source:'Yahoo Finance',fetched_at:stamp,quote:gold,usdthb:fx,thai_gold_indicative:estimateThaiGoldPerBaht(gold?.price||null,fx?.price||null),official_thai_gold_price:false};
      }throw new Error('unknown_market');
    },
    async news(args){
      if(!input.allowed.includes('news'))throw new Error('module_not_allowed');if(!['world','thailand','business','markets','tech'].includes(args.category))throw new Error('unknown_news_category');
      const result=await fetchCategory(args.category);let articles=result.articles;if(args.search)articles=articles.filter(a=>(a.headline+' '+a.summary).toLowerCase().includes(String(args.search).toLowerCase().slice(0,100)));
      return{fetched_at:new Date().toISOString(),articles:articles.slice(0,5).map(a=>({headline:a.headline,source:a.source,summary:a.summary.slice(0,800),published_at:a.published_at,url:a.article_url,fetched_at:a.fetched_at})),failed_providers:result.failedProviders};
    },
    async load(){const state=await call('stark_context_load',{p_actor:input.actor,p_message:input.messageId});revision=state.revision||0;return{history:state.history||[],cached_reply:state.cached_reply};},
    async save(history:StarkMessage[],reply:string){await call('stark_context_save',{p_actor:input.actor,p_message:input.messageId,p_history:history,p_reply:reply,p_revision:revision});}
  };
}
