-- PROMOTION SYSTEM STABILIZATION
-- Ensures fee accounts are regenerated for promoted students in their new class
-- Run this AFTER promotion to verify accounts are created

-- Check if students have fee accounts in their current class
SELECT 
  s.id,
  s.full_name,
  s.class_id,
  c.name as class_name,
  COUNT(DISTINCT sfa.id) as fee_accounts,
  COUNT(DISTINCT fs.id) as fee_structures_for_class
FROM public.students s
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.fee_structures fs ON fs.class_id = s.class_id
LEFT JOIN public.student_fee_accounts sfa ON sfa.student_id = s.id AND sfa.fee_structure_id = fs.id
WHERE s.status = 'active'
GROUP BY s.id, s.full_name, s.class_id, c.name
HAVING COUNT(DISTINCT fs.id) > COUNT(DISTINCT sfa.id)
ORDER BY s.full_name;

-- View: Promotion Status Overview with Fee Details
CREATE OR REPLACE VIEW public.promotion_status_overview AS
SELECT
  s.id,
  s.full_name,
  s.admission_number,
  c.name as current_class,
  c.level_order,
  COUNT(DISTINCT sfa.id) as active_fee_accounts,
  COALESCE(SUM(sfa.expected_amount), 0) as total_expected_fees,
  COALESCE(SUM(fp.amount), 0) as total_paid,
  COALESCE(SUM(sfa.expected_amount), 0) - COALESCE(SUM(fp.amount), 0) as balance
FROM public.students s
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.student_fee_accounts sfa ON sfa.student_id = s.id
LEFT JOIN public.fee_payments fp ON fp.student_fee_account_id = sfa.id
WHERE s.status = 'active' AND s.class_id IS NOT NULL
GROUP BY s.id, s.full_name, s.admission_number, c.name, c.level_order
ORDER BY c.level_order ASC, s.full_name ASC;

GRANT SELECT ON public.promotion_status_overview TO authenticated;

-- IMPORTANT: The promote_students() function in schema.sql already includes
-- logic to regenerate fee accounts through triggers. If promotions aren't
-- creating fee accounts, verify:
-- 1. Triggers are enabled on student_fee_accounts table
-- 2. Fee structures exist for the target class
-- 3. Check audit logs for trigger execution errors
-- PROMOTION SYSTEM STABILIZATION
-- Ensures fee accounts are regenerated for promoted students in their new class

-- Update promote_students function to regenerate fee accounts after promotion
CREATE OR REPLACE FUNCTION public.promote_students(current_class_id uuid, student_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_class record;\n  next_class record;\n  eligible_count int;\n  expected_count int;\n  student_id_item uuid;\nBEGIN\n  expected_count := coalesce(array_length(student_ids, 1), 0);\n  if expected_count = 0 then\n    raise exception 'No students selected for promotion.';\n  end if;\n\n  select id, level_order into current_class\n  from public.classes\n  where id = current_class_id;\n\n  if not found then\n    raise exception 'Current class not found.';\n  end if;\n\n  select id into next_class\n  from public.classes\n  where level_order = current_class.level_order + 1\n  order by id\n  limit 1;\n\n  select count(*) into eligible_count\n  from public.students\n  where id = any(student_ids)\n    and class_id = current_class_id\n    and status = 'active';\n\n  if eligible_count <> expected_count then\n    raise exception 'One or more selected students are not eligible for this promotion.';\n  end if;\n\n  if next_class.id is null then\n    update public.students\n    set status = 'graduated'\n    where id = any(student_ids)\n      and class_id = current_class_id\n      and status = 'active';\n  else\n    update public.students\n    set class_id = next_class.id\n    where id = any(student_ids)\n      and class_id = current_class_id\n      and status = 'active';\n    \n    -- CRITICAL FIX: Regenerate fee accounts for promoted students in new class\n    -- This ensures they get fee accounts for all fee structures in their new class\n    FOREACH student_id_item IN ARRAY student_ids\n    LOOP\n      INSERT INTO public.student_fee_accounts(student_id, fee_structure_id, expected_amount, created_at)\n      SELECT student_id_item, fs.id, fs.expected_amount, timezone('utc', now())\n      FROM public.fee_structures fs\n      WHERE fs.class_id = next_class.id\n        AND NOT EXISTS (\n          SELECT 1 FROM public.student_fee_accounts a\n          WHERE a.student_id = student_id_item AND a.fee_structure_id = fs.id\n        )\n      ON CONFLICT (student_id, fee_structure_id) DO NOTHING;\n    END LOOP;\n  end if;\nEND;\n$$;\n\n-- View to show promotion history with fee account details\nCREATE OR REPLACE VIEW public.promotion_status_overview AS\nSELECT\n  s.id,\n  s.full_name,\n  s.admission_number,\n  c.name as current_class,\n  c.level_order,\n  COUNT(DISTINCT sfa.id) as active_fee_accounts,\n  COALESCE(SUM(sfa.expected_amount), 0) as total_expected_fees,\n  COALESCE(SUM(CASE WHEN fp.amount > 0 THEN fp.amount ELSE 0 END), 0) as total_paid,\n  COALESCE(SUM(sfa.expected_amount) - SUM(CASE WHEN fp.amount > 0 THEN fp.amount ELSE 0 END), 0) as balance\nFROM public.students s\nLEFT JOIN public.classes c ON c.id = s.class_id\nLEFT JOIN public.student_fee_accounts sfa ON sfa.student_id = s.id\nLEFT JOIN public.fee_payments fp ON fp.student_fee_account_id = sfa.id\nWHERE s.status = 'active' AND s.class_id IS NOT NULL\nGROUP BY s.id, s.full_name, s.admission_number, c.name, c.level_order\nORDER BY c.level_order ASC, s.full_name ASC;\n\n-- Grant access\nGRANT SELECT ON public.promotion_status_overview TO authenticated;\n