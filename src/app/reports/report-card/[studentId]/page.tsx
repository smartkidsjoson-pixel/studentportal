import Link from 'next/link';

import { getReportCardData } from '@/lib/data';
import { formatPercentage } from '@/lib/utils';

export default async function ReportCardPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const data = await getReportCardData(studentId);

  return (
    <div className="print-sheet">
      <div className="no-print" style={{ marginBottom: '1rem' }}>
        <Link href="/reports">Back to reports</Link>
      </div>
      <h1>Student Report Card</h1>
      <p><strong>Name:</strong> {data.student.full_name}</p>
      <p><strong>Admission Number:</strong> {data.student.admission_number}</p>
      <p><strong>Class:</strong> {data.student.class_name ?? 'Unassigned'}</p>
      <p><strong>Parent Contact:</strong> {data.student.parent_contact ?? 'N/A'}</p>
      <h2>Subject Scores</h2>
      <table>
        <thead>
          <tr><th>Subject</th><th>Term</th><th>Score</th><th>Max Score</th></tr>
        </thead>
        <tbody>
          {data.marks.map((mark) => (
            <tr key={`${mark.subject_name}-${mark.term}`}>
              <td>{mark.subject_name}</td>
              <td>{mark.term.replace('_', ' ')}</td>
              <td>{mark.score}</td>
              <td>{mark.max_score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 style={{ marginTop: '1.5rem' }}>Term Summary</h2>
      <table>
        <thead>
          <tr><th>Term</th><th>Total Score</th><th>Average</th><th>Class Position</th><th>Overall Position</th></tr>
        </thead>
        <tbody>
          {data.totals.map((row) => (
            <tr key={row.term}>
              <td>{row.term.replace('_', ' ')}</td>
              <td>{row.total_score}</td>
              <td>{formatPercentage(row.average_score)}</td>
              <td>{row.position_in_class}</td>
              <td>{row.overall_position}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
