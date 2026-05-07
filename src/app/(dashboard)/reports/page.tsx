import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { getClasses, getStudents } from '@/lib/data';

export default async function ReportsPage() {
  const [students, classes] = await Promise.all([getStudents(), getClasses()]);

  return (
    <div className="grid">
      <Card title="Student Reports" description="Printable documents for academic progress and report cards.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Admission No.</th>
                <th>Class</th>
                <th>Report Card</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.full_name}</td>
                  <td>{student.admission_number}</td>
                  <td>{student.class_name ?? 'Unassigned'}</td>
                  <td><Link href={`/reports/report-card/${student.id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Class Reports" description="Class-wide academic performance reports.">
        <ul className="list-clean">
          {classes.map((schoolClass) => (
            <li key={schoolClass.id}>
              <span>{schoolClass.name}</span>
              <Link href={`/reports/class/${schoolClass.id}`}>Open Class Report</Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
