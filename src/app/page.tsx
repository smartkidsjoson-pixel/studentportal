import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="landing-shell">
      <section className="landing-hero">
        <div className="hero-copy">
          <span className="brand-pill">CBC School Portal</span>
          <h1>Clean school records for every Kenyan classroom.</h1>
          <p className="hero-copy-text">
            Manage students, classes, teachers and promotions with a secure, minimal portal built for everyday school operations.
          </p>
          <div className="hero-actions">
            <Link href="/login">Sign in</Link>
            <Link href="/setup" className="secondary">Set up school</Link>
          </div>
        </div>

        <div className="hero-panel">
          <div>
            <h2>Fast, secure school management.</h2>
            <p>One place for clean student registration, teacher assignments and class promotion planning.</p>
          </div>
          <dl className="feature-list">
            <div>
              <dt>Student directory</dt>
              <dd>Search names, admission numbers and parent contacts instantly.</dd>
            </div>
            <div>
              <dt>Class control</dt>
              <dd>Maintain class structure and assign teachers to the right groups.</dd>
            </div>
            <div>
              <dt>Promotion workflow</dt>
              <dd>Move students to next classes with history and audit-safe updates.</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="landing-features">
        <div>
          <h2>Designed for school owners and teachers.</h2>
          <p>Simple navigation, role-aware access and a polished interface for everyday school administration.</p>
        </div>
        <div className="feature-grid">
          <div className="feature-card">
            <h3>Owner access</h3>
            <p>Full control over students, teachers and class promotion workflows.</p>
          </div>
          <div className="feature-card">
            <h3>Teacher access</h3>
            <p>Only assigned classes and students appear to classroom staff.</p>
          </div>
          <div className="feature-card">
            <h3>Reliable records</h3>
            <p>Admission numbers, status tracking and promotion history are stored safely.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
