import { MarksForm } from '@/components/marks-form';
import { Card } from '@/components/ui/card';
import { getClasses, getMeritList, getStudents, getSubjectPerformance } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import { formatPercentage } from '@/lib/utils';

export default async function ResultsPage({
  searchParams,
}: {
  searchParams?: Promise<{ classId?: string; term?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const supabase = await createClient();
  const [{ data: subjects }, classes, students, meritList, subjectPerformance] = await Promise.all([
    supabase.from('subjects').select('id, name').order('name', { ascending: true }),
    getClasses(),
    getStudents({ classId: params.classId }),
    getMeritList(params.classId, params.term ?? 'TERM_1'),
    getSubjectPerformance(params.classId, params.term ?? 'TERM_1'),
  ]);

  return (
    <div className="grid">
      <div className="card">
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h2>Academic Records</h2>
          <p>Term-based merit ranking and subject performance summaries.</p>
        </div>
        <form className="inline-filters" action="/results">
          <select name="classId" defaultValue={params.classId ?? ''}>
            <option value="">All classes</option>
            {classes.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
            ))}
          </select>
          <select name="term" defaultValue={params.term ?? 'TERM_1'}>
            <option value="TERM_1">Term 1</option>
            <option value="TERM_2">Term 2</option>
            <option value="TERM_3">Term 3</option>
          </select>
          <button type="submit">Apply Filter</button>
        </form>
        <div className="layout-two">
          <Card title="Merit List" description="Automatic ranking by total and average score.">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Student</th>
                    <th>Admission No.</th>
                    <th>Class</th>
                    <th>Total</th>
                    <th>Average</th>
                  </tr>
                </thead>
                <tbody>
                  {meritList.map((entry) => (
                    <tr key={`${entry.student_id}-${entry.position}`}>
                      <td>{entry.position}</td>
                      <td>{entry.full_name}</td>
                      <td>{entry.admission_number}</td>
                      <td>{entry.class_name ?? 'Unassigned'}</td>
                      <td>{entry.total_score}</td>
                      <td>{formatPercentage(entry.average_score)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Subject Performance" description="Average score per subject for the selected term.">
            <ul className="kpi-list">
              {subjectPerformance.map((item) => (
                <li key={item.subject_id}>
                  <span>{item.subject_name}</span>
                  <strong>{formatPercentage(item.average_score)}</strong>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <MarksForm students={students} subjects={subjects ?? []} />
    </div>
  );
}
