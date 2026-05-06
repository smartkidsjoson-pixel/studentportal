'use client';

import { useActionState, useEffect, useRef } from 'react';

import { createStudentAction } from '@/lib/actions';
import type { ClassSummary } from '@/lib/types';

const initialState = {} as { error?: string; success?: string };

export function StudentForm({ classes }: { classes: ClassSummary[] }) {
  const [state, formAction, pending] = useActionState(createStudentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="card">
      <div className="section-header" style={{ marginBottom: '0.9rem' }}>
        <h2>Register Student</h2>
        <p>Create a student record with automatic admission number generation.</p>
      </div>
      <div className="form-grid">
        <div>
          <label className="label" htmlFor="student-name">Full Name</label>
          <input id="student-name" name="full_name" required />
        </div>
        <div>
          <label className="label" htmlFor="student-class">Class</label>
          <select id="student-class" name="class_id" required defaultValue="">
            <option value="" disabled>Select class</option>
            {classes.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="parent-contact">Parent Contact</label>
          <input id="parent-contact" name="parent_contact" required />
        </div>
        <div>
          <label className="label" htmlFor="student-status">Status</label>
          <select id="student-status" name="status" defaultValue="active">
            <option value="active">Active</option>
            <option value="transferred">Transferred</option>
            <option value="graduated">Graduated</option>
          </select>
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Register student'}</button>
        {state?.error ? <span className="muted">{state.error}</span> : null}
        {state?.success ? <span className="muted">{state.success}</span> : null}
      </div>
    </form>
  );
}
