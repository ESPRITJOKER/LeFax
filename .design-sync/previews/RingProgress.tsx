import { RingProgress } from "lefax-course";

export function Default() {
  return (
    <div className="flex items-center gap-3 p-4 bg-surface">
      <RingProgress pct={68} />
      <div>
        <div className="text-lg font-bold text-ink-900">68%</div>
        <div className="text-xs text-muted">Ma progression</div>
      </div>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex items-end gap-6 p-4 bg-surface">
      <RingProgress pct={30} size={40} stroke={4} />
      <RingProgress pct={68} size={64} stroke={6} />
      <RingProgress pct={95} size={88} stroke={8} color="var(--color-ochre-600)" />
    </div>
  );
}
