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
            minLength={4}
            className="form-input"
            autoComplete="current-password"
          />
        </div>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <div className="space-y-6">
          <button type="submit" disabled={pending} className="w-full py-2.5 px-4 bg-[#15803d] text-white font-medium rounded-lg text-center shadow-sm hover:bg-[#166534] transition-colors disabled:opacity-65">
            {pending ? 'Signing in…' : 'Sign in'}
          </button>

          <button
            type="button"
            onClick={() => setIsChangePasswordOpen(true)}
            className="w-full py-2.5 px-4 bg-transparent border border-gray-300 text-gray-700 font-medium rounded-lg text-center hover:bg-gray-50 transition-colors mt-3"
          >
            Change Password
          </button>
        </div>
      </form>

      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
    </>
  );
}
