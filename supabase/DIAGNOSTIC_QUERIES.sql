-- DIAGNOSTIC QUERIES FOR PAYMENT FAILURE INVESTIGATION
-- Run these manually in Supabase SQL editor to diagnose issues

-- ============================================================================
-- STEP 1: CHECK IF FEE STRUCTURES EXIST
-- ============================================================================
SELECT 'CHECKING FEE STRUCTURES' as step;

SELECT 
  fs.id,
  fs.class_id,
  c.name as class_name,
  fs.academic_year,
  fs.term,
  fs.expected_amount,
  COUNT(DISTINCT sfa.id) as accounts_created,
  COUNT(DISTINCT fp.id) as payments_recorded
FROM public.fee_structures fs
LEFT JOIN public.classes c ON c.id = fs.class_id
LEFT JOIN public.student_fee_accounts sfa ON sfa.fee_structure_id = fs.id
LEFT JOIN public.fee_payments fp ON fp.student_fee_account_id = sfa.id
GROUP BY fs.id, fs.class_id, c.name, fs.academic_year, fs.term, fs.expected_amount
ORDER BY fs.created_at DESC;

-- ============================================================================
-- STEP 2: CHECK STUDENT FEE ACCOUNTS - RAW TABLE
-- ============================================================================
SELECT 'CHECKING RAW STUDENT_FEE_ACCOUNTS TABLE' as step;

SELECT 
  sfa.id,
  sfa.student_id,
  sfa.fee_structure_id,
  sfa.expected_amount,
  fs.class_id,
  fs.academic_year,
  fs.term,
  COUNT(fp.id) as payment_count,
  COALESCE(SUM(fp.amount), 0) as total_paid
FROM public.student_fee_accounts sfa
LEFT JOIN public.fee_structures fs ON fs.id = sfa.fee_structure_id
LEFT JOIN public.fee_payments fp ON fp.student_fee_account_id = sfa.id
GROUP BY sfa.id, sfa.student_id, sfa.fee_structure_id, sfa.expected_amount, 
         fs.class_id, fs.academic_year, fs.term
ORDER BY sfa.created_at DESC
LIMIT 20;

-- ============================================================================
-- STEP 3: CHECK STUDENT_FEE_ACCOUNTS_OVERVIEW VIEW
-- ============================================================================
SELECT 'CHECKING STUDENT_FEE_ACCOUNTS_OVERVIEW VIEW' as step;

SELECT * FROM public.student_fee_accounts_overview
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- STEP 4: CHECK FOR STUDENTS WITH NO FEE ACCOUNTS
-- ============================================================================
SELECT 'CHECKING FOR STUDENTS WITH NO FEE ACCOUNTS' as step;

SELECT 
  s.id,
  s.full_name,
  s.admission_number,
  s.class_id,
  c.name as class_name,
  s.status,
  (SELECT COUNT(*) FROM public.fee_structures WHERE class_id = s.class_id) as fee_structures_for_class,
  (SELECT COUNT(*) FROM public.student_fee_accounts WHERE student_id = s.id) as fee_accounts_for_student
FROM public.students s
LEFT JOIN public.classes c ON c.id = s.class_id
WHERE s.status = 'active' 
  AND s.class_id IS NOT NULL
  AND (SELECT COUNT(*) FROM public.fee_structures WHERE class_id = s.class_id) > 0
  AND (SELECT COUNT(*) FROM public.student_fee_accounts WHERE student_id = s.id) = 0
LIMIT 20;

-- ============================================================================
-- STEP 5: CHECK FEE STRUCTURES FOR SPECIFIC CLASS AND CHECK IF ACCOUNTS CREATED
-- ============================================================================
SELECT 'CHECKING FEE STRUCTURE TRIGGER EXECUTION' as step;

SELECT 
  fs.id,
  fs.class_id,
  c.name as class_name,
  fs.expected_amount,
  fs.created_at,
  COUNT(DISTINCT s.id) as active_students_in_class,
  COUNT(DISTINCT sfa.id) as fee_accounts_created,
  COUNT(DISTINCT s.id) - COUNT(DISTINCT sfa.id) as missing_accounts
FROM public.fee_structures fs
LEFT JOIN public.classes c ON c.id = fs.class_id
LEFT JOIN public.students s ON s.class_id = fs.class_id AND s.status = 'active'
LEFT JOIN public.student_fee_accounts sfa ON sfa.student_id = s.id AND sfa.fee_structure_id = fs.id
GROUP BY fs.id, fs.class_id, c.name, fs.expected_amount, fs.created_at
ORDER BY fs.created_at DESC;

-- ============================================================================
-- STEP 6: CHECK FEE PAYMENTS TABLE
-- ============================================================================
SELECT 'CHECKING FEE PAYMENTS TABLE' as step;

SELECT 
  fp.id,
  fp.student_fee_account_id,
  sfa.student_id,
  sfa.expected_amount,
  fp.amount,
  fp.receipt_number,
  fp.payment_date,
  fp.recorded_by,
  fp.created_at
FROM public.fee_payments fp
LEFT JOIN public.student_fee_accounts sfa ON sfa.id = fp.student_fee_account_id
ORDER BY fp.created_at DESC
LIMIT 20;

-- ============================================================================
-- STEP 7: CHECK SPECIFIC STUDENT DETAIL (Replace UUID)
-- ============================================================================
SELECT 'CHECKING SPECIFIC STUDENT - REPLACE WITH ACTUAL STUDENT UUID' as step;

-- Replace 'STUDENT_UUID_HERE' with actual student ID
SELECT 
  s.id,
  s.full_name,
  s.class_id,
  c.name as class_name,
  s.status,
  (SELECT JSON_AGG(
    JSON_BUILD_OBJECT(
      'id', fs.id,
      'academic_year', fs.academic_year,
      'term', fs.term,
      'expected_amount', fs.expected_amount
    )
  ) FROM public.fee_structures fs WHERE fs.class_id = s.class_id) as available_fee_structures,
  (SELECT JSON_AGG(
    JSON_BUILD_OBJECT(
      'id', sfa.id,
      'fee_structure_id', sfa.fee_structure_id,
      'expected_amount', sfa.expected_amount,
      'total_paid', (SELECT COALESCE(SUM(amount), 0) FROM public.fee_payments WHERE student_fee_account_id = sfa.id),
      'balance', sfa.expected_amount - (SELECT COALESCE(SUM(amount), 0) FROM public.fee_payments WHERE student_fee_account_id = sfa.id)
    )
  ) FROM public.student_fee_accounts sfa WHERE sfa.student_id = s.id) as student_fee_accounts
FROM public.students s
LEFT JOIN public.classes c ON c.id = s.class_id
WHERE s.id = 'STUDENT_UUID_HERE';

-- ============================================================================
-- STEP 8: CHECK TRIGGER EXISTENCE AND STATUS
-- ============================================================================
SELECT 'CHECKING TRIGGERS' as step;

SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND (event_object_table LIKE '%student%fee%'
       OR event_object_table LIKE '%fee%'
       OR event_object_table LIKE '%student%')
ORDER BY event_object_table;

-- ============================================================================
-- STEP 9: CHECK ROW LEVEL SECURITY ON FEE TABLES
-- ============================================================================
SELECT 'CHECKING RLS POLICIES ON FEE TABLES' as step;

SELECT 
  schemaname,
  tablename,
  (SELECT COUNT(*) FROM information_schema.constraint_column_usage 
   WHERE table_schema = schemaname AND table_name = tablename) as policy_count
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('fee_structures', 'student_fee_accounts', 'fee_payments')
ORDER BY tablename;

SELECT 
  tablename,
  policyname,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('fee_structures', 'student_fee_accounts', 'fee_payments')
ORDER BY tablename, policyname;

-- ============================================================================
-- STEP 10: CHECK STUDENT DIRECTORY VIEW
-- ============================================================================
SELECT 'CHECKING STUDENT DIRECTORY VIEW' as step;

SELECT 
  id,
  full_name,
  class_name,
  fee_expected,
  total_paid,
  balance,
  payment_status
FROM public.student_directory
ORDER BY created_at DESC
LIMIT 20;
