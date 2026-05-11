import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import type {
  ClassSummary,
  DashboardStats,
  FeeDashboardStats,
  FeePaymentHistoryItem,
  FeeStructureSummary,
  PromotionHistoryItem,
  SessionUser,
  StudentDirectoryItem,
  StudentFeeAccountSummary,
  TeacherClassAssignment,
  TeacherProfile,
  UserRole,
} from '@/lib/types';

function normalizeRole(role: unknown): UserRole {
  if (role === 'OWNER' || role === 'TEACHER') {
    return role;
  }

  return 'TEACHER';
}

function sanitizeSearchQuery(value: string) {
  return value.replace(/[^a-zA-Z0-9_\-@+ \u00C0-\u017F]/g, '').trim();
}

export async function getClasses(user?: SessionUser): Promise<ClassSummary[]> {
  const supabase = await createClient();
  const builder = supabase
    .from('class_overview')
    .select('*')
    .order('level_order', { ascending: true })
    .order('name', { ascending: true });

  if (user?.role === 'TEACHER') {
    const teacherClassIds = await getTeacherClassIds(supabase, user.id);
    if (teacherClassIds.length === 0) {
      return [];
    }
    builder.in('id', teacherClassIds);
  }

  const { data, error } = await builder;

  if (error) {
    console.error(error);
    return [];
  }

  return data ?? [];
}

export async function getTeachers(): Promise<TeacherProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('staff_directory')
    .select('id, full_name, role, is_active, assigned_classes')
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Failed to read staff_directory view, falling back to profiles', error);
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('profiles')
      .select('id, full_name, role, is_active')
      .in('role', ['OWNER', 'TEACHER'])
      .order('full_name', { ascending: true });

    if (fallbackError) {
      console.error('Failed to read profiles fallback for teachers', fallbackError);
      return [];
    }

    return (
      fallbackData?.map((row) => ({
        ...row,
        assigned_classes: 'None',
      })) ?? []
    );
  }

  return data ?? [];
}

export async function getTeacherAssignments(): Promise<TeacherClassAssignment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('teacher_class_assignments')
    .select('id, teacher_id, class_id, classes(name)')
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  const rows = data as Array<{
    id: string;
    teacher_id: string;
    class_id: string;
    classes?: Array<{ name: string }>;
  }> | null;

  return (
    rows?.map((assignment) => ({
      id: assignment.id,
      teacher_id: assignment.teacher_id,
      class_id: assignment.class_id,
      class_name: assignment.classes?.[0]?.name ?? 'Unknown',
    })) ?? []
  );
}

export async function getStudents(params?: {
  query?: string;
  classId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}, user?: SessionUser): Promise<StudentDirectoryItem[]> {
  const supabase = await createClient();
  const query = params?.query ? sanitizeSearchQuery(params.query) : undefined;
  const pageSize = params?.pageSize ?? 12;
  const page = params?.page && params.page > 0 ? params.page : 1;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let builder = supabase
    .from('student_directory')
    .select('*')
    .order('full_name', { ascending: true })
    .range(from, to);

  if (user?.role === 'TEACHER') {
    const teacherClassIds = await getTeacherClassIds(supabase, user.id);
    builder = builder.in('class_id', teacherClassIds);
    if (!params?.status) {
      builder = builder.eq('status', 'active');
    }
  }

  if (params?.classId) {
    builder = builder.eq('class_id', params.classId);
  }

  if (params?.status) {
    builder = builder.eq('status', params.status);
  }

  if (query) {
    builder = builder.or(`full_name.ilike.%${query}%,admission_number.ilike.%${query}%,parent_name.ilike.%${query}%,parent_phone.ilike.%${query}%,class_name.ilike.%${query}%`);
  }

  const { data, error } = await builder;

  if (error) {
    console.error(error);
    return [];
  }

  return data ?? [];
}

export async function getStudentsCount(params?: { query?: string; classId?: string; status?: string }, user?: SessionUser): Promise<number> {
  const supabase = await createClient();
  const query = params?.query ? sanitizeSearchQuery(params.query) : undefined;

  let builder = supabase
    .from('student_directory')
    .select('id', { count: 'exact', head: true });

  if (user?.role === 'TEACHER') {
    const teacherClassIds = await getTeacherClassIds(supabase, user.id);
    builder = builder.in('class_id', teacherClassIds);
    if (!params?.status) {
      builder = builder.eq('status', 'active');
    }
  }

  if (params?.classId) {
    builder = builder.eq('class_id', params.classId);
  }

  if (params?.status) {
    builder = builder.eq('status', params.status);
  }

  if (query) {
    builder = builder.or(`full_name.ilike.%${query}%,admission_number.ilike.%${query}%,parent_name.ilike.%${query}%,parent_phone.ilike.%${query}%,class_name.ilike.%${query}%`);
  }

  const { count, error } = await builder;

  if (error) {
    console.error(error);
    return 0;
  }

  return count ?? 0;
}

export async function getStudentById(studentId: string): Promise<StudentDirectoryItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('student_directory')
    .select('*')
    .eq('id', studentId)
    .maybeSingle();

  if (error) {
    console.error('getStudentById failed:', error);
    return null;
  }

  return data ?? null;
}

export async function getFeeStructures(): Promise<FeeStructureSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('fee_structure_overview')
    .select('*')
    .eq('archived', false)
    .order('academic_year', { ascending: false })
    .order('term', { ascending: true })
    .order('class_name', { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  return data ?? [];
}

export async function getStudentFeeOverview(studentId: string): Promise<{
  accounts: StudentFeeAccountSummary[];
  payments: FeePaymentHistoryItem[];
}> {
  console.log('\n=== GET STUDENT FEE OVERVIEW START ===');
  console.log('Student ID:', studentId);
  
  const supabase = await createClient();

  // Before fetching, ensure fee accounts exist (defensive programming)
  console.log('Running defensive fee account check...');
  try {
    // Get student to check if they have a class and fee structures
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('class_id, status')
      .eq('id', studentId)
      .maybeSingle();
    
    if (studentError) {
      console.error('Error fetching student:', studentError);
    }
    
    if (student?.class_id && student?.status === 'active') {
      // Check if any fee accounts are missing or have zero expected_amount
      const { data: feeStructures } = await supabase
        .from('fee_structures')
        .select('id, expected_amount')
        .eq('class_id', student.class_id)
        .eq('archived', false);
      
      if (feeStructures && feeStructures.length > 0) {
        for (const fs of feeStructures) {
          const { data: account } = await supabase
            .from('student_fee_accounts')
            .select('id, expected_amount')
            .eq('student_id', studentId)
            .eq('fee_structure_id', fs.id)
            .maybeSingle();
          
          if (!account) {
            // Create missing account
            console.log(`Creating missing fee account for fee structure ${fs.id} with amount ${fs.expected_amount}`);
            const { error: insertError } = await supabase.from('student_fee_accounts').insert({
              student_id: studentId,
              fee_structure_id: fs.id,
              expected_amount: fs.expected_amount,
            });
            if (insertError) {
              console.error(`Error creating account: ${insertError.message}`);
            } else {
              console.log(`✓ Created missing fee account`);
            }
          } else if (account.expected_amount === 0 || account.expected_amount === '0' || Number(account.expected_amount) === 0) {
            // Fix zero amount
            console.log(`⚠️ Fixing zero expected_amount in account ${account.id}, setting to ${fs.expected_amount}`);
            const { error: updateError } = await supabase
              .from('student_fee_accounts')
              .update({ expected_amount: fs.expected_amount })
              .eq('id', account.id);
            if (updateError) {
              console.error(`Error updating account: ${updateError.message}`);
            } else {
              console.log(`✓ Fixed zero expected_amount`);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Error in defensive fee account check:', e);
  }

  // Fetch fee accounts with proper expected amounts
  const { data: rawAccounts, error: accountsError } = await supabase
    .from('student_fee_accounts')
    .select(`
      id,
      student_id,
      fee_structure_id,
      expected_amount,
      fee_structures!inner(
        academic_year,
        term,
        expected_amount,
        classes!inner(name)
      )
    `)
    .eq('student_id', studentId);

  if (accountsError) {
    console.error('ERROR fetching fee accounts:', accountsError);
    return { accounts: [], payments: [] };
  }

  // Fetch all payments for this student
  const { data: payments, error: paymentsError } = await supabase
    .from('fee_payment_history')
    .select('*')
    .eq('student_id', studentId)
    .order('payment_date', { ascending: false });

  if (paymentsError) {
    console.error('ERROR fetching fee payments:', paymentsError);
    return { accounts: [], payments: [] };
  }

  // Calculate accounts with proper totals
  const accounts: StudentFeeAccountSummary[] = (rawAccounts ?? []).map((account: any) => {
    // Get expected amount with fallback
    const expectedAmount = account.expected_amount && Number(account.expected_amount) > 0
      ? Number(account.expected_amount)
      : Number(account.fee_structures?.expected_amount ?? 0);

    // Calculate total paid by summing payments for this account
    const totalPaid = (payments ?? [])
      .filter(payment => payment.student_fee_account_id === account.id)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    const balance = expectedAmount - totalPaid;
    const status = balance <= 0 ? 'Cleared' : totalPaid > 0 ? 'Partial' : 'Not Paid';

    return {
      id: account.id,
      student_id: account.student_id,
      fee_structure_id: account.fee_structure_id,
      academic_year: account.fee_structures?.academic_year ?? '',
      term: account.fee_structures?.term ?? 'TERM_1',
      class_name: account.fee_structures?.classes?.name ?? null,
      expected_amount: expectedAmount,
      total_paid: totalPaid,
      balance: balance,
      status: status as 'Cleared' | 'Partial' | 'Not Paid',
    };
  });

  console.log('Calculated accounts:', accounts);
  console.log('Payments:', payments);
  
  console.log('=== GET STUDENT FEE OVERVIEW END ===\n');
  
  return {
    accounts,
    payments: payments ?? [],
  };
}

export async function getFeeDashboardStats(): Promise<FeeDashboardStats> {
  console.log('\n=== GET FEE DASHBOARD STATS START ===');
  
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('fee_dashboard_overview')
    .select('*')
    .single();

  console.log('Dashboard stats response:', { data, error });

  if (error) {
    console.error('ERROR fetching fee dashboard stats:', error);
    return {
      totalExpected: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      studentsWithBalance: 0,
      recentPayments: [],
    };
  }

  const { data: payments, error: paymentsError } = await supabase
    .from('fee_payment_history')
    .select('*')
    .order('payment_date', { ascending: false })
    .limit(5);

  if (paymentsError) {
    console.error(paymentsError);
  }

  return {
    totalExpected: Number(data.total_expected ?? 0),
    totalCollected: Number(data.total_collected ?? 0),
    totalOutstanding: Number(data.total_outstanding ?? 0),
    studentsWithBalance: Number(data.students_with_balance ?? 0),
    recentPayments: payments ?? [],
  };
}

async function getTeacherClassIds(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase
    .from('teacher_class_assignments')
    .select('class_id');

  if (error) {
    console.error(error);
    return [] as string[];
  }

  return (data ?? []).map((row: { class_id: string }) => row.class_id);
}

export async function getDashboardStats(user?: SessionUser): Promise<DashboardStats> {
  const supabase = await createClient();
  const ownerTotalsPromise = Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'TEACHER'),
    supabase.from('classes').select('id', { count: 'exact', head: true }),
  ]);

  const recentStudentsQuery = supabase
    .from('student_directory')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (!user || user.role === 'OWNER') {
    const graduatedCountQuery = supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'graduated');
    const [studentsCount, teachersCount, classesCount, graduatedCount] = await Promise.all([
      ...(await ownerTotalsPromise),
      graduatedCountQuery,
    ]);
    const { data: recentStudents } = await recentStudentsQuery;
    const feeStats = await getFeeDashboardStats();

    return {
      totalStudents: studentsCount.count ?? 0,
      totalTeachers: teachersCount.count ?? 0,
      totalClasses: classesCount.count ?? 0,
      totalGraduated: graduatedCount.count ?? 0,
      recentStudents: recentStudents ?? [],
      feeStats,
    };
  }

  const teacherClassIds = await getTeacherClassIds(supabase, user.id);

  const [studentCount, classCount] = await Promise.all([
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .in('class_id', teacherClassIds),
    supabase
      .from('teacher_class_assignments')
      .select('class_id', { count: 'exact', head: true })
      .eq('teacher_id', user.id),
  ]);

  const { data: recentStudents } = await supabase
    .from('student_directory')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: assignedClasses } = await supabase
    .from('class_overview')
    .select('*')
    .in('id', teacherClassIds)
    .order('level_order', { ascending: true });

  return {
    totalStudents: studentCount.count ?? 0,
    totalTeachers: 0,
    totalClasses: classCount.count ?? 0,
    recentStudents: recentStudents ?? [],
    assignedClasses: assignedClasses ?? [],
  };
}

export async function getPromotionHistory(studentId: string): Promise<PromotionHistoryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('student_promotion_history')
    .select('*')
    .eq('student_id', studentId)
    .order('promoted_at', { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data ?? [];
}

export async function getRecentPromotions(limit = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('promotion_log_overview')
    .select('*')
    .order('promoted_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(error);
    return [];
  }

  return data ?? [];
}

export async function getSessionUserProfile(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    console.error('Failed to get user', userError);
    return null;
  }

  const user = userData.user;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  if (error && error.message !== 'Results contain 0 rows') {
    console.error('Failed to read session user profile', error);
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const roleSource = profile?.role ?? (metadata.role as string | undefined);

  const finalRole = normalizeRole(roleSource);

  return {
    id: user.id,
    email: user.email ?? '',
    fullName: profile?.full_name ?? (metadata.full_name as string | undefined) ?? null,
    role: finalRole,
  };
}


