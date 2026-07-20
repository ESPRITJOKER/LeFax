import type { ReactNode } from "react";
import { LangSwitcher } from "./LangSwitcher";

/**
 * Mobile-first presentation shell for the student app, matching the design
 * reference's 412px phone-card layout (CDC 7: web responsive, Android-first,
 * no native app at MVP — but the card visual affordance is kept for parity
 * with the design system on desktop browsers too).
 *
 * Renders the FR/EN toggle strip above every screen by default, matching the
 * design reference (a shared bar shown on every screen except the initial
 * language picker) — pass `topBar={false}` to opt out (Landing only).
 */
export function PhoneFrame({ children, topBar = true }: { children: ReactNode; topBar?: boolean }) {
  return (
    <div className="min-h-screen flex justify-center py-7 px-3.5 bg-surface">
      <div className="w-full max-w-[412px] bg-card rounded-[26px] shadow-[0_24px_60px_-24px_rgba(20,30,60,0.4),0_2px_10px_rgba(20,30,60,0.1)] overflow-hidden flex flex-col min-h-[850px] relative">
        {topBar && (
          <div className="flex items-center justify-end px-[18px] pt-3.5">
            <LangSwitcher />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
