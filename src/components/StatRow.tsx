export function StatRow({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: string;
  variant?: "default" | "good" | "bad";
}) {
  const valueColor =
    variant === "good"
      ? "text-success-700"
      : variant === "bad"
        ? "text-danger-700"
        : "text-ink-950";

  return (
    <div className="flex items-center justify-between text-left bg-card border border-border rounded-xl px-4 py-3 mb-2 text-[12.5px] font-bold text-muted">
      <span>{label}</span>
      <b className={`text-[13.5px] font-extrabold ${valueColor}`}>{value}</b>
    </div>
  );
}
