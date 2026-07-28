export default function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-24 text-[var(--text-muted)] gap-3">
      <span className="w-4 h-4 rounded-full border-2 border-[var(--border-strong)] border-t-[var(--series-1)] animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
