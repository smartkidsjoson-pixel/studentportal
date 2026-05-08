import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { getDashboardStats, getSessionUserProfile } from '@/lib/data';
import { formatCurrency } from '@/lib/utils';
import type { SessionUser } from '@/lib/types';

export default async function DashboardPage() {
  const user: SessionUser | null = await getSessionUserProfile();
  const stats = await getDashboardStats(user ?? undefined);

  return (
    <div className="grid">
      <div className="grid stats">
        <Card title="Active students">
          <div className="stat-value">{stats.totalStudents}</div>
          <p className="muted">Students currently enrolled in active classes.</p>
        </Card>
        <Card title={user?.role === 'OWNER' ? 'Total classes' : 'Assigned classes'}>
          <div className="stat-value">{stats.totalClasses}</div>
          <p className="muted">{user?.role === 'OWNER' ? 'All class groups in the portal.' : 'Classes you are assigned to teach.'}</p>
        </Card>
        {user?.role === 'OWNER' ? (
          <>
            <Card title="Teachers">
              <div className="stat-value">{stats.totalTeachers}</div>
              <p className="muted">Active staff accounts with school access.</p>
            </Card>
            {stats.feeStats ? (
              <Card title="Fee collection">
                <div className="stat-value">{formatCurrency(stats.feeStats.totalCollected)}</div>
                <p className="muted">Recent fee revenue recorded across the school.</p>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>

      {user?.role === 'TEACHER' && stats.assignedClasses ? (
        <Card title="Your classes" description="Classes assigned to you for this term.">
          {stats.assignedClasses.length ? (
            <ul className="kpi-list">
              {stats.assignedClasses.map((schoolClass) => (
                <li key={schoolClass.id}>
                  <span>{schoolClass.name}</span>
                  <strong>{schoolClass.studentCount}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No assigned classes" description="Ask your administrator to assign you to a class." />
          )}
        </Card>
      ) : null}

      <Card title="Recent students" description="Most recently added or updated student records.">
        {stats.recentStudents.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Admission No.</th>
                  <th>Class</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentStudents.map((student) => (
                  <tr key={student.id}>
                    <td>{student.full_name}</td>
                    <td>{student.admission_number}</td>
                    <td>{student.class_name ?? 'Unassigned'}</td>
                    <td>{student.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No student activity" description="Register students to see recent activity on the dashboard." href="/students" ctaLabel="Create student" />
        )}
      </Card>

      <Card title="Quick actions" description="Navigate to the most common tasks.">
        <div className="form-actions" style={{ marginTop: 0, flexWrap: 'wrap' }}>
          <Link href="/students">Student directory</Link>
          <Link href="/classes">Classes</Link>
          {user?.role === 'OWNER' ? <Link href="/teachers">Teachers</Link> : null}
          {user?.role === 'OWNER' ? <Link href="/promotions">Promotions</Link> : null}
        </div>
      </Card>
    </div>
  );
}
