import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="landing-shell">
      <section className="landing-hero">
        <div className="hero-copy">
          <span className="brand-pill">CBC School Portal</span>
          <h1>Simple, secure school management for Kenyan classrooms.</h1>
          <p className="hero-copy-text">
            Keep student records, teacher assignments and class promotions clean, fast and organised with a practical portal built for real schools.
          </p>
          <div className="hero-actions">
            <Link href="/login">Sign in</Link>
            <Link href="/setup" className="secondary">Set up school</Link>
          </div>
          <ul className="hero-badges">
            <li>Owner/Teacher role access</li>
            <li>Class-based student filtering</li>
            <li>Promotion workflow with history</li>
          </ul>
        </div>

        <div className="hero-panel">
          <div>
            <h2>A polished portal for everyday school operations.</h2>
            <p>Built for administrators and teachers who need a fast, dependable system for student and class management.</p>
          </div>
          <dl className="feature-list">
            <div>
              <dt>Student directory</dt>
              <dd>Search by name, admission number or guardian phone instantly.</dd>
            </div>
            <div>
              <dt>Class management</dt>
              <dd>Track class counts, assign teachers and keep class structures aligned.</dd>
            </div>
            <div>
              <dt>Promotion planning</dt>
              <dd>Move learners cleanly to the next class with an audit trail.</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="landing-features">
        <div>
          <h2>Everything you need, nothing you don’t.</h2>
          <p>Minimal design, thoughtful access control and practical tools for school staff.</p>
        </div>
        <div className="feature-grid">
          <div className="feature-card">
            <h3>Admin control</h3>
            <p>Owner access to classes, teachers, student records and promotion workflows.</p>
          </div>
          <div className="feature-card">
            <h3>Teacher focus</h3>
            <p>Teachers only see their assigned classes and the students they teach.</p>
          </div>
          <div className="feature-card">
            <h3>Clean records</h3>
            <p>Guardian details, transfer status and admission history all in one place.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
