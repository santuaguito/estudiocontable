alter table public.employees
  add column base_salary numeric(18, 2) not null default 0
  check (base_salary >= 0);

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

  if not found or not company_row.active or company_row.service_type not in ('payroll', 'both') then
    raise exception 'Company is not active or enabled for payroll';
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
      'start_date', e.start_date,
      'base_salary', e.base_salary
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

  insert into public.payroll_items (
    studio_id, slip_id, item_type, cost_category, description,
    calculation_base, unit, amount, calculation_note, rule_version,
    sort_order, created_by
  )
  select
    s.studio_id, s.id, 'remuneration', null, 'Sueldo básico',
    e.base_salary, 'ARS', e.base_salary,
    'Importe básico cargado en el legajo; requiere revisión profesional para el período.',
    null, 0, (select auth.uid())
  from public.payroll_slips s
  join public.employees e on e.id = s.employee_id and e.company_id = s.company_id
  where s.period_id = new_period_id and e.base_salary > 0;

  return new_period_id;
end;
$$;
