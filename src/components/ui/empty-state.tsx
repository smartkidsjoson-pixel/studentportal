import Link from 'next/link';

export function EmptyState({ title, description, href, ctaLabel }: { title: string; description: string; href?: string; ctaLabel?: string }) {
  return (
    <div className="notice">
      <strong>{title}</strong>
      <p style={{ marginTop: '0.4rem' }}>{description}</p>
      {href && ctaLabel ? (
        <p style={{ marginTop: '0.75rem' }}>
          <Link href={href}>{ctaLabel}</Link>
        </p>
      ) : null}
    </div>
  );
}
