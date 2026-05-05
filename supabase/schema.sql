create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type public.app_role as enum ('OWNER', 'TEACHER');
create type public.student_status as enum ('active', 'transferred', 'graduated');
create type public.academic_term as enum ('TERM_1', 'TERM_2', 'TERM_3');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'TEACHER',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  section text,
  level_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(name, section)
);

create table if not exists public.teacher_class_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique(teacher_id, class_id)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create sequence if not exists public.admission_number_seq start 1001;

create or replace function public.generate_admission_number()
returns text
language plpgsql
as $$
declare
  next_number bigint;
begin
  next_number := nextval('public.admission_number_seq');
  return 'ADM-' || lpad(next_number::text, 6, '0');
end;
$$;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  admission_number text not null unique default public.generate_admission_number(),
  class_id uuid references public.classes(id) on delete set null,
  parent_contact text,
  status public.student_status not null default 'active',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.student_fee_ledgers (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  session_label text not null,
  total_fee numeric(12,2) not null check (total_fee >= 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(student_id, session_label)
);

create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  fee_ledger_id uuid not null references public.student_fee_ledgers(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.marks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  term public.academic_term not null,
  score numeric(5,2) not null check (score >= 0),
  max_score numeric(5,2) not null default 100 check (max_score > 0),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(student_id, subject_id, term)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  action text not null,
  changed_by uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_current_user_columns()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'students' and new.created_by is null then
    new.created_by := auth.uid();
  elsif tg_table_name = 'student_fee_ledgers' and new.created_by is null then
    new.created_by := auth.uid();
  elsif tg_table_name = 'fee_payments' and new.recorded_by is null then
    new.recorded_by := auth.uid();
  elsif tg_table_name = 'marks' then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs(table_name, record_id, action, changed_by, before_data, after_data)
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    tg_op,
    auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'TEACHER')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop trigger if exists students_set_user on public.students;
create trigger students_set_user
before insert on public.students
for each row execute procedure public.set_current_user_columns();

drop trigger if exists ledgers_set_user on public.student_fee_ledgers;
create trigger ledgers_set_user
before insert on public.student_fee_ledgers
for each row execute procedure public.set_current_user_columns();

drop trigger if exists payments_set_user on public.fee_payments;
create trigger payments_set_user
before insert on public.fee_payments
for each row execute procedure public.set_current_user_columns();

drop trigger if exists marks_set_user on public.marks;
create trigger marks_set_user
before insert or update on public.marks
for each row execute procedure public.set_current_user_columns();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute procedure public.touch_updated_at();
drop trigger if exists classes_touch on public.classes;
create trigger classes_touch before update on public.classes for each row execute procedure public.touch_updated_at();
drop trigger if exists students_touch on public.students;
create trigger students_touch before update on public.students for each row execute procedure public.touch_updated_at();
drop trigger if exists ledgers_touch on public.student_fee_ledgers;
create trigger ledgers_touch before update on public.student_fee_ledgers for each row execute procedure public.touch_updated_at();
drop trigger if exists marks_touch on public.marks;
create trigger marks_touch before update on public.marks for each row execute procedure public.touch_updated_at();

drop trigger if exists marks_audit on public.marks;
create trigger marks_audit after insert or update or delete on public.marks for each row execute procedure public.write_audit_log();
drop trigger if exists payments_audit on public.fee_payments;
create trigger payments_audit after insert or update or delete on public.fee_payments for each row execute procedure public.write_audit_log();
drop trigger if exists ledgers_audit on public.student_fee_ledgers;
create trigger ledgers_audit after insert or update or delete on public.student_fee_ledgers for each row execute procedure public.write_audit_log();

create index if not exists students_admission_number_idx on public.students(admission_number);
create index if not exists students_full_name_trgm_idx on public.students using gin(full_name gin_trgm_ops);
create index if not exists students_class_id_idx on public.students(class_id);
create index if not exists marks_student_term_idx on public.marks(student_id, term);
create index if not exists marks_subject_term_idx on public.marks(subject_id, term);
create index if not exists ledgers_student_idx on public.student_fee_ledgers(student_id);
create index if not exists payments_ledger_date_idx on public.fee_payments(fee_ledger_id, payment_date desc);
create index if not exists teacher_assignments_teacher_idx on public.teacher_class_assignments(teacher_id, class_id);

create or replace function public.current_role()
returns public.app_role
language sql
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_role() = 'OWNER', false)
$$;

create or replace function public.teacher_has_class(target_class_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.teacher_class_assignments tca
    where tca.teacher_id = auth.uid() and tca.class_id = target_class_id
  )
$$;

create or replace function public.can_access_student(target_student_id uuid)
returns boolean
language sql
stable
as $$
  select public.is_owner() or exists (
    select 1
    from public.students s
    join public.teacher_class_assignments tca on tca.class_id = s.class_id
    where s.id = target_student_id and tca.teacher_id = auth.uid()
  )
$$;

create or replace view public.student_directory as
select
  s.id,
  s.full_name,
  s.admission_number,
  s.parent_contact,
  s.status,
  s.class_id,
  c.name as class_name
from public.students s
left join public.classes c on c.id = s.class_id;

create or replace view public.class_overview as
select
  c.id,
  c.name,
  c.section,
  c.level_order,
  count(distinct s.id)::int as student_count,
  count(distinct tca.teacher_id)::int as teacher_count
from public.classes c
left join public.students s on s.class_id = c.id and s.status = 'active'
left join public.teacher_class_assignments tca on tca.class_id = c.id
group by c.id;

create or replace view public.class_distribution as
select
  c.id as class_id,
  c.name as class_name,
  c.level_order,
  count(s.id)::int as student_count
from public.classes c
left join public.students s on s.class_id = c.id and s.status = 'active'
group by c.id;

create or replace view public.fee_balances as
with payments as (
  select fee_ledger_id, coalesce(sum(amount), 0)::numeric(12,2) as amount_paid
  from public.fee_payments
  group by fee_ledger_id
)
select
  l.id as ledger_id,
  s.id as student_id,
  s.full_name as student_name,
  s.admission_number,
  c.name as class_name,
  l.session_label,
  l.total_fee,
  coalesce(p.amount_paid, 0)::numeric(12,2) as amount_paid,
  (l.total_fee - coalesce(p.amount_paid, 0))::numeric(12,2) as balance,
  case
    when coalesce(p.amount_paid, 0) >= l.total_fee then 'paid'
    when coalesce(p.amount_paid, 0) = 0 then 'unpaid'
    else 'partial'
  end as fee_state
from public.student_fee_ledgers l
join public.students s on s.id = l.student_id
left join public.classes c on c.id = s.class_id
left join payments p on p.fee_ledger_id = l.id;

create or replace view public.fee_dashboard_summary as
select
  coalesce(sum(amount_paid), 0)::numeric(12,2) as total_collected,
  coalesce(sum(balance), 0)::numeric(12,2) as outstanding_balance
from public.fee_balances;

create or replace view public.payment_history_view as
select
  fp.id,
  l.student_id,
  fp.amount,
  fp.payment_date,
  fp.payment_method,
  l.session_label,
  p.full_name as recorded_by_name
from public.fee_payments fp
join public.student_fee_ledgers l on l.id = fp.fee_ledger_id
left join public.profiles p on p.id = fp.recorded_by;

create or replace view public.academic_marks_view as
select
  m.id,
  m.student_id,
  m.term,
  m.score,
  m.max_score,
  sub.id as subject_id,
  sub.name as subject_name
from public.marks m
join public.subjects sub on sub.id = m.subject_id;

create or replace view public.student_term_totals as
with aggregated as (
  select
    s.id as student_id,
    s.class_id,
    m.term,
    sum(m.score)::numeric(12,2) as total_score,
    avg((m.score / nullif(m.max_score, 0)) * 100)::numeric(5,2) as average_score
  from public.students s
  join public.marks m on m.student_id = s.id
  group by s.id, s.class_id, m.term
)
select
  a.*,
  rank() over (partition by a.class_id, a.term order by a.total_score desc, a.average_score desc) as position_in_class,
  rank() over (partition by a.term order by a.total_score desc, a.average_score desc) as overall_position
from aggregated a;

create or replace view public.term_merit_list as
select
  stt.student_id,
  s.class_id,
  s.full_name,
  s.admission_number,
  c.name as class_name,
  stt.term,
  stt.total_score,
  stt.average_score,
  stt.position_in_class as position
from public.student_term_totals stt
join public.students s on s.id = stt.student_id
left join public.classes c on c.id = s.class_id;

create or replace view public.overall_merit_list as
with overall as (
  select
    s.id as student_id,
    s.full_name,
    s.class_id,
    avg(stt.average_score)::numeric(5,2) as average_score
  from public.students s
  join public.student_term_totals stt on stt.student_id = s.id
  group by s.id, s.full_name, s.class_id
)
select
  o.student_id,
  o.full_name,
  c.name as class_name,
  o.average_score
from overall o
left join public.classes c on c.id = o.class_id
order by o.average_score desc;

create or replace view public.subject_performance_summary as
select
  m.subject_id,
  sub.name as subject_name,
  s.class_id,
  m.term,
  avg((m.score / nullif(m.max_score, 0)) * 100)::numeric(5,2) as average_score
from public.marks m
join public.subjects sub on sub.id = m.subject_id
join public.students s on s.id = m.student_id
group by m.subject_id, sub.name, s.class_id, m.term;

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.teacher_class_assignments enable row level security;
alter table public.subjects enable row level security;
alter table public.students enable row level security;
alter table public.student_fee_ledgers enable row level security;
alter table public.fee_payments enable row level security;
alter table public.marks enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists profiles_select_own_or_owner on public.profiles;
create policy profiles_select_own_or_owner on public.profiles
for select using (id = auth.uid() or public.is_owner());

drop policy if exists profiles_update_own_or_owner on public.profiles;
create policy profiles_update_own_or_owner on public.profiles
for update using (id = auth.uid() or public.is_owner()) with check (id = auth.uid() or public.is_owner());

drop policy if exists classes_read_all on public.classes;
create policy classes_read_all on public.classes for select using (auth.role() = 'authenticated');

drop policy if exists classes_owner_write on public.classes;
create policy classes_owner_write on public.classes for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists teacher_assignments_read on public.teacher_class_assignments;
create policy teacher_assignments_read on public.teacher_class_assignments
for select using (teacher_id = auth.uid() or public.is_owner());

drop policy if exists teacher_assignments_owner_write on public.teacher_class_assignments;
create policy teacher_assignments_owner_write on public.teacher_class_assignments
for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists subjects_read_all on public.subjects;
create policy subjects_read_all on public.subjects for select using (auth.role() = 'authenticated');

drop policy if exists subjects_owner_write on public.subjects;
create policy subjects_owner_write on public.subjects for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists students_read_scoped on public.students;
create policy students_read_scoped on public.students
for select using (public.can_access_student(id));

drop policy if exists students_insert_scoped on public.students;
create policy students_insert_scoped on public.students
for insert with check (public.is_owner() or public.teacher_has_class(class_id));

drop policy if exists students_update_scoped on public.students;
create policy students_update_scoped on public.students
for update using (public.can_access_student(id)) with check (public.is_owner() or public.teacher_has_class(class_id));

drop policy if exists student_fees_read_scoped on public.student_fee_ledgers;
create policy student_fees_read_scoped on public.student_fee_ledgers
for select using (public.can_access_student(student_id));

drop policy if exists student_fees_owner_write on public.student_fee_ledgers;
create policy student_fees_owner_write on public.student_fee_ledgers
for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists fee_payments_read_scoped on public.fee_payments;
create policy fee_payments_read_scoped on public.fee_payments
for select using (
  exists (
    select 1 from public.student_fee_ledgers l
    where l.id = fee_ledger_id and public.can_access_student(l.student_id)
  )
);

drop policy if exists fee_payments_insert_scoped on public.fee_payments;
create policy fee_payments_insert_scoped on public.fee_payments
for insert with check (
  exists (
    select 1 from public.student_fee_ledgers l
    where l.id = fee_ledger_id and public.can_access_student(l.student_id)
  )
);

drop policy if exists fee_payments_update_owner on public.fee_payments;
create policy fee_payments_update_owner on public.fee_payments
for update using (public.is_owner()) with check (public.is_owner());

drop policy if exists marks_read_scoped on public.marks;
create policy marks_read_scoped on public.marks
for select using (public.can_access_student(student_id));

drop policy if exists marks_write_scoped on public.marks;
create policy marks_write_scoped on public.marks
for all using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

drop policy if exists audit_logs_owner_only on public.audit_logs;
create policy audit_logs_owner_only on public.audit_logs
for select using (public.is_owner());

grant select on public.student_directory to authenticated;
grant select on public.class_overview to authenticated;
grant select on public.class_distribution to authenticated;
grant select on public.fee_balances to authenticated;
grant select on public.fee_dashboard_summary to authenticated;
grant select on public.payment_history_view to authenticated;
grant select on public.academic_marks_view to authenticated;
grant select on public.student_term_totals to authenticated;
grant select on public.term_merit_list to authenticated;
grant select on public.overall_merit_list to authenticated;
grant select on public.subject_performance_summary to authenticated;

insert into public.subjects (name)
values ('English'), ('Mathematics'), ('Science'), ('Social Studies'), ('ICT')
on conflict (name) do nothing;
