export default function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2 text-[11px]">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all font-mono">{value ?? '-'}</span>
    </div>
  )
}
