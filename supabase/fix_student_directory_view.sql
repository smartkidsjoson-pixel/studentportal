-- Recreate the student_directory view to ensure it exposes level_order, class_name, class_id and payment summary fields.
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
  s.status,
  s.class_id,
  c.level_order,
  c.name AS class_name,
  s.date_joined,
  s.profile_photo_url,
  s.notes,
  s.created_at,
  coalesce(f.fee_expected, 0) AS fee_expected,
  coalesce(f.total_paid, 0) AS total_paid,
  coalesce(f.balance, 0) AS balance,
  coalesce(f.payment_status, 'Not Paid') AS payment_status
FROM public.students s
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN (
  SELECT
    student_id,
    sum(expected_amount) AS fee_expected,
    sum(total_paid) AS total_paid,
    sum(balance) AS balance,
    CASE
      WHEN sum(balance) <= 0 THEN 'Cleared'
      WHEN sum(total_paid) > 0 THEN 'Partial'
      ELSE 'Not Paid'
    END AS payment_status
  FROM public.student_fee_accounts_overview
  GROUP BY student_id
) f ON f.student_id = s.id;

GRANT SELECT ON public.student_directory TO authenticated;
