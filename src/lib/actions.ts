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
  parent_name: z.string().optional(),
  parent_phone: z.string().optional(),
  alt_phone: z.string().optional(),
  home_address: z.string().optional(),
  notes: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  date_of_birth: z.preprocess((value) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  }, z.date().optional()),
  date_joined: z.preprocess((value) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  }, z.date()),
  status: z.enum(['active', 'transferred', 'graduated', 'inactive']).default('active'),
});

const updateStudentSchema = createStudentSchema.extend({
  student_id: z.string().uuid('Invalid student selected'),
});

const createClassSchema = z.object({
  name: z.string().min(2, 'Class name is required'),
  capacity: z.preprocess((value) => {
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  }, z.number().int().positive().optional()),
  level_order: z.preprocess((value) => {
    const num = Number(value);
    return Number.isNaN(num) ? 0 : num;
  }, z.number().int().nonnegative()),
});

const createTeacherSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['OWNER', 'TEACHER']),
});

const createFeeStructureSchema = z.object({
  class_id: z.string().uuid('Please select a valid class'),
  academic_year: z.string().min(4, 'Academic year is required'),
  term: z.enum(['TERM_1', 'TERM_2', 'TERM_3']),
  expected_amount: z.preprocess((value) => Number(value), z.number().positive('Expected amount must be greater than zero')),
});

const recordFeePaymentSchema = z.object({
  student_fee_account_id: z.string().uuid('Select a fee account'),
  amount: z.preprocess((value) => Number(value), z.number().positive('Payment amount must be greater than zero')),
  receipt_number: z.string().min(1, 'Receipt number is required'),
});

const updateFeePaymentSchema = recordFeePaymentSchema.extend({
  payment_id: z.string().uuid('Payment identifier is required'),
});

const deleteFeePaymentSchema = z.object({
  payment_id: z.string().uuid('Payment identifier is required'),
});

const assignTeacherClassSchema = z.object({
  teacher_id: z.string().uuid(),
  class_id: z.string().uuid(),
});

const toggleTeacherStatusSchema = z.object({
  teacher_id: z.string().uuid(),
  is_active: z.string().transform((value) => value === 'true'),
});

const promoteStudentsSchema = z.object({
  current_class_id: z.string().uuid(),
  student_ids: z.array(z.string().uuid()).min(1, 'Select at least one student to promote'),
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

  const parsed = createStudentSchema.safeParse({
    full_name: String(formData.get('full_name') ?? '').trim(),
    class_id: String(formData.get('class_id') ?? ''),
    parent_name: String(formData.get('parent_name') ?? '').trim() || undefined,
    parent_phone: String(formData.get('parent_phone') ?? '').trim() || undefined,
    alt_phone: String(formData.get('alt_phone') ?? '').trim() || undefined,
    home_address: String(formData.get('home_address') ?? '').trim() || undefined,
    notes: String(formData.get('notes') ?? '').trim() || undefined,
    gender: (String(formData.get('gender') ?? '') as 'male' | 'female' | 'other') || undefined,
    date_of_birth: formData.get('date_of_birth'),
    date_joined: formData.get('date_joined'),
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
      parent_name: parsed.data.parent_name ?? null,
      parent_phone: parsed.data.parent_phone ?? null,
      alt_phone: parsed.data.alt_phone ?? null,
      home_address: parsed.data.home_address ?? null,
      notes: parsed.data.notes ?? null,
      gender: parsed.data.gender ?? null,
      date_of_birth: parsed.data.date_of_birth ?? null,
      date_joined: parsed.data.date_joined,
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

  const parsed = updateStudentSchema.safeParse({
    student_id: String(formData.get('student_id') ?? ''),
    full_name: String(formData.get('full_name') ?? '').trim(),
    class_id: String(formData.get('class_id') ?? ''),
    parent_name: String(formData.get('parent_name') ?? '').trim() || undefined,
    parent_phone: String(formData.get('parent_phone') ?? '').trim() || undefined,
    alt_phone: String(formData.get('alt_phone') ?? '').trim() || undefined,
    home_address: String(formData.get('home_address') ?? '').trim() || undefined,
    notes: String(formData.get('notes') ?? '').trim() || undefined,
    gender: (String(formData.get('gender') ?? '') as 'male' | 'female' | 'other') || undefined,
    date_of_birth: formData.get('date_of_birth'),
    date_joined: formData.get('date_joined'),
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

    const { error } = await supabase
      .from('students')
      .update({
        full_name: parsed.data.full_name,
        class_id: parsed.data.class_id,
        parent_name: parsed.data.parent_name ?? null,
        parent_phone: parsed.data.parent_phone ?? null,
        alt_phone: parsed.data.alt_phone ?? null,
        home_address: parsed.data.home_address ?? null,
        notes: parsed.data.notes ?? null,
        gender: parsed.data.gender ?? null,
        date_of_birth: parsed.data.date_of_birth ?? null,
        date_joined: parsed.data.date_joined,
        status: parsed.data.status,
      })
      .eq('id', parsed.data.student_id);

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

  const parsed = createClassSchema.safeParse({
    name: String(formData.get('name') ?? '').trim(),
    capacity: formData.get('capacity'),
    level_order: formData.get('level_order'),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Provide valid class details.' };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('classes').insert({
      name: parsed.data.name,
      capacity: parsed.data.capacity ?? null,
      level_order: parsed.data.level_order,
    });
    if (error) throw error;
  } catch (e) {
    return handleActionError(e);
  }

  revalidatePath('/classes');
  redirect('/classes');
}

export async function createFeeStructureAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();

  const parsed = createFeeStructureSchema.safeParse({
    class_id: String(formData.get('class_id') ?? ''),
    academic_year: String(formData.get('academic_year') ?? '').trim(),
    term: String(formData.get('term') ?? ''),
    expected_amount: formData.get('expected_amount'),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Provide valid fee structure details.' };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('fee_structures').insert({
      class_id: parsed.data.class_id,
      academic_year: parsed.data.academic_year,
      term: parsed.data.term,
      expected_amount: parsed.data.expected_amount,
    });
    if (error) throw error;
  } catch (e) {
    return handleActionError(e);
  }

  revalidatePath('/fees');
  revalidatePath('/dashboard');
  return { success: 'Fee structure created successfully.' };
}

export async function recordFeePaymentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();

  const parsed = recordFeePaymentSchema.safeParse({
    student_fee_account_id: String(formData.get('student_fee_account_id') ?? ''),
    amount: formData.get('amount'),
    receipt_number: String(formData.get('receipt_number') ?? '').trim(),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Provide valid payment details.' };
  }

  const studentId = String(formData.get('student_id') ?? '');

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('fee_payments').insert({
      student_fee_account_id: parsed.data.student_fee_account_id,
      amount: parsed.data.amount,
      receipt_number: parsed.data.receipt_number,
    });
    if (error) throw error;
  } catch (e) {
    return handleActionError(e);
  }

  if (studentId) {
    revalidatePath(`/students/${studentId}`);
  }
  revalidatePath('/fees');
  revalidatePath('/dashboard');
  return { success: 'Payment recorded successfully.' };
}

export async function updateFeePaymentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();

  const parsed = updateFeePaymentSchema.safeParse({
    payment_id: String(formData.get('payment_id') ?? ''),
    student_fee_account_id: String(formData.get('student_fee_account_id') ?? ''),
    amount: formData.get('amount'),
    receipt_number: String(formData.get('receipt_number') ?? '').trim(),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Provide valid payment update details.' };
  }

  const studentId = String(formData.get('student_id') ?? '');

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('fee_payments')
      .update({
        amount: parsed.data.amount,
        receipt_number: parsed.data.receipt_number,
      })
      .eq('id', parsed.data.payment_id);
    if (error) throw error;
  } catch (e) {
    return handleActionError(e);
  }

  if (studentId) {
    revalidatePath(`/students/${studentId}`);
  }
  revalidatePath('/fees');
  revalidatePath('/dashboard');
  return { success: 'Payment updated successfully.' };
}

export async function deleteFeePaymentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();

  const parsed = deleteFeePaymentSchema.safeParse({
    payment_id: String(formData.get('payment_id') ?? ''),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Unable to delete payment.' };
  }

  const studentId = String(formData.get('student_id') ?? '');

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('fee_payments')
      .delete()
      .eq('id', parsed.data.payment_id);
    if (error) throw error;
  } catch (e) {
    return handleActionError(e);
  }

  if (studentId) {
    revalidatePath(`/students/${studentId}`);
  }
  revalidatePath('/fees');
  revalidatePath('/dashboard');
  return { success: 'Payment deleted successfully.' };
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

    const supabase = await createClient();
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      is_active: true,
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

    const supabase = await createClient();
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      is_active: true,
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

export async function toggleTeacherStatusAction(formData: FormData): Promise<void> {
  await requireOwner();
  const parsed = toggleTeacherStatusSchema.safeParse({
    teacher_id: formData.get('teacher_id'),
    is_active: formData.get('is_active'),
  });

  if (!parsed.success) {
    throw new Error('Selected teacher record is invalid.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: parsed.data.is_active })
    .eq('id', parsed.data.teacher_id);

  if (error) {
    throw error;
  }

  revalidatePath('/teachers');
  redirect('/teachers');
}

export async function promoteStudentsAction(formData: FormData): Promise<void> {
  await requireOwner();

  const studentIds = formData.getAll('student_ids').map((value) => String(value));
  const parsed = promoteStudentsSchema.safeParse({
    current_class_id: formData.get('current_class_id'),
    target_class_id: formData.get('target_class_id'),
    student_ids: studentIds,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Provide valid promotion details.');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('promote_students', {
    current_class_id: parsed.data.current_class_id,
    student_ids: parsed.data.student_ids,
  });

  if (error) {
    throw error;
  }

  revalidatePath('/students');
  revalidatePath('/promotions');
  redirect('/promotions');
}
