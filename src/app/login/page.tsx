import Link from 'next/link';
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="login-shell">
      <section className="login-hero">
        <div>
          <p className="brand-pill">CBC School Portal</p>
          <h1>Secure access for school owners and teachers.</h1>
          <p className="hero-copy-text">
            Use a modern, minimal portal for student records, class assignments and promotion planning.
          </p>
        </div>
      </section>

      <div className="auth-card">
        <div className="auth-header">
          <p className="eyebrow">Sign in</p>
          <h2>Welcome back</h2>
        </div>
        <div className="mt-6">
          <LoginForm />
        </div>
        <p className="login-help">
          First time here? <Link href="/setup">Create administrator account</Link>.
        </p>
      </div>
    </div>
  );
}
