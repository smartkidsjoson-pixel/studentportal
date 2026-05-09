import Image from 'next/image';
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="login-shell">
      <div className="login-hero">
        <div>
          <div className="brand-pill">Joson's SmartKids Academy</div>
          <div className="mt-6" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="logo-badge">
              <Image
                src="/logos/IMG-20260506-WA0004(1).jpg"
                alt="Joson's SmartKids Academy"
                width={64}
                height={64}
                className="logo-image"
                priority
              />
            </div>
            <div>
              <p className="eyebrow">Private academy portal</p>
              <h1>Welcome back</h1>
            </div>
          </div>
          <p className="hero-copy-text">
            Secure access for administrators of Joson's SmartKids Academy. Manage student records, fee collection, and class operations with confidence.
          </p>
          <ul className="login-list">
            <li>Premium private academy dashboard</li>
            <li>Automated fee accounts and payment tracking</li>
            <li>Clean, secure administration workflow</li>
          </ul>
        </div>

        <div className="auth-card">
          <div className="auth-header">
            <span className="eyebrow">Sign in</span>
            <h2>Access the school management portal</h2>
            <p className="login-help">Enter your email and password to continue.</p>
          </div>

          <LoginForm />

          <p className="login-help" style={{ marginTop: '1.5rem' }}>
            New to the portal? <a href="/setup">Create the first administrator account</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
