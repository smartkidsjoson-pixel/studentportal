import type { ReactNode } from 'react';

import { Sidebar } from '@/components/sidebar';
import { requireSessionUser } from '@/lib/auth';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireSessionUser();

  return (
    <div className="page-shell">
      <Sidebar schoolName="Joson's SmartKids Academy" userRole={user.role} />
      <main className="main-content">
        <div className="topbar">
          <div>
            <h2>Joson's SmartKids Academy</h2>
            <p>{user.fullName ?? user.email} | {user.role}</p>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
