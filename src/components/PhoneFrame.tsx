import type { ReactNode } from "react";

/**
 * Presentation shell for the student app, matching the LeFax Claude Design
 * prototype: a single centered phone frame (412px-class column, 28px radius,
 * soft drop shadow) floating on a muted slate backdrop.
 *
 * - Mobile (< sm): the frame fills the viewport edge-to-edge (no card chrome).
 * - sm and up: a centered rounded phone card with the design's shadow.
 *
 * The frame is `position: relative` with a DEFINITE height (100dvh on mobile,
 * 860px from sm up) and clips overflow, so each screen's absolutely-positioned
 * bottom nav and slide-in Drawer stay pinned to the phone (as in the
 * prototype) while the screen's own content region scrolls internally. Screens
 * compose their own TopBar / BottomTabs / Drawer inside, and put their
 * scrollable content in a `flex-1 min-h-0 overflow-y-auto` region.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full flex justify-center bg-[#e7ebf1] sm:items-start sm:py-10 sm:px-4">
      <div className="relative w-full h-[100dvh] bg-[#eef3f9] overflow-hidden flex flex-col sm:w-[440px] sm:h-[860px] sm:rounded-[28px] sm:shadow-[0_30px_60px_-20px_rgba(15,30,60,0.35)]">
        {children}
      </div>
    </div>
  );
}
