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

function parseFloatValue(value: FormDataEntryValue | null, defaultValue = 0): number {
  const parsed = parseFloat(String(value ?? ''));
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function handleActionError(error: unknown): ActionState {
  console.error(error);
  return { error: 'Failed' };
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
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
  await requireSessionUser();

  try {
    const supabase = await createClient();
    const payload = {
      full_name: String(formData.get('full_name') ?? ''),
      class_id: String(formData.get('class_id') ?? ''),
      parent_contact: String(formData.get('parent_contact') ?? ''),
      status: String(formData.get('status') ?? 'active'),
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

  revalidatePath('/classes');
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
    const { error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      user_metadata: {
        full_name: parsed.data.full_name,
        role: parsed.data.role,
      },
      email_confirm: true,
    });
    if (error) throw error;
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
    const { error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      user_metadata: {
        full_name: parsed.data.full_name,
        role: parsed.data.role,
      },
      email_confirm: true,
    });
    if (error) throw error;
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

export async function recordPaymentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireSessionUser();

  try {
    const supabase = await createClient();
    const payload = {
      fee_ledger_id: String(formData.get('fee_ledger_id') ?? ''),
      amount: parseFloatValue(formData.get('amount')),
      payment_date: String(formData.get('payment_date') ?? new Date().toISOString().slice(0, 10)),
      payment_method: String(formData.get('payment_method') ?? 'cash'),
    };

    const { error } = await supabase.from('fee_payments').insert(payload);
    if (error) throw error;
  } catch (e) {
    return handleActionError(e);
  }

  revalidatePath('/fees');
  revalidatePath('/dashboard');
  redirect('/fees');
}

export async function createFeeLedgerAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();

  try {
    const supabase = await createClient();
    const payload = {
      student_id: String(formData.get('student_id') ?? ''),
      session_label: String(formData.get('session_label') ?? ''),
      total_fee: parseFloatValue(formData.get('total_fee')),
    };

    const { error } = await supabase.from('student_fee_ledgers').insert(payload);
    if (error) throw error;
  } catch (e) {
    return handleActionError(e);
  }

  revalidatePath('/fees');
  redirect('/fees');
}

export async function upsertMarkAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireSessionUser();

  try {
    const supabase = await createClient();
    const payload = {
      student_id: String(formData.get('student_id') ?? ''),
      subject_id: String(formData.get('subject_id') ?? ''),
      term: String(formData.get('term') ?? 'TERM_1'),
      score: parseInteger(formData.get('score')),
      max_score: parseInteger(formData.get('max_score')),
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
