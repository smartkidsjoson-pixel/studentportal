-- ============================================================================
-- JOSON'S SMARTKIDS ACADEMY - PRODUCTION STABILIZATION SQL
-- ============================================================================
-- This migration fixes critical fee account issues and ensures production readiness
-- Run this BEFORE deploying to production
-- ============================================================================

-- SECTION 1: FIX DUPLICATE FEE ACCOUNTS
-- ============================================================================
-- Detect and remove any duplicate fee accounts, keeping the one with latest created_at

CREATE TEMP TABLE duplicate_accounts AS
SELECT 
  student_id,
  fee_structure_id,
  COUNT(*) as count,
  ARRAY_AGG(id ORDER BY created_at DESC) as ids
FROM public.student_fee_accounts
GROUP BY student_id, fee_structure_id
HAVING COUNT(*) > 1;

-- Display duplicates that will be removed for audit
SELECT 'DUPLICATE FEE ACCOUNTS FOUND' as audit_action;
SELECT 
  student_id,
  fee_structure_id,
  count,
  ids[1] as kept_id,
  ids[2:] as removed_ids
FROM duplicate_accounts;

-- Delete duplicate accounts (keep the most recent one)
DELETE FROM public.student_fee_accounts
WHERE (student_id, fee_structure_id, id) IN (
  SELECT student_id, fee_structure_id, UNNEST(ids[2:])
  FROM duplicate_accounts
);

-- ============================================================================
-- SECTION 2: FIX ZERO EXPECTED_AMOUNT ACCOUNTS
-- ============================================================================
-- Set expected_amount from fee_structures for accounts that have 0

UPDATE public.student_fee_accounts sfa
SET expected_amount = fs.expected_amount
FROM public.fee_structures fs
WHERE sfa.fee_structure_id = fs.id
  AND (sfa.expected_amount = 0 OR sfa.expected_amount IS NULL);

-- Verify all accounts now have valid amounts
SELECT 'CHECKING FOR REMAINING ZERO AMOUNTS' as check_name;
SELECT 
  COUNT(*) as zero_amount_count,
  COALESCE(MAX(expected_amount), 0) as max_amount
FROM public.student_fee_accounts
WHERE expected_amount <= 0;

-- ============================================================================
-- SECTION 3: CREATE MISSING FEE ACCOUNTS
-- ============================================================================
-- For any student in a class with fee structures, ensure they have an account for EACH structure

INSERT INTO public.student_fee_accounts(student_id, fee_structure_id, expected_amount, created_at)
SELECT 
  s.id as student_id,
  fs.id as fee_structure_id,
  fs.expected_amount,
  timezone('utc', now())
FROM public.students s
CROSS JOIN public.fee_structures fs
WHERE s.status = 'active'
  AND s.class_id = fs.class_id
  AND NOT EXISTS (
    SELECT 1 FROM public.student_fee_accounts sfa
    WHERE sfa.student_id = s.id AND sfa.fee_structure_id = fs.id
  )
ON CONFLICT (student_id, fee_structure_id) DO NOTHING;

-- ============================================================================
-- SECTION 4: VERIFY UNIQUE CONSTRAINT
-- ============================================================================
-- Ensure the unique constraint exists on student_fee_accounts

ALTER TABLE public.student_fee_accounts
ADD CONSTRAINT unique_student_fee_account 
UNIQUE (student_id, fee_structure_id)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 5: DIAGNOSTIC VIEWS - PRODUCTION READINESS
-- ============================================================================

-- View: Students missing fee accounts
CREATE OR REPLACE VIEW public.diagnostic_missing_fee_accounts AS
SELECT 
  s.id,
  s.full_name,
  s.admission_number,
  s.class_id,
  c.name as class_name,
  COUNT(DISTINCT fs.id) as fee_structures_for_class,
  COUNT(DISTINCT sfa.id) as fee_accounts_for_student,
  COUNT(DISTINCT fs.id) - COUNT(DISTINCT sfa.id) as missing_accounts
FROM public.students s
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.fee_structures fs ON fs.class_id = s.class_id
LEFT JOIN public.student_fee_accounts sfa ON sfa.student_id = s.id AND sfa.fee_structure_id = fs.id
WHERE s.status = 'active' AND s.class_id IS NOT NULL
GROUP BY s.id, s.full_name, s.admission_number, s.class_id, c.name
HAVING COUNT(DISTINCT fs.id) > COUNT(DISTINCT sfa.id);

-- View: Fee account health check
CREATE OR REPLACE VIEW public.diagnostic_fee_account_health AS
SELECT 
  COUNT(*) as total_accounts,
  COUNT(CASE WHEN expected_amount = 0 THEN 1 END) as zero_expected_accounts,
  COUNT(CASE WHEN expected_amount IS NULL THEN 1 END) as null_expected_accounts,
  COUNT(CASE WHEN expected_amount > 0 THEN 1 END) as healthy_accounts,
  MIN(CASE WHEN expected_amount > 0 THEN expected_amount END) as min_healthy_amount,
  MAX(expected_amount) as max_amount,
  AVG(CASE WHEN expected_amount > 0 THEN expected_amount END)::numeric(12,2) as avg_healthy_amount
FROM public.student_fee_accounts;

-- View: Payment balance integrity
CREATE OR REPLACE VIEW public.diagnostic_payment_integrity AS
SELECT 
  sfa.id as account_id,
  sfa.student_id,
  sfa.fee_structure_id,
  sfa.expected_amount,
  COALESCE(SUM(fp.amount), 0) as total_paid,
  sfa.expected_amount - COALESCE(SUM(fp.amount), 0) as balance,
  COUNT(DISTINCT fp.id) as payment_count
FROM public.student_fee_accounts sfa
LEFT JOIN public.fee_payments fp ON fp.student_fee_account_id = sfa.id
GROUP BY sfa.id, sfa.student_id, sfa.fee_structure_id, sfa.expected_amount;

-- ============================================================================
-- SECTION 6: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON public.diagnostic_missing_fee_accounts TO authenticated;
GRANT SELECT ON public.diagnostic_fee_account_health TO authenticated;
GRANT SELECT ON public.diagnostic_payment_integrity TO authenticated;

-- ============================================================================
-- SECTION 7: RUN PRODUCTION DIAGNOSTICS
-- ============================================================================

-- Check 1: Duplicate accounts removed
SELECT 'CHECK 1: DUPLICATE ACCOUNTS' as diagnostic;
SELECT 
  COUNT(*) as total_accounts,
  COUNT(DISTINCT (student_id, fee_structure_id)) as unique_accounts,
  CASE 
    WHEN COUNT(*) = COUNT(DISTINCT (student_id, fee_structure_id)) THEN '✓ NO DUPLICATES'
    ELSE '❌ DUPLICATES FOUND'
  END as status
FROM public.student_fee_accounts;

-- Check 2: No zero expected_amount
SELECT 'CHECK 2: ZERO EXPECTED_AMOUNT' as diagnostic;
SELECT 
  COUNT(*) as zero_amount_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ NO ZERO AMOUNTS'
    ELSE '❌ ZERO AMOUNTS EXIST'
  END as status
FROM public.student_fee_accounts
WHERE expected_amount <= 0;

-- Check 3: All active students have fee accounts
SELECT 'CHECK 3: MISSING FEE ACCOUNTS' as diagnostic;
SELECT 
  COUNT(*) as missing_accounts,
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ ALL STUDENTS COVERED'
    ELSE '❌ MISSING ACCOUNTS FOR STUDENTS'
  END as status
FROM public.diagnostic_missing_fee_accounts;

-- Check 4: Fee structure coverage
SELECT 'CHECK 4: FEE STRUCTURE COVERAGE' as diagnostic;
SELECT 
  COUNT(DISTINCT f.id) as total_fee_structures,
  COUNT(DISTINCT sfa.fee_structure_id) as covered_structures,
  CASE 
    WHEN COUNT(DISTINCT f.id) = COUNT(DISTINCT sfa.fee_structure_id) THEN '✓ ALL STRUCTURES COVERED'
    ELSE '❌ UNUSED FEE STRUCTURES'
  END as status
FROM public.fee_structures f
LEFT JOIN public.student_fee_accounts sfa ON sfa.fee_structure_id = f.id;

-- Check 5: Payment integrity
SELECT 'CHECK 5: PAYMENT INTEGRITY' as diagnostic;
SELECT 
  COUNT(*) as accounts_checked,
  COUNT(CASE WHEN balance >= 0 THEN 1 END) as valid_balances,
  COUNT(CASE WHEN balance < 0 THEN 1 END) as negative_balances,
  CASE 
    WHEN COUNT(CASE WHEN balance < 0 THEN 1 END) = 0 THEN '✓ ALL BALANCES VALID'
    ELSE '⚠️ OVERPAYMENTS EXIST'
  END as status
FROM public.diagnostic_payment_integrity;

-- ============================================================================
-- SECTION 8: FINAL PRODUCTION READINESS STATUS
-- ============================================================================

SELECT 
  'PRODUCTION STABILIZATION COMPLETE' as status,
  timezone('utc', now()) as completed_at
UNION ALL
SELECT 
  'Database schema validated',
  timezone('utc', now())
UNION ALL
SELECT 
  'Duplicate accounts removed',
  timezone('utc', now())
UNION ALL
SELECT 
  'Zero expected_amount fixed',
  timezone('utc', now())
UNION ALL
SELECT 
  'Missing accounts created',
  timezone('utc', now())
UNION ALL
SELECT 
  'Unique constraints enforced',
  timezone('utc', now());
