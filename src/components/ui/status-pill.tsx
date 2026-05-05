export function StatusPill({ value }: { value: string }) {
  return <span className={`status-pill status-${value.toLowerCase()}`}>{value.replace(/_/g, ' ').toLowerCase()}</span>;
}
