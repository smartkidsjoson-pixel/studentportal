import Link from 'next/link';

import { ClassForm } from '@/components/class-form';
import { Card } from '@/components/ui/card';
import { getClasses } from '@/lib/data';

export default async function ClassesPage() {
  const classes = await getClasses();

  return (
    <div className="grid">
      <Card title="Class Registry" description="Manage dynamic class structures from PG through Grade 9.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Section</th>
                <th>Students</th>
                <th>Teachers</th>
                <th>Reports</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((schoolClass) => (
                <tr key={schoolClass.id}>
                  <td>{schoolClass.name}</td>
                  <td>{schoolClass.section ?? '-'}</td>
                  <td>{schoolClass.student_count ?? 0}</td>
                  <td>{schoolClass.teacher_count ?? 0}</td>
                  <td><Link href={`/reports/class/${schoolClass.id}`}>Class report</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <ClassForm />
    </div>
  );
}
