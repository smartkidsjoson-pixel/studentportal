import type { ReactNode } from 'react';

export function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="card">
      <div className="section-header" style={{ marginBottom: '0.9rem' }}>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
