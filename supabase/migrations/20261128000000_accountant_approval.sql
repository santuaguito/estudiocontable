-- A studio accountant (or owner acting as accountant) can approve each receipt.
alter type public.payroll_status add value if not exists 'approved';

alter table public.payroll_slips
  add column reviewed_by uuid references auth.users(id) on delete restrict,
  add column reviewed_at timestamptz;

create or replace function public.guard_payroll_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor_role public.studio_role;
begin
  if old.status = 'approved' then
    raise exception 'Approved payroll records cannot be changed';
  end if;

  if old.status = 'draft' and new.status not in ('draft', 'review_requested', 'approved') then
    raise exception 'Payroll status transition is not allowed';
  end if;
  if old.status = 'review_requested' and new.status not in ('review_requested', 'approved') then
    raise exception 'Payroll status transition is not allowed';
  end if;

  if new.status = 'approved' then
    select sm.role into actor_role
    from public.studio_members sm
    where sm.studio_id = new.studio_id and sm.user_id = (select auth.uid());
    if actor_role not in ('accountant', 'owner') or actor_role is null then
      raise exception 'Only an accountant or studio owner can approve payroll';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.approve_payroll_slip(target_slip_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_period public.payroll_periods%rowtype;
  current_slip public.payroll_slips%rowtype;
  actor_id uuid := (select auth.uid());
  actor_role public.studio_role;
  pending_slips integer;
begin
  select p.* into parent_period
  from public.payroll_periods p
  join public.payroll_slips s on s.period_id = p.id
  where s.id = target_slip_id
  for update of p;
  if not found then raise exception 'Payroll period or receipt not found'; end if;

  select sm.role into actor_role
  from public.studio_members sm
  where sm.studio_id = parent_period.studio_id and sm.user_id = actor_id;
  if actor_role not in ('accountant', 'owner') or actor_role is null then
    raise exception 'Only an accountant or studio owner can approve payroll';
  end if;
  if parent_period.status = 'approved' then
    raise exception 'Payroll period is already finalized';
  end if;

  select * into current_slip
  from public.payroll_slips s
  where s.id = target_slip_id and s.period_id = parent_period.id
  for update;
  if not found or current_slip.status not in ('draft', 'review_requested') then
    raise exception 'Receipt is not awaiting approval';
  end if;

  update public.payroll_slips
  set status = 'approved', reviewed_by = actor_id, reviewed_at = now()
  where id = target_slip_id;

  select count(*) into pending_slips
  from public.payroll_slips s
  where s.period_id = parent_period.id and s.status <> 'approved';
  if pending_slips = 0 then
    update public.payroll_periods
    set status = 'approved'
    where id = parent_period.id;
  end if;
  return pending_slips = 0;
end;
$$;

revoke all on function public.approve_payroll_slip(uuid) from public, anon;
grant execute on function public.approve_payroll_slip(uuid) to authenticated;
