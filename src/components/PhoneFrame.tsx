import type { ReactNode } from "react";

/**
 * Mobile-first presentation shell for the student app, matching the design
 * reference's 412px phone-card layout (CDC 7: web responsive, Android-first,
 * no native app at MVP — but the card visual affordance is kept for parity
 * with the design system on desktop browsers too).
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex justify-center py-7 px-3.5 bg-surface">
      <div className="w-full max-w-[412px] bg-card rounded-[26px] shadow-[0_24px_60px_-24px_rgba(20,30,60,0.4),0_2px_10px_rgba(20,30,60,0.1)] overflow-hidden flex flex-col min-h-[850px] relative">
        {children}
      </div>
    </div>
  );
}
