import Link from 'next/link';

import { StudentForm } from '@/components/students/student-form';
import { StatusPill } from '@/components/ui/status-pill';
import { getClasses, getStudents } from '@/lib/data';

export default async function StudentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; classId?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const [classes, students] = await Promise.all([
    getClasses(),
    getStudents({ query: params.q, classId: params.classId }),
  ]);

  return (
    <div className="grid">
      <div className="card">
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h2>Student Directory</h2>
          <p>Fast search by name or admission number with class-level filtering.</p>
        </div>
        <form className="inline-filters" action="/students">
          <input name="q" defaultValue={params.q ?? ''} placeholder="Search by student name or admission number" />
          <select name="classId" defaultValue={params.classId ?? ''}>
            <option value="">All classes</option>
            {classes.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
            ))}
          </select>
          <button type="submit">Search</button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Admission No.</th>
                <th>Class</th>
                <th>Parent Contact</th>
                <th>Status</th>
                <th>Reports</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.full_name}</td>
                  <td>{student.admission_number}</td>
                  <td>{student.class_name ?? 'Unassigned'}</td>
                  <td>{student.parent_contact ?? 'N/A'}</td>
                  <td><StatusPill value={student.status} /></td>
                  <td>
                    <Link href={`/reports/report-card/${student.id}`}>Report Card</Link><br />
                    <Link href={`/reports/fees/${student.id}`}>Fee Statement</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <StudentForm classes={classes} />
    </div>
  );
}
