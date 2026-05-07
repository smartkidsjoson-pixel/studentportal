import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { requireOwner } from '@/lib/auth';
import { getClasses, getStudents } from '@/lib/data';
import { promoteStudentsAction } from '@/lib/actions';

export default async function PromotionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ currentClassId?: string; targetClassId?: string }>;
}) {
  await requireOwner();

  const params = (await searchParams) ?? {};
  const classes = await getClasses();
  const currentClassId = params.currentClassId || classes[0]?.id || '';
  const students = currentClassId
    ? await getStudents({ classId: currentClassId, status: 'active', page: 1, pageSize: 200 })
    : [];

  return (
    <div className="grid">
      <Card title="Student promotion" description="Select students from one class and move them to the next.">
        <form className="form-grid" action={promoteStudentsAction}>
          <div>
            <label className="label" htmlFor="current-class">From class</label>
            <select id="current-class" name="current_class_id" defaultValue={currentClassId} required>
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="target-class">To class</label>
            <select id="target-class" name="target_class_id" defaultValue={params.targetClassId ?? ''} required>
              <option value="" disabled>Select destination class</option>
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
              ))}
            </select>
          </div>
          <div className="form-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
            <button type="submit">Promote selected students</button>
          </div>

          {students.length ? (
            <div className="table-wrap" style={{ gridColumn: '1 / -1' }}>
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>Name</th>
                    <th>Admission No.</th>
                    <th>Class</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <input type="checkbox" name="student_ids" value={student.id} />
                      </td>
                      <td>{student.full_name}</td>
                      <td>{student.admission_number}</td>
                      <td>{student.class_name ?? 'Unassigned'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted" style={{ gridColumn: '1 / -1' }}>
              Select a class with active students to promote.
            </p>
          )}
        </form>
      </Card>
      <Card title="Promotion guide" description="Promote students in one bulk action. The history will be stored automatically.">
        <p>Choose the current class, destination class and students to move forward cleanly. This will update their current class and log the transfer.</p>
      </Card>
      <Card title="Recent promotions" description="Most recent class moves will appear here when students are promoted.">
        <p className="muted">Promotion logs appear on the student profile once a transfer has been completed.</p>
      </Card>
    </div>
  );
}
