-- The existing SNK binding uses PERSONAL_FINANCE_PRIVATE. Preserve its scope.
update public.finance_channel_bindings set allowed_modules=allowed_modules||array['goals','portfolio','markets','news','wishlist','reviews']
where system='snk' and scope in ('personal','PERSONAL_FINANCE_PRIVATE')
  and allowed_modules @> array['money','tasks','schedule','projects','notes','coach','personal_summary']
  and not allowed_modules @> array['goals'];

create or replace function public.stark_agent_readiness() returns jsonb language sql stable security invoker set search_path=public as $fn$
  select jsonb_build_object('system','snk','scope','personal','context',to_regprocedure('public.stark_context_load(uuid,text,text)') is not null,
    'write_tools',to_regprocedure('public.stark_secretary_update(uuid,text,uuid,jsonb,text,text,text)') is not null,
    'backend',to_regclass('public.tasks') is not null and to_regclass('public.transactions') is not null,
    'binding',to_regclass('public.finance_channel_bindings') is not null,
    'active_group',exists(select 1 from public.finance_channel_bindings where status='ACTIVE' and system='snk' and scope in ('personal','PERSONAL_FINANCE_PRIVATE')));
$fn$;
revoke all on function public.stark_agent_readiness() from public,anon,authenticated;
grant execute on function public.stark_agent_readiness() to service_role;
