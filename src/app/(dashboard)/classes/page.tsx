import { ClassForm } from '@/components/class-form';
import { Card } from '@/components/ui/card';
import { getClasses, getSessionUserProfile } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function ClassesPage() {
  const [classes, user] = await Promise.all([getClasses(), getSessionUserProfile()]);

  return (
    <div className="grid">
      <Card title="Class registry" description="Manage class groups from pre-primary through upper primary." >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Section</th>
                <th>Capacity</th>
                <th>Students</th>
                <th>Teachers</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((schoolClass) => (
                <tr key={schoolClass.id}>
                  <td>{schoolClass.name}</td>
                  <td>{schoolClass.section ?? '-'}</td>
                  <td>{schoolClass.capacity ?? '-'}</td>
                  <td>{schoolClass.student_count ?? 0}</td>
                  <td>{schoolClass.teacher_count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {user?.role === 'OWNER' ? <ClassForm /> : null}
    </div>
  );
}
