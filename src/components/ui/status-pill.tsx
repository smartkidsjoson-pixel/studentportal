export function StatusPill({ value }: { value: string }) {
  const label = value.replace(/_/g, ' ').toUpperCase();
  return <span className={`status-pill status-${value.toLowerCase()}`}>{label}</span>;
}
