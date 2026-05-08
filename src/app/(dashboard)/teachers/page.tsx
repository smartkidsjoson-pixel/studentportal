import { Card } from '@/components/ui/card';
import { ClassAssignmentForm } from '@/components/teachers/class-assignment-form';
import { TeacherForm } from '@/components/teachers/teacher-form';
import { requireOwner } from '@/lib/auth';
import { getClasses, getTeachers } from '@/lib/data';
import { toggleTeacherStatusAction } from '@/lib/actions';

export default async function TeachersPage() {
  await requireOwner();

  const [classes, teachers] = await Promise.all([
    getClasses(),
    getTeachers(),
  ]);

  return (
    <div className="grid">
      <Card title="Staff directory" description="Review teacher and owner accounts and assigned classes.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Assigned classes</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(teachers ?? []).map((teacher) => (
                <tr key={teacher.id}>
                  <td>{teacher.full_name}</td>
                  <td>{teacher.role}</td>
                  <td>{teacher.is_active ? 'Active' : 'Inactive'}</td>
                  <td>{teacher.assigned_classes ?? 'None'}</td>
                  <td>
                    <form action={toggleTeacherStatusAction}>
                      <input type="hidden" name="teacher_id" value={teacher.id} />
                      <input type="hidden" name="is_active" value={teacher.is_active ? 'false' : 'true'} />
                      <button type="submit" className="secondary">
                        {teacher.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <TeacherForm />
      <ClassAssignmentForm teachers={teachers} classes={classes} />
    </div>
  );
}
