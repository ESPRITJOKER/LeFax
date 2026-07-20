import type { ReactNode } from "react";
import { LangSwitcher } from "./LangSwitcher";
import { Sidebar } from "./Sidebar";

/**
 * Responsive presentation shell for the student app (CDC 7: web responsive,
 * mobile-first, Android-first, no native app at MVP). Three tiers, not a
 * single fixed-width card at every size:
 *
 * - Mobile (< sm / 640px): fills the viewport edge-to-edge — no card, no
 *   shadow, no rounded corners. The single-column layout here is unchanged.
 * - Tablet (sm–lg / 640–1024px): a wider centered column (not the old fixed
 *   412px) so content uses the extra width instead of floating in dead
 *   space either side — individual screens (e.g. Dashboard's subject list)
 *   additionally switch to a 2-column grid in this range.
 * - Desktop (>= lg / 1024px): a persistent left sidebar (`Sidebar`, replacing
 *   BottomTabs which hides at this breakpoint) plus a flat content pane
 *   (no floating-card shadow/rounding — that reads as a real app layout at
 *   this size, not a phone mockup) capped at a readable max width rather
 *   than stretching edge-to-edge.
 *
 * This is a layout/breakpoint fix, not a visual redesign — colors, spacing,
 * and each screen's content are unchanged; only the shell around them
 * adapts to viewport width.
 *
 * Renders the FR/EN toggle strip above every screen by default, matching the
 * design reference (a shared bar shown on every screen except the initial
 * language picker) — pass `topBar={false}` to opt out. Pass `nav={false}` to
 * suppress the desktop Sidebar for pre-dashboard/onboarding screens (Landing,
 * Login, Register, Track) that have no bottom tabs on mobile either.
 */
export function PhoneFrame({ children, topBar = true, nav = true }: { children: ReactNode; topBar?: boolean; nav?: boolean }) {
  return (
    <div className="min-h-screen flex bg-surface">
      {nav && <Sidebar />}
      <div className="min-w-0 flex-1 flex justify-center sm:py-7 sm:px-3.5 lg:items-start lg:py-10 lg:px-10">
        <div
          className="w-full min-w-0 min-h-screen bg-card overflow-hidden flex flex-col relative
            sm:max-w-[600px] sm:min-h-[850px] sm:rounded-[26px] sm:shadow-[0_24px_60px_-24px_rgba(20,30,60,0.4),0_2px_10px_rgba(20,30,60,0.1)]
            lg:max-w-[760px] lg:min-h-0 lg:rounded-2xl lg:shadow-none lg:border lg:border-border"
        >
          {topBar && (
            <div className="flex items-center justify-end px-[18px] pt-3.5">
              <LangSwitcher />
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
