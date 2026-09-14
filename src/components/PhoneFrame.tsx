import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

/**
 * Presentation shell for the student app. Adapts to the device via CSS
 * breakpoints (no user-agent sniffing):
 *
 * - `nav="app"` (default) — the main navigable screens. Below `lg` it's the
 *   full-screen phone experience (edge-to-edge, with the screen's own TopBar +
 *   BottomTabs + Drawer). At `lg` and up it becomes a real desktop web app: a
 *   persistent left {@link Sidebar} plus a fluid content column that fills the
 *   remaining width. BottomTabs hides itself at `lg` (see BottomTabs), so the
 *   same screen markup works in both layouts.
 * - `nav="auth"` — pre-login screens (login, register, track, mobile splash).
 *   A centered phone-width card on a soft backdrop at every size.
 * - `nav="focus"` — distraction-free runners (quiz, past-paper, practice, card
 *   deck). Same centered stage as `auth`, so the absolute-positioned runner
 *   chrome keeps its phone geometry.
 *
 * In every mode the frame is a definite-height flex column that clips overflow,
 * so a screen's absolutely-positioned bottom nav / drawer stay pinned while its
 * own `flex-1 min-h-0 overflow-y-auto` region scrolls internally.
 */
export function PhoneFrame({
  children,
  nav = "app",
}: {
  children: ReactNode;
  nav?: "app" | "auth" | "focus";
}) {
  if (nav === "auth" || nav === "focus") {
    return (
      <div className="min-h-screen w-full flex justify-center bg-[#e7ebf1] sm:items-start sm:py-10 sm:px-4">
        <div className="relative w-full h-[100dvh] bg-[#eef3f9] overflow-hidden flex flex-col sm:w-[440px] sm:h-[860px] sm:rounded-[28px] sm:shadow-[0_30px_60px_-20px_rgba(15,30,60,0.35)]">
          {children}
        </div>
      </div>
    );
  }

  // nav === "app": full-screen on phone/tablet, sidebar + fluid content on desktop.
  return (
    <div className="min-h-screen w-full bg-[#eef3f9] lg:flex lg:bg-surface">
      <Sidebar />
      <div className="relative w-full h-[100dvh] bg-[#eef3f9] overflow-hidden flex flex-col lg:h-screen lg:flex-1 lg:min-w-0 lg:bg-card">
        {children}
      </div>
    </div>
  );
}
