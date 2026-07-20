import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-card border border-border bg-card ${onClick ? "cursor-pointer hover:bg-ink-50" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}

export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  const base = "rounded-xl px-4 py-3 text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const styles: Record<string, string> = {
    primary: "bg-ink-700 text-white hover:bg-ink-800",
    secondary: "bg-white border border-border text-ink-900 hover:bg-ink-50",
    ghost: "bg-transparent text-ink-900 hover:bg-ink-50",
    danger: "bg-danger-600 text-white hover:opacity-90",
  };
  return <button className={`${base} ${styles[variant]} ${className}`} {...rest} />;
}

export function ProgressBar({ pct, color = "success" }: { pct: number; color?: "success" | "ink" | "ochre" }) {
  const bar = { success: "bg-success-600", ink: "bg-ink-700", ochre: "bg-ochre-600" }[color];
  return (
    <div className="h-[7px] rounded-pill bg-ink-100 overflow-hidden">
      <div className={`h-full rounded-pill ${bar} transition-all`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function Pill({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-pill px-3 py-1.5 text-xs font-bold whitespace-nowrap ${
        active ? "bg-ink-700 text-white" : "bg-ink-100 text-ink-900"
      }`}
    >
      {children}
    </button>
  );
}

export function RingProgress({ pct, size = 64, stroke = 6, color = "var(--color-success-600)" }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (c * pct) / 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        style={{ strokeDashoffset: offset, transition: "stroke-dashoffset .2s linear" }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export function EmptyState({ label }: { label: string }) {
  return <div className="text-center py-10 text-muted text-sm">{label}</div>;
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="w-6 h-6 border-2 border-ink-100 border-t-ink-700 rounded-full animate-spin" />
    </div>
  );
}
