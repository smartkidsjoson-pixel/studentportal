'use client';

import { useActionState } from 'react';

import { loginAction } from '@/lib/actions';

const initialState = {} as { error?: string };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="auth-shell">
      <form action={formAction} className="card auth-card">
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h2>Staff Sign In</h2>
          <p>Use your school-issued email and password to access the administration portal.</p>
        </div>
        <div className="form-grid">
          <div className="wide">
            <label className="label" htmlFor="email">Email Address</label>
            <input id="email" name="email" type="email" required />
          </div>
          <div className="wide">
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" disabled={pending}>{pending ? 'Signing in...' : 'Sign in'}</button>
          {state?.error ? <span className="muted">{state.error}</span> : null}
        </div>
      </form>
    </div>
  );
}
