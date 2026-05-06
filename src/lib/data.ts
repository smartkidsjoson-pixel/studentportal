import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import type {
  ClassSummary,
  DashboardStats,
  FeeStatementData,
  FeeSummary,
  MeritEntry,
  ReportCardData,
  SessionUser,
  StudentDirectoryItem,
  SubjectPerformance,
  TeacherClassAssignment,
  TeacherProfile,
} from '@/lib/types';

export async function getClasses(): Promise<ClassSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('class_overview')
    .select('*')
    .order('level_order', { ascending: true })
    .order('name', { ascending: true });

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
    .select('id, full_name, role')
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
    .select('id, teacher_id, class_id, class_name:classes(name)')
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  return (
    data?.map((assignment: any) => ({
      id: assignment.id,
      teacher_id: assignment.teacher_id,
      class_id: assignment.class_id,
      class_name: assignment.class_name ?? 'Unknown',
    })) ?? []
  );
}

export async function getStudents(params?: { query?: string; classId?: string }): Promise<StudentDirectoryItem[]> {
  const supabase = await createClient();
  const query = params?.query?.trim();

  let builder = supabase
    .from('student_directory')
    .select('*')
    .order('full_name', { ascending: true })
    .limit(100);

  if (params?.classId) {
    builder = builder.eq('class_id', params.classId);
  }

  if (query) {
    builder = builder.or(`full_name.ilike.%${query}%,admission_number.ilike.%${query}%`);
  }

  const { data, error } = await builder;

  if (error) {
    console.error(error);
    return [];
  }

  return data ?? [];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const [studentsCount, feeSummary, topStudents, classDistribution] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('fee_dashboard_summary').select('total_collected, outstanding_balance').single(),
    supabase.from('overall_merit_list').select('*').limit(5),
    supabase.from('class_distribution').select('*').order('level_order', { ascending: true }),
  ]);

  return {
    totalStudents: studentsCount.count ?? 0,
    totalFeesCollected: feeSummary.data?.total_collected ?? 0,
    outstandingFees: feeSummary.data?.outstanding_balance ?? 0,
    topStudents:
      topStudents.data?.map((entry) => ({
        studentId: entry.student_id,
        fullName: entry.full_name,
        averageScore: Number(entry.average_score ?? 0),
        className: entry.class_name,
      })) ?? [],
    classDistribution:
      classDistribution.data?.map((entry) => ({
        className: entry.class_name,
        studentCount: entry.student_count,
      })) ?? [],
  };
}

export async function getFeeSummaries(filter?: string): Promise<FeeSummary[]> {
  const supabase = await createClient();
  let builder = supabase
    .from('fee_balances')
    .select('*')
    .order('balance', { ascending: false })
    .limit(100);

  if (filter && ['paid', 'partial', 'unpaid'].includes(filter)) {
    builder = builder.eq('fee_state', filter);
  }

  const { data, error } = await builder;

  if (error) {
    console.error(error);
    return [];
  }

  return data ?? [];
}

export async function getMeritList(classId?: string, term?: string): Promise<MeritEntry[]> {
  const supabase = await createClient();
  let builder = supabase.from('term_merit_list').select('*').order('position', { ascending: true }).limit(100);

  if (classId) {
    builder = builder.eq('class_id', classId);
  }

  if (term) {
    builder = builder.eq('term', term);
  }

  const { data, error } = await builder;

  if (error) {
    console.error(error);
    return [];
  }

  return data ?? [];
}

export async function getSubjectPerformance(classId?: string, term?: string): Promise<SubjectPerformance[]> {
  const supabase = await createClient();
  let builder = supabase.from('subject_performance_summary').select('*').order('average_score', { ascending: false }).limit(20);

  if (classId) {
    builder = builder.eq('class_id', classId);
  }

  if (term) {
    builder = builder.eq('term', term);
  }

  const { data, error } = await builder;

  if (error) {
    console.error(error);
    return [];
  }

  return data ?? [];
}

export async function getSessionUserProfile(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single();

  return {
    id: user.id,
    email: user.email ?? '',
    fullName: data?.full_name ?? null,
    role: data?.role ?? 'TEACHER',
  };
}

export async function getReportCardData(studentId: string): Promise<ReportCardData> {
  const supabase = await createClient();
  const [{ data: student }, { data: marks }, { data: totals }] = await Promise.all([
    supabase.from('student_directory').select('*').eq('id', studentId).single(),
    supabase.from('academic_marks_view').select('*').eq('student_id', studentId).order('term').order('subject_name'),
    supabase.from('student_term_totals').select('*').eq('student_id', studentId).order('term'),
  ]);

  if (!student) {
    notFound();
  }

  return {
    student: {
      id: student.id,
      full_name: student.full_name,
      admission_number: student.admission_number,
      class_name: student.class_name,
      parent_contact: student.parent_contact,
    },
    marks:
      marks?.map((entry) => ({
        subject_name: entry.subject_name,
        term: entry.term,
        score: Number(entry.score),
        max_score: Number(entry.max_score),
      })) ?? [],
    totals:
      totals?.map((entry) => ({
        term: entry.term,
        total_score: Number(entry.total_score),
        average_score: Number(entry.average_score),
        position_in_class: entry.position_in_class,
        overall_position: entry.overall_position,
      })) ?? [],
  };
}

export async function getFeeStatementData(studentId: string): Promise<FeeStatementData> {
  const supabase = await createClient();
  const [{ data: student }, { data: ledgers }, { data: payments }] = await Promise.all([
    supabase.from('student_directory').select('*').eq('id', studentId).single(),
    supabase.from('student_fee_ledgers').select('*').eq('student_id', studentId).order('session_label', { ascending: false }),
    supabase.from('payment_history_view').select('*').eq('student_id', studentId).order('payment_date', { ascending: false }),
  ]);

  if (!student) {
    notFound();
  }

  return {
    student: {
      id: student.id,
      full_name: student.full_name,
      admission_number: student.admission_number,
      class_name: student.class_name,
    },
    ledgers:
      ledgers?.map((entry) => ({
        ledger_id: entry.id,
        session_label: entry.session_label,
        total_fee: Number(entry.total_fee),
        amount_paid: Number(entry.amount_paid),
        balance: Number(entry.balance),
      })) ?? [],
    payments:
      payments?.map((entry) => ({
        id: entry.id,
        amount: Number(entry.amount),
        payment_date: entry.payment_date,
        payment_method: entry.payment_method,
        session_label: entry.session_label,
        recorded_by_name: entry.recorded_by_name,
      })) ?? [],
  };
}
