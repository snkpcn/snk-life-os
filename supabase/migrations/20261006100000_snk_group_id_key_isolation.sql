-- Extend the existing binding; no second group map or personal data system.
alter table public.finance_channel_bindings
  add column if not exists system text not null default 'snk' check (system='snk'),
  add column if not exists source_type text not null default 'group' check (source_type in ('group','room')),
  add column if not exists allowed_modules text[] not null default array['money','tasks','schedule','projects','notes','coach','personal_summary']
    check (allowed_modules <@ array['money','tasks','schedule','projects','notes','coach','personal_summary']::text[]);
-- Move private LINE group-ID encryption onto an SNK-only key without changing
-- the active binding or any finance/task rows. The first signed event after
-- deployment provides the group ID again and replaces legacy ciphertext.
create or replace function public.finance_binding_lookup_any(p_group_hash text) returns jsonb
language sql stable security definer set search_path='' as $fn$
  select coalesce(
    (select pg_catalog.jsonb_build_object('id',id,'status',status,'owner_id',owner_id,'group_id_enc',group_id_enc,'failed_attempts',failed_attempts,'system',system,'scope','personal','source_type',source_type,'group_name',group_name,'allowed_modules',allowed_modules)
       from public.finance_channel_bindings
      where group_id_hash=p_group_hash and status in ('PENDING','ACTIVE') limit 1),
    pg_catalog.jsonb_build_object('status','NONE')
  );
$fn$;

create or replace function public.finance_binding_refresh_ciphertext(p_group_hash text, p_group_enc text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_row public.finance_channel_bindings%rowtype;
begin
  if coalesce(p_group_hash,'') !~ '^[0-9a-f]{64}$' then raise exception 'group_hash_invalid'; end if;
  if coalesce(p_group_enc,'') !~ '^v2\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' then raise exception 'group_ciphertext_invalid'; end if;
  update public.finance_channel_bindings
     set group_id_enc=p_group_enc,updated_at=pg_catalog.now()
   where group_id_hash=p_group_hash and status in ('PENDING','ACTIVE') and coalesce(group_id_enc,'') not like 'v2.%'
   returning * into v_row;
  if v_row.id is not null then
    if v_row.owner_id is not null then
      perform public.finance_i_audit(v_row.owner_id,'GROUP_ID_ENCRYPTION_ROTATED','binding',v_row.id,
        'system:snk-runtime',null,'{}'::jsonb,pg_catalog.jsonb_build_object('format','v2'),pg_catalog.jsonb_build_object('key_scope','snk_private'));
    end if;
    return pg_catalog.jsonb_build_object('ok',true,'updated',true);
  end if;
  return pg_catalog.jsonb_build_object('ok',true,'updated',false);
end $fn$;

revoke all on function public.finance_binding_lookup_any(text) from public,anon,authenticated;
grant execute on function public.finance_binding_lookup_any(text) to service_role;
revoke all on function public.finance_binding_refresh_ciphertext(text,text) from public,anon,authenticated,service_role;
grant execute on function public.finance_binding_refresh_ciphertext(text,text) to service_role;


-- Fresh, bounded, module-scoped evidence from the EXISTING SNK models.
-- Invoker permissions are used: only the server-side service_role may call this.
create or replace function public.snk_personal_snapshot(p_owner uuid,p_today date,p_modules text[],p_from date,p_to date)
returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare v_result jsonb := pg_catalog.jsonb_build_object('system','snk','scope','personal','today',p_today,'read_at',pg_catalog.now());
        v_tasks jsonb; v_masters jsonb; v_exceptions jsonb; v_money jsonb; v_recent jsonb; v_categories jsonb;
begin
  if p_owner is null then raise exception 'owner_not_found'; end if;
  if p_today is null or p_from is null or p_to is null or p_from>p_to or p_to-p_from>366 then raise exception 'invalid_range'; end if;
  if p_modules is null or not (p_modules <@ array['money','tasks','schedule','projects','notes','coach','personal_summary']::text[]) then raise exception 'invalid_modules'; end if;
  if 'tasks'=any(p_modules) then
    select coalesce(pg_catalog.jsonb_agg(x.j order by x.rank desc,x.due_date nulls last,x.created_at),'[]'::jsonb) into v_tasks from (
      select t.created_at,t.due_date,
        coalesce(t.owner_priority,0)+case when t.due_date<p_today then 10000 when t.is_today_priority then 5000 else 0 end as rank,
        pg_catalog.jsonb_build_object('id',t.id,'title',t.title,'state',
          case when t.secretary_state in ('WAITING','BLOCKED') then t.secretary_state when t.due_date<p_today then 'OVERDUE' else t.secretary_state end,
          'due_date',t.due_date,'due_time',t.due_time,'next_action',t.next_action,'waiting_for',t.waiting_for,'blocker',t.blocker,
          'owner_action',t.waiting_for ~ '(เจ้าของ|ยืนยัน|อนุมัติ)','priority',t.priority) as j
      from public.tasks t where t.owner_id=p_owner and t.business_id is null and t.archived_at is null and t.completed_at is null
        and coalesce(t.status,'inbox') not in ('done','cancelled','archived') and t.secretary_state not in ('DONE','CANCELLED')
        and not (t.secretary_state='SNOOZED' and t.snoozed_until>pg_catalog.now())
        and (t.project_id is null or exists(select 1 from public.projects p where p.id=t.project_id and p.owner_id=p_owner and p.business_id is null))
      order by rank desc,t.due_date nulls last,t.created_at limit 200
    ) x;
    v_result:=v_result||pg_catalog.jsonb_build_object('tasks',v_tasks);
  end if;
  if 'schedule'=any(p_modules) then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(e) order by e.start_time),'[]'::jsonb) into v_masters
      from public.schedule_events e where e.owner_id=p_owner and e.business_id is null and e.archived_at is null and e.status='scheduled'
      and (e.project_id is null or exists(select 1 from public.projects p where p.id=e.project_id and p.owner_id=p_owner and p.business_id is null))
      and (e.rrule is not null or e.start_time>=((p_today::timestamp) at time zone 'Asia/Bangkok'))
      and e.start_time<(((p_today+32)::timestamp) at time zone 'Asia/Bangkok');
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(o)),'[]'::jsonb) into v_exceptions
      from public.schedule_event_occurrences o join public.schedule_events e on e.id=o.master_event_id
      where o.owner_id=p_owner and e.owner_id=p_owner and e.business_id is null and e.archived_at is null
      and (e.project_id is null or exists(select 1 from public.projects p where p.id=e.project_id and p.owner_id=p_owner and p.business_id is null));
    v_result:=v_result||pg_catalog.jsonb_build_object('schedule_masters',v_masters,'schedule_exceptions',v_exceptions);
  end if;
  if 'projects'=any(p_modules) then
    v_result:=v_result||pg_catalog.jsonb_build_object('projects',coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',p.id,'name',p.name,'status',p.status,'next_action',p.next_action,
        'next_milestone',p.next_milestone,'due_date',p.due_date,'blocker',p.blocker,'progress',p.explicit_progress))
      from public.projects p where p.owner_id=p_owner and p.business_id is null and p.archived_at is null and p.status not in ('completed','done','cancelled','archived')),'[]'::jsonb));
  end if;
  if 'personal_summary'=any(p_modules) then
    v_result:=v_result||pg_catalog.jsonb_build_object('decisions',coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',d.id,'title',d.title,'review_date',d.review_date))
      from public.decisions d where d.owner_id=p_owner and d.business_id is null and d.archived_at is null and nullif(trim(d.decision),'') is null
        and (d.project_id is null or exists(select 1 from public.projects p where p.id=d.project_id and p.owner_id=p_owner and p.business_id is null))),'[]'::jsonb));
  end if;
  if 'notes'=any(p_modules) then
    v_result:=v_result||pg_catalog.jsonb_build_object('notes',coalesce((
      select pg_catalog.jsonb_agg(x.j) from (select pg_catalog.jsonb_build_object('id',n.id,'title',n.title) j
      from public.notes n where n.owner_id=p_owner and n.business_id is null and n.archived_at is null
        and (n.project_id is null or exists(select 1 from public.projects p where p.id=n.project_id and p.owner_id=p_owner and p.business_id is null))
      order by n.updated_at desc limit 10) x),'[]'::jsonb));
  end if;
  if 'money'=any(p_modules) then
    select pg_catalog.jsonb_build_object('from',p_from,'to',p_to,
      'expense',coalesce(sum(t.amount) filter(where t.type='expense'),0),'income',coalesce(sum(t.amount) filter(where t.type='income'),0),
      'transaction_count',count(*),'pending_clarification_count',count(*) filter(where t.status='PENDING_CLARIFICATION'))
      into v_money from public.transactions t where t.owner_id=p_owner and t.business_id is null
        and (t.project_id is null or exists(select 1 from public.projects p where p.id=t.project_id and p.owner_id=p_owner and p.business_id is null))
        and t.type in ('income','expense') and t.archived_at is null and t.status in ('CONFIRMED','PENDING_CLARIFICATION') and t.occurred_on between p_from and p_to;
    select coalesce(pg_catalog.jsonb_agg(x.j),'[]'::jsonb) into v_recent from (
      select pg_catalog.jsonb_build_object('id',t.id,'kind',upper(t.type),'amount',t.amount,'occurred_on',t.occurred_on,
        'category',t.category,'payee',t.merchant,'note',coalesce(t.notes,t.description)) j from public.transactions t where t.owner_id=p_owner and t.business_id is null
        and (t.project_id is null or exists(select 1 from public.projects p where p.id=t.project_id and p.owner_id=p_owner and p.business_id is null))
        and t.archived_at is null and t.status in ('CONFIRMED','PENDING_CLARIFICATION') and t.occurred_on between p_from and p_to
      order by t.seq desc limit 10) x;
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.total desc),'[]'::jsonb) into v_categories from (
      select coalesce(c.name,t.category,'ไม่ระบุหมวด') as category,upper(t.type) as kind,sum(t.amount) as total
        from public.transactions t left join public.transaction_categories c on c.id=t.category_id and c.owner_id=p_owner
        where t.owner_id=p_owner and t.business_id is null
          and (t.project_id is null or exists(select 1 from public.projects p where p.id=t.project_id and p.owner_id=p_owner and p.business_id is null))
          and t.type in ('income','expense') and t.archived_at is null and t.status in ('CONFIRMED','PENDING_CLARIFICATION') and t.occurred_on between p_from and p_to group by 1,2) x;
    v_result:=v_result||pg_catalog.jsonb_build_object('money',v_money||pg_catalog.jsonb_build_object('recent',v_recent,'latest',(
      select pg_catalog.jsonb_build_object('id',t.id,'kind',upper(t.type),'amount',t.amount,'occurred_on',t.occurred_on,'category',t.category,'payee',t.merchant,'note',coalesce(t.notes,t.description))
      from public.transactions t where t.owner_id=p_owner and t.business_id is null and t.archived_at is null
        and t.status in ('CONFIRMED','PENDING_CLARIFICATION')
        and (t.project_id is null or exists(select 1 from public.projects p where p.id=t.project_id and p.owner_id=p_owner and p.business_id is null))
      order by t.seq desc limit 1),'latest_expense',(
      select pg_catalog.jsonb_build_object('id',t.id,'kind','EXPENSE','amount',t.amount,'occurred_on',t.occurred_on,'category',t.category,'payee',t.merchant,'note',coalesce(t.notes,t.description))
      from public.transactions t where t.owner_id=p_owner and t.business_id is null and t.archived_at is null and t.type='expense'
        and t.status in ('CONFIRMED','PENDING_CLARIFICATION')
        and (t.project_id is null or exists(select 1 from public.projects p where p.id=t.project_id and p.owner_id=p_owner and p.business_id is null))
      order by t.seq desc limit 1),'by_category',v_categories));
  end if;
  return v_result;
end $fn$;
revoke all on function public.snk_personal_snapshot(uuid,date,text[],date,date) from public,anon,authenticated;
grant execute on function public.snk_personal_snapshot(uuid,date,text[],date,date) to service_role;

create or replace function public.snk_personal_readiness() returns jsonb
language sql stable security invoker set search_path='' as $fn$
  select pg_catalog.jsonb_build_object('backend',true,
    'money',pg_catalog.to_regprocedure('public.finance_record_transaction(uuid,text,numeric,uuid,uuid,text,text,text,date,text,text,text,text,text,boolean)') is not null,
    'secretary',pg_catalog.to_regprocedure('public.secretary_apply_batch(uuid,jsonb,text,text,text,date)') is not null,
    'snapshot',pg_catalog.to_regprocedure('public.snk_personal_snapshot(uuid,date,text[],date,date)') is not null,
    'binding',pg_catalog.to_regprocedure('public.finance_binding_refresh_ciphertext(text,text)') is not null,
    'active_group',exists(select 1 from public.finance_channel_bindings where status='ACTIVE' and system='snk'));
$fn$;
revoke all on function public.snk_personal_readiness() from public,anon,authenticated;
grant execute on function public.snk_personal_readiness() to service_role;

create or replace function public.snk_binding_activate_room(p_group_hash text,p_group_enc text,p_actor text,p_code text,p_group_name text default null)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare v_result jsonb;
begin
  v_result:=public.finance_binding_activate_code(p_group_hash,p_group_enc,p_actor,p_code,p_group_name);
  if (v_result->>'ok')::boolean then
    update public.finance_channel_bindings set source_type='room'
      where group_id_hash=p_group_hash and owner_id=(v_result->>'owner_id')::uuid and status='ACTIVE';
  end if;
  return v_result;
end $fn$;
revoke all on function public.snk_binding_activate_room(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.snk_binding_activate_room(text,text,text,text,text) to service_role;
