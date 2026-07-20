import type { ReactNode } from "react";
import { LangSwitcher } from "./LangSwitcher";

/**
 * Responsive presentation shell for the student app (CDC 7: web responsive,
 * mobile-first, Android-first, no native app at MVP).
 *
 * Below the `sm` breakpoint (real phone widths) it fills the viewport
 * edge-to-edge — no card, no shadow, no rounded corners — a normal
 * full-bleed mobile web page. At `sm` and up (tablet/desktop, where a
 * full-bleed layout of content designed for a narrow column would just
 * stretch awkwardly wide) it renders the design reference's centered
 * 412px phone-card look instead. This is a two-state breakpoint switch,
 * not a fluid multi-column desktop layout — a fuller adaptive redesign of
 * each screen is out of scope here.
 *
 * Renders the FR/EN toggle strip above every screen by default, matching the
 * design reference (a shared bar shown on every screen except the initial
 * language picker) — pass `topBar={false}` to opt out (Landing only).
 */
export function PhoneFrame({ children, topBar = true }: { children: ReactNode; topBar?: boolean }) {
  return (
    <div className="min-h-screen flex justify-center bg-surface sm:py-7 sm:px-3.5">
      <div className="w-full min-h-screen bg-card overflow-hidden flex flex-col relative sm:max-w-[412px] sm:min-h-[850px] sm:rounded-[26px] sm:shadow-[0_24px_60px_-24px_rgba(20,30,60,0.4),0_2px_10px_rgba(20,30,60,0.1)]">
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
