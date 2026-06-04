'use client';

import { useActionState } from 'react';

import { changePasswordAction } from '@/lib/actions';

type State = { error?: string; success?: string };

const initialState = {} as State;

export default function PasswordChangeForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label htmlFor="current_password" className="label">
          Current password
        </label>
        <input id="current_password" name="current_password" type="password" required minLength={6} className="form-input" />
      </div>

      <div>
        <label htmlFor="new_password" className="label">
          New password
        </label>
        <input id="new_password" name="new_password" type="password" required minLength={8} className="form-input" />
      </div>

      <div>
        <label htmlFor="confirm_password" className="label">
          Confirm new password
        </label>
        <input id="confirm_password" name="confirm_password" type="password" required minLength={8} className="form-input" />
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-green-700">{state.success}</p> : null}

      <div className="space-y-3">
        <button type="submit" disabled={pending} className="primary-btn w-full">
          {pending ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  );
}
