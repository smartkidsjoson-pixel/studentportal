import Link from 'next/link';

import { StudentForm } from '@/components/students/student-form';
import { StatusPill } from '@/components/ui/status-pill';
import { EmptyState } from '@/components/ui/empty-state';
import { getClasses, getStudents, getStudentsCount } from '@/lib/data';

export default async function StudentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; classId?: string; page?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const requestedPage = Number(params.page);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 12;

  const [classes, students, totalStudents] = await Promise.all([
    getClasses(),
    getStudents({ query: params.q, classId: params.classId, page, pageSize }),
    getStudentsCount({ query: params.q, classId: params.classId }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalStudents / pageSize));
  const nextPage = page < totalPages ? page + 1 : totalPages;
  const prevPage = page > 1 ? page - 1 : 1;

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

        {students.length === 0 ? (
          <EmptyState
            title="No students found"
            description={params.q ? 'Try another search term or clear the filters.' : 'Register students to see them listed here.'}
            href="/students"
            ctaLabel="Register student"
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Admission No.</th>
                    <th>Class</th>
                    <th>Parent Contact</th>
                    <th>Status</th>
                    <th>Profile</th>
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
                        <Link href={`/students/${student.id}`}>View profile</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
              {page > 1 ? (
                <Link href={`/students?q=${params.q ?? ''}&classId=${params.classId ?? ''}&page=${prevPage}`} className="secondary">
                  Previous
                </Link>
              ) : (
                <span className="disabled-link">Previous</span>
              )}
              {page < totalPages ? (
                <Link href={`/students?q=${params.q ?? ''}&classId=${params.classId ?? ''}&page=${nextPage}`} className="secondary">
                  Next
                </Link>
              ) : (
                <span className="disabled-link">Next</span>
              )}
            </div>
          </>
        )}
      </div>
      <StudentForm classes={classes} />
    </div>
  );
}
