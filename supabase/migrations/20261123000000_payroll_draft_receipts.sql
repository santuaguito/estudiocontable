create type public.payroll_status as enum ('draft', 'review_requested');
create type public.payroll_item_type as enum (
  'employer_contribution',
  'remuneration',
  'deduction'
);
create type public.employer_cost_category as enum (
  'sindical',
  'seguridad_social',
  'obra_social',
  'inssjp',
  'art',
  'camaras',
  'otros'
);

alter table public.employees
  add constraint employees_id_company_id_key unique (id, company_id);

create table public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete restrict,
  company_id uuid not null,
  payment_year integer not null check (payment_year between 2000 and 2100),
  payment_month integer not null check (payment_month between 1 and 12),
  payment_date date,
  payment_location text,
  social_contributions_payment_date date,
  social_contributions_payment_location text,
  status public.payroll_status not null default 'draft',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (company_id, studio_id)
    references public.companies(id, studio_id) on delete restrict,
  unique (studio_id, company_id, payment_year, payment_month),
  unique (id, studio_id, company_id)
);

create table public.payroll_slips (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete restrict,
  company_id uuid not null,
  period_id uuid not null,
  employee_id uuid not null,
  status public.payroll_status not null default 'draft',
  company_snapshot jsonb not null,
  employee_snapshot jsonb not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (period_id, studio_id, company_id)
    references public.payroll_periods(id, studio_id, company_id) on delete restrict,
  foreign key (employee_id, company_id)
    references public.employees(id, company_id) on delete restrict,
  unique (period_id, employee_id),
  unique (id, studio_id)
);

create table public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete restrict,
  slip_id uuid not null,
  item_type public.payroll_item_type not null,
  cost_category public.employer_cost_category,
  description text not null check (length(trim(description)) > 0),
  calculation_base numeric(18, 4),
  unit text,
  amount numeric(18, 2) not null check (amount >= 0),
  calculation_note text,
  rule_version text,
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (slip_id, studio_id)
    references public.payroll_slips(id, studio_id) on delete restrict,
  check ((item_type = 'employer_contribution') = (cost_category is not null))
);

create index payroll_periods_studio_company_idx
  on public.payroll_periods(studio_id, company_id, payment_year desc, payment_month desc);
create index payroll_slips_period_idx on public.payroll_slips(period_id, status);
create index payroll_items_slip_idx on public.payroll_items(slip_id, sort_order, created_at);

create or replace function public.create_payroll_drafts(
  target_company_id uuid,
  target_year integer,
  target_month integer,
  target_payment_date date,
  target_payment_location text,
  target_social_contributions_payment_date date,
  target_social_contributions_payment_location text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  company_row public.companies%rowtype;
  new_period_id uuid;
  inserted_slips integer;
begin
  if target_year not between 2000 and 2100 or target_month not between 1 and 12 then
    raise exception 'Invalid payroll period';
  end if;

  select * into company_row
  from public.companies c
  where c.id = target_company_id
  for share;

  if not found or company_row.service_type not in ('payroll', 'both') then
    raise exception 'Company is not enabled for payroll';
  end if;

  insert into public.payroll_periods (
    studio_id, company_id, payment_year, payment_month, payment_date,
    payment_location, social_contributions_payment_date,
    social_contributions_payment_location, created_by
  ) values (
    company_row.studio_id, company_row.id, target_year, target_month,
    target_payment_date, nullif(trim(target_payment_location), ''),
    target_social_contributions_payment_date,
    nullif(trim(target_social_contributions_payment_location), ''),
    (select auth.uid())
  ) returning id into new_period_id;

  insert into public.payroll_slips (
    studio_id, company_id, period_id, employee_id,
    company_snapshot, employee_snapshot, created_by
  )
  select
    e.studio_id,
    e.company_id,
    new_period_id,
    e.id,
    jsonb_build_object(
      'legal_name', company_row.legal_name,
      'tax_id', company_row.tax_id,
      'address', company_row.address
    ),
    jsonb_build_object(
      'full_name', e.full_name,
      'cuil', e.cuil,
      'category', e.category,
      'start_date', e.start_date
    ),
    (select auth.uid())
  from public.employees e
  where e.company_id = company_row.id
    and e.studio_id = company_row.studio_id
    and e.active;

  get diagnostics inserted_slips = row_count;
  if inserted_slips = 0 then
    raise exception 'No active employees for this period';
  end if;

  return new_period_id;
end;
$$;

create or replace function public.request_payroll_review(target_period_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_period public.payroll_periods%rowtype;
  changed_slips integer;
begin
  select * into current_period
  from public.payroll_periods p
  where p.id = target_period_id
  for update;

  if not found or current_period.status <> 'draft' then
    raise exception 'Payroll period is not an editable draft';
  end if;

  update public.payroll_slips
  set status = 'review_requested'
  where period_id = target_period_id and status = 'draft';

  get diagnostics changed_slips = row_count;
  if changed_slips = 0 then
    raise exception 'Payroll period has no draft slips';
  end if;

  update public.payroll_periods
  set status = 'review_requested'
  where id = target_period_id;

  return changed_slips;
end;
$$;

create or replace function public.guard_payroll_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' or new.status not in ('draft', 'review_requested') then
    raise exception 'Payroll status transition is not allowed';
  end if;
  return new;
end;
$$;

create or replace function public.guard_payroll_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  slip_status public.payroll_status;
  target_slip_id uuid;
  target_studio_id uuid;
begin
  if tg_op = 'DELETE' then
    target_slip_id := old.slip_id;
    target_studio_id := old.studio_id;
  else
    target_slip_id := new.slip_id;
    target_studio_id := new.studio_id;
  end if;

  if tg_op = 'UPDATE' and (new.slip_id <> old.slip_id or new.studio_id <> old.studio_id) then
    raise exception 'Payroll items cannot be moved between receipts or studios';
  end if;

  select s.status into slip_status
  from public.payroll_slips s
  where s.id = target_slip_id and s.studio_id = target_studio_id;

  if slip_status is distinct from 'draft' then
    raise exception 'Payroll items can only change while the receipt is a draft';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.record_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  event_studio_id uuid;
  event_entity_id uuid;
begin
  if actor_id is null then
    raise exception 'Authenticated user required for audited changes';
  end if;
  if tg_op = 'DELETE' then
    event_studio_id := old.studio_id;
    event_entity_id := old.id;
  else
    event_studio_id := new.studio_id;
    event_entity_id := new.id;
  end if;
  insert into public.audit_events(studio_id, user_id, action, entity_type, entity_id)
  values (event_studio_id, actor_id, lower(tg_op), tg_table_name, event_entity_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger payroll_periods_updated_at
  before update on public.payroll_periods
  for each row execute function public.set_updated_at();
create trigger payroll_slips_updated_at
  before update on public.payroll_slips
  for each row execute function public.set_updated_at();
create trigger payroll_items_updated_at
  before update on public.payroll_items
  for each row execute function public.set_updated_at();

create trigger payroll_periods_guard_status
  before update on public.payroll_periods
  for each row execute function public.guard_payroll_status();
create trigger payroll_slips_guard_status
  before update on public.payroll_slips
  for each row execute function public.guard_payroll_status();
create trigger payroll_items_guard
  before insert or update or delete on public.payroll_items
  for each row execute function public.guard_payroll_item();

create trigger payroll_periods_audit
  after insert or update on public.payroll_periods
  for each row execute function public.record_audit_event();
create trigger payroll_slips_audit
  after insert or update on public.payroll_slips
  for each row execute function public.record_audit_event();
create trigger payroll_items_audit
  after insert or update or delete on public.payroll_items
  for each row execute function public.record_audit_event();

alter table public.payroll_periods enable row level security;
alter table public.payroll_slips enable row level security;
alter table public.payroll_items enable row level security;

create policy "members can read payroll periods"
  on public.payroll_periods for select to authenticated
  using (public.is_studio_member(studio_id));
create policy "members can create payroll periods"
  on public.payroll_periods for insert to authenticated
  with check (public.is_studio_member(studio_id) and created_by = (select auth.uid()));
create policy "members can update payroll periods"
  on public.payroll_periods for update to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create policy "members can read payroll slips"
  on public.payroll_slips for select to authenticated
  using (public.is_studio_member(studio_id));
create policy "members can create payroll slips"
  on public.payroll_slips for insert to authenticated
  with check (public.is_studio_member(studio_id) and created_by = (select auth.uid()));
create policy "members can update payroll slips"
  on public.payroll_slips for update to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create policy "members can read payroll items"
  on public.payroll_items for select to authenticated
  using (public.is_studio_member(studio_id));
create policy "members can create payroll items"
  on public.payroll_items for insert to authenticated
  with check (public.is_studio_member(studio_id) and created_by = (select auth.uid()));
create policy "members can update payroll items"
  on public.payroll_items for update to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));
create policy "members can delete draft payroll items"
  on public.payroll_items for delete to authenticated
  using (public.is_studio_member(studio_id));

grant select, insert, update on public.payroll_periods, public.payroll_slips to authenticated;
grant select, insert, update, delete on public.payroll_items to authenticated;
revoke all on function public.create_payroll_drafts(uuid, integer, integer, date, text, date, text) from public, anon;
revoke all on function public.request_payroll_review(uuid) from public, anon;
grant execute on function public.create_payroll_drafts(uuid, integer, integer, date, text, date, text) to authenticated;
grant execute on function public.request_payroll_review(uuid) to authenticated;
