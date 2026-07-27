export function HeartsDisplay({ total, remaining }: { total: number; remaining: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }, (_, i) => (
        <svg
          key={i}
          width={17}
          height={17}
          viewBox="0 0 24 24"
          fill={i < remaining ? "var(--color-heart)" : "var(--color-heart-empty)"}
        >
          <path d="M12 21s-7-4.35-9.5-9A5.5 5.5 0 0112 5.5 5.5 5.5 0 0121.5 12c-2.5 4.65-9.5 9-9.5 9z" />
        </svg>
      ))}
    </div>
  );
}
