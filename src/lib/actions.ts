'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireOwner, requireSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type ActionState = {
  error?: string;
  success?: string;
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function loginAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: 'Enter a valid email address and password.' };
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: error.message };
  }

  redirect('/dashboard');
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function createStudentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireSessionUser();
  const supabase = await createClient();
  const payload = {
    full_name: String(formData.get('full_name') ?? ''),
    class_id: String(formData.get('class_id') ?? ''),
    parent_contact: String(formData.get('parent_contact') ?? ''),
    status: String(formData.get('status') ?? 'active'),
  };

  const { error } = await supabase.from('students').insert(payload);
  if (error) {
    return { error: error.message };
  }

  revalidatePath('/students');
  revalidatePath('/dashboard');
  return { success: 'Student added successfully.' };
}

export async function createClassAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const supabase = await createClient();
  const payload = {
    name: String(formData.get('name') ?? ''),
    section: String(formData.get('section') ?? '') || null,
    level_order: Number(formData.get('level_order') ?? 0),
  };

  const { error } = await supabase.from('classes').insert(payload);
  if (error) {
    return { error: error.message };
  }

  revalidatePath('/classes');
  return { success: 'Class created successfully.' };
}

export async function recordPaymentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireSessionUser();
  const supabase = await createClient();
  const payload = {
    fee_ledger_id: String(formData.get('fee_ledger_id') ?? ''),
    amount: Number(formData.get('amount') ?? 0),
    payment_date: String(formData.get('payment_date') ?? new Date().toISOString().slice(0, 10)),
    payment_method: String(formData.get('payment_method') ?? 'cash'),
  };

  const { error } = await supabase.from('fee_payments').insert(payload);
  if (error) {
    return { error: error.message };
  }

  revalidatePath('/fees');
  revalidatePath('/dashboard');
  return { success: 'Payment recorded successfully.' };
}

export async function createFeeLedgerAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const supabase = await createClient();
  const payload = {
    student_id: String(formData.get('student_id') ?? ''),
    session_label: String(formData.get('session_label') ?? ''),
    total_fee: Number(formData.get('total_fee') ?? 0),
  };

  const { error } = await supabase.from('student_fee_ledgers').insert(payload);
  if (error) {
    return { error: error.message };
  }

  revalidatePath('/fees');
  return { success: 'Fee ledger created successfully.' };
}

export async function upsertMarkAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireSessionUser();
  const supabase = await createClient();
  const payload = {
    student_id: String(formData.get('student_id') ?? ''),
    subject_id: String(formData.get('subject_id') ?? ''),
    term: String(formData.get('term') ?? 'TERM_1'),
    score: Number(formData.get('score') ?? 0),
    max_score: Number(formData.get('max_score') ?? 100),
  };

  const { error } = await supabase
    .from('marks')
    .upsert(payload, { onConflict: 'student_id,subject_id,term' });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/results');
  revalidatePath('/dashboard');
  return { success: 'Marks updated successfully.' };
}
