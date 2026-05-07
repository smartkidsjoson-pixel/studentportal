import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import type {
  ClassSummary,
  DashboardStats,
  MeritEntry,
  ReportCardData,
  SessionUser,
  StudentDirectoryItem,
  SubjectPerformance,
  TeacherClassAssignment,
  TeacherProfile,
  UserRole,
} from '@/lib/types';

function normalizeRole(role: unknown): UserRole {
  if (role === 'OWNER' || role === 'TEACHER' || role === 'ADMIN') {
    return role;
  }

  return 'TEACHER';
}

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

export async function getStudents(params?: { query?: string; classId?: string; page?: number; pageSize?: number }): Promise<StudentDirectoryItem[]> {
  const supabase = await createClient();
  const query = params?.query?.trim();
  const pageSize = params?.pageSize ?? 12;
  const page = params?.page && params.page > 0 ? params.page : 1;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let builder = supabase
    .from('student_directory')
    .select('*')
    .order('full_name', { ascending: true })
    .range(from, to);

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

export async function getStudentsCount(params?: { query?: string; classId?: string }): Promise<number> {
  const supabase = await createClient();
  const query = params?.query?.trim();

  let builder = supabase
    .from('student_directory')
    .select('id', { count: 'exact', head: true });

  if (params?.classId) {
    builder = builder.eq('class_id', params.classId);
  }

  if (query) {
    builder = builder.or(`full_name.ilike.%${query}%,admission_number.ilike.%${query}%`);
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

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const [studentsCount, classesCount, topStudents, classDistribution] = await Promise.all([
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('classes')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('overall_merit_list')
      .select('*')
      .limit(5),
    supabase
      .from('class_distribution')
      .select('*')
      .order('level_order', { ascending: true }),
  ]);

  return {
    totalStudents: studentsCount.count ?? 0,
    totalClasses: classesCount.count ?? 0,
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
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('Failed to refresh session', sessionError);
  }

  const user = sessionData?.session?.user ?? (await supabase.auth.getUser()).data.user;

  if (!user) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  if (error && error.message !== 'Results contain 0 rows') {
    console.error('Failed to read session user profile', error);
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const roleSource = profile?.role;

  const finalRole = normalizeRole(roleSource);

  return {
    id: user.id,
    email: user.email ?? '',
    fullName: profile?.full_name ?? (metadata.full_name as string | undefined) ?? null,
    role: finalRole,
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


