-- ============================================================================
-- School Portal - Supabase Database Migration
-- Run this in your Supabase SQL Editor to set up the complete schema
-- ============================================================================

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Types
create type if not exists public.app_role as enum ('OWNER', 'TEACHER');
create type if not exists public.student_status as enum ('active', 'transferred', 'graduated');

-- Tables

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'TEACHER',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  section text,
  level_order integer not null default 0,
  capacity integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(name, section)
);

CREATE TABLE IF NOT EXISTS public.teacher_class_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique(teacher_id, class_id)
);

-- Admission number sequence
CREATE SEQUENCE IF NOT EXISTS public.admission_number_seq start 1001;

CREATE OR REPLACE FUNCTION public.generate_admission_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_number bigint;
BEGIN
  next_number := nextval('public.admission_number_seq');
  RETURN 'ADM-' || lpad(next_number::text, 6, '0');
END;
$$;

-- Students table with extended fields
CREATE TABLE IF NOT EXISTS public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  admission_number text not null unique default public.generate_admission_number(),
  class_id uuid references public.classes(id) on delete set null,
  gender text,
  date_of_birth date,
  parent_name text,
  parent_phone text,
  alt_phone text,
  home_address text,
  date_joined date not null default CURRENT_DATE,
  profile_photo_url text,
  notes text,
  status public.student_status not null default 'active',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Promotion logs table
CREATE TABLE IF NOT EXISTS public.promotion_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  from_class_id uuid references public.classes(id) on delete set null,
  to_class_id uuid references public.classes(id) on delete set null,
  promoted_by uuid references public.profiles(id) on delete set null,
  promoted_at timestamptz not null default timezone('utc', now()),
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  action text not null,
  changed_by uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

-- Triggers and Functions

CREATE OR REPLACE FUNCTION public.set_current_user_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  if tg_table_name = 'students' and new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at := timezone('utc', now());
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs(table_name, record_id, action, changed_by, before_data, after_data)
  VALUES (
    tg_table_name,
    coalesce(new.id, old.id),
    tg_op,
    auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  RETURN coalesce(new, old);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles(id, full_name, role, is_active)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'TEACHER'),
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS students_set_user ON public.students;
DROP TRIGGER IF EXISTS profiles_touch ON public.profiles;
DROP TRIGGER IF EXISTS classes_touch ON public.classes;
DROP TRIGGER IF EXISTS students_touch ON public.students;
DROP TRIGGER IF EXISTS audit_logs_write ON public.students;

-- Create triggers
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE TRIGGER students_set_user
BEFORE INSERT ON public.students
FOR EACH ROW EXECUTE PROCEDURE public.set_current_user_columns();

CREATE TRIGGER profiles_touch
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE public.touch_updated_at();

CREATE TRIGGER classes_touch
BEFORE UPDATE ON public.classes
FOR EACH ROW EXECUTE PROCEDURE public.touch_updated_at();

CREATE TRIGGER students_touch
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE PROCEDURE public.touch_updated_at();

CREATE TRIGGER students_audit
AFTER INSERT OR UPDATE OR DELETE ON public.students
FOR EACH ROW EXECUTE PROCEDURE public.write_audit_log();

-- Views

CREATE OR REPLACE VIEW public.student_directory AS
SELECT
  s.id,
  s.full_name,
  s.admission_number,
  s.gender,
  s.date_of_birth,
  s.parent_name,
  s.parent_phone,
  s.alt_phone,
  s.home_address,
  s.date_joined,
  s.notes,
  s.profile_photo_url,
  s.status,
  s.class_id,
  c.name as class_name,
  s.created_at
FROM public.students s
LEFT JOIN public.classes c ON c.id = s.class_id;

CREATE OR REPLACE VIEW public.class_overview AS
SELECT
  c.id,
  c.name,
  c.section,
  c.level_order,
  c.capacity,
  count(distinct s.id)::int as student_count,
  count(distinct tca.teacher_id)::int as teacher_count
FROM public.classes c
LEFT JOIN public.students s ON s.class_id = c.id AND s.status = 'active'
LEFT JOIN public.teacher_class_assignments tca ON tca.class_id = c.id
GROUP BY c.id;

-- Indexes

CREATE INDEX IF NOT EXISTS students_admission_number_idx ON public.students(admission_number);
CREATE INDEX IF NOT EXISTS students_full_name_trgm_idx ON public.students USING gin(full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS students_class_id_idx ON public.students(class_id);
CREATE INDEX IF NOT EXISTS students_status_idx ON public.students(status);
CREATE INDEX IF NOT EXISTS teacher_assignments_teacher_idx ON public.teacher_class_assignments(teacher_id, class_id);
CREATE INDEX IF NOT EXISTS promotion_logs_student_idx ON public.promotion_logs(student_id);
CREATE INDEX IF NOT EXISTS promotion_logs_promoted_at_idx ON public.promotion_logs(promoted_at DESC);

-- Helper Functions

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(public.current_role() = 'OWNER', false)
$$;

CREATE OR REPLACE FUNCTION public.teacher_has_class(target_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_class_assignments tca
    WHERE tca.teacher_id = auth.uid() AND tca.class_id = target_class_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_student(target_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.is_owner() OR EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.teacher_class_assignments tca ON tca.class_id = s.class_id
    WHERE s.id = target_student_id AND tca.teacher_id = auth.uid()
  )
$$;

-- Row Level Security

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_class_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS profiles_select_own_or_owner ON public.profiles;
CREATE POLICY profiles_select_own_or_owner ON public.profiles
FOR SELECT USING (id = auth.uid() OR public.is_owner());

DROP POLICY IF EXISTS profiles_update_own_or_owner ON public.profiles;
CREATE POLICY profiles_update_own_or_owner ON public.profiles
FOR UPDATE USING (id = auth.uid() OR public.is_owner()) WITH CHECK (id = auth.uid() OR public.is_owner());

-- Classes Policies
DROP POLICY IF EXISTS classes_read_all ON public.classes;
CREATE POLICY classes_read_all ON public.classes 
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS classes_owner_write ON public.classes;
CREATE POLICY classes_owner_write ON public.classes 
FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Teacher Assignments Policies
DROP POLICY IF EXISTS teacher_assignments_read ON public.teacher_class_assignments;
CREATE POLICY teacher_assignments_read ON public.teacher_class_assignments
FOR SELECT USING (teacher_id = auth.uid() OR public.is_owner());

DROP POLICY IF EXISTS teacher_assignments_owner_write ON public.teacher_class_assignments;
CREATE POLICY teacher_assignments_owner_write ON public.teacher_class_assignments
FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Students Policies
DROP POLICY IF EXISTS students_read_scoped ON public.students;
CREATE POLICY students_read_scoped ON public.students
FOR SELECT USING (public.can_access_student(id));

DROP POLICY IF EXISTS students_insert_scoped ON public.students;
CREATE POLICY students_insert_scoped ON public.students
FOR INSERT WITH CHECK (public.is_owner() OR public.teacher_has_class(class_id));

DROP POLICY IF EXISTS students_update_scoped ON public.students;
CREATE POLICY students_update_scoped ON public.students
FOR UPDATE USING (public.can_access_student(id)) WITH CHECK (public.is_owner() OR public.teacher_has_class(class_id));

-- Promotion Logs Policies
DROP POLICY IF EXISTS promotion_logs_read_scoped ON public.promotion_logs;
CREATE POLICY promotion_logs_read_scoped ON public.promotion_logs
FOR SELECT USING (public.can_access_student(student_id));

DROP POLICY IF EXISTS promotion_logs_insert_owner ON public.promotion_logs;
CREATE POLICY promotion_logs_insert_owner ON public.promotion_logs
FOR INSERT WITH CHECK (public.is_owner());

-- Audit Logs Policies
DROP POLICY IF EXISTS audit_logs_owner_only ON public.audit_logs;
CREATE POLICY audit_logs_owner_only ON public.audit_logs
FOR SELECT USING (public.is_owner());

-- Grants
GRANT SELECT ON public.student_directory TO authenticated;
GRANT SELECT ON public.class_overview TO authenticated;
GRANT SELECT ON public.promotion_logs TO authenticated;

-- ============================================================================
-- End of Schema Migration
-- ============================================================================
