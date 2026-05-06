'use client';

import { useActionState, useEffect, useRef } from 'react';

import { createClassAction } from '@/lib/actions';

const initialState = {} as { error?: string; success?: string };

export function ClassForm() {
  const [state, formAction, pending] = useActionState(createClassAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="card">
      <div className="section-header" style={{ marginBottom: '0.9rem' }}>
        <h2>Create Class</h2>
        <p>Maintain the class structure from pre-grade through Grade 9.</p>
      </div>
      <div className="form-grid">
        <div>
          <label className="label" htmlFor="class-name">Class Name</label>
          <input id="class-name" name="name" placeholder="Grade 3" required />
        </div>
        <div>
          <label className="label" htmlFor="section">Section</label>
          <input id="section" name="section" placeholder="Blue" />
        </div>
        <div>
          <label className="label" htmlFor="level-order">Level Order</label>
          <input id="level-order" name="level_order" type="number" min="0" required />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Create class'}</button>
        {state?.error ? <span className="muted">{state.error}</span> : null}
        {state?.success ? <span className="muted">{state.success}</span> : null}
      </div>
    </form>
  );
}
