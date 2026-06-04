-- Fix schema mismatches for students table
-- Run this in Supabase SQL Editor if columns are missing

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS status public.student_status NOT NULL DEFAULT 'active';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_name text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_phone text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS home_address text;

-- Fix current_role function return type
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
AS $$
  SELECT role::public.app_role FROM public.profiles WHERE id = auth.uid()
$$;