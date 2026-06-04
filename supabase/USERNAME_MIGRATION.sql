-- Migration: add username to profiles, populate values, add unique index, create audit logs
BEGIN;

-- 1) Add username column (nullable for data population step)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

-- 2) Add email column to profiles if missing (helps keep auth lookup fast)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

-- 3) Populate profiles.email from auth.users where available
-- This uses the auth schema; requires service-role privileges during migration
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id
  AND (p.email IS NULL OR p.email = '');

-- 4) Populate username from email local-part and ensure uniqueness by appending id fragment
-- Set OWNER username to 'Joson' explicitly if role exists
UPDATE public.profiles
SET username = 'Joson'
WHERE role = 'OWNER';

-- For other rows, derive username from email local-part
WITH derived AS (
  SELECT p.id,
         lower(split_part(coalesce(p.email, ''), '@', 1)) AS base
  FROM public.profiles p
  WHERE p.username IS NULL OR p.username = ''
)
UPDATE public.profiles p
SET username = CASE
    WHEN coalesce(d.base, '') = '' THEN substr(p.id::text, 1, 8)
    ELSE d.base || '_' || substr(p.id::text, 1, 8)
  END
FROM derived d
WHERE p.id = d.id;

-- 5) Ensure no nulls remain; set default computed username (last resort)
UPDATE public.profiles
SET username = substr(id::text,1,8)
WHERE username IS NULL OR username = '';

-- 6) Create unique index and btree index for fast lookup (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx ON public.profiles (lower(username));
CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles (lower(username));

-- 7) Make username non-nullable now that values exist
ALTER TABLE public.profiles
  ALTER COLUMN username SET NOT NULL;

-- 8) Create audit logs table for auth events
CREATE TABLE IF NOT EXISTS public.auth_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  username text,
  event text NOT NULL,
  details text,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9) Add an is_protected flag to prevent accidental deletion of special accounts (developer, etc.)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_protected boolean NOT NULL DEFAULT false;

-- 10) Create trigger to prevent deletion of protected profiles
CREATE OR REPLACE FUNCTION prevent_protected_profile_delete()
RETURNS trigger AS $$
BEGIN
  IF OLD.is_protected THEN
    RAISE EXCEPTION 'Cannot delete protected profile: %', OLD.id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_protected_delete ON public.profiles;
CREATE TRIGGER trg_prevent_protected_delete
BEFORE DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION prevent_protected_profile_delete();

COMMIT;
