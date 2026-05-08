import Link from 'next/link';

import { getClasses, getPromotionHistory, getStudentById, getSessionUserProfile, getStudentFeeOverview } from '@/lib/data';
import { StudentProfileForm } from '@/components/students/student-profile-form';
import { StudentFeeSection } from '@/components/students/student-fee-section';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';

export default async function StudentProfilePage({ 
  params 
}: { 
  params: Promise<{ studentId: string }> 
}) {
  const resolvedParams = await params;
  const { studentId } = resolvedParams;

  // Guard against undefined studentId
  if (!studentId || studentId === 'undefined') {
    return (
      <div className="grid">
        <div className="card">
          <div className="section-header" style={{ marginBottom: '1rem' }}>
            <h2>Invalid Student ID</h2>
            <p>No valid student ID provided.</p>
          </div>
          <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
            <Link href="/students" className="secondary">
              Back to student list
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [student, classes, promotionHistory, user] = await Promise.all([
    getStudentById(studentId),
    getClasses(),
    getPromotionHistory(studentId),
    getSessionUserProfile(),
  ]);

  console.log('FETCHED STUDENT:', { studentId, student });

  if (!student) {
    return (
      <div className="grid">
        <div className="card">
          <div className="section-header" style={{ marginBottom: '1rem' }}>
            <h2>User not found</h2>
            <p>No student record was found for the requested ID.</p>
          </div>
          <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
            <Link href="/students" className="secondary">
              Back to student list
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const feeOverview = user?.role === 'OWNER' ? await getStudentFeeOverview(studentId) : null;

  return (
    <div className="grid">
      <div className="card">
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h2>Student profile</h2>
          <p>View student details, guardian contacts and promotion history.</p>
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
                <th>Gender</th>
                <td>{student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : 'Not set'}</td>
              </tr>
              <tr>
                <th>Date of birth</th>
                <td>{student.date_of_birth ?? 'Not set'}</td>
              </tr>
              <tr>
                <th>Date joined</th>
                <td>{student.date_joined ?? 'Not set'}</td>
              </tr>
              <tr>
                <th>Parent / guardian</th>
                <td>{student.parent_name ?? 'N/A'}</td>
              </tr>
              <tr>
                <th>Parent phone</th>
                <td>{student.parent_phone ?? 'N/A'}</td>
              </tr>
              <tr>
                <th>Alternative phone</th>
                <td>{student.alt_phone ?? 'N/A'}</td>
              </tr>
              <tr>
                <th>Address</th>
                <td>{student.home_address ?? 'N/A'}</td>
              </tr>
              <tr>
                <th>Status</th>
                <td><StatusPill value={student.status} /></td>
              </tr>
              <tr>
                <th>Notes</th>
                <td>{student.notes ?? 'No additional notes'}</td>
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
      <div className="card">
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h2>Student record</h2>
          <p>Edit the student details or update transfer and graduation status.</p>
        </div>
        <StudentProfileForm student={student} classes={classes} />
      </div>
      {user?.role === 'OWNER' && feeOverview ? (
        <StudentFeeSection
          studentId={student.id}
          accounts={feeOverview.accounts}
          payments={feeOverview.payments}
        />
      ) : null}
      <div className="card">
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h2>Promotion history</h2>
          <p>Track class changes and promotions for this student.</p>
        </div>
        {promotionHistory.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>From</th>
                  <th>To</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {promotionHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.promoted_at).toLocaleDateString()}</td>
                    <td>{entry.from_class_name ?? 'Unknown'}</td>
                    <td>{entry.to_class_name ?? 'Unknown'}</td>
                    <td>{entry.promoted_by ?? 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No promotion history" description="This student has not been moved between classes yet." />
        )}
      </div>
    </div>
  );
}
