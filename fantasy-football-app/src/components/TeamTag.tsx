export default function TeamTag({ team }: { team: string | null | undefined }) {
  if (!team) return <span className="text-[var(--text-muted)]">—</span>;
  return <span className="text-[var(--text-secondary)] font-medium tabular">{team}</span>;
}
