-- STUDENT TRANSFER AND DELETION WORKFLOW
-- Adds support for safely transferring and deleting students

-- Add columns to students table for tracking status transitions
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS transferred_to_school text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS transfer_date timestamptz;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS transfer_reason text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS deleted_by uuid references public.profiles(id) on delete set null;

-- Create student_transitions table for audit trail
CREATE TABLE IF NOT EXISTS public.student_transitions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  old_status public.student_status,
  new_status public.student_status not null,
  transition_reason text,
  transition_data jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Create index for transitions
CREATE INDEX IF NOT EXISTS student_transitions_student_idx ON public.student_transitions(student_id);
CREATE INDEX IF NOT EXISTS student_transitions_status_idx ON public.student_transitions(new_status);
CREATE INDEX IF NOT EXISTS student_transitions_created_idx ON public.student_transitions(created_at);

-- Add constraints to prevent invalid transitions
ALTER TABLE public.student_transitions 
  ADD CONSTRAINT valid_status_transition 
  CHECK (
    (old_status = 'active' AND new_status IN ('transferred', 'inactive', 'graduated')) OR
    (old_status = 'transferred' AND new_status IN ('inactive', 'graduated')) OR
    (old_status = 'inactive' AND new_status = 'active') OR
    (old_status IS NULL AND new_status = 'active') -- Initial status
  );

-- Function to safely transfer student
CREATE OR REPLACE FUNCTION public.transfer_student(
  student_id_in uuid,
  transfer_to_school text,
  transfer_reason_in text,
  transferred_by uuid
)
RETURNS TABLE (success boolean, message text, student_id uuid) AS $$
DECLARE
  student_record record;
  total_balance numeric;
BEGIN
  -- Check student exists and is active
  SELECT s.id, s.full_name, s.status, 
         COALESCE(SUM(sfa.balance), 0) as outstanding_balance
  INTO student_record
  FROM public.students s
  LEFT JOIN public.student_fee_accounts_overview sfa ON sfa.student_id = s.id
  WHERE s.id = student_id_in
  GROUP BY s.id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Student not found'::text, NULL::uuid;
    RETURN;
  END IF;

  -- Check if student has outstanding balance
  IF student_record.outstanding_balance > 0 THEN
    INSERT INTO public.student_transitions(
      student_id, old_status, new_status, transition_reason, 
      transition_data, created_by
    ) VALUES (
      student_id_in, student_record.status, 'transferred',
      transfer_reason_in,
      jsonb_build_object(
        'outstanding_balance', student_record.outstanding_balance,
        'school_name', transfer_to_school,
        'requires_payment_before_transfer', true
      ),
      transferred_by
    );
    RETURN QUERY SELECT FALSE, 
      'Cannot transfer: Student has outstanding balance of KES ' || student_record.outstanding_balance::text ||
      '. Resolve fees before transfer.'::text, student_id_in::uuid;
    RETURN;
  END IF;

  -- Update student status
  UPDATE public.students
  SET 
    status = 'transferred',
    transferred_to_school = transfer_to_school,
    transfer_date = timezone('utc', now()),
    transfer_reason = transfer_reason_in,
    class_id = NULL
  WHERE id = student_id_in;

  -- Log transition
  INSERT INTO public.student_transitions(
    student_id, old_status, new_status, transition_reason,
    transition_data, created_by
  ) VALUES (
    student_id_in, student_record.status, 'transferred',
    transfer_reason_in,
    jsonb_build_object(
      'school_name', transfer_to_school,
      'transferred_from_class', (SELECT class_id FROM public.students WHERE id = student_id_in)
    ),
    transferred_by
  );

  RETURN QUERY SELECT TRUE, 'Student transferred successfully'::text, student_id_in;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to safely delete student (only transferred/inactive/duplicate)
CREATE OR REPLACE FUNCTION public.delete_student_safe(
  student_id_in uuid,
  deletion_reason text,
  deleted_by_id uuid
)
RETURNS TABLE (success boolean, message text, deleted_records int) AS $$
DECLARE
  student_record record;
  deleted_count int := 0;
BEGIN
  -- Check student exists
  SELECT s.id, s.full_name, s.status, s.admission_number
  INTO student_record
  FROM public.students s
  WHERE s.id = student_id_in;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Student not found'::text, 0;
    RETURN;
  END IF;

  -- Only allow deletion of non-active students
  IF student_record.status NOT IN ('transferred', 'inactive', 'graduated') THEN
    RETURN QUERY SELECT FALSE, 
      'Cannot delete active student. Must transfer or mark inactive first. Current status: ' || student_record.status::text,
      0;
    RETURN;
  END IF;

  -- Check for payments (for audit purposes)
  PERFORM 1 FROM public.fee_payments fp
  JOIN public.student_fee_accounts sfa ON sfa.id = fp.student_fee_account_id
  WHERE sfa.student_id = student_id_in;

  IF FOUND THEN
    -- Student has payment history - archive instead of delete
    UPDATE public.students
    SET 
      deletion_requested_at = timezone('utc', now()),
      deleted_by = deleted_by_id,
      notes = COALESCE(notes || CHR(10), '') || '[DELETED: ' || deletion_reason || ' at ' || timezone('utc', now())::text || ']'
    WHERE id = student_id_in;

    INSERT INTO public.student_transitions(
      student_id, old_status, new_status, transition_reason,
      transition_data, created_by
    ) VALUES (
      student_id_in, student_record.status, student_record.status,
      'Deletion requested - record archived',
      jsonb_build_object(
        'deletion_reason', deletion_reason,
        'had_payment_history', true
      ),
      deleted_by_id
    );

    RETURN QUERY SELECT TRUE, 
      'Student record archived (not fully deleted due to payment history). Records preserved for audit.'::text,
      1;
  ELSE
    -- No payment history - safe to delete
    DELETE FROM public.fee_payments fp
    USING public.student_fee_accounts sfa
    WHERE sfa.student_id = student_id_in AND fp.student_fee_account_id = sfa.id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    DELETE FROM public.student_fee_accounts
    WHERE student_id = student_id_in;

    DELETE FROM public.marks
    WHERE student_id = student_id_in;

    DELETE FROM public.students
    WHERE id = student_id_in;

    INSERT INTO public.student_transitions(
      student_id, old_status, new_status, transition_reason,
      transition_data, created_by
    ) VALUES (
      student_id_in, student_record.status, 'inactive',
      'Record deleted - no payment history',
      jsonb_build_object(
        'deletion_reason', deletion_reason,
        'had_payment_history', false,
        'admission_number', student_record.admission_number
      ),
      deleted_by_id
    );

    RETURN QUERY SELECT TRUE, 
      'Student record permanently deleted (no payment or enrollment history).'::text,
      deleted_count;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.transfer_student TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_student_safe TO authenticated;
