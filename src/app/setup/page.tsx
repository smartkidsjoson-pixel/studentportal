import { redirect } from 'next/navigation';

import AdminSetupForm from '@/components/auth/AdminSetupForm';
import { createAdminClient } from '@/lib/supabase/admin';

async function hasExistingUsers() {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1 });

  if (error) {
    throw new Error(error.message);
  }

  return Array.isArray(data?.users) && data.users.length > 0;
}

export default async function SetupPage() {
  if (await hasExistingUsers()) {
    redirect('/login');
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="text-center">
          <p className="eyebrow">Elote School setup</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Create your first administrator</h1>
          <p className="mt-3 text-slate-500">
            Set up the first school administrator account to access the entire portal.
          </p>
        </div>

        <div className="mt-8">
          <AdminSetupForm />
        </div>
      </div>
    </div>
  );
}
