import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { getDashboardStats } from '@/lib/data';
import { formatPercentage } from '@/lib/utils';

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="grid">
      <div className="grid stats">
        <Card title="Total Students">
          <div className="stat-value">{stats.totalStudents}</div>
          <p className="muted">Currently active enrolment across all classes.</p>
        </Card>
        <Card title="Total Classes">
          <div className="stat-value">{stats.totalClasses}</div>
          <p className="muted">Academic classes configured in the system.</p>
        </Card>
      </div>

      <div className="layout-two">
        <Card title="Top Performing Students" description="Overall merit ranking based on cumulative averages.">
          {stats.topStudents.length ? (
            <ul className="kpi-list">
              {stats.topStudents.map((student, index) => (
                <li key={student.studentId}>
                  <span>{index + 1}. {student.fullName}<br /><span className="small">{student.className ?? 'Unassigned'}</span></span>
                  <strong>{formatPercentage(student.averageScore)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No rankings yet" description="Add marks to see top-performing students here." href="/results" ctaLabel="Go to results" />
          )}
        </Card>

        <Card title="Class Distribution" description="Current student population by class.">
          {stats.classDistribution.length ? (
            <ul className="kpi-list">
              {stats.classDistribution.map((entry) => (
                <li key={entry.className}>
                  <span>{entry.className}</span>
                  <strong>{entry.studentCount}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No class data" description="Create classes and assign students to populate this view." href="/classes" ctaLabel="Manage classes" />
          )}
        </Card>
      </div>

      <Card title="Quick Access" description="Key operations for daily school administration.">
        <div className="form-actions" style={{ marginTop: 0, flexWrap: 'wrap' }}>
          <Link href="/students">Students</Link>
          <Link href="/results">Results</Link>
          <Link href="/reports">Reports</Link>
        </div>
      </Card>
    </div>
  );
}
