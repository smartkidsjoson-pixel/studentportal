import { redirect } from 'next/navigation';

import type { UserRole } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';

function normalizeRole(role: unknown): UserRole {
  if (role === 'OWNER' || role === 'TEACHER' || role === 'ADMIN') {
    return role;
  }

  return 'TEACHER';
}

export async function getCurrentSessionUser() {
  const supabase = await createClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('Failed to refresh session', sessionError);
  }

  const user = sessionData?.session?.user ?? (await supabase.auth.getUser()).data.user;

  if (!user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  if (profileError && profileError.message !== 'Results contain 0 rows') {
    console.error('Failed to read session user profile', profileError);
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const roleSource = profile?.role;

  console.log("ACTUAL ROLE FROM DB:", profile?.role);

  return {
    id: user.id,
    email: user.email ?? '',
    fullName: profile?.full_name ?? (metadata.full_name as string | undefined) ?? null,
    role: normalizeRole(roleSource),
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

  if (sessionUser.role !== 'OWNER' && sessionUser.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return sessionUser;
}
