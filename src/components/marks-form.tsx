'use client';

import { useActionState, useEffect, useRef } from 'react';

import { upsertMarkAction } from '@/lib/actions';
import type { StudentDirectoryItem } from '@/lib/types';

const initialState = {} as { error?: string; success?: string };

export function MarksForm({ students, subjects }: { students: StudentDirectoryItem[]; subjects: Array<{ id: string; name: string }> }) {
  const [state, formAction, pending] = useActionState(upsertMarkAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="card">
      <div className="section-header" style={{ marginBottom: '0.9rem' }}>
        <h2>Marks Entry</h2>
        <p>Enter subject scores per term with automatic totals and ranking views.</p>
      </div>
      <div className="form-grid">
        <div className="wide">
          <label className="label" htmlFor="mark-student">Student</label>
          <select id="mark-student" name="student_id" defaultValue="" required>
            <option value="" disabled>Select student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>{student.full_name} ({student.admission_number})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="mark-subject">Subject</label>
          <select id="mark-subject" name="subject_id" defaultValue="" required>
            <option value="" disabled>Select subject</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>{subject.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="mark-term">Term</label>
          <select id="mark-term" name="term" defaultValue="TERM_1">
            <option value="TERM_1">Term 1</option>
            <option value="TERM_2">Term 2</option>
            <option value="TERM_3">Term 3</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="mark-score">Score</label>
          <input id="mark-score" name="score" type="number" min="0" max="100" required />
        </div>
        <div>
          <label className="label" htmlFor="mark-max">Max Score</label>
          <input id="mark-max" name="max_score" type="number" min="1" defaultValue="100" required />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save marks'}</button>
        {state?.error ? <span className="muted">{state.error}</span> : null}
        {state?.success ? <span className="muted">{state.success}</span> : null}
      </div>
    </form>
  );
}
