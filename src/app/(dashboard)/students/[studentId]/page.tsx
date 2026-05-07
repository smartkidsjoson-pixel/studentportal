import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getClasses, getStudentById } from '@/lib/data';
import { StudentProfileForm } from '@/components/students/student-profile-form';
import { StatusPill } from '@/components/ui/status-pill';

export default async function StudentProfilePage({ params }: { params: { studentId: string } }) {
  const [student, classes] = await Promise.all([
    getStudentById(params.studentId),
    getClasses(),
  ]);

  if (!student) {
    notFound();
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h2>Student profile</h2>
          <p>Review details and update the student record safely.</p>
        </div>
        <div className="table-wrap">
          <table>
            <tbody>
              <tr>
                <th>Name</th>
                <td>{student.full_name}</td>
              </tr>
              <tr>
                <th>Admission No.</th>
                <td>{student.admission_number}</td>
              </tr>
              <tr>
                <th>Class</th>
                <td>{student.class_name ?? 'Unassigned'}</td>
              </tr>
              <tr>
                <th>Parent Contact</th>
                <td>{student.parent_contact ?? 'N/A'}</td>
              </tr>
              <tr>
                <th>Status</th>
                <td><StatusPill value={student.status} /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
          <Link href="/students" className="secondary">
            Back to student list
          </Link>
        </div>
      </div>
      <StudentProfileForm student={student} classes={classes} />
    </div>
  );
}
