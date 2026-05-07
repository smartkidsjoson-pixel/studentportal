'use client';

import { useEffect, useRef } from 'react';
import { useActionState } from 'react';

import { createFeeStructureAction } from '@/lib/actions';
import type { ClassSummary } from '@/lib/types';

const initialState = {} as { error?: string; success?: string };

export function FeeStructureForm({ classes }: { classes: ClassSummary[] }) {
  const [state, formAction, pending] = useActionState(createFeeStructureAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="card">
      <div className="section-header" style={{ marginBottom: '0.9rem' }}>
        <h2>Create fee structure</h2>
        <p>Set expected fees by class, year and term so student accounts are created automatically.</p>
      </div>
      <div className="form-grid">
        <div>
          <label className="label" htmlFor="fee-class">Class</label>
          <select id="fee-class" name="class_id" required>
            <option value="" disabled>Select class</option>
            {classes.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="academic-year">Academic year</label>
          <input id="academic-year" name="academic_year" placeholder="2026" required />
        </div>
        <div>
          <label className="label" htmlFor="term">Term</label>
          <select id="term" name="term" required>
            <option value="" disabled>Select term</option>
            <option value="TERM_1">TERM 1</option>
            <option value="TERM_2">TERM 2</option>
            <option value="TERM_3">TERM 3</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="expected-amount">Expected amount</label>
          <input id="expected-amount" name="expected_amount" type="number" min="1" step="0.01" placeholder="25000" required />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Create structure'}</button>
        {state.error ? <span className="muted">{state.error}</span> : null}
        {state.success ? <span className="muted">{state.success}</span> : null}
      </div>
    </form>
  );
}
