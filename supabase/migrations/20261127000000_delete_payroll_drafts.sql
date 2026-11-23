-- Allow studio members to discard only editable payroll drafts.
-- Every deleted row is recorded in audit_events before it is removed.
drop policy if exists "members can delete draft payroll periods" on public.payroll_periods;
create policy "members can delete draft payroll periods"
  on public.payroll_periods for delete to authenticated
  using (status = 'draft' and public.is_studio_member(studio_id));

drop policy if exists "members can delete draft payroll slips" on public.payroll_slips;
create policy "members can delete draft payroll slips"
  on public.payroll_slips for delete to authenticated
  using (status = 'draft' and public.is_studio_member(studio_id));

-- RLS policies filter rows but do not grant the table-level DELETE privilege.
grant delete on public.payroll_periods, public.payroll_slips to authenticated;

create trigger payroll_periods_delete_audit
  after delete on public.payroll_periods
  for each row execute function public.record_audit_event();
create trigger payroll_slips_delete_audit
  after delete on public.payroll_slips
  for each row execute function public.record_audit_event();

create or replace function public.delete_payroll_draft(target_period_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_period public.payroll_periods%rowtype;
  locked_slip_count integer;
begin
  select * into current_period
  from public.payroll_periods p
  where p.id = target_period_id
  for update;

  if not found or current_period.status <> 'draft'
     or not public.is_studio_member(current_period.studio_id) then
    raise exception 'Only a member can delete an editable draft period';
  end if;

  perform 1 from public.payroll_slips s
  where s.period_id = target_period_id
  for update;
  select count(*) into locked_slip_count
  from public.payroll_slips s
  where s.period_id = target_period_id and s.status <> 'draft';
  if locked_slip_count > 0 then
    raise exception 'A period with receipts under review cannot be deleted';
  end if;

  delete from public.payroll_items i
  using public.payroll_slips s
  where s.period_id = target_period_id and i.slip_id = s.id;
  delete from public.payroll_slips s where s.period_id = target_period_id;
  delete from public.payroll_periods p where p.id = target_period_id;
end;
$$;

create or replace function public.delete_payroll_slip_draft(target_slip_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_period public.payroll_periods%rowtype;
  current_slip public.payroll_slips%rowtype;
  period_slip_count integer;
begin
  select p.* into parent_period
  from public.payroll_periods p
  join public.payroll_slips s on s.period_id = p.id
  where s.id = target_slip_id
  for update of p;

  if not found or parent_period.status <> 'draft'
     or not public.is_studio_member(parent_period.studio_id) then
    raise exception 'Only a member can delete a receipt from an editable draft period';
  end if;

  select * into current_slip
  from public.payroll_slips s
  where s.id = target_slip_id and s.period_id = parent_period.id
  for update;
  if not found or current_slip.status <> 'draft' then
    raise exception 'Only a draft receipt can be deleted';
  end if;

  select count(*) into period_slip_count
  from public.payroll_slips s where s.period_id = parent_period.id;
  if period_slip_count <= 1 then
    raise exception 'Delete the whole period when it contains only one receipt';
  end if;

  delete from public.payroll_items i where i.slip_id = target_slip_id;
  delete from public.payroll_slips s where s.id = target_slip_id;
end;
$$;

revoke all on function public.delete_payroll_draft(uuid) from public, anon;
revoke all on function public.delete_payroll_slip_draft(uuid) from public, anon;
grant execute on function public.delete_payroll_draft(uuid) to authenticated;
grant execute on function public.delete_payroll_slip_draft(uuid) to authenticated;
