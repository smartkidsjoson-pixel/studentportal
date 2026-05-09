'use client';

import { useActionState } from 'react';

import { loginAction } from '@/lib/actions';

const initialState = {} as { error?: string; success?: string };

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label htmlFor="email" className="label">
          Email address
        </label>
        <input id="email" name="email" type="email" placeholder="admin@smartkids.academy" required className="form-input" />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input id="password" name="password" type="password" placeholder="Enter your password" required minLength={6} className="form-input" />
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <div className="space-y-3">
        <button type="submit" disabled={pending} className="primary-btn w-full">
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </form>
  );
}
