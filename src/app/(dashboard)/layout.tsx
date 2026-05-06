import type { ReactNode } from 'react';

import { RoleCheck } from '@/components/role-check';
import { Sidebar } from '@/components/sidebar';
import { requireSessionUser } from '@/lib/auth';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireSessionUser();

  return (
    <div className="page-shell">
      <RoleCheck sessionRole={user.role} />
      <Sidebar schoolName="School MIS" />
      <main className="main-content">
        <div className="topbar">
          <div>
            <h2>School Management System</h2>
            <p>{user.fullName ?? user.email} | {user.role}</p>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
