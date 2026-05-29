'use client';

import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function ChangePasswordModal({ isOpen, onClose }: Props) {
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setStep('email');
    setEmail('');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleEmailSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setStep('password');
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!oldPassword || !newPassword || !confirmPassword) {
        setError('All password fields are required.');
        setLoading(false);
        return;
      }

      if (newPassword.length < 8) {
        setError('New password must be at least 8 characters long.');
        setLoading(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('New password and confirmation do not match.');
        setLoading(false);
        return;
      }

      if (oldPassword === newPassword) {
        setError('New password must be different from old password.');
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: oldPassword,
      });

      if (signInError) {
        setError('Unable to sign in with the provided email and current password.');
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(`Password update failed: ${updateError.message}`);
        setLoading(false);
        return;
      }

      await supabase.auth.signOut();
      setSuccess('Password updated successfully. Reloading to sign in fresh...');
      setLoading(false);

      window.setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4 py-6">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold">Change Password</h2>
            <p className="text-sm text-slate-500 mt-1">
              {step === 'email'
                ? 'Enter your email to continue.'
                : 'Now enter your current password and choose a new password.'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-500 hover:text-slate-800 text-2xl font-bold leading-none"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="label">
                Email Address
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="form-input w-full"
                autoComplete="email"
              />
            </div>

            {error ? <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p> : null}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-3 border border-gray-300 text-slate-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-600">
                Account email: <span className="font-semibold text-slate-900">{email}</span>
              </p>
            </div>

            <div>
              <label htmlFor="modal-old-password" className="label">
                Old Password
              </label>
              <input
                id="modal-old-password"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
                className="form-input w-full"
                autoComplete="current-password"
              />
            </div>

            <div>
              <label htmlFor="modal-new-password" className="label">
                New Password
              </label>
              <input
                id="modal-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 8 chars)"
                className="form-input w-full"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label htmlFor="modal-confirm-password" className="label">
                Confirm New Password
              </label>
              <input
                id="modal-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="form-input w-full"
                autoComplete="new-password"
              />
            </div>

            {error ? <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg">{success}</p> : null}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setStep('email')}
                className="w-full sm:w-auto px-4 py-3 border border-gray-300 text-slate-700 rounded-lg hover:bg-gray-50"
                disabled={loading}
              >
                Back
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
