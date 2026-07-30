import { CoinsBadge } from "./CoinsBadge";

interface TopBarProps {
  variant: "menu" | "back" | "title";
  title?: string;
  coins?: number;
  initial?: string;
  onMenu?: () => void;
  onBack?: () => void;
  onCoins?: () => void;
  onAvatar?: () => void;
}

function MenuIcon({ onClick }: { onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center justify-center" aria-label="Menu">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M3 6h18M3 12h18M3 18h18" stroke="#1e2a3a" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function BackIcon({ onClick }: { onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center justify-center" aria-label="Back">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M15 6l-6 6 6 6" stroke="#1e2a3a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/**
 * Screen header from the LeFax design. `menu` = hamburger + full FaxCoins pill
 * + avatar (main tab screens). `back` = back chevron + compact FaxCoins pill
 * (drill-down screens). `title` = back chevron + a title, with a hairline
 * underline (lesson / correction / notifications).
 */
export function TopBar({ variant, title, coins = 0, initial = "?", onMenu, onBack, onCoins, onAvatar }: TopBarProps) {
  if (variant === "title") {
    return (
      <div className="flex items-center gap-3 px-5 py-[18px] border-b border-[#f0f2f5] flex-shrink-0">
        <BackIcon onClick={onBack} />
        <div className="font-serif font-semibold text-[14.5px] text-ink-900">{title}</div>
      </div>
    );
  }

  if (variant === "back") {
    return (
      <div className="flex items-center justify-between px-5 py-[18px] flex-shrink-0">
        <BackIcon onClick={onBack} />
        <CoinsBadge balance={coins} variant="compact" />
        <div className="w-5" />
      </div>
    );
  }

  // menu
  return (
    <div className="flex items-center justify-between px-5 py-[18px] flex-shrink-0">
      <MenuIcon onClick={onMenu} />
      <CoinsBadge balance={coins} variant="full" onClick={onCoins} />
      <button
        onClick={onAvatar}
        className="w-[34px] h-[34px] rounded-full bg-brand-500 text-white font-serif font-bold text-[13px] flex items-center justify-center"
      >
        {initial}
      </button>
    </div>
  );
}
