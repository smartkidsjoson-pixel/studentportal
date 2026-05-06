import { Card } from '@/components/ui/card';
import { TeacherForm } from '@/components/teachers/teacher-form';
import { ClassAssignmentForm } from '@/components/teachers/class-assignment-form';
import { requireOwner } from '@/lib/auth';
import { getClasses, getTeacherAssignments, getTeachers } from '@/lib/data';
import type { TeacherProfile } from '@/lib/types';

export default async function TeachersPage() {
  await requireOwner();

  const [classes, teachers, assignments] = await Promise.all([
    getClasses(),
    getTeachers(),
    getTeacherAssignments(),
  ]);

  const teacherAssignmentMap = assignments.reduce<Record<string, string[]>>((map, assignment) => {
    map[assignment.teacher_id] = [...(map[assignment.teacher_id] ?? []), assignment.class_name];
    return map;
  }, {});

  return (
    <div className="grid">
      <Card title="Staff Directory" description="Review teacher and owner accounts and their assigned classes.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Assigned Classes</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td>{teacher.full_name}</td>
                  <td>{teacher.role}</td>
                  <td>{(teacherAssignmentMap[teacher.id] ?? []).join(', ') || 'None'}</td>
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
