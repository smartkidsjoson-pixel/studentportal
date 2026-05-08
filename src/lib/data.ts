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
    .from('profiles')
    .select('id, full_name, role, is_active')
    .in('role', ['OWNER', 'TEACHER'])
    .order('full_name', { ascending: true });

  if (error) {
    console.error(error);
    return [];
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
    .single();

  if (error) {
    console.error(error);
    return null;
  }

  return data ?? null;
}

export async function getFeeStructures(): Promise<FeeStructureSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('fee_structure_overview')
    .select('*')
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
  const supabase = await createClient();

  const [accountsResponse, paymentsResponse] = await Promise.all([
    supabase
      .from('student_fee_accounts_overview')
      .select('*')
      .eq('student_id', studentId)
      .order('academic_year', { ascending: false })
      .order('term', { ascending: true }),
    supabase
      .from('fee_payment_history')
      .select('*')
      .eq('student_id', studentId)
      .order('payment_date', { ascending: false }),
  ]);

  if (accountsResponse.error) {
    console.error(accountsResponse.error);
  }
  if (paymentsResponse.error) {
    console.error(paymentsResponse.error);
  }

  return {
    accounts: accountsResponse.data ?? [],
    payments: paymentsResponse.data ?? [],
  };
}

export async function getFeeDashboardStats(): Promise<FeeDashboardStats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('fee_dashboard_overview')
    .select('*')
    .single();

  if (error) {
    console.error(error);
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


