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
        <p>Update student details, guardian information and current status.</p>
      </div>

      <input type="hidden" name="student_id" value={student.id} />

      <div className="form-grid">
        <div>
          <label className="label" htmlFor="student-name">Full name</label>
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
          <label className="label" htmlFor="gender">Gender</label>
          <select id="gender" name="gender" defaultValue={student.gender ?? ''}>
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="date-of-birth">Date of birth</label>
          <input id="date-of-birth" name="date_of_birth" type="date" defaultValue={student.date_of_birth ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="parent-name">Parent / guardian</label>
          <input id="parent-name" name="parent_name" defaultValue={student.parent_name ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="parent-phone">Parent phone</label>
          <input id="parent-phone" name="parent_phone" type="tel" defaultValue={student.parent_phone ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="alt-phone">Alternative phone</label>
          <input id="alt-phone" name="alt_phone" type="tel" defaultValue={student.alt_phone ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="home-address">Home address</label>
          <input id="home-address" name="home_address" defaultValue={student.home_address ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="date-joined">Date joined</label>
          <input id="date-joined" name="date_joined" type="date" defaultValue={student.date_joined ?? ''} required />
        </div>
        <div className="wide">
          <label className="label" htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={4} defaultValue={student.notes ?? ''} />
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
