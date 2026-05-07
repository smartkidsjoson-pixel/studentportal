import Link from 'next/link';
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-header" style={{ textAlign: 'center' }}>
          <p className="eyebrow">School MIS</p>
          <h2>Sign in</h2>
        </div>

        <div className="mt-6">
          <LoginForm />
        </div>

        <p className="login-help" style={{ textAlign: 'center' }}>
          First time here? <Link href="/setup">Create administrator account</Link>.
        </p>
      </div>
    </div>
  );
}
