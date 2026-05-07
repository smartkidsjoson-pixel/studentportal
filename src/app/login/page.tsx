import Link from 'next/link';
import Image from 'next/image';
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="login-shell">
      <section className="login-hero">
        <div>
          <Image src="/logos/IMG-20260506-WA0004(1).jpg" alt="School Logo" width={150} height={100} />
          <p className="brand-pill">CBC School Portal</p>
          <h1>Secure school access for owners and teachers.</h1>
          <p className="hero-copy-text">
            Sign in to manage learner records, class assignments and promotions with a calm, dependable interface.
          </p>
          <ul className="login-list">
            <li>Role-based teacher access</li>
            <li>Protected student records</li>
            <li>Fast class and promotion workflows</li>
          </ul>
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
