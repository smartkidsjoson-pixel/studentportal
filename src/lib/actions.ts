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
  
  const result: { success: number; created: number; errors: string[] } = { success: 0, created: 0, errors: [] };
  
  try {
    // Step 1: Get student's current class
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('class_id, status')
      .eq('id', studentId)
      .maybeSingle();
    
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
      .eq('class_id', student.class_id)
      .eq('archived', false);
    
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
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
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
  payment_date: z.string().min(1, 'Payment date is required').optional(),
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
    username: String(formData.get('username') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  });

  if (!parsed.success) {
    return { error: 'Enter a valid username and password.' };
  }

  // Use admin client for profile lookup during login to bypass RLS
  // (user is not yet authenticated, so RLS would cause infinite recursion)
  const admin = createAdminClient();

  // Lookup profile by username (case-insensitive)
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, email, username')
    .ilike('username', parsed.data.username)
    .maybeSingle();

  // Defensive logging: show lookup outcome
  console.log('Username lookup for:', parsed.data.username, 'profileFound:', !!profile, 'profileError:', profileError);

  if (profileError) {
    console.error('Auth lookup error details:', profileError);
    return { error: `Auth lookup error: ${profileError.message || 'unknown'}` };
  }

  if (!profile) {
    console.warn('Username not found:', parsed.data.username);
    return { error: 'Username not found' };
  }

  // Extra diagnostic logging for dedicated developer account
  try {
    const uname = (profile.username ?? '').toString().toLowerCase();
    if (uname === 'developer') {
      console.log('[Developer Login] Developer account lookup successful for username:', profile.username, 'id:', profile.id);
    }
  } catch (e) {
    console.error('[Developer Login] Error during developer lookup logging', e);
  }

  if (!profile.email) {
    console.error('Profile email missing for user:', profile.id);
    return { error: 'Account configuration error: missing email' };
  }

  try {
    // Now use authenticated client for signIn and audit logging
    const supabase = await createClient();

    // Attempt authentication using the user's email internally
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: parsed.data.password,
    });

    if (authError) {
      const msg = String(authError.message || authError);
      console.error('Supabase auth failure for user:', profile.id, 'msg:', msg);

      // Extra diagnostics for developer account failed logins
      try {
        if ((profile.username ?? '').toString().toLowerCase() === 'developer') {
          console.warn('[Developer Login] Failed login attempt for developer account. Role lookup and permission checks will be recorded.');
        }
      } catch (e) {
        console.error('[Developer Login] Error while logging failed developer attempt', e);
      }

      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('password') || msg.toLowerCase().includes('invalid login')) {
        // Log failed login
        try {
          await supabase.from('auth_audit_logs').insert({ user_id: profile.id, username: profile.username ?? parsed.data.username, event: 'failed_login', details: msg });
        } catch (e) {
          console.error('Failed to record failed login audit:', e);
        }
        return { error: 'Incorrect password' };
      }

      return { error: `Supabase auth failure: ${msg}` };
    }

    // Record successful login
    try {
      await supabase.from('auth_audit_logs').insert({ user_id: profile.id, username: profile.username ?? parsed.data.username, event: 'login', details: null });
    } catch (e) {
      console.error('Failed to record login audit:', e);
    }
  } catch (e) {
    return handleActionError(e);
  }

  // redirect() must be called outside try-catch to avoid being caught by error handler
  // Next.js redirect() throws a special error that the framework must handle
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

export async function getUserEmailByUsername(username: string): Promise<{ email?: string; error?: string }> {
  try {
    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      return { error: 'Username is required.' };
    }

    const admin = createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('email')
      .ilike('username', trimmedUsername)
      .maybeSingle();

    if (profileError) {
      console.error('Profile lookup error:', profileError);
      return { error: 'Unable to look up username.' };
    }

    if (!profile || !profile.email) {
      return { error: 'Username not found or email is missing.' };
    }

    return { email: profile.email };
  } catch (e) {
    console.error('getUserEmailByUsername error:', e);
    return { error: e instanceof Error ? e.message : 'An error occurred during lookup.' };
  }
}

export async function changePasswordAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const currentPassword = String(formData.get('current_password') ?? '');
  const newPassword = String(formData.get('new_password') ?? '');
  const confirmPassword = String(formData.get('confirm_password') ?? '');

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'All password fields are required.' };
  }

  if (newPassword.length < 8) {
    return { error: 'New password must be at least 8 characters long.' };
  }

  if (newPassword !== confirmPassword) {
    return { error: 'New password and confirmation do not match.' };
  }

  if (currentPassword === newPassword) {
    return { error: 'New password must be different from current password.' };
  }

  try {
    const sessionUser = await requireSessionUser();
    if (!sessionUser || !sessionUser.email) {
      return { error: 'Expired session or missing profile.' };
    }

    const admin = createAdminClient();

    // Verify current password using admin client (no session persistence)
    const { error: verifyError } = await admin.auth.signInWithPassword({
      email: sessionUser.email,
      password: currentPassword,
    });

    if (verifyError) {
      return { error: 'Wrong current password.' };
    }

    // Update password using admin API
    // admin.auth.admin.updateUser may be available; otherwise fallback to admin.auth.updateUser
    // Use try/catch to surface readable errors
    try {
      // @ts-ignore - using admin API
      const { error: updateError } = await admin.auth.admin.updateUser(sessionUser.id, { password: newPassword });
      if (updateError) {
        return { error: `Password update failed: ${updateError.message}` };
      }
    } catch (e) {
      return { error: `Password update failed: ${e instanceof Error ? e.message : String(e)}` };
    }

    // Record audit
    try {
      const supabase = await createClient();
      await supabase.from('auth_audit_logs').insert({ user_id: sessionUser.id, username: sessionUser.username ?? null, event: 'password_change', details: null });
    } catch (e) {
      console.error('Failed to record password change audit:', e);
    }

    return { success: 'Password updated successfully.' };
  } catch (e) {
    return handleActionError(e);
  }
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

    const { data: newStudent, error: insertError } = await supabase
      .from('students')
      .insert(payload)
      .select('id')
      .maybeSingle();
    if (insertError) throw insertError;

    if (newStudent?.id) {
      const feeAccountResult = await ensureStudentFeeAccountsExist(newStudent.id, supabase);
      if (feeAccountResult.errors.length > 0) {
        console.warn('Warning: Some student fee accounts could not be created automatically.', feeAccountResult.errors);
      }
    }
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

    const feeAccountResult = await ensureStudentFeeAccountsExist(parsed.data.student_id, supabase);
    if (feeAccountResult.errors.length > 0) {
      console.warn('Warning: Student fee accounts may require manual review after update.', feeAccountResult.errors);
    }
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
  try {
    await requireOwner();

    const rawFormData = Object.fromEntries(formData.entries());
    console.log('👉 [FORM SUBMIT DATA]:', rawFormData);

    const parsed = createFeeStructureSchema.safeParse({
      class_id: String(rawFormData.class_id ?? ''),
      academic_year: String(rawFormData.academic_year ?? '').trim(),
      term: String(rawFormData.term ?? ''),
      expected_amount: rawFormData.expected_amount,
    });

    if (!parsed.success) {
      console.error('Validation failed:', parsed.error.errors);
      return { error: parsed.error.errors[0]?.message ?? 'Provide valid fee structure details.' };
    }

    const validated = {
      class_id: parsed.data.class_id,
      academic_year: parsed.data.academic_year,
      term: parsed.data.term,
      expected_amount: parsed.data.expected_amount,
    };

    console.log('Validated payload:', validated);

    const supabase = await createClient();

    // PRECHECK: existing active fee structure for same class/year/term
    const existing = await supabase
      .from('fee_structures')
      .select('id, class_id, academic_year, term')
      .eq('class_id', validated.class_id)
      .eq('academic_year', validated.academic_year)
      .eq('term', validated.term)
      .eq('archived', false)
      .maybeSingle();

    console.log('Existing active structure:', existing?.data ?? existing);

    if (existing?.data) {
      return { error: 'Fee structure already exists for this class/year/term' };
    }

    // Verify class exists and check for minor data issues
    const { data: existingStructures, error: existingError } = await supabase
      .from('fee_structures')
      .select('id, archived')
      .eq('class_id', validated.class_id)
      .eq('academic_year', validated.academic_year)
      .eq('term', validated.term)
      .eq('archived', false);

    console.log('Existing fee structures for duplicate check:', existingStructures, existingError);

    if (existingError) {
      console.error('CREATE FEE STRUCTURE ERROR: duplicate check failed', existingError);
      return {
        error: existingError?.message || existingError?.details || existingError?.hint || JSON.stringify(existingError),
      };
    }

    const activeDuplicate = (existingStructures ?? []).find((structure: any) => structure.archived === false);
    if (activeDuplicate) {
      return { error: 'Fee structure already exists for this class/year/term' };
    }

    const { data: classRow, error: classError } = await supabase
      .from('classes')
      .select('id, name, level_order')
      .eq('id', validated.class_id)
      .maybeSingle();

    console.log('Class lookup result:', { classRow, classError, classId: validated.class_id });

    if (classError) {
      console.error('CREATE FEE STRUCTURE ERROR: class lookup failed', classError);
      return {
        error: classError?.message || classError?.details || classError?.hint || JSON.stringify(classError),
      };
    }

    if (!classRow) {
      return { error: 'Selected class no longer exists' };
    }

    // Safe fix: if level_order is null, set to 0
    if (classRow.level_order === null || typeof classRow.level_order === 'undefined') {
      console.warn('Class has null level_order. Setting to 0 for class:', classRow.id);
      const { error: fixError } = await supabase.from('classes').update({ level_order: 0 }).eq('id', classRow.id);
      if (fixError) {
        console.error('CREATE FEE STRUCTURE ERROR: failed to fix class level_order', fixError);
        return {
          error: fixError?.message || fixError?.details || fixError?.hint || JSON.stringify(fixError),
        };
      }
    }

    // Check duplicate class names (informational only)
    const { data: sameNameClasses } = await supabase.from('classes').select('id').eq('name', classRow.name);
    if (sameNameClasses && sameNameClasses.length > 1) {
      console.warn('Multiple classes share the same name:', classRow.name, 'ids:', sameNameClasses.map((c: any) => c.id));
    }

    // INSERT fee structure
    const { data, error } = await supabase.from('fee_structures').insert(validated).select('id, class_id');

    console.log('Response - data:', data);
    console.log('Response - error:', error);

    if (error) {
      console.error('CREATE FEE STRUCTURE ERROR:', error);
      return {
        error: error?.message || error?.details || error?.hint || JSON.stringify(error),
      };
    }

    if (data && data[0]?.class_id) {
      const { data: students, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', data[0].class_id)
        .eq('status', 'active');

      if (!studentError && students?.length) {
        const createPayload = students.map((student) => ({
          student_id: student.id,
          fee_structure_id: data[0].id,
          expected_amount: validated.expected_amount,
        }));

        const { error: accountError } = await supabase
          .from('student_fee_accounts')
          .upsert(createPayload, { onConflict: 'student_id,fee_structure_id' });

        if (accountError) {
          console.warn('Fee accounts fallback creation failed:', accountError.message);
        }
      }
    }

    console.log('Fee structure created! Trigger should auto-create student fee accounts...');
    console.log('Revalidating paths...');
    revalidatePath('/fees');
    revalidatePath('/dashboard');
    console.log('=== CREATE FEE STRUCTURE ACTION END (SUCCESS) ===\n');
    return { success: 'Fee structure created successfully.' };
  } catch (err: any) {
    console.error('CREATE FEE STRUCTURE ERROR:', err);
    return {
      error: err?.message || err?.details || err?.hint || JSON.stringify(err),
    };
  }
}

const updateFeeStructureSchema = z.object({
  fee_structure_id: z.string().uuid(),
  class_id: z.string().uuid(),
  academic_year: z.string().min(1),
  term: z.enum(['TERM_1', 'TERM_2', 'TERM_3']),
  expected_amount: z.coerce.number().positive(),
});

export async function updateFeeStructureAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  console.log('\n=== UPDATE FEE STRUCTURE ACTION START ===');
  await requireOwner();

  const parsed = updateFeeStructureSchema.safeParse({
    fee_structure_id: String(formData.get('fee_structure_id') ?? ''),
    class_id: String(formData.get('class_id') ?? ''),
    academic_year: String(formData.get('academic_year') ?? '').trim(),
    term: String(formData.get('term') ?? ''),
    expected_amount: formData.get('expected_amount'),
  });

  console.log('Update fee structure form data:', Object.fromEntries(formData.entries()));
  console.log('Parsed update:', parsed.data);

  if (!parsed.success) {
    console.error('Validation failed:', parsed.error.errors);
    return { error: parsed.error.errors[0]?.message ?? 'Provide valid fee structure details.' };
  }

  try {
    const supabase = await createClient();
    
    // Check if fee structure exists and is not archived
    const { data: existing, error: fetchError } = await supabase
      .from('fee_structures')
      .select('id, archived')
      .eq('id', parsed.data.fee_structure_id)
      .maybeSingle();

    if (fetchError || !existing) {
      return { error: 'Fee structure not found.' };
    }

    if (existing.archived) {
      return { error: 'Cannot update archived fee structure.' };
    }

    // Update fee structure
    const { error: updateError } = await supabase
      .from('fee_structures')
      .update({
        class_id: parsed.data.class_id,
        academic_year: parsed.data.academic_year,
        term: parsed.data.term,
        expected_amount: parsed.data.expected_amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.fee_structure_id);

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    // Update all linked student fee accounts with new expected amount
    const { error: accountUpdateError } = await supabase
      .from('student_fee_accounts')
      .update({ expected_amount: parsed.data.expected_amount })
      .eq('fee_structure_id', parsed.data.fee_structure_id);

    if (accountUpdateError) {
      console.warn('Failed to update student fee accounts:', accountUpdateError.message);
      // Don't fail the action, but log it
    }

    console.log('Fee structure updated successfully!');
  } catch (e) {
    console.error('=== FEE STRUCTURE UPDATE FAILED ===');
    return handleActionError(e);
  }

  console.log('Revalidating paths...');
  revalidatePath('/fees');
  revalidatePath('/dashboard');
  console.log('=== UPDATE FEE STRUCTURE ACTION END (SUCCESS) ===\n');
  return { success: 'Fee structure updated successfully.' };
}

export async function deleteFeeStructureAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  console.log('\n=== DELETE FEE STRUCTURE ACTION START ===');
  await requireOwner();

  const feeStructureId = String(formData.get('fee_structure_id') ?? '');

  if (!feeStructureId) {
    return { error: 'Fee structure ID is required.' };
  }

  try {
    const supabase = await createClient();

    // Check if fee structure exists
    const { data: existing, error: fetchError } = await supabase
      .from('fee_structures')
      .select('id, archived')
      .eq('id', feeStructureId)
      .maybeSingle();

    if (fetchError || !existing) {
      return { error: 'Fee structure not found.' };
    }

    // Check for linked student fee accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('student_fee_accounts')
      .select('id')
      .eq('fee_structure_id', feeStructureId)
      .limit(1);

    if (accountsError) {
      console.error('Error checking accounts:', accountsError);
      return { error: 'Unable to verify fee structure usage.' };
    }

    const hasAccounts = accounts && accounts.length > 0;

    if (hasAccounts) {
      // Archive (soft delete) when any student fee accounts exist to preserve audit trail
      const { error: archiveError } = await supabase
        .from('fee_structures')
        .update({ archived: true, updated_at: new Date().toISOString() })
        .eq('id', feeStructureId);

      if (archiveError) {
        console.error('Archive error:', archiveError);
        throw archiveError;
      }

      console.log('Fee structure archived due to linked student fee accounts.');
    } else {
      // Hard delete when no linked accounts exist
      const { error: deleteError } = await supabase
        .from('fee_structures')
        .delete()
        .eq('id', feeStructureId);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw deleteError;
      }

      console.log('Fee structure hard deleted.');
    }

    revalidatePath('/fees');
    revalidatePath('/dashboard');
    revalidatePath('/students');
    return { success: 'Fee structure deleted successfully.' };
  } catch (e) {
    console.error('=== FEE STRUCTURE DELETE FAILED ===');
    return handleActionError(e);
  }
}

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
    // Using maybeSingle() instead of single() to handle missing accounts gracefully
    console.log('Pre-flight check: Verifying fee account...');
    console.log('Looking for account ID:', parsed.data.student_fee_account_id);
    
    const { data: feeAccount, error: accountError } = await supabase
      .from('student_fee_accounts')
      .select('id, expected_amount, fee_structure_id, student_id')
      .eq('id', parsed.data.student_fee_account_id)
      .maybeSingle();
    
    if (accountError) {
      console.error('Error fetching fee account:', accountError);
      throw new Error(`Database error: ${accountError.message}`);
    }
    
    if (!feeAccount) {
      const msg = `❌ Fee account not found (ID: ${parsed.data.student_fee_account_id}). This should not happen - account should have been created when student was added.`;
      console.error(msg);
      throw new Error(msg);
    }
    
    console.log('✓ Fee account found:', {
      accountId: feeAccount.id,
      studentId: feeAccount.student_id,
      expected_amount: feeAccount.expected_amount,
    });
    
    // DEFENSIVE: Fix zero expected_amount before allowing payment
    let validFeeAccount = feeAccount;
    if (feeAccount.expected_amount === 0 || feeAccount.expected_amount === '0' || Number(feeAccount.expected_amount) === 0) {
      console.warn('⚠️ Fee account has zero expected_amount - attempting recovery from fee structure...');
      
      const { data: feeStructure, error: fsError } = await supabase
        .from('fee_structures')
        .select('expected_amount')
        .eq('id', feeAccount.fee_structure_id)
        .maybeSingle();
      
      if (fsError) {
        console.error('Error fetching fee structure:', fsError);
        throw new Error(`Cannot recover expected_amount: ${fsError.message}`);
      }
      
      if (feeStructure && feeStructure.expected_amount && Number(feeStructure.expected_amount) > 0) {
        console.log(`🔧 Fixing zero amount - updating to ${feeStructure.expected_amount} from fee structure`);
        const { error: updateError } = await supabase
          .from('student_fee_accounts')
          .update({ expected_amount: feeStructure.expected_amount })
          .eq('id', feeAccount.id);
        
        if (updateError) {
          console.error('Error updating expected_amount:', updateError);
          throw new Error(`Could not fix zero amount: ${updateError.message}`);
        }
        validFeeAccount.expected_amount = feeStructure.expected_amount;
        console.log('✓ Fixed expected_amount successfully');
      } else {
        const msg = '❌ Fee structure not found or has zero amount. Cannot process payment.';
        console.error(msg);
        throw new Error(msg);
      }
    }
    
    console.log('Proceeding with payment insertion...');
    const paymentPayload: any = {
      student_fee_account_id: parsed.data.student_fee_account_id,
      amount: parsed.data.amount,
      receipt_number: parsed.data.receipt_number,
    };
    
    // Add optional fields if present in form data
    if (cleanData.payment_method) {
      paymentPayload.payment_method = cleanData.payment_method;
    }
    if (cleanData.fee_ledger_id) {
      paymentPayload.fee_ledger_id = cleanData.fee_ledger_id;
    }
    
    console.log('Payload:', paymentPayload);
    
    const { error, data } = await supabase.from('fee_payments').insert(paymentPayload).select();
    
    console.log('Supabase response - data:', data);
    console.log('Supabase response - error:', error);
    
    if (error) {
      console.error('Supabase insert error:', error);
      throw new Error(`Payment insert failed: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      throw new Error('Payment inserted but no data returned');
    }
    
    console.log('✓ Payment inserted successfully!');
    console.log('Payment details:', {
      paymentId: data[0].id,
      amount: data[0].amount,
      receipt: data[0].receipt_number,
      date: data[0].payment_date,
      created_by: data[0].created_by,
      updated_by: data[0].updated_by,
    });
  } catch (e) {
    console.error('=== PAYMENT RECORDING FAILED ===');
    return handleActionError(e);
  }

  console.log('Revalidating paths...');
  if (studentId) {
    revalidatePath(`/students/${studentId}`);
    revalidatePath('/(dashboard)/students/[studentId]', 'layout');
  }
  revalidatePath('/fees');
  revalidatePath('/dashboard');
  revalidatePath('/(dashboard)/students', 'page');
  
  console.log('=== RECORD FEE PAYMENT ACTION END (SUCCESS) ===\n');
  return { success: 'Payment recorded successfully.' };
}

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
    payment_date: String(cleanData.payment_date ?? '').trim(),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Provide valid payment update details.' };
  }

  const studentId = String(cleanData.student_id ?? '');

  try {
    const supabase = await createClient();
    const updatePayload: any = {
      amount: parsed.data.amount,
      receipt_number: parsed.data.receipt_number,
    };

    if (parsed.data.payment_date) {
      updatePayload.payment_date = parsed.data.payment_date;
    }
    
    // Add optional fields if present in form data
    if (cleanData.payment_method) {
      updatePayload.payment_method = cleanData.payment_method;
    }
    if (cleanData.fee_ledger_id) {
      updatePayload.fee_ledger_id = cleanData.fee_ledger_id;
    }
    
    const { error } = await supabase
      .from('fee_payments')
      .update(updatePayload)
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
    revalidatePath('/(dashboard)/students/[studentId]', 'layout');
  }
  revalidatePath('/fees');
  revalidatePath('/dashboard');
  revalidatePath('/(dashboard)/students', 'page');
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
    
    // Generate a base username from email local-part and ensure uniqueness
    const baseUsername = String(parsed.data.email).split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
    let username = baseUsername;
    let attempt = 0;
    while (true) {
      const { data: existing } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
      if (!existing) break;
      attempt++;
      username = `${baseUsername}${attempt}`;
      if (attempt > 10) {
        username = `${baseUsername}_${Date.now().toString().slice(-4)}`;
        break;
      }
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: parsed.data.full_name,
      role: 'TEACHER',
      is_active: true,
      email: parsed.data.email,
      username,
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
    
    // Owner username must be 'Joson' per requirements
    const ownerUsername = 'Joson';
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      is_active: true,
      email: parsed.data.email,
      username: ownerUsername,
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
