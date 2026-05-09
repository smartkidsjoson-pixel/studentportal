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
  console.error('=== ACTION ERROR DETAILS ===');
  console.error('Full error object:', error);
  
  if (error instanceof Error) {
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  }
  
  let detailedMessage = 'An error occurred. Please try again.';

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Expose actual database error details
    if (error.message.includes('duplicate') || message.includes('unique violation')) {
      detailedMessage = `Duplicate record: ${error.message}`;
    } else if (error.message.includes('foreign key')) {
      detailedMessage = `Cannot delete: Record is referenced elsewhere. ${error.message}`;
    } else if (error.message.includes('check constraint')) {
      detailedMessage = `Invalid value: ${error.message}`;
    } else if (error.message.includes('not found') || error.message.includes('no rows')) {
      detailedMessage = `Not found: ${error.message}`;
    } else if (error.message.includes('permission denied')) {
      detailedMessage = `Permission denied: ${error.message}`;
    } else if (message.includes('invalid login') || message.includes('invalid password') || message.includes('credentials')) {
      detailedMessage = 'Invalid login credentials';
    } else if (message.includes('unauthorized')) {
      detailedMessage = `Unauthorized: ${error.message}`;
    } else {
      detailedMessage = `Error: ${error.message}`;
    }
  }
  
  console.error('=== ERROR SUMMARY ===');
  console.error(detailedMessage);
  console.error('====================');
  
  return { error: detailedMessage };
}

/**
 * DEFENSIVE PROGRAMMING: Ensure student fee accounts exist and have correct expected_amount
 * This is a backup mechanism if database triggers fail to create accounts
 */
async function ensureStudentFeeAccountsExist(studentId: string, supabase: any): Promise<{
  success: number;
  created: number;
  errors: string[];
}> {
  console.log('\n=== ENSURING STUDENT FEE ACCOUNTS EXIST ===');
  console.log('Student ID:', studentId);
  
  const result = { success: 0, created: 0, errors: [] };
  
  try {
    // Step 1: Get student's current class
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('class_id, status')
      .eq('id', studentId)
      .single();
    
    if (studentError || !student || !student.class_id) {
      const msg = `Cannot find student or student has no class assigned: ${studentError?.message || 'No class'}`;
      console.error(msg);
      result.errors.push(msg);
      return result;
    }
    
    console.log('Student found:', { classId: student.class_id, status: student.status });
    
    // Step 2: Get all fee structures for student's class
    const { data: feeStructures, error: fsError } = await supabase
      .from('fee_structures')
      .select('id, expected_amount, academic_year, term')
      .eq('class_id', student.class_id);
    
    if (fsError) {
      const msg = `Error fetching fee structures: ${fsError.message}`;
      console.error(msg);
      result.errors.push(msg);
      return result;
    }
    
    console.log(`Found ${feeStructures?.length || 0} fee structures for this class`);
    
    if (!feeStructures || feeStructures.length === 0) {
      console.log('No fee structures exist for this class yet');
      return result;
    }
    
    // Step 3: For each fee structure, check if account exists and has correct amount
    for (const fs of feeStructures) {
      console.log(`Checking fee structure: ${fs.academic_year} ${fs.term} (expected: KES ${fs.expected_amount})`);
      
      const { data: existingAccount, error: checkError } = await supabase
        .from('student_fee_accounts')
        .select('id, expected_amount')
        .eq('student_id', studentId)
        .eq('fee_structure_id', fs.id)
        .maybeSingle();
      
      if (checkError && checkError.message !== 'Results contain 0 rows') {
        const msg = `Error checking fee account: ${checkError.message}`;
        console.error(msg);
        result.errors.push(msg);
        continue;
      }
      
      if (existingAccount) {
        console.log(`Account exists with expected_amount: ${existingAccount.expected_amount}`);
        if (existingAccount.expected_amount === 0 || existingAccount.expected_amount === '0') {
          console.warn(`FIXING: Account has zero expected_amount, updating to ${fs.expected_amount}`);
          const { error: updateError } = await supabase
            .from('student_fee_accounts')
            .update({ expected_amount: fs.expected_amount })
            .eq('id', existingAccount.id);
          
          if (updateError) {
            const msg = `Error updating account amount: ${updateError.message}`;
            console.error(msg);
            result.errors.push(msg);
          } else {
            console.log(`FIXED: Updated expected_amount for account`);
            result.success++;
          }
        } else {
          result.success++;
        }
      } else {
        console.log(`Account MISSING - creating new account with expected_amount: ${fs.expected_amount}`);
        const { error: createError, data: newAccount } = await supabase
          .from('student_fee_accounts')
          .insert({
            student_id: studentId,
            fee_structure_id: fs.id,
            expected_amount: fs.expected_amount,
          })
          .select();
        
        if (createError) {
          const msg = `Error creating fee account: ${createError.message}`;
          console.error(msg);
          result.errors.push(msg);
        } else {
          console.log(`CREATED: Account ${newAccount?.[0]?.id}`);
          result.created++;
        }
      }
    }
  } catch (e) {
    const msg = `Unexpected error in ensureStudentFeeAccountsExist: ${e instanceof Error ? e.message : String(e)}`;
    console.error(msg);
    result.errors.push(msg);
  }
  
  console.log('Fee accounts ensure complete - Success:', result.success, 'Created:', result.created, 'Errors:', result.errors.length);
  
  return result;
}

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const createStudentSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  class_id: z.preprocess((value) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed.length > 0 ? trimmed : null;
  }, z.string().uuid('Please select a valid class').nullable()),
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
    return new Date();
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
  full_name: z.string().optional(),
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

  const classIdValue = formData.get('class_id');
  const classId = typeof classIdValue === 'string' ? classIdValue.trim() : '';
  const parsed = createStudentSchema.safeParse({
    full_name: String(formData.get('full_name') ?? '').trim(),
    class_id: classId || null,
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
      class_id: parsed.data.class_id ?? null,
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
      level_order: parsed.data.level_order ?? 0,
    });
    if (error) throw error;
  } catch (e) {
    return handleActionError(e);
  }

  revalidatePath('/classes');
  redirect('/classes');
}

export async function createFeeStructureAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  console.log('\n=== CREATE FEE STRUCTURE ACTION START ===');
  await requireOwner();

  const parsed = createFeeStructureSchema.safeParse({
    class_id: String(formData.get('class_id') ?? ''),
    academic_year: String(formData.get('academic_year') ?? '').trim(),
    term: String(formData.get('term') ?? ''),
    expected_amount: formData.get('expected_amount'),
  });

  console.log('Fee structure form data:', Object.fromEntries(formData.entries()));
  console.log('Parsed fee structure:', parsed.data);

  if (!parsed.success) {
    console.error('Validation failed:', parsed.error.errors);
    return { error: parsed.error.errors[0]?.message ?? 'Provide valid fee structure details.' };
  }

  try {
    const supabase = await createClient();
    console.log('Inserting fee structure...');
    console.log('Payload:', {
      class_id: parsed.data.class_id,
      academic_year: parsed.data.academic_year,
      term: parsed.data.term,
      expected_amount: parsed.data.expected_amount,
    });
    
    const { error, data } = await supabase.from('fee_structures').insert({
      class_id: parsed.data.class_id,
      academic_year: parsed.data.academic_year,
      term: parsed.data.term,
      expected_amount: parsed.data.expected_amount,
    }).select();
    
    console.log('Response - data:', data);
    console.log('Response - error:', error);
    
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    console.log('Fee structure created! Trigger should auto-create student fee accounts...');
  } catch (e) {
    console.error('=== FEE STRUCTURE CREATION FAILED ===');
    return handleActionError(e);
  }

  console.log('Revalidating paths...');
  revalidatePath('/fees');
  revalidatePath('/dashboard');
  console.log('=== CREATE FEE STRUCTURE ACTION END (SUCCESS) ===\n');
  return { success: 'Fee structure created successfully.' };


export async function recordFeePaymentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  console.log('\n=== RECORD FEE PAYMENT ACTION START ===');
  
  await requireOwner();

  // Strip numeric prefixes (e.g., '1_' from keys like '1_amount', '0_receipt_number')
  const rawData = Object.fromEntries(formData.entries());
  console.log('Raw form data:', rawData);
  
  const cleanData: Record<string, any> = {};
  for (const key in rawData) {
    const cleanKey = key.replace(/^\d+_/, '');
    cleanData[cleanKey] = rawData[key];
  }
  console.log('Cleaned form data:', cleanData);

  const parsed = recordFeePaymentSchema.safeParse({
    student_fee_account_id: String(cleanData.student_fee_account_id ?? ''),
    amount: cleanData.amount,
    receipt_number: String(cleanData.receipt_number ?? '').trim(),
  });

  if (!parsed.success) {
    console.error('Validation failed:', parsed.error.errors);
    return { error: parsed.error.errors[0]?.message ?? 'Provide valid payment details.' };
  }

  console.log('Parsed payment data:', parsed.data);
  const studentId = String(cleanData.student_id ?? '');
  console.log('Student ID:', studentId);

  try {
    const supabase = await createClient();
    
    // PRE-FLIGHT CHECK: Verify fee account exists and has valid expected_amount
    console.log('Pre-flight check: Verifying fee account...');
    const { data: feeAccount, error: accountError } = await supabase
      .from('student_fee_accounts')
      .select('id, expected_amount, fee_structure_id')
      .eq('id', parsed.data.student_fee_account_id)
      .single();
    
    if (accountError || !feeAccount) {
      const msg = `Fee account not found: ${accountError?.message || 'Invalid account ID'}`;
      console.error(msg);
      throw new Error(msg);
    }
    
    console.log('Fee account found:', {
      accountId: feeAccount.id,
      expected_amount: feeAccount.expected_amount,
    });
    
    if (feeAccount.expected_amount === 0 || feeAccount.expected_amount === '0') {
      console.warn('WARNING: Fee account has zero expected_amount!');
      // Attempt to fetch the fee structure and fix it
      const { data: feeStructure } = await supabase
        .from('fee_structures')
        .select('expected_amount')
        .eq('id', feeAccount.fee_structure_id)
        .single();
      
      if (feeStructure && feeStructure.expected_amount > 0) {
        console.log(`Attempting to fix zero amount with structure amount: ${feeStructure.expected_amount}`);
        await supabase
          .from('student_fee_accounts')
          .update({ expected_amount: feeStructure.expected_amount })
          .eq('id', feeAccount.id);
      }
    }
    
    console.log('Attempting to insert payment into fee_payments table...');
    console.log('Payload:', {
      student_fee_account_id: parsed.data.student_fee_account_id,
      amount: parsed.data.amount,
      receipt_number: parsed.data.receipt_number,
    });
    
    const { error, data } = await supabase.from('fee_payments').insert({
      student_fee_account_id: parsed.data.student_fee_account_id,
      amount: parsed.data.amount,
      receipt_number: parsed.data.receipt_number,
    }).select();
    
    console.log('Supabase response - data:', data);
    console.log('Supabase response - error:', error);
    
    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }
    
    console.log('Payment inserted successfully!');
  } catch (e) {
    console.error('=== PAYMENT RECORDING FAILED ===');
    return handleActionError(e);
  }

  console.log('Revalidating paths...');
  if (studentId) {
    revalidatePath(`/students/${studentId}`);
  }
  revalidatePath('/fees');
  revalidatePath('/dashboard');
  
  console.log('=== RECORD FEE PAYMENT ACTION END (SUCCESS) ===\n');
  return { success: 'Payment recorded successfully.' };


export async function updateFeePaymentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();

  // Strip numeric prefixes (e.g., '1_' from keys like '1_amount', '0_receipt_number')
  const rawData = Object.fromEntries(formData.entries());
  const cleanData: Record<string, any> = {};
  for (const key in rawData) {
    const cleanKey = key.replace(/^\d+_/, '');
    cleanData[cleanKey] = rawData[key];
  }

  const parsed = updateFeePaymentSchema.safeParse({
    payment_id: String(cleanData.payment_id ?? ''),
    student_fee_account_id: String(cleanData.student_fee_account_id ?? ''),
    amount: cleanData.amount,
    receipt_number: String(cleanData.receipt_number ?? '').trim(),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Provide valid payment update details.' };
  }

  const studentId = String(cleanData.student_id ?? '');

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
      role: 'TEACHER',
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
      .insert({
        teacher_id: parsed.data.teacher_id,
        class_id: parsed.data.class_id,
      });

    if (error) {
      if (!error.message.toLowerCase().includes('duplicate')) {
        throw error;
      }
    }
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

const transferStudentSchema = z.object({
  student_id: z.string().uuid('Invalid student ID'),
  transfer_to_school: z.string().min(2, 'School name required'),
  transfer_reason: z.string().min(2, 'Reason required'),
});

export async function transferStudentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  console.log('\n=== TRANSFER STUDENT ACTION START ===');
  await requireOwner();

  const parsed = transferStudentSchema.safeParse({
    student_id: String(formData.get('student_id') ?? ''),
    transfer_to_school: String(formData.get('transfer_to_school') ?? '').trim(),
    transfer_reason: String(formData.get('transfer_reason') ?? '').trim(),
  });

  if (!parsed.success) {
    console.error('Transfer validation failed:', parsed.error.errors);
    return { error: parsed.error.errors[0]?.message ?? 'Provide valid transfer details.' };
  }

  try {
    const supabase = await createClient();
    const user = await requireSessionUser();

    console.log('Calling transfer_student function with:', parsed.data);
    const { data, error } = await supabase.rpc('transfer_student', {
      student_id_in: parsed.data.student_id,
      transfer_to_school: parsed.data.transfer_to_school,
      transfer_reason_in: parsed.data.transfer_reason,
      transferred_by: user.id,
    });

    console.log('Transfer response:', { data, error });

    if (error) {
      console.error('Transfer error:', error);
      throw error;
    }

    if (data && data.length > 0) {
      const result = data[0];
      if (!result.success) {
        console.warn('Transfer function returned error:', result.message);
        return { error: result.message };
      }
    }
  } catch (e) {
    console.error('=== TRANSFER STUDENT FAILED ===');
    return handleActionError(e);
  }

  console.log('Transfer successful, revalidating...');
  revalidatePath('/students');
  revalidatePath('/dashboard');
  console.log('=== TRANSFER STUDENT ACTION END ===\n');
  return { success: 'Student transferred successfully.' };
}

const deleteStudentSchema = z.object({
  student_id: z.string().uuid('Invalid student ID'),
  deletion_reason: z.string().min(2, 'Reason required'),
});

export async function deleteStudentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  console.log('\n=== DELETE STUDENT ACTION START ===');
  await requireOwner();

  const parsed = deleteStudentSchema.safeParse({
    student_id: String(formData.get('student_id') ?? ''),
    deletion_reason: String(formData.get('deletion_reason') ?? '').trim(),
  });

  if (!parsed.success) {
    console.error('Delete validation failed:', parsed.error.errors);
    return { error: parsed.error.errors[0]?.message ?? 'Provide valid deletion details.' };
  }

  try {
    const supabase = await createClient();
    
    // First, get student details
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, full_name, status')
      .eq('id', parsed.data.student_id)
      .single();
    
    if (studentError || !student) {
      throw new Error('Student not found');
    }
    
    console.log('Student to delete:', { id: student.id, name: student.full_name, status: student.status });
    
    if (student.status === 'active') {
      return { error: 'Cannot delete active student. Must transfer, mark as inactive, or wait for graduation first.' };
    }
    
    const user = await requireSessionUser();

    console.log('Calling delete_student_safe function...');
    const { data, error } = await supabase.rpc('delete_student_safe', {
      student_id_in: parsed.data.student_id,
      deletion_reason: parsed.data.deletion_reason,
      deleted_by_id: user.id,
    });

    console.log('Delete response:', { data, error });

    if (error) {
      console.error('Delete error:', error);
      throw error;
    }

    if (data && data.length > 0) {
      const result = data[0];
      if (!result.success) {
        console.warn('Delete function returned error:', result.message);
        return { error: result.message };
      }
      console.log('Delete result:', result);
    }
  } catch (e) {
    console.error('=== DELETE STUDENT FAILED ===');
    return handleActionError(e);
  }

  console.log('Delete successful, revalidating...');
  revalidatePath('/students');
  revalidatePath('/dashboard');
  console.log('=== DELETE STUDENT ACTION END ===\n');
  return { success: 'Student record processed successfully.' };
}
