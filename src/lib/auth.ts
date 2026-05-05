import { redirect } from 'next/navigation';

import type { UserRole } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';

export async function getCurrentSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? '',
    fullName: profile?.full_name ?? null,
    role: (profile?.role ?? 'TEACHER') as UserRole,
  };
}

export async function requireSessionUser() {
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    redirect('/login');
  }

  return sessionUser;
}

export async function requireOwner() {
  const sessionUser = await requireSessionUser();

  if (sessionUser.role !== 'OWNER') {
    redirect('/dashboard');
  }

  return sessionUser;
}
