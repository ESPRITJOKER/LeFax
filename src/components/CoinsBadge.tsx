export function CoinsBadge({ balance }: { balance: number }) {
  return (
    <div className="flex items-center gap-1.5 bg-brand-800 text-white font-bold text-[13px] py-[6px] px-3 rounded-pill">
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-ochre-600)] text-ink-950 text-[11px] font-extrabold">
        f
      </span>
      {balance}
    </div>
  );
}
