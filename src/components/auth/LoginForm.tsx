'use client';

import { useState } from 'react';
import { useActionState } from 'react';

import { loginAction } from '@/lib/actions';
import ChangePasswordModal from './ChangePasswordModal';

const initialState = {} as { error?: string; success?: string };

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  return (
    <>
      <form action={formAction} className="space-y-6">
        <div>
          <label htmlFor="username" className="label">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            placeholder="Joson"
            required
            className="form-input"
            autoComplete="username"
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            required
            minLength={6}
            className="form-input"
            autoComplete="current-password"
          />
        </div>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <div className="space-y-4">
          <button type="submit" disabled={pending} className="primary-btn w-full py-3 text-sm">
            {pending ? 'Signing in…' : 'Sign in'}
          </button>

          <button
            type="button"
            onClick={() => setIsChangePasswordOpen(true)}
            className="w-full mt-4 text-sm text-blue-600 hover:text-blue-800 hover:underline font-semibold"
          >
            Change Password
          </button>
        </div>
      </form>

      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
    </>
  );
}
