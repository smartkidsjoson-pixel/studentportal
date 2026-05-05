import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { getMeritList, getSubjectPerformance } from '@/lib/data';
import { formatPercentage } from '@/lib/utils';

export default async function ClassReportPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const [meritList, subjectPerformance] = await Promise.all([
    getMeritList(classId, 'TERM_1'),
    getSubjectPerformance(classId, 'TERM_1'),
  ]);

  return (
    <div className="print-sheet">
      <div className="no-print" style={{ marginBottom: '1rem' }}>
        <Link href="/reports">Back to reports</Link>
      </div>
      <h1>Class Performance Report</h1>
      <div className="grid">
        <Card title="Term 1 Merit List">
          <table>
            <thead>
              <tr><th>Position</th><th>Student</th><th>Admission No.</th><th>Total</th><th>Average</th></tr>
            </thead>
            <tbody>
              {meritList.map((entry) => (
                <tr key={`${entry.student_id}-${entry.position}`}>
                  <td>{entry.position}</td>
                  <td>{entry.full_name}</td>
                  <td>{entry.admission_number}</td>
                  <td>{entry.total_score}</td>
                  <td>{formatPercentage(entry.average_score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Subject Averages">
          <ul className="kpi-list">
            {subjectPerformance.map((subject) => (
              <li key={subject.subject_id}>
                <span>{subject.subject_name}</span>
                <strong>{formatPercentage(subject.average_score)}</strong>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
