-- Extend the existing personal secretary context; no second chat/task database.
alter table public.secretary_contexts add column if not exists conversation jsonb not null default '[]'::jsonb;
alter table public.secretary_contexts add column if not exists conversation_updated_at timestamptz;
alter table public.secretary_contexts add column if not exists conversation_revision bigint not null default 0;


create or replace function public.stark_context_load(p_owner uuid,p_actor text,p_message text)
returns jsonb language plpgsql security definer set search_path=public as $fn$
declare c public.secretary_contexts%rowtype; cached jsonb;
begin
  if p_owner is null or length(coalesce(p_actor,'')) not between 1 and 256 or length(coalesce(p_message,'')) not between 1 and 256 then raise exception 'invalid_context'; end if;
  select * into c from public.secretary_contexts where owner_id=p_owner and actor_hash=p_actor;
  cached:=public.finance_i_idem_get(p_owner,'stark:reply:'||p_actor||':'||p_message);
  return jsonb_build_object('history',case when c.conversation_updated_at>now()-interval '7 days' then c.conversation else '[]'::jsonb end,
    'revision',coalesce(c.conversation_revision,0),'cached_reply',cached->>'reply');
end $fn$;

create or replace function public.stark_context_save(p_owner uuid,p_actor text,p_message text,p_history jsonb,p_reply text,p_revision bigint)
returns jsonb language plpgsql security definer set search_path=public as $fn$
declare v_revision bigint; item jsonb;
begin
  if p_owner is null or length(coalesce(p_actor,'')) not between 1 and 256 or length(coalesce(p_message,'')) not between 1 and 256 or length(p_reply)>4500
    or jsonb_typeof(p_history)<>'array' or jsonb_array_length(p_history)>12 then raise exception 'invalid_context'; end if;
  for item in select value from jsonb_array_elements(p_history) loop
    if coalesce(item->>'role','') not in ('user','assistant') or jsonb_typeof(item->'content') is distinct from 'string' or length(item->>'content')>4500 then raise exception 'invalid_history'; end if;
  end loop;
  insert into public.secretary_contexts(owner_id,actor_hash) values(p_owner,p_actor) on conflict do nothing;
  select conversation_revision into v_revision from public.secretary_contexts where owner_id=p_owner and actor_hash=p_actor for update;
  perform public.finance_i_idem_put(p_owner,'stark:reply:'||p_actor||':'||p_message,jsonb_build_object('reply',p_reply));
  if v_revision<>p_revision then return jsonb_build_object('ok',true,'memory_conflict',true); end if;
  update public.secretary_contexts set conversation=p_history,conversation_updated_at=now(),conversation_revision=conversation_revision+1
    where owner_id=p_owner and actor_hash=p_actor;
  return jsonb_build_object('ok',true);
end $fn$;

-- Typed, owner-scoped, audited writes to existing goals/projects/notes only.
create or replace function public.stark_resource_write(p_owner uuid,p_resource text,p_id uuid,p_data jsonb,p_actor text,p_message text,p_idem text)
returns jsonb language plpgsql security definer set search_path=public as $fn$
declare v_fields text[]; v_key text; v_cols text; v_values text; v_sets text; v_row jsonb; v_previous jsonb; v_before jsonb;
begin
  if p_owner is null or jsonb_typeof(p_data)<>'object' or p_data='{}'::jsonb then raise exception 'invalid_record'; end if;
  if p_resource='goals' then v_fields:=array['title','description','level','status','current_value','target_value','unit','deadline','priority','notes','archived_at'];
  elsif p_resource='projects' then v_fields:=array['name','description','status','due_date','priority','next_action','blocker','explicit_progress','notes','archived_at'];
  elsif p_resource='notes' then v_fields:=array['title','content','archived_at'];
  else raise exception 'resource_write_not_allowed'; end if;
  for v_key in select jsonb_object_keys(p_data) loop
    if not v_key=any(v_fields) then raise exception 'field_not_allowed'; end if;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':'||p_idem,0));
  v_previous:=public.finance_i_idem_get(p_owner,p_idem); if v_previous is not null then return v_previous; end if;
  perform public.finance_i_engine();
  select string_agg(format('%I',key),','),string_agg(format('v.%I',key),','),string_agg(format('%I=v.%I',key,key),',')
    into v_cols,v_values,v_sets from jsonb_object_keys(p_data) key;
  if p_id is null then
    execute format('insert into public.%I as t (owner_id,%s) select $1,%s from jsonb_populate_record(null::public.%I,$2) v returning to_jsonb(t)',p_resource,v_cols,v_values,p_resource)
      into v_row using p_owner,p_data;
  else
    execute format('select to_jsonb(t) from public.%I t where id=$1 and owner_id=$2 and archived_at is null for update',p_resource)
      into v_before using p_id,p_owner;
    if v_before is null then return jsonb_build_object('ok',false,'error','record_not_found'); end if;
    execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) v where t.id=$2 and t.owner_id=$3 returning to_jsonb(t)',p_resource,v_sets,p_resource)
      into v_row using p_data,p_id,p_owner;
  end if;
  perform public.finance_i_audit(p_owner,'STARK_RECORD_WRITE',p_resource,(v_row->>'id')::uuid,p_actor,p_message,coalesce(v_before,'{}'::jsonb),v_row,'{}'::jsonb);
  return public.finance_i_idem_put(p_owner,p_idem,jsonb_build_object('ok',true,'record',v_row-'owner_id','label',coalesce(v_row->>'title',v_row->>'name')));
end $fn$;

revoke all on function public.stark_context_load(uuid,text,text), public.stark_context_save(uuid,text,text,jsonb,text,bigint), public.stark_resource_write(uuid,text,uuid,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.stark_context_load(uuid,text,text), public.stark_context_save(uuid,text,text,jsonb,text,bigint), public.stark_resource_write(uuid,text,uuid,jsonb,text,text,text) to service_role;

-- Expand only bindings that already granted every module in the previous full personal profile.
do $do$ declare c record; begin
  for c in select conname from pg_constraint where conrelid='public.finance_channel_bindings'::regclass and contype='c' and pg_get_constraintdef(oid) like '%allowed_modules%' loop
    execute format('alter table public.finance_channel_bindings drop constraint %I',c.conname);
  end loop;
end $do$;
alter table public.finance_channel_bindings add constraint snk_allowed_modules_check check(allowed_modules <@ array['money','tasks','schedule','projects','notes','coach','personal_summary','goals','portfolio','markets','news','wishlist','reviews']::text[]);
alter table public.finance_channel_bindings alter column allowed_modules set default array['money','tasks','schedule','projects','notes','coach','personal_summary','goals','portfolio','markets','news','wishlist','reviews'];
update public.finance_channel_bindings set allowed_modules=allowed_modules||array['goals','portfolio','markets','news','wishlist','reviews']
where system='snk' and scope='personal' and allowed_modules @> array['money','tasks','schedule','projects','notes','coach','personal_summary']
  and not allowed_modules @> array['goals'];

-- Keep the canonical secretary lifecycle/audit; extend only its existing editable fields.
create or replace function public.stark_secretary_update(p_owner uuid,p_resource text,p_id uuid,p_patch jsonb,p_actor text,p_message text,p_idem text)
returns jsonb language plpgsql security definer set search_path=public as $fn$
declare v_result jsonb; v_before jsonb; v_after jsonb; v_fields text[]; k text;
begin
  if p_owner is null or p_resource not in ('tasks','schedule') or jsonb_typeof(p_patch) is distinct from 'object' then raise exception 'invalid_record'; end if;
  v_fields:=case when p_resource='tasks' then array['title','due_date','due_time','priority','state','progress','next_action','blocker','waiting_for'] else array['title','start_at','end_at','location','notes','reminder_at','status'] end;
  for k in select jsonb_object_keys(p_patch) loop if not k=any(v_fields) then raise exception 'field_not_allowed'; end if; end loop;
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':'||p_idem,0));
  v_result:=public.finance_i_idem_get(p_owner,p_idem); if v_result is not null then return v_result; end if;
  if p_resource='tasks' then
    select to_jsonb(t) into v_before from public.tasks t where id=p_id and owner_id=p_owner and archived_at is null for update;
    if v_before is null then return jsonb_build_object('ok',false,'error','record_not_found'); end if;
    v_result:=public.secretary_update_task(p_owner,p_id,p_patch,p_actor,p_message,p_idem||':lifecycle');
    update public.tasks set title=case when p_patch ? 'title' then p_patch->>'title' else title end,
      secretary_key=case when p_patch ? 'title' then public.secretary_i_task_key(p_patch->>'title') else secretary_key end,
      priority=case when p_patch ? 'priority' then p_patch->>'priority' else priority end,updated_at=now()
      where id=p_id and owner_id=p_owner returning to_jsonb(tasks) into v_after;
  else
    select to_jsonb(t) into v_before from public.schedule_events t where id=p_id and owner_id=p_owner and archived_at is null for update;
    if v_before is null then return jsonb_build_object('ok',false,'error','record_not_found'); end if;
    v_result:=public.secretary_update_event(p_owner,p_id,p_patch,p_actor,p_message,p_idem||':lifecycle');
    update public.schedule_events set title=case when p_patch ? 'title' then p_patch->>'title' else title end,
      location=case when p_patch ? 'location' then p_patch->>'location' else location end,
      notes=case when p_patch ? 'notes' then p_patch->>'notes' else notes end,
      status=case when p_patch ? 'status' then p_patch->>'status' else status end
      where id=p_id and owner_id=p_owner returning to_jsonb(schedule_events) into v_after;
    if (v_after->>'end_time')::timestamptz<(v_after->>'start_time')::timestamptz then raise exception 'invalid_end_time'; end if;
  end if;
  perform public.finance_i_audit(p_owner,'STARK_RECORD_WRITE',p_resource,p_id,p_actor,p_message,v_before,v_after,'{}'::jsonb);
  return public.finance_i_idem_put(p_owner,p_idem,jsonb_build_object('ok',true,'record',v_after-'owner_id','label',v_after->>'title'));
end $fn$;

revoke all on function public.stark_secretary_update(uuid,text,uuid,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.stark_secretary_update(uuid,text,uuid,jsonb,text,text,text) to service_role;

create or replace function public.stark_agent_readiness() returns jsonb language sql stable security invoker set search_path=public as $fn$
  select jsonb_build_object('system','snk','scope','personal','context',to_regprocedure('public.stark_context_load(uuid,text,text)') is not null,
    'write_tools',to_regprocedure('public.stark_secretary_update(uuid,text,uuid,jsonb,text,text,text)') is not null,
    'backend',to_regclass('public.tasks') is not null and to_regclass('public.transactions') is not null,
    'binding',to_regclass('public.finance_channel_bindings') is not null,
    'active_group',exists(select 1 from public.finance_channel_bindings where status='ACTIVE' and system='snk' and scope='personal'));
$fn$;
revoke all on function public.stark_agent_readiness() from public,anon,authenticated;
grant execute on function public.stark_agent_readiness() to service_role;
