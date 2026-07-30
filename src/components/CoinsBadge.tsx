/**
 * FaxCoins pill — the dark navy pill with the gold "f" token from the LeFax
 * design. Two variants:
 *  - "full": gold coin + "FaxCoins" label + balance (used on the main tab
 *    screens' header, taps through to the shop).
 *  - "compact": gold coin + balance only (used on back-navigation headers).
 */
export function CoinsBadge({
  balance,
  variant = "compact",
  onClick,
}: {
  balance: number;
  variant?: "full" | "compact";
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center rounded-pill bg-brand-800 ${onClick ? "cursor-pointer" : ""} ${
        variant === "full" ? "gap-2 px-3.5 py-1.5" : "gap-1.5 px-3.5 py-1.5"
      }`}
    >
      <span
        className={`flex items-center justify-center rounded-full bg-ochre-600 text-ink-900 font-serif font-extrabold ${
          variant === "full" ? "w-5 h-5 text-[11px]" : "w-[18px] h-[18px] text-[10px]"
        }`}
      >
        f
      </span>
      {variant === "full" && <span className="text-white font-bold text-[13px]">FaxCoins</span>}
      <span className="text-white font-bold text-[13px]">{balance}</span>
    </div>
  );
}
