create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type public.app_role as enum ('OWNER', 'TEACHER');
create type public.student_status as enum ('active', 'transferred', 'graduated', 'inactive');
create type public.academic_term as enum ('TERM_1', 'TERM_2', 'TERM_3');

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'public.student_status'::regtype
      and enumlabel = 'inactive'
  ) then
    alter type public.student_status add value 'inactive';
  end if;
end;
$$;

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
  capacity integer,
  level_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(name, section)
);

create unique index if not exists classes_name_idx on public.classes(name);
create unique index if not exists classes_level_order_idx on public.classes(level_order);

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

create table if not exists public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  status public.student_status not null,
  from_class_id uuid references public.classes(id) on delete set null,
  to_class_id uuid references public.classes(id) on delete set null,
  enrolled_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles(id),
  notes text
);

create table if not exists public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  academic_year text not null,
  term public.academic_term not null,
  expected_amount numeric(12,2) not null check (expected_amount >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(class_id, academic_year, term)
);

create table if not exists public.student_fee_accounts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  fee_structure_id uuid not null references public.fee_structures(id) on delete cascade,
  expected_amount numeric(12,2) not null check (expected_amount >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique(student_id, fee_structure_id)
);

create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  student_fee_account_id uuid not null references public.student_fee_accounts(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  receipt_number text not null unique,
  payment_date timestamptz not null default timezone('utc', now()),
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
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
  elsif tg_table_name = 'marks' then
    new.updated_by := auth.uid();
  elsif tg_table_name = 'fee_payments' and new.recorded_by is null then
    new.recorded_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.create_student_fee_accounts_for_student()
returns trigger
language plpgsql
as $$
begin
  if new.class_id is not null and new.status = 'active' then
    if tg_op = 'INSERT' or new.class_id is distinct from old.class_id or new.status is distinct from old.status then
      insert into public.student_fee_accounts(student_id, fee_structure_id, expected_amount, created_at)
      select new.id, fs.id, fs.expected_amount, timezone('utc', now())
      from public.fee_structures fs
      where fs.class_id = new.class_id
        and not exists (
          select 1 from public.student_fee_accounts a
          where a.student_id = new.id and a.fee_structure_id = fs.id
        );
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.create_student_fee_accounts_for_fee_structure()
returns trigger
language plpgsql
as $$
begin
  insert into public.student_fee_accounts(student_id, fee_structure_id, expected_amount, created_at)
  select s.id, new.id, new.expected_amount, timezone('utc', now())
  from public.students s
  where s.class_id = new.class_id
    and s.status = 'active'
    and not exists (
      select 1 from public.student_fee_accounts a
      where a.student_id = s.id and a.fee_structure_id = new.id
    );
  return new;
end;
$$;

create or replace function public.sync_fee_accounts_for_fee_structure_update()
returns trigger
language plpgsql
as $$
begin
  if new.expected_amount is distinct from old.expected_amount then
    update public.student_fee_accounts
    set expected_amount = new.expected_amount
    where fee_structure_id = new.id;
  end if;
  return new;
end;
$$;

create or replace function public.record_student_enrollment()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.student_enrollments(student_id, class_id, status, from_class_id, to_class_id, enrolled_at, created_by)
    values (new.id, new.class_id, new.status, null, new.class_id, timezone('utc', now()), auth.uid());
  elsif tg_op = 'UPDATE' then
    if new.class_id is distinct from old.class_id or new.status is distinct from old.status then
      insert into public.student_enrollments(student_id, class_id, status, from_class_id, to_class_id, enrolled_at, created_by)
      values (new.id, new.class_id, new.status, old.class_id, new.class_id, timezone('utc', now()), auth.uid());
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.promote_students(current_class_id uuid, student_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_class record;
  next_class record;
  eligible_count int;
  expected_count int;
begin
  expected_count := coalesce(array_length(student_ids, 1), 0);
  if expected_count = 0 then
    raise exception 'No students selected for promotion.';
  end if;

  select id, level_order into current_class
  from public.classes
  where id = current_class_id;

  if not found then
    raise exception 'Current class not found.';
  end if;

  select id into next_class
  from public.classes
  where level_order = current_class.level_order + 1
  order by id
  limit 1;

  select count(*) into eligible_count
  from public.students
  where id = any(student_ids)
    and class_id = current_class_id
    and status = 'active';

  if eligible_count <> expected_count then
    raise exception 'One or more selected students are not eligible for this promotion.';
  end if;

  if next_class.id is null then
    update public.students
    set status = 'graduated'
    where id = any(student_ids)
      and class_id = current_class_id
      and status = 'active';
  else
    update public.students
    set class_id = next_class.id
    where id = any(student_ids)
      and class_id = current_class_id
      and status = 'active';
  end if;
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

drop trigger if exists marks_set_user on public.marks;
create trigger marks_set_user
before insert or update on public.marks
for each row execute procedure public.set_current_user_columns();

drop trigger if exists fee_payments_set_user on public.fee_payments;
create trigger fee_payments_set_user
before insert on public.fee_payments
for each row execute procedure public.set_current_user_columns();

drop trigger if exists student_fee_accounts_for_student on public.students;
create trigger student_fee_accounts_for_student
after insert or update on public.students
for each row execute procedure public.create_student_fee_accounts_for_student();

drop trigger if exists student_enrollment_record on public.students;
create trigger student_enrollment_record
after insert or update on public.students
for each row execute procedure public.record_student_enrollment();

drop trigger if exists fee_structure_account_creation on public.fee_structures;
create trigger fee_structure_account_creation
after insert on public.fee_structures
for each row execute procedure public.create_student_fee_accounts_for_fee_structure();

drop trigger if exists fee_structure_update_sync on public.fee_structures;
create trigger fee_structure_update_sync
after update on public.fee_structures
for each row execute procedure public.sync_fee_accounts_for_fee_structure_update();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute procedure public.touch_updated_at();
drop trigger if exists classes_touch on public.classes;
create trigger classes_touch before update on public.classes for each row execute procedure public.touch_updated_at();
drop trigger if exists students_touch on public.students;
create trigger students_touch before update on public.students for each row execute procedure public.touch_updated_at();
drop trigger if exists marks_touch on public.marks;
create trigger marks_touch before update on public.marks for each row execute procedure public.touch_updated_at();
drop trigger if exists fee_payments_touch on public.fee_payments;
create trigger fee_payments_touch before update on public.fee_payments for each row execute procedure public.touch_updated_at();

drop trigger if exists student_fee_accounts_touch on public.student_fee_accounts;
create trigger student_fee_accounts_touch before update on public.student_fee_accounts for each row execute procedure public.touch_updated_at();

drop trigger if exists marks_audit on public.marks;
create trigger marks_audit after insert or update or delete on public.marks for each row execute procedure public.write_audit_log();

create index if not exists students_admission_number_idx on public.students(admission_number);
create index if not exists students_full_name_trgm_idx on public.students using gin(full_name gin_trgm_ops);
create index if not exists students_class_id_idx on public.students(class_id);
create index if not exists marks_student_term_idx on public.marks(student_id, term);
create index if not exists marks_subject_term_idx on public.marks(subject_id, term);
create index if not exists teacher_assignments_teacher_idx on public.teacher_class_assignments(teacher_id, class_id);

DO $$
begin
  insert into public.classes (name, level_order, created_at, updated_at)
  values
    ('Playgroup', 0, timezone('utc', now()), timezone('utc', now())),
    ('PP1', 1, timezone('utc', now()), timezone('utc', now())),
    ('PP2', 2, timezone('utc', now()), timezone('utc', now())),
    ('Grade 1', 3, timezone('utc', now()), timezone('utc', now())),
    ('Grade 2', 4, timezone('utc', now()), timezone('utc', now())),
    ('Grade 3', 5, timezone('utc', now()), timezone('utc', now())),
    ('Grade 4', 6, timezone('utc', now()), timezone('utc', now())),
    ('Grade 5', 7, timezone('utc', now()), timezone('utc', now())),
    ('Grade 6', 8, timezone('utc', now()), timezone('utc', now())),
    ('Grade 7', 9, timezone('utc', now()), timezone('utc', now())),
    ('Grade 8', 10, timezone('utc', now()), timezone('utc', now())),
    ('Grade 9', 11, timezone('utc', now()), timezone('utc', now()))
  on conflict (name) do update
    set level_order = excluded.level_order,
        updated_at = timezone('utc', now());
end;
$$;

create index if not exists fee_structures_class_term_idx on public.fee_structures(class_id, academic_year, term);
create index if not exists student_fee_accounts_student_idx on public.student_fee_accounts(student_id);
create index if not exists student_fee_accounts_fee_structure_idx on public.student_fee_accounts(fee_structure_id);
create index if not exists fee_payments_account_idx on public.fee_payments(student_fee_account_id);
create index if not exists fee_payments_receipt_idx on public.fee_payments(receipt_number);

create or replace view public.fee_structure_overview as
select
  fs.id,
  fs.class_id,
  c.name as class_name,
  fs.academic_year,
  fs.term,
  fs.expected_amount,
  count(distinct sfa.id)::int as account_count,
  coalesce(sum(fp.amount), 0) as total_collected,
  coalesce(count(distinct sfa.id) * fs.expected_amount - sum(fp.amount), 0) as total_outstanding
from public.fee_structures fs
left join public.student_fee_accounts sfa on sfa.fee_structure_id = fs.id
left join public.fee_payments fp on fp.student_fee_account_id = sfa.id
join public.classes c on c.id = fs.class_id
group by fs.id, c.name;

create or replace view public.student_fee_accounts_overview as
select
  sfa.id,
  sfa.student_id,
  sfa.fee_structure_id,
  fs.academic_year,
  fs.term,
  c.name as class_name,
  sfa.expected_amount,
  coalesce(sum(fp.amount), 0) as total_paid,
  sfa.expected_amount - coalesce(sum(fp.amount), 0) as balance,
  case
    when coalesce(sum(fp.amount), 0) >= sfa.expected_amount then 'Cleared'
    when coalesce(sum(fp.amount), 0) > 0 then 'Partial'
    else 'Not Paid'
  end as status
from public.student_fee_accounts sfa
join public.fee_structures fs on fs.id = sfa.fee_structure_id
join public.classes c on c.id = fs.class_id
left join public.fee_payments fp on fp.student_fee_account_id = sfa.id
group by sfa.id, fs.academic_year, fs.term, c.name, sfa.expected_amount;

create or replace view public.fee_payment_history as
select
  fp.id,
  fp.student_fee_account_id,
  sfa.student_id,
  fp.amount,
  fp.receipt_number,
  fp.payment_date,
  fp.recorded_by,
  fs.academic_year,
  fs.term,
  c.name as class_name
from public.fee_payments fp
join public.student_fee_accounts sfa on sfa.id = fp.student_fee_account_id
join public.fee_structures fs on fs.id = sfa.fee_structure_id
join public.classes c on c.id = fs.class_id;

create or replace view public.fee_dashboard_overview as
select
  coalesce((select sum(expected_amount) from public.student_fee_accounts), 0) as total_expected,
  coalesce((select sum(amount) from public.fee_payments), 0) as total_collected,
  coalesce((select sum(sfa.expected_amount) - sum(coalesce(fp.amount, 0)) from public.student_fee_accounts sfa left join public.fee_payments fp on fp.student_fee_account_id = sfa.id), 0) as total_outstanding,
  coalesce((select count(*) from (
    select sfa.id
    from public.student_fee_accounts sfa
    left join public.fee_payments fp on fp.student_fee_account_id = sfa.id
    group by sfa.id
    having coalesce(sum(fp.amount), 0) < sfa.expected_amount
  ) x), 0) as students_with_balance;

alter table public.fee_structures enable row level security;
alter table public.student_fee_accounts enable row level security;
alter table public.fee_payments enable row level security;

create policy owner_full_access_on_fee_structures
  on public.fee_structures
  for all
  using (public.is_owner())
  with check (public.is_owner());

create policy owner_full_access_on_student_fee_accounts
  on public.student_fee_accounts
  for all
  using (public.is_owner())
  with check (public.is_owner());

create policy owner_full_access_on_fee_payments
  on public.fee_payments
  for all
  using (public.is_owner())
  with check (public.is_owner());

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

create or replace function public.teacher_can_access_student_enrollment(target_student_id uuid)
returns boolean
language sql
stable
as $$
  select public.can_access_student(target_student_id)
$$;

create or replace view public.student_promotion_history as
select
  se.id,
  se.student_id,
  se.enrolled_at as promoted_at,
  se.status,
  se.from_class_id,
  fc.name as from_class_name,
  se.to_class_id,
  tc.name as to_class_name,
  se.created_by as promoted_by,
  se.notes
from public.student_enrollments se
left join public.classes fc on fc.id = se.from_class_id
left join public.classes tc on tc.id = se.to_class_id
where se.from_class_id is not null or se.status <> 'active';

create or replace view public.promotion_log_overview as
select
  se.id,
  se.student_id,
  s.full_name,
  se.enrolled_at as promoted_at,
  fc.name as from_class_name,
  tc.name as to_class_name,
  p.full_name as promoted_by,
  se.status
from public.student_enrollments se
join public.students s on s.id = se.student_id
left join public.classes fc on fc.id = se.from_class_id
left join public.classes tc on tc.id = se.to_class_id
left join public.profiles p on p.id = se.created_by
where se.from_class_id is not null or se.status <> 'active'
order by se.enrolled_at desc;

alter table public.students enable row level security;
alter table public.student_enrollments enable row level security;

create policy owner_full_access_on_students
  on public.students
  for all
  using (public.is_owner())
  with check (public.is_owner());

create policy teacher_select_students
  on public.students
  for select
  using (public.can_access_student(id));

create policy teacher_insert_students
  on public.students
  for insert
  with check (public.is_owner() or public.teacher_has_class(new.class_id));

create policy teacher_update_students
  on public.students
  for update
  using (public.is_owner() or public.teacher_has_class(old.class_id))
  with check (public.is_owner() or public.teacher_has_class(new.class_id));

create policy owner_delete_students
  on public.students
  for delete
  using (public.is_owner());

create policy owner_full_access_on_student_enrollments
  on public.student_enrollments
  for all
  using (public.is_owner())
  with check (public.is_owner());

create policy teacher_select_student_enrollments
  on public.student_enrollments
  for select
  using (public.teacher_can_access_student_enrollment(student_id));

create policy teacher_modify_student_enrollments
  on public.student_enrollments
  for insert, update
  with check (public.is_owner() or public.teacher_can_access_student_enrollment(student_id));

create or replace view public.class_overview as
select
  c.id,
  c.name,
  c.capacity,
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
  dense_rank() over (partition by a.class_id, a.term order by a.total_score desc, a.average_score desc) as position_in_class,
  dense_rank() over (partition by a.term order by a.total_score desc, a.average_score desc) as overall_position
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
grant select on public.academic_marks_view to authenticated;
grant select on public.student_term_totals to authenticated;
grant select on public.term_merit_list to authenticated;
grant select on public.overall_merit_list to authenticated;
grant select on public.subject_performance_summary to authenticated;

insert into public.subjects (name)
values ('English'), ('Mathematics'), ('Science'), ('Social Studies'), ('ICT')
on conflict (name) do nothing;
