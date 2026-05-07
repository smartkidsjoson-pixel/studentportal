'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireOwner, requireSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type ActionState = {
  error?: string;
  success?: string;
};

function parseInteger(value: FormDataEntryValue | null, defaultValue = 0): number {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function handleActionError(error: unknown): ActionState {
  console.error(error);

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('invalid login') || message.includes('invalid password') || message.includes('credentials')) {
      return { error: 'Invalid login credentials' };
    }
    if (message.includes('duplicate') || message.includes('already exists') || message.includes('unique')) {
      return { error: 'Record already exists. Please check and try again.' };
    }
    if (message.includes('not found')) {
      return { error: 'Resource not found. Please try again.' };
    }
    if (message.includes('invalid')) {
      return { error: 'Invalid input provided. Please check your data.' };
    }
    if (message.includes('unauthorized') || message.includes('permission')) {
      return { error: 'You do not have permission to perform this action.' };
    }
  }

  return { error: 'An error occurred. Please try again.' };
}

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const createStudentSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  class_id: z.string().uuid('Please select a valid class'),
  parent_contact: z.string().optional(),
  status: z.enum(['active', 'transferred', 'graduated']).default('active'),
});

const updateStudentSchema = createStudentSchema.extend({
  student_id: z.string().uuid('Invalid student selected'),
});

const createTeacherSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['OWNER', 'TEACHER']),
});

const assignTeacherClassSchema = z.object({
  teacher_id: z.string().uuid(),
  class_id: z.string().uuid(),
});

const upsertMarkSchema = z.object({
  student_id: z.string().uuid('Invalid student'),
  subject_id: z.string().uuid('Invalid subject'),
  term: z.enum(['TERM_1', 'TERM_2', 'TERM_3']),
  score: z.number().int().min(0).max(100, 'Score must be between 0 and 100'),
  max_score: z.number().int().min(1).default(100),
});

export async function loginAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: 'Enter a valid email address and password.' };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) throw error;
  } catch (e) {
    return handleActionError(e);
  }

  redirect('/dashboard');
}

export async function logoutAction() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (e) {
    console.error(e);
  }

  redirect('/login');
}

export async function createStudentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const sessionUser = await requireSessionUser();

  const parentContact = String(formData.get('parent_contact') ?? '').trim();
  const parsed = createStudentSchema.safeParse({
    full_name: String(formData.get('full_name') ?? '').trim(),
    class_id: String(formData.get('class_id') ?? ''),
    parent_contact: parentContact || undefined,
    status: String(formData.get('status') ?? 'active'),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Provide valid student information.' };
  }

  try {
    const supabase = await createClient();

    if (sessionUser.role === 'TEACHER') {
      const { data: assignment, error: assignmentError } = await supabase
        .from('teacher_class_assignments')
        .select('id')
        .eq('teacher_id', sessionUser.id)
        .eq('class_id', parsed.data.class_id)
        .single();

      if (assignmentError && assignmentError.message !== 'Results contain 0 rows') {
        throw assignmentError;
      }
      if (!assignment) {
        return { error: 'You are not allowed to add students to this class.' };
      }
    }

    const payload = {
      full_name: parsed.data.full_name,
      class_id: parsed.data.class_id,
      parent_contact: parsed.data.parent_contact ?? null,
      status: parsed.data.status,
    };

    const { error } = await supabase.from('students').insert(payload);
    if (error) throw error;
  } catch (e) {
    return handleActionError(e);
  }

  revalidatePath('/students');
  revalidatePath('/dashboard');
  redirect('/students');
}

export async function updateStudentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const sessionUser = await requireSessionUser();

  const parentContact = String(formData.get('parent_contact') ?? '').trim();
  const parsed = updateStudentSchema.safeParse({
    student_id: String(formData.get('student_id') ?? ''),
    full_name: String(formData.get('full_name') ?? '').trim(),
    class_id: String(formData.get('class_id') ?? ''),
    parent_contact: parentContact || undefined,
    status: String(formData.get('status') ?? 'active'),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Provide valid student details.' };
  }

  try {
    const supabase = await createClient();
    const { data: currentStudent, error: studentError } = await supabase
      .from('students')
      .select('class_id')
      .eq('id', parsed.data.student_id)
      .single();

    if (studentError) throw studentError;
    if (!currentStudent) {
      return { error: 'Student not found.' };
    }

    if (sessionUser.role === 'TEACHER') {
      if (currentStudent.class_id !== parsed.data.class_id) {
        return { error: 'You are not allowed to move this student to another class.' };
      }

      const { data: assignment, error: assignmentError } = await supabase
        .from('teacher_class_assignments')
        .select('id')
        .eq('teacher_id', sessionUser.id)
        .eq('class_id', currentStudent.class_id)
        .single();

      if (assignmentError && assignmentError.message !== 'Results contain 0 rows') {
        throw assignmentError;
      }
      if (!assignment) {
        return { error: 'You are not allowed to update this student.' };
      }
    }

    const { error } = await supabase.from('students').update({
      full_name: parsed.data.full_name,
      class_id: parsed.data.class_id,
      parent_contact: parsed.data.parent_contact ?? null,
      status: parsed.data.status,
    }).eq('id', parsed.data.student_id);

    if (error) throw error;
  } catch (e) {
    return handleActionError(e);
  }

  revalidatePath('/students');
  revalidatePath('/dashboard');
  return { success: 'Student record updated successfully.' };
}

export async function createClassAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();

  try {
    const supabase = await createClient();
    const payload = {
      name: String(formData.get('name') ?? ''),
      section: String(formData.get('section') ?? '') || null,
      level_order: parseInteger(formData.get('level_order')),
    };

    const { error } = await supabase.from('classes').insert(payload);
    if (error) throw error;
  } catch (e) {
    return handleActionError(e);
  }

  revalidatePath('/classes', 'layout');
  redirect('/classes');
}

export async function createTeacherAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const parsed = createTeacherSchema.safeParse({
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
  });

  if (!parsed.success) {
    return { error: 'Provide valid staff details and a secure password.' };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      user_metadata: {
        full_name: parsed.data.full_name,
        role: parsed.data.role,
      },
      email_confirm: true,
    });
    if (error) throw error;

    // Insert into profiles table
    const supabase = await createClient();
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: parsed.data.full_name,
      role: parsed.data.role,
    });
    if (profileError) throw profileError;
  } catch (e) {
    return handleActionError(e);
  }

  revalidatePath('/teachers');
  redirect('/teachers');
}

export async function createInitialAdminAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createTeacherSchema.safeParse({
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
  });

  if (!parsed.success) {
    return { error: 'Provide valid administrator details and a secure password.' };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      user_metadata: {
        full_name: parsed.data.full_name,
        role: parsed.data.role,
      },
      email_confirm: true,
    });
    if (error) throw error;

    // Insert into profiles table
    const supabase = await createClient();
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: parsed.data.full_name,
      role: parsed.data.role,
    });
    if (profileError) throw profileError;
  } catch (e) {
    return handleActionError(e);
  }

  return { success: 'Administrator account created successfully. You can now log in.' };
}

export async function assignTeacherClassAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const parsed = assignTeacherClassSchema.safeParse({
    teacher_id: formData.get('teacher_id'),
    class_id: formData.get('class_id'),
  });

  if (!parsed.success) {
    return { error: 'Select a valid teacher and class.' };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('teacher_class_assignments')
      .upsert(
        {
          teacher_id: parsed.data.teacher_id,
          class_id: parsed.data.class_id,
        },
        { onConflict: 'teacher_class_assignments_teacher_id_class_id_key' },
      );
    if (error) throw error;
  } catch (e) {
    return handleActionError(e);
  }

  revalidatePath('/teachers');
  redirect('/teachers');
}

export async function upsertMarkAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const sessionUser = await requireSessionUser();

  const parsed = upsertMarkSchema.safeParse({
    student_id: String(formData.get('student_id') ?? ''),
    subject_id: String(formData.get('subject_id') ?? ''),
    term: String(formData.get('term') ?? 'TERM_1'),
    score: parseInteger(formData.get('score')),
    max_score: parseInteger(formData.get('max_score')),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Provide valid marks details.' };
  }

  try {
    const supabase = await createClient();

    if (sessionUser.role === 'TEACHER') {
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('class_id')
        .eq('id', parsed.data.student_id)
        .single();

      if (studentError) throw studentError;
      if (!student?.class_id) {
        return { error: 'You are not allowed to enter marks for this student.' };
      }

      const { data: assignment, error: assignmentError } = await supabase
        .from('teacher_class_assignments')
        .select('id')
        .eq('teacher_id', sessionUser.id)
        .eq('class_id', student.class_id)
        .single();

      if (assignmentError && assignmentError.message !== 'Results contain 0 rows') {
        throw assignmentError;
      }
      if (!assignment) {
        return { error: 'You are not allowed to enter marks for this student.' };
      }
    }

    const payload = {
      student_id: parsed.data.student_id,
      subject_id: parsed.data.subject_id,
      term: parsed.data.term,
      score: parsed.data.score,
      max_score: parsed.data.max_score,
    };

    const { error } = await supabase
      .from('marks')
      .upsert(payload, { onConflict: 'student_id,subject_id,term' });
    if (error) throw error;
  } catch (e) {
    return handleActionError(e);
  }

  revalidatePath('/results');
  revalidatePath('/dashboard');
  redirect('/results');
}
