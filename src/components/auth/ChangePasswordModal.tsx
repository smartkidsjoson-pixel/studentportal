'use client';

import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getUserEmailByUsername } from '@/lib/actions';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function ChangePasswordModal({ isOpen, onClose }: Props) {
  const [username, setUsername] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setUsername('');
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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!username.trim() || !oldPassword || !newPassword || !confirmPassword) {
        setError('All fields are required.');
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

      const { email, error: lookupError } = await getUserEmailByUsername(username);

      if (lookupError || !email) {
        setError(lookupError || 'Username not found.');
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: oldPassword,
      });

      if (signInError) {
        setError('Unable to authenticate with the provided username and current password.');
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
      setSuccess('Password updated successfully. Reloading to sign in with your new password...');
      setLoading(false);

      window.setTimeout(() => {
        window.location.reload();
      }, 1500);
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
            <p className="text-sm text-slate-500 mt-1">Enter your username and current password to set a new one.</p>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-500 hover:text-slate-800 text-2xl font-bold leading-none"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="modal-username" className="label">
              Username
            </label>
            <input
              id="modal-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="form-input w-full"
              autoComplete="username"
            />
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

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 px-4 bg-transparent border border-gray-300 text-gray-700 font-medium rounded-lg text-center hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-[#15803d] text-white font-medium rounded-lg text-center shadow-sm hover:bg-[#166534] transition-colors disabled:opacity-65"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
