export function StatusPill({ value }: { value?: string | null }) {
  const safeValue = value?.toString() ?? 'unknown';
  const label = safeValue.replace(/_/g, ' ').toUpperCase();
  return <span className={`status-pill status-${safeValue.toLowerCase().replace(/\s+/g, '-')}`}>{label}</span>;
}
