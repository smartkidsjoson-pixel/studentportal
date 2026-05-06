import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="login-shell">
      <section className="login-hero">
        <span className="brand-pill">Elote School</span>
        <h1>Secure school management for modern administrators.</h1>
        <p className="hero-copy-text">
          Manage attendance, fees, students, and report cards from one elegant portal built for school leaders.
        </p>

        <div className="feature-grid">
          <span className="feature-chip">Student records</span>
          <span className="feature-chip">Fees & payments</span>
          <span className="feature-chip">Term reports</span>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-header">
          <p className="eyebrow">Administration Portal</p>
          <h2>Sign in to continue</h2>
          <p className="mt-3 text-slate-500">Use your school administrator credentials to access the dashboard.</p>
        </div>

        <div className="mt-8">
          <LoginForm />
        </div>

        <p className="login-help">
          First time here? <a href="/setup">Create the first administrator account</a>.
        </p>
      </section>
    </div>
  );
}
