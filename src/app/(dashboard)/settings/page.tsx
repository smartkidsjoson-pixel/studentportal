import PasswordChangeForm from '@/components/auth/PasswordChangeForm';
import { requireSessionUser } from '@/lib/auth';

export default async function SettingsPage() {
  const user = await requireSessionUser();

  return (
    <div>
      <h1>Account Settings</h1>
      <p>Username: {user.username ?? user.email}</p>

      <section style={{ marginTop: '1rem' }}>
        <h2>Change Password</h2>
        <PasswordChangeForm />
      </section>
    </div>
  );
}
