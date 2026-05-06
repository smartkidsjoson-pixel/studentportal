'use client';

import { useActionState } from 'react';

import { assignTeacherClassAction } from '@/lib/actions';
import type { ClassSummary, TeacherProfile } from '@/lib/types';

const initialState = {} as { error?: string; success?: string };

export function ClassAssignmentForm({ teachers, classes }: { teachers: TeacherProfile[]; classes: ClassSummary[] }) {
  const [state, formAction, pending] = useActionState(assignTeacherClassAction, initialState);

  return (
    <form action={formAction} className="card">
      <div className="section-header" style={{ marginBottom: '0.9rem' }}>
        <h2>Assign Teacher to Class</h2>
        <p>Grant teachers access only to the classes they manage.</p>
      </div>
      <div className="form-grid">
        <div>
          <label className="label" htmlFor="assignment-teacher">Staff Member</label>
          <select id="assignment-teacher" name="teacher_id" defaultValue="" required>
            <option value="" disabled>Select staff member</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>{teacher.full_name} ({teacher.role})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="assignment-class">Class</label>
          <select id="assignment-class" name="class_id" defaultValue="" required>
            <option value="" disabled>Select class</option>
            {classes.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" disabled={pending}>{pending ? 'Assigning...' : 'Assign class'}</button>
        {state?.error ? <span className="muted">{state.error}</span> : null}
        {state?.success ? <span className="muted">{state.success}</span> : null}
      </div>
    </form>
  );
}
