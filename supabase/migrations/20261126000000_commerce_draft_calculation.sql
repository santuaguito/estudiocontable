-- CCT 130/75 / FAECYS Acuerdo 10/2026 draft calculator.
-- This creates professional-review drafts only; it does not issue a legal receipt.
alter table public.employees
  add column union_rate numeric(5, 2) not null default 2
    check (union_rate between 0 and 100),
  add column solidarity_rate numeric(5, 2) not null default 0
    check (solidarity_rate between 0 and 100),
  add column rifl_eligible boolean not null default false;

alter table public.companies
  add column arca_employer_rate numeric(4, 2)
    check (arca_employer_rate in (18, 20.4)),
  add column fal_rate numeric(4, 2) not null default 0
    check (fal_rate in (0, 1, 2.5)),
  add column art_rate numeric(5, 2)
    check (art_rate between 0 and 100);

create table public.commerce_salary_scales (
  rule_version text not null,
  cct_code text not null,
  payment_year integer not null,
  payment_month integer not null check (payment_month between 1 and 12),
  basic_salary numeric(18, 2) not null check (basic_salary > 0),
  nonremunerative_sum numeric(18, 2) not null default 0,
  one_time_nonremunerative numeric(18, 2) not null default 0,
  source_url text not null,
  primary key (rule_version, cct_code, payment_year, payment_month)
);

insert into public.commerce_salary_scales
  (rule_version, cct_code, payment_year, payment_month, basic_salary, nonremunerative_sum, one_time_nonremunerative, source_url)
select 'FAECYS-ACU-10-2026', c.cct_code, y.payment_year, y.payment_month,
       c.november_basic + (y.month_index * 20000),
       case y.month_index when 0 then 120000 when 1 then 100000 when 2 then 80000
            when 3 then 60000 when 4 then 40000 when 5 then 20000 else 0 end,
       case when y.payment_month = 11 and y.payment_year = 2026 then 25000 else 0 end,
       'https://www.faecys.org.ar/faecys/wp-content/uploads/2026/10/CIRCULAR-ESCALAS-ACUERDO-OCTUBRE-2026-CCT-130.pdf'
from (values
  ('Maestranza A',1233448::numeric), ('Maestranza B',1236969), ('Maestranza C',1249305),
  ('Administrativo A',1246664), ('Administrativo B',1251955), ('Administrativo C',1257240),
  ('Administrativo D',1273103), ('Administrativo E',1286320), ('Administrativo F',1305707),
  ('Cajero A',1251069), ('Cajero B',1257240), ('Cajero C',1265171),
  ('Auxiliar A',1251069), ('Auxiliar B',1259881), ('Auxiliar C',1288963),
  ('Auxiliar especializado A',1261647), ('Auxiliar especializado B',1277508),
  ('Vendedor A',1251067), ('Vendedor B',1277511), ('Vendedor C',1286320), ('Vendedor D',1305707)
) as c(cct_code, november_basic)
cross join (values (2026,11,0),(2026,12,1),(2027,1,2),(2027,2,3),(2027,3,4),(2027,4,5),(2027,5,6)) as y(payment_year,payment_month,month_index);

alter table public.commerce_salary_scales enable row level security;
create policy "authenticated members can read commerce salary scales"
  on public.commerce_salary_scales for select to authenticated using (true);
grant select on public.commerce_salary_scales to authenticated;
revoke insert, update, delete on public.commerce_salary_scales from authenticated, anon;

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
  actor_id uuid := (select auth.uid());
  missing_profile integer;
  effective_fal_rate numeric(4, 2);
begin
  if target_year not between 2000 and 2100 or target_month not between 1 and 12 then
    raise exception 'Invalid payroll period';
  end if;
  select * into company_row from public.companies c
  where c.id = target_company_id for share;
  if not found or not company_row.active or company_row.service_type not in ('payroll', 'both') then
    raise exception 'Company is not active or enabled for payroll';
  end if;
  if company_row.arca_employer_rate is null or company_row.art_rate is null
     or company_row.fal_rate > company_row.arca_employer_rate then
    raise exception 'Employer ARCA, FAL and ART rates must be configured';
  end if;
  effective_fal_rate := case when target_year > 2026 or (target_year = 2026 and target_month >= 12)
    then company_row.fal_rate else 0 end;
  select count(*) into missing_profile
  from public.employees e
  where e.company_id = company_row.id and e.studio_id = company_row.studio_id and e.active
    and (e.cct_code is null or e.weekly_hours is null or e.seniority_years is null
      or not exists (select 1 from public.commerce_salary_scales sc
        where sc.rule_version = 'FAECYS-ACU-10-2026' and sc.cct_code = e.cct_code
          and sc.payment_year = target_year and sc.payment_month = target_month));
  if missing_profile > 0 then
    raise exception 'Commerce scale unavailable or employee profile incomplete for this period';
  end if;
  insert into public.payroll_periods (
    studio_id, company_id, payment_year, payment_month, payment_date, payment_location,
    social_contributions_payment_date, social_contributions_payment_location, created_by
  ) values (
    company_row.studio_id, company_row.id, target_year, target_month, target_payment_date,
    nullif(trim(target_payment_location), ''), target_social_contributions_payment_date,
    nullif(trim(target_social_contributions_payment_location), ''), actor_id
  ) returning id into new_period_id;
  insert into public.payroll_slips (
    studio_id, company_id, period_id, employee_id, company_snapshot, employee_snapshot, created_by
  )
  select e.studio_id, e.company_id, new_period_id, e.id,
    jsonb_build_object('legal_name', company_row.legal_name, 'tax_id', company_row.tax_id, 'address', company_row.address),
    jsonb_build_object(
      'full_name', e.full_name, 'cuil', e.cuil, 'category', e.category,
      'start_date', e.start_date,
      'cct_code', e.cct_code, 'weekly_hours', e.weekly_hours,
      'seniority_years', e.seniority_years, 'presentismo_eligible', e.presentismo_eligible,
      'union_rate', e.union_rate, 'solidarity_rate', e.solidarity_rate,
      'rifl_eligible', e.rifl_eligible,
      'payroll_rule_version', 'FAECYS-ACU-10-2026'
    ), actor_id
  from public.employees e
  where e.company_id = company_row.id and e.studio_id = company_row.studio_id and e.active;
  get diagnostics inserted_slips = row_count;
  if inserted_slips = 0 then raise exception 'No active employees for this period'; end if;

  -- The FAECYS scale applies a 1% seniority supplement to remunerative and
  -- recurring non-remunerative concepts, excluding the one-time sum.
  -- Art. 40 presentismo is 1/12 of monthly pay and is only enabled by the
  -- employee-period attendance confirmation stored in presentismo_eligible.
  insert into public.payroll_items (
    studio_id, slip_id, item_type, cost_category, description, calculation_base,
    unit, amount, calculation_note, rule_version, sort_order, created_by
  )
  select s.studio_id, s.id, x.item_type, null, x.description, x.calculation_base,
         'ARS', x.amount, x.calculation_note, 'FAECYS-ACU-10-2026 / CCT-130-75', x.sort_order, actor_id
  from public.payroll_slips s
  join public.employees e on e.id = s.employee_id and e.company_id = s.company_id
  join public.commerce_salary_scales sc on sc.rule_version = 'FAECYS-ACU-10-2026'
    and sc.cct_code = e.cct_code and sc.payment_year = target_year and sc.payment_month = target_month
  cross join lateral (
    select round(sc.basic_salary * e.weekly_hours / 48, 2) as basic,
           round(sc.nonremunerative_sum * e.weekly_hours / 48, 2) as nonrem,
           round(sc.one_time_nonremunerative * e.weekly_hours / 48, 2) as one_time
  ) b
  cross join lateral (
    select round(b.basic * e.seniority_years / 100, 2) as seniority,
           round(b.nonrem * e.seniority_years / 100, 2) as seniority_nonrem
  ) a
  cross join lateral (
    select case when e.presentismo_eligible then round((b.basic + a.seniority) / 12, 2) else 0 end as presentismo,
           case when e.presentismo_eligible then round((b.nonrem + a.seniority_nonrem) / 12, 2) else 0 end as presentismo_nonrem
  ) p
  cross join lateral (values
    ('remuneration'::public.payroll_item_type, 'Sueldo básico CCT 130/75', b.basic, b.basic,
      'Escala FAECYS para categoría y período; prorrateada por jornada semanal.', 10),
    ('remuneration'::public.payroll_item_type, 'Antigüedad (1%)', b.basic, a.seniority,
      '1% por año reconocido aplicado al básico de escala.', 20),
    ('remuneration'::public.payroll_item_type, 'Presentismo Art. 40 CCT 130/75', b.basic + a.seniority, p.presentismo,
      '1/12 de la remuneración remunerativa mensual; sujeto a asistencia informada.', 30),
    ('remuneration'::public.payroll_item_type, 'Suma no remunerativa FAECYS', b.nonrem, b.nonrem,
      'Importe mensual del Acuerdo 10/2026 prorrateado por jornada.', 40),
    ('remuneration'::public.payroll_item_type, 'Antigüedad sobre suma no remunerativa (1%)', b.nonrem, a.seniority_nonrem,
      '1% por año reconocido sobre suma no remunerativa periódica.', 50),
    ('remuneration'::public.payroll_item_type, 'Presentismo sobre suma no remunerativa', b.nonrem + a.seniority_nonrem, p.presentismo_nonrem,
      '1/12 sobre suma no remunerativa periódica según Acuerdo 10/2026.', 60),
    ('remuneration'::public.payroll_item_type, 'Suma no remunerativa única Acuerdo 10/2026', b.one_time, b.one_time,
      'Suma única prorrateada por jornada; excluida de antigüedad y presentismo.', 70)
  ) as x(item_type,description,calculation_base,amount,calculation_note,sort_order)
  where s.period_id = new_period_id and (x.amount > 0 or x.sort_order <= 30);

  -- Union and solidarity deductions are percentages supplied in each employee profile.
  insert into public.payroll_items (
    studio_id, slip_id, item_type, cost_category, description, calculation_base,
    unit, amount, calculation_note, rule_version, sort_order, created_by
  )
  select s.studio_id, s.id, 'deduction', null, d.description, d.base,
         'ARS', round(d.base * d.rate / 100, 2),
         'Porcentaje configurable en el legajo; verificar alcance y base con el estudio.',
         'FAECYS-ACU-10-2026 / porcentaje del legajo', d.sort_order, actor_id
  from public.payroll_slips s
  join public.employees e on e.id = s.employee_id and e.company_id = s.company_id
  join public.commerce_salary_scales sc on sc.rule_version = 'FAECYS-ACU-10-2026'
    and sc.cct_code = e.cct_code and sc.payment_year = target_year and sc.payment_month = target_month
  cross join lateral (
    select round((sc.basic_salary + sc.nonremunerative_sum)
      * e.weekly_hours / 48 * (1 + e.seniority_years / 100.0) + sc.one_time_nonremunerative * e.weekly_hours / 48
      + case when e.presentismo_eligible then (sc.basic_salary + sc.nonremunerative_sum)
        * e.weekly_hours / 48 * (1 + e.seniority_years / 100.0) / 12 else 0 end, 2) as total_base
  ) b
  cross join lateral (values
    ('Aporte sindical', b.total_base, e.union_rate, 80),
    ('Promoción social / cuota solidaria', b.total_base, e.solidarity_rate, 90)
  ) d(description,base,rate,sort_order)
  where s.period_id = new_period_id and d.rate > 0;

  -- Standard personal contributions: retirement and INSSJP on remunerative pay;
  -- OSECAC on remuneration and the agreement's non-remunerative concepts.
  insert into public.payroll_items (
    studio_id, slip_id, item_type, cost_category, description, calculation_base,
    unit, amount, calculation_note, rule_version, sort_order, created_by
  )
  select s.studio_id, s.id, 'deduction', null, d.description, d.base,
         'ARS', round(d.base * d.rate / 100, 2),
         'Porcentaje de referencia sobre base calculada; topes y situaciones particulares requieren validación.',
         'CCT-130-75 / draft-2026-11', d.sort_order, actor_id
  from public.payroll_slips s
  join public.employees e on e.id = s.employee_id and e.company_id = s.company_id
  join public.commerce_salary_scales sc on sc.rule_version = 'FAECYS-ACU-10-2026'
    and sc.cct_code = e.cct_code and sc.payment_year = target_year and sc.payment_month = target_month
  cross join lateral (
    select round(sc.basic_salary * e.weekly_hours / 48
      * (1 + e.seniority_years / 100.0) * (13.0 / 12.0), 2) as remunerative_base,
      round((sc.nonremunerative_sum * e.weekly_hours / 48
      * (1 + e.seniority_years / 100.0) * (13.0 / 12.0))
      + sc.one_time_nonremunerative * e.weekly_hours / 48, 2) as nonremunerative_base
  ) b
  cross join lateral (values
    ('Jubilación', b.remunerative_base, 11.0::numeric, 100),
    ('INSSJP', b.remunerative_base, 3.0::numeric, 110),
    ('Obra social OSECAC', b.remunerative_base + b.nonremunerative_base, 3.0::numeric, 120)
  ) d(description,base,rate,sort_order)
  where s.period_id = new_period_id;

  -- Employer costs shown in the chart: ARCA rate split net of FAL, FAL as a
  -- separate line, ART by company rate, and the employer health contribution.
  insert into public.payroll_items (
    studio_id, slip_id, item_type, cost_category, description, calculation_base,
    unit, amount, calculation_note, rule_version, sort_order, created_by
  )
  select s.studio_id, s.id, 'employer_contribution', d.category, d.description, d.base,
         'ARS', round(d.base * d.rate / 100, 2), d.note,
         'ARCA-2026-11 / FAECYS-ACU-10-2026', d.sort_order, actor_id
  from public.payroll_slips s
  join public.employees e on e.id = s.employee_id and e.company_id = s.company_id
  join public.commerce_salary_scales sc on sc.rule_version = 'FAECYS-ACU-10-2026'
    and sc.cct_code = e.cct_code and sc.payment_year = target_year and sc.payment_month = target_month
  cross join lateral (
    select round(sc.basic_salary * e.weekly_hours / 48
      * (1 + e.seniority_years / 100.0) * (13.0 / 12.0), 2) as remunerative_base,
      round((sc.nonremunerative_sum * e.weekly_hours / 48
      * (1 + e.seniority_years / 100.0) * (13.0 / 12.0))
      + sc.one_time_nonremunerative * e.weekly_hours / 48, 2) as nonremunerative_base
  ) b
  cross join lateral (
    select e.rifl_eligible
      and e.start_date between date '2026-05-01' and date '2027-04-30'
      and make_date(target_year,target_month,1) < (e.start_date + interval '48 months') as rifl_active
  ) r
  cross join lateral (values
    ('seguridad_social'::public.employer_cost_category, 'Contribuciones patronales ARCA', b.remunerative_base,
      case when r.rifl_active then 2.0 else company_row.arca_employer_rate - effective_fal_rate end,
      'Alícuota ARCA agregada neta del FAL; la distribución por subsistema requiere el detalle F.931.', 100),
    ('inssjp'::public.employer_cost_category, 'Contribución patronal INSSJP', b.remunerative_base,
      case when r.rifl_active then 3.0 else 0.0 end,
      'RIFL: alícuota específica del 3%; fuera de RIFL se incluye en el total agregado ARCA.', 105),
    ('otros'::public.employer_cost_category, 'Fondo de Asistencia Laboral (FAL)', b.remunerative_base,
      case when target_year = 2026 and target_month < 12 then 0
        when r.rifl_active then company_row.fal_rate else effective_fal_rate end,
      'Alícuota FAL según caracterización; sin reducción sobre ARCA durante RIFL.', 110),
    ('obra_social'::public.employer_cost_category, 'Contribución patronal obra social', b.remunerative_base + b.nonremunerative_base,
      6.0::numeric, 'Tasa general estimada; revisar base y acuerdos aplicables.', 120),
    ('art'::public.employer_cost_category, 'ART', b.remunerative_base,
      company_row.art_rate, 'Alícuota ART configurada por empresa.', 130)
  ) d(category,description,base,rate,note,sort_order)
  where s.period_id = new_period_id and d.rate > 0;
  return new_period_id;
end;
$$;

revoke all on function public.create_payroll_drafts(uuid, integer, integer, date, text, date, text) from public, anon;
grant execute on function public.create_payroll_drafts(uuid, integer, integer, date, text, date, text) to authenticated;
