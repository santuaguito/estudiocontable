create type public.studio_role as enum ('owner', 'accountant', 'assistant', 'viewer');
create type public.company_service as enum ('payroll', 'balance', 'both');

create or replace function public.argentine_identifier_check_digit(first_ten text)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  weights integer[] := array[5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  total integer := 0;
  result integer;
  idx integer;
begin
  if first_ten !~ '^[0-9]{10}$' then
    return -1;
  end if;
  for idx in 1..10 loop
    total := total + substr(first_ten, idx, 1)::integer * weights[idx];
  end loop;
  result := 11 - (total % 11);
  if result = 11 then return 0; end if;
  return result;
end;
$$;

create or replace function public.is_valid_argentine_identifier(identifier text, kind text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  prefix text;
  middle text;
  expected integer;
begin
  if identifier !~ '^[0-9]{11}$' or identifier = '00000000000' then
    return false;
  end if;

  prefix := left(identifier, 2);
  middle := substr(identifier, 3, 8);
  if kind = 'CUIT' then
    if prefix not in ('20', '23', '24', '27', '30', '33', '34') then return false; end if;
  elsif kind = 'CUIL' then
    if prefix not in ('20', '23', '24', '27') then return false; end if;
  else
    return false;
  end if;

  expected := public.argentine_identifier_check_digit(left(identifier, 10));
  if expected <> 10 then
    return right(identifier, 1)::integer = expected;
  end if;

  if prefix = '23' then
    return (
      public.argentine_identifier_check_digit('20' || middle) = 10
      and right(identifier, 1) = '9'
    ) or (
      public.argentine_identifier_check_digit('27' || middle) = 10
      and right(identifier, 1) = '4'
    );
  end if;
  if prefix = '33' then
    return public.argentine_identifier_check_digit('30' || middle) = 10
      and right(identifier, 1) = '9';
  end if;
  return false;
end;
$$;

create table public.studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.studio_members (
  studio_id uuid not null references public.studios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.studio_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (studio_id, user_id)
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete restrict,
  legal_name text not null check (length(trim(legal_name)) > 0),
  tax_id text not null check (public.is_valid_argentine_identifier(tax_id, 'CUIT')),
  address text not null check (length(trim(address)) > 0),
  service_type public.company_service not null,
  fiscal_year_end date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, tax_id),
  unique (id, studio_id),
  check (service_type = 'payroll' or fiscal_year_end is not null)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete restrict,
  company_id uuid not null,
  full_name text not null check (length(trim(full_name)) > 0),
  cuil text not null check (public.is_valid_argentine_identifier(cuil, 'CUIL')),
  category text not null check (length(trim(category)) > 0),
  start_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (company_id, studio_id)
    references public.companies(id, studio_id) on delete restrict,
  unique (company_id, cuil)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index studio_members_user_id_idx on public.studio_members(user_id);
create index companies_studio_active_idx on public.companies(studio_id, active);
create index employees_studio_company_idx on public.employees(studio_id, company_id, active);
create index audit_events_studio_created_idx on public.audit_events(studio_id, created_at desc);

create or replace function public.is_studio_member(target_studio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.studio_members sm
    where sm.studio_id = target_studio_id
      and sm.user_id = (select auth.uid())
  );
$$;

create or replace function public.create_studio_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_studio_id uuid;
  requested_name text;
begin
  requested_name := nullif(trim(new.raw_user_meta_data ->> 'studio_name'), '');
  insert into public.studios(name)
  values (coalesce(requested_name, split_part(coalesce(new.email, 'Estudio'), '@', 1) || ' · Estudio'))
  returning id into new_studio_id;

  insert into public.studio_members(studio_id, user_id, role)
  values (new_studio_id, new.id, 'owner');
  return new;
end;
$$;

create trigger on_auth_user_created_create_studio
  after insert on auth.users
  for each row execute procedure public.create_studio_for_new_user();

do $$
declare
  auth_user record;
  new_studio_id uuid;
  requested_name text;
begin
  for auth_user in
    select u.id, u.email, u.raw_user_meta_data
    from auth.users u
    where not exists (
      select 1 from public.studio_members sm where sm.user_id = u.id
    )
  loop
    requested_name := nullif(trim(auth_user.raw_user_meta_data ->> 'studio_name'), '');
    insert into public.studios(name)
    values (coalesce(requested_name, split_part(coalesce(auth_user.email, 'Estudio'), '@', 1) || ' · Estudio'))
    returning id into new_studio_id;

    insert into public.studio_members(studio_id, user_id, role)
    values (new_studio_id, auth_user.id, 'owner');
  end loop;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_studio_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.studio_id <> old.studio_id then
    raise exception 'Records cannot be moved between studios';
  end if;
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
begin
  if actor_id is null then
    raise exception 'Authenticated user required for audited changes';
  end if;
  insert into public.audit_events(studio_id, user_id, action, entity_type, entity_id)
  values (new.studio_id, actor_id, lower(tg_op), tg_table_name, new.id);
  return new;
end;
$$;

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute procedure public.set_updated_at();

create trigger employees_set_updated_at
  before update on public.employees
  for each row execute procedure public.set_updated_at();

create trigger companies_prevent_studio_change
  before update on public.companies
  for each row execute procedure public.prevent_studio_change();

create trigger employees_prevent_studio_change
  before update on public.employees
  for each row execute procedure public.prevent_studio_change();

create trigger companies_audit_changes
  after insert or update on public.companies
  for each row execute procedure public.record_audit_event();

create trigger employees_audit_changes
  after insert or update on public.employees
  for each row execute procedure public.record_audit_event();

alter table public.studios enable row level security;
alter table public.studio_members enable row level security;
alter table public.companies enable row level security;
alter table public.employees enable row level security;
alter table public.audit_events enable row level security;

create policy "members can read their studios"
  on public.studios for select to authenticated
  using (public.is_studio_member(id));

create policy "members can read their memberships"
  on public.studio_members for select to authenticated
  using (public.is_studio_member(studio_id));

create policy "members can read companies in their studios"
  on public.companies for select to authenticated
  using (public.is_studio_member(studio_id));

create policy "members can create companies in their studios"
  on public.companies for insert to authenticated
  with check (public.is_studio_member(studio_id));

create policy "members can update companies in their studios"
  on public.companies for update to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create policy "members can read employees in their studios"
  on public.employees for select to authenticated
  using (public.is_studio_member(studio_id));

create policy "members can create employees in their studios"
  on public.employees for insert to authenticated
  with check (public.is_studio_member(studio_id));

create policy "members can update employees in their studios"
  on public.employees for update to authenticated
  using (public.is_studio_member(studio_id))
  with check (public.is_studio_member(studio_id));

create policy "members can read audit events in their studios"
  on public.audit_events for select to authenticated
  using (public.is_studio_member(studio_id));

grant usage on schema public to authenticated;
revoke all on function public.is_studio_member(uuid) from public, anon;
revoke all on function public.argentine_identifier_check_digit(text) from public, anon;
revoke all on function public.is_valid_argentine_identifier(text, text) from public, anon;
grant execute on function public.is_studio_member(uuid) to authenticated;
grant execute on function public.argentine_identifier_check_digit(text) to authenticated;
grant execute on function public.is_valid_argentine_identifier(text, text) to authenticated;
grant select on public.studios, public.studio_members to authenticated;
grant select, insert, update on public.companies, public.employees to authenticated;
grant select on public.audit_events to authenticated;
