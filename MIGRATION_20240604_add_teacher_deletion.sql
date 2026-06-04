-- Migration: Add teacher management improvements
-- Date: 2024-06-04
-- Purpose: Add is_active column for soft delete pattern and audit logging for teacher operations

-- Add is_active column to profiles table for soft delete pattern
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add audit logging function for teacher deletion/status changes
CREATE OR REPLACE FUNCTION public.log_teacher_deletion()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs(table_name, record_id, action, changed_by, before_data, after_data)
  VALUES (
    'profiles',
    NEW.id,
    CASE 
      WHEN NEW.is_active = false AND OLD.is_active = true THEN 'teacher_deactivated'
      WHEN NEW.is_active = true AND OLD.is_active = false THEN 'teacher_reactivated'
      ELSE 'teacher_updated'
    END,
    auth.uid(),
    to_jsonb(OLD),
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for teacher status changes audit logging
DROP TRIGGER IF EXISTS profiles_audit_trigger ON public.profiles;
CREATE TRIGGER profiles_audit_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (NEW.role IN ('OWNER', 'TEACHER'))
  EXECUTE FUNCTION public.log_teacher_deletion();

-- Add cascade deletion for teacher class assignments when teacher is deleted
CREATE OR REPLACE FUNCTION public.cascade_teacher_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all class assignments for this teacher
  DELETE FROM public.teacher_class_assignments WHERE teacher_id = OLD.id;
  
  -- Log the deletion
  INSERT INTO public.audit_logs(table_name, record_id, action, changed_by, before_data, after_data)
  VALUES (
    'profiles',
    OLD.id,
    'teacher_deleted',
    auth.uid(),
    to_jsonb(OLD),
    NULL
  );
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- This will be called from application when admin confirms deletion
-- Drop existing trigger if present
DROP TRIGGER IF EXISTS teacher_deletion_trigger ON public.profiles;

-- Ensure audit_logs table has proper constraints
ALTER TABLE public.audit_logs 
ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id) 
ON CONFLICT DO NOTHING;

-- Add helpful indexes for audit logs
CREATE INDEX IF NOT EXISTS audit_logs_table_name_idx ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS audit_logs_record_id_idx ON public.audit_logs(record_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs(action);
