'use client';

import { useActionState } from 'react';

import { loginAction } from '@/lib/actions';

const initialState = {} as { error?: string };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl ring-1 ring-slate-900/5">
        <div className="mb-8 text-center">
          <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white uppercase tracking-[.2em]">
            School Portal
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900">Staff Sign In</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Securely access student records, marks, fees and reports from one central dashboard.
          </p>
        </div>

        <form action={formAction} className="space-y-6">
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <label className="block text-sm font-medium text-slate-700" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              placeholder="you@school.edu"
            />
          </div>

          <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <label className="block text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              placeholder="Enter your password"
            />
          </div>

          <div className="space-y-3">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex w-full justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {pending ? 'Signing in…' : 'Sign in'}
            </button>
            {state?.error ? (
              <p className="text-center text-sm font-medium text-rose-600">{state.error}</p>
            ) : null}
          </div>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-slate-500">
          By signing in, you agree to use this portal for authorized school administration only.
        </p>
      </div>
    </main>
  );
}
