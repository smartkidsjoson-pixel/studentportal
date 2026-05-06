'use client';

import { useActionState } from 'react';

import { createInitialAdminAction } from '@/lib/actions';

type State = {
  error?: string;
  success?: string;
};

const initialState = {} as State;

export default function AdminSetupForm() {
  const [state, formAction, pending] = useActionState(createInitialAdminAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label htmlFor="full_name" className="label">
          Full name
        </label>
        <input id="full_name" name="full_name" type="text" placeholder="Jane Doe" required autoComplete="name" />
      </div>

      <div>
        <label htmlFor="email" className="label">
          Email address
        </label>
        <input id="email" name="email" type="email" placeholder="admin@eloteschool.edu" required autoComplete="email" />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="Create a secure password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <input type="hidden" name="role" value="OWNER" />

      <div className="space-y-3">
        <button type="submit" disabled={pending} className="w-full">
          {pending ? 'Creating admin…' : 'Create administrator'}
        </button>
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-green-700">{state.success}</p> : null}
      </div>
    </form>
  );
}
