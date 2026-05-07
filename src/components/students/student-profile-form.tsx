'use client';

import { useActionState, useRef } from 'react';

import { updateStudentAction } from '@/lib/actions';
import type { ClassSummary, StudentDirectoryItem } from '@/lib/types';

const initialState = {} as { error?: string; success?: string };

export function StudentProfileForm({ student, classes }: { student: StudentDirectoryItem; classes: ClassSummary[] }) {
  const [state, formAction, pending] = useActionState(updateStudentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="card">
      <div className="section-header" style={{ marginBottom: '0.9rem' }}>
        <h2>Edit student record</h2>
        <p>Update student status, class, and parent contact data.</p>
      </div>

      <input type="hidden" name="student_id" value={student.id} />

      <div className="form-grid">
        <div>
          <label className="label" htmlFor="student-name">Full Name</label>
          <input id="student-name" name="full_name" defaultValue={student.full_name} required />
        </div>
        <div>
          <label className="label" htmlFor="student-class">Class</label>
          <select id="student-class" name="class_id" required defaultValue={student.class_id ?? ''}>
            <option value="" disabled>Select class</option>
            {classes.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="parent-contact">Parent Contact</label>
          <input id="parent-contact" name="parent_contact" defaultValue={student.parent_contact ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="student-status">Status</label>
          <select id="student-status" name="status" defaultValue={student.status}>
            <option value="active">Active</option>
            <option value="transferred">Transferred</option>
            <option value="graduated">Graduated</option>
          </select>
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save changes'}</button>
        {state.error ? <span className="muted">{state.error}</span> : null}
        {state.success ? <span className="muted">{state.success}</span> : null}
      </div>
    </form>
  );
}
