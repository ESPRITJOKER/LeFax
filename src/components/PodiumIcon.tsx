export function PodiumIcon({ rank }: { rank: 1 | 2 | 3 }) {
  const colors: Record<number, { fill: string; base: string }> = {
    1: { fill: "var(--color-ochre-600)", base: "var(--color-ochre-700)" },
    2: { fill: "#B9C2CC", base: "#8A93A0" },
    3: { fill: "#CD7F32", base: "#8A4E1E" },
  };
  const c = colors[rank];
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <path d="M6 3h12l-1 8a5 5 0 01-10 0L6 3z" fill={c.fill} />
      <path d="M9 21h6l-1-4H10l-1 4z" fill={c.base} />
    </svg>
  );
}
