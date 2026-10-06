create or replace function public.finance_i_account_json(p_id uuid) returns jsonb language sql stable set search_path=public as $$
  select case when a.id is null then null else jsonb_build_object(
    'id',a.id,'name',a.name,'institution',a.institution,'kind',upper(a.account_type),'balance',a.current_balance,'balance_status',a.balance_status,
    'balance_confirmed_at',a.balance_confirmed_at,'is_active',(a.is_active and a.archived_at is null)) end
  from (select 1) s left join public.financial_accounts a on a.id=p_id;
$$;
