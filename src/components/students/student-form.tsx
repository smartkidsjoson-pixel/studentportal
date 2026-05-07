'use client';

import { useActionState, useEffect, useMemo, useRef } from 'react';

import { createStudentAction } from '@/lib/actions';
import type { ClassSummary } from '@/lib/types';

const initialState = {} as { error?: string; success?: string };

export function StudentForm({ classes }: { classes: ClassSummary[] }) {
  const [state, formAction, pending] = useActionState(createStudentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="card">
      <div className="section-header" style={{ marginBottom: '0.9rem' }}>
        <h2>Register student</h2>
        <p>Create a clean student record with family details and join date.</p>
      </div>
      <div className="form-grid">
        <div>
          <label className="label" htmlFor="student-name">Full name</label>
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
          <label className="label" htmlFor="gender">Gender</label>
          <select id="gender" name="gender" defaultValue="">
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="date-of-birth">Date of birth</label>
          <input id="date-of-birth" name="date_of_birth" type="date" />
        </div>
        <div>
          <label className="label" htmlFor="parent-name">Parent / guardian</label>
          <input id="parent-name" name="parent_name" />
        </div>
        <div>
          <label className="label" htmlFor="parent-phone">Parent phone</label>
          <input id="parent-phone" name="parent_phone" type="tel" />
        </div>
        <div>
          <label className="label" htmlFor="alt-phone">Alternative phone</label>
          <input id="alt-phone" name="alt_phone" type="tel" />
        </div>
        <div>
          <label className="label" htmlFor="home-address">Home address</label>
          <input id="home-address" name="home_address" />
        </div>
        <div className="wide">
          <label className="label" htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={4} />
        </div>
        <div>
          <label className="label" htmlFor="date-joined">Date joined</label>
          <input id="date-joined" name="date_joined" type="date" defaultValue={today} required />
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
        {state.error ? <span className="muted">{state.error}</span> : null}
        {state.success ? <span className="muted">{state.success}</span> : null}
      </div>
    </form>
  );
}
