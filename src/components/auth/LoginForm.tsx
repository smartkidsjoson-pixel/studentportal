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
        <input id="email" name="email" type="email" placeholder="you@school.edu" required />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input id="password" name="password" type="password" placeholder="••••••••" required minLength={6} />
      </div>

      <div className="space-y-3">
        <button type="submit" disabled={pending} className="w-full">
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      </div>
    </form>
  );
}
