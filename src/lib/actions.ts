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

const removeTeacherClassSchema = z.object({
  teacher_id: z.string().uuid(),
  class_id: z.string().uuid(),
});

const deleteTeacherSchema = z.object({
  teacher_id: z.string().uuid(),
});

const promoteStudentsSchema = z.object({
  current_class_id: z.string().uuid(),
  target_class_id: z.string().uuid().optional(),
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
    console.warn('[Teacher Creation] Validation failed:', parsed.error.errors);
    return { error: 'Provide valid staff details and a secure password.' };
  }

  try {
    console.log('[Teacher Creation] Starting creation for:', parsed.data.email, 'Role:', parsed.data.role);
    
    const admin = createAdminClient();
    console.log('[Teacher Creation] Creating auth user');
    
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      user_metadata: {
        full_name: parsed.data.full_name,
        role: parsed.data.role,
      },
      email_confirm: true,
    });
    
    if (error) {
      console.error('[Teacher Creation] Auth creation failed:', error);
      throw error;
    }
    
    console.log('[Teacher Creation] Auth user created with ID:', data.user.id);

    const supabase = await createClient();
    console.log('[Teacher Creation] Creating profile record');
    
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      is_active: true,
    });
    
    if (profileError) {
      console.error('[Teacher Creation] Profile creation failed:', profileError);
      throw profileError;
    }
    
    console.log('[Teacher Creation] Teacher created successfully:', data.user.id);
  } catch (e) {
    console.error('[Teacher Creation] Caught error:', e);
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
    console.warn('[Initial Admin Creation] Validation failed:', parsed.error.errors);
    return { error: 'Provide valid administrator details and a secure password.' };
  }

  try {
    console.log('[Initial Admin Creation] Starting creation for:', parsed.data.email);
    
    const admin = createAdminClient();
    console.log('[Initial Admin Creation] Creating auth user');
    
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      user_metadata: {
        full_name: parsed.data.full_name,
        role: parsed.data.role,
      },
      email_confirm: true,
    });
    
    if (error) {
      console.error('[Initial Admin Creation] Auth creation failed:', error);
      throw error;
    }

    console.log('[Initial Admin Creation] Auth user created with ID:', data.user.id);

    const supabase = await createClient();
    console.log('[Initial Admin Creation] Creating profile record');
    
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      is_active: true,
    });
    
    if (profileError) {
      console.error('[Initial Admin Creation] Profile creation failed:', profileError);
      throw profileError;
    }

    console.log('[Initial Admin Creation] Initial admin created successfully');
  } catch (e) {
    console.error('[Initial Admin Creation] Caught error:', e);
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
    console.warn('[Class Assignment] Validation failed:', parsed.error.errors);
    return { error: 'Select a valid teacher and class.' };
  }

  try {
    console.log('[Class Assignment] Starting assignment for teacher:', parsed.data.teacher_id, 'to class:', parsed.data.class_id);
    
    const supabase = await createClient();
    
    // Check if teacher exists and is active
    console.log('[Class Assignment] Verifying teacher exists and is active');
    const { data: teacher, error: teacherError } = await supabase
      .from('profiles')
      .select('id, full_name, is_active')
      .eq('id', parsed.data.teacher_id)
      .single();
    
    if (teacherError || !teacher) {
      console.error('[Class Assignment] Teacher not found:', teacherError);
      return { error: 'Selected teacher not found.' };
    }

    if (!teacher.is_active) {
      console.warn('[Class Assignment] Cannot assign inactive teacher:', parsed.data.teacher_id);
      return { error: 'Cannot assign an inactive teacher to a class.' };
    }

    console.log('[Class Assignment] Teacher verified:', teacher.full_name);
    
    const { error } = await supabase
      .from('teacher_class_assignments')
      .upsert(
        {
          teacher_id: parsed.data.teacher_id,
          class_id: parsed.data.class_id,
        },
        { onConflict: 'teacher_class_assignments_teacher_id_class_id_key' },
      );
    
    if (error) {
      console.error('[Class Assignment] Assignment failed:', error);
      throw error;
    }

    console.log('[Class Assignment] Successfully assigned teacher to class');
  } catch (e) {
    console.error('[Class Assignment] Caught error:', e);
    return handleActionError(e);
  }

  revalidatePath('/teachers');
  redirect('/teachers');
}

export async function removeTeacherClassAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const parsed = removeTeacherClassSchema.safeParse({
    teacher_id: formData.get('teacher_id'),
    class_id: formData.get('class_id'),
  });

  if (!parsed.success) {
    console.warn('[Class Removal] Validation failed:', parsed.error.errors);
    return { error: 'Select a valid teacher and class.' };
  }

  try {
    console.log('[Class Removal] Removing teacher:', parsed.data.teacher_id, 'from class:', parsed.data.class_id);
    
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('teacher_class_assignments')
      .delete()
      .eq('teacher_id', parsed.data.teacher_id)
      .eq('class_id', parsed.data.class_id);
    
    if (error) {
      console.error('[Class Removal] Removal failed:', error);
      throw error;
    }

    console.log('[Class Removal] Successfully removed teacher from class');
  } catch (e) {
    console.error('[Class Removal] Caught error:', e);
    return handleActionError(e);
  }

  revalidatePath('/teachers');
  redirect('/teachers');
}

export async function deleteTeacherAction(formData: FormData): Promise<void> {
  await requireOwner();
  const parsed = deleteTeacherSchema.safeParse({
    teacher_id: formData.get('teacher_id'),
  });

  if (!parsed.success) {
    console.error('[Teacher Deletion] Invalid teacher ID');
    throw new Error('Selected teacher record is invalid.');
  }

  try {
    console.log('[Teacher Deletion] Starting deletion for teacher:', parsed.data.teacher_id);
    
    const supabase = await createClient();
    
    // Get teacher info before deletion for audit log
    console.log('[Teacher Deletion] Fetching teacher details');
    const { data: teacherData, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', parsed.data.teacher_id)
      .single();
    
    if (fetchError) {
      console.error('[Teacher Deletion] Failed to fetch teacher:', fetchError);
      throw fetchError;
    }

    // Delete teacher class assignments first
    console.log('[Teacher Deletion] Deleting class assignments');
    const { error: assignmentError } = await supabase
      .from('teacher_class_assignments')
      .delete()
      .eq('teacher_id', parsed.data.teacher_id);
    
    if (assignmentError) {
      console.error('[Teacher Deletion] Failed to delete assignments:', assignmentError);
      throw assignmentError;
    }

    // Delete auth user (this will cascade delete profile due to foreign key)
    console.log('[Teacher Deletion] Deleting auth user');
    const admin = createAdminClient();
    const { error: authError } = await admin.auth.admin.deleteUser(parsed.data.teacher_id);
    
    if (authError) {
      console.error('[Teacher Deletion] Failed to delete auth user:', authError);
      throw authError;
    }

    // Create audit log entry
    console.log('[Teacher Deletion] Creating audit log entry');
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'profiles',
        record_id: parsed.data.teacher_id,
        action: 'teacher_deleted',
        changed_by: (await supabase.auth.getUser()).data.user?.id,
        before_data: teacherData,
        after_data: null,
      });
    
    if (auditError) {
      console.warn('[Teacher Deletion] Failed to create audit log (non-critical):', auditError);
      // Don't throw - this is not critical for the deletion itself
    }

    console.log('[Teacher Deletion] Teacher deleted successfully');
  } catch (e) {
    console.error('[Teacher Deletion] Caught error:', e);
    throw e;
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
    console.error('[Student Promotion] Validation failed:', parsed.error.errors);
    throw new Error(parsed.error.errors[0]?.message ?? 'Provide valid promotion details.');
  }

  try {
    console.log('[Student Promotion] Starting promotion for', parsed.data.student_ids.length, 'students');
    console.log('[Student Promotion] From class:', parsed.data.current_class_id);
    console.log('[Student Promotion] To class:', parsed.data.target_class_id || 'auto-detect (next level)');

    const supabase = await createClient();
    
    // Verify current class exists
    const { data: currentClass, error: classError } = await supabase
      .from('classes')
      .select('id, name, level_order')
      .eq('id', parsed.data.current_class_id)
      .single();
    
    if (classError || !currentClass) {
      console.error('[Student Promotion] Current class not found');
      throw new Error('Current class not found.');
    }

    console.log('[Student Promotion] Current class verified:', currentClass.name);

    // If target_class_id provided, verify it exists
    if (parsed.data.target_class_id) {
      const { data: targetClass, error: targetError } = await supabase
        .from('classes')
        .select('id, name, level_order')
        .eq('id', parsed.data.target_class_id)
        .single();
      
      if (targetError || !targetClass) {
        console.error('[Student Promotion] Target class not found');
        throw new Error('Target class not found.');
      }

      console.log('[Student Promotion] Target class verified:', targetClass.name);
    }

    // Verify all students are in current class and active
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, full_name, class_id, status')
      .in('id', parsed.data.student_ids);
    
    if (studentsError) {
      console.error('[Student Promotion] Failed to verify students:', studentsError);
      throw studentsError;
    }

    const ineligibleStudents = students.filter(
      s => s.class_id !== parsed.data.current_class_id || s.status !== 'active'
    );

    if (ineligibleStudents.length > 0) {
      console.warn('[Student Promotion] Found ineligible students:', ineligibleStudents.map(s => s.id));
      throw new Error(`${ineligibleStudents.length} student(s) are not eligible for promotion (not in current class or not active).`);
    }

    console.log('[Student Promotion] All students verified as eligible');

    // Call the promotion RPC (it ignores target_class_id for now and auto-detects next class)
    const { error } = await supabase.rpc('promote_students', {
      current_class_id: parsed.data.current_class_id,
      student_ids: parsed.data.student_ids,
    });

    if (error) {
      console.error('[Student Promotion] RPC call failed:', error);
      throw error;
    }

    console.log('[Student Promotion] Students promoted successfully');
  } catch (e) {
    console.error('[Student Promotion] Caught error:', e);
    throw e;
  }

  revalidatePath('/students');
  revalidatePath('/promotions');
  redirect('/promotions');
}
