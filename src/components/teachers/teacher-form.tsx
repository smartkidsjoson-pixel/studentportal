'use client';

import { useActionState, useEffect, useRef } from 'react';

import { createTeacherAction } from '@/lib/actions';

const initialState = {} as { error?: string; success?: string };

export function TeacherForm() {
  const [state, formAction, pending] = useActionState(createTeacherAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="card">
      <div className="section-header" style={{ marginBottom: '0.9rem' }}>
        <h2>Create Staff Account</h2>
        <p>Invite a teacher or owner account with role-based access.</p>
      </div>
      <div className="form-grid">
        <div>
          <label className="label" htmlFor="teacher-full-name">Full Name</label>
          <input id="teacher-full-name" name="full_name" required />
        </div>
        <div>
          <label className="label" htmlFor="teacher-email">Email</label>
          <input id="teacher-email" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="teacher-password">Password</label>
          <input id="teacher-password" name="password" type="password" minLength={6} required />
        </div>
        <div>
          <label className="label" htmlFor="teacher-role">Role</label>
          <select id="teacher-role" name="role" defaultValue="TEACHER">
            <option value="TEACHER">Teacher</option>
            <option value="OWNER">Owner</option>
          </select>
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" disabled={pending}>{pending ? 'Creating...' : 'Create staff account'}</button>
        {state?.error ? <span className="muted">{state.error}</span> : null}
        {state?.success ? <span className="muted">{state.success}</span> : null}
      </div>
    </form>
  );
}
