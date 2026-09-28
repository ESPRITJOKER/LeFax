import { useEffect, type ReactNode } from "react";
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
 *
 * Every viewport height here is `100dvh`, never `100vh`/`min-h-screen`. On a
 * mobile browser `100vh` is the *large* viewport (URL bar hidden) while `dvh`
 * follows the visible one, so mixing them made the outer wrapper taller than
 * the screen: the document itself scrolled, carrying the whole shell — TopBar
 * and the absolutely-pinned BottomTabs — up and down with it. That is the
 * "footer with Lessons/Perfs moves while I scroll" bug. Keeping one unit means
 * the shell exactly fills the visible viewport and only the inner region
 * scrolls. `lg:` keeps `h-screen` because desktop has no dynamic toolbar.
 *
 * The unit alone is not enough, though: the initial containing block is still
 * the large viewport, so the document stayed taller than the screen by the
 * toolbar height and the browser scrolled it anyway. While `nav="app"` is
 * mounted we therefore also pin the document, via `data-app-shell` on <html>
 * (the rule and the reasoning live in index.css). It is an attribute rather
 * than a class so document-scrolling pages — the marketing landing page, the
 * admin back-office — are untouched, and it is deliberately not set for
 * `auth`/`focus`: those centre a fixed 860px card that a short desktop window
 * does need to scroll to.
 */
export function PhoneFrame({
  children,
  nav = "app",
}: {
  children: ReactNode;
  nav?: "app" | "auth" | "focus";
}) {
  const lockDocument = nav === "app";
  useEffect(() => {
    if (!lockDocument) return;
    document.documentElement.dataset.appShell = "";
    return () => {
      delete document.documentElement.dataset.appShell;
    };
  }, [lockDocument]);

  if (nav === "auth" || nav === "focus") {
    return (
      <div className="min-h-[100dvh] w-full flex justify-center bg-surface sm:items-start sm:py-10 sm:px-4">
        <div className="relative w-full h-[100dvh] bg-surface overflow-hidden flex flex-col sm:w-[440px] sm:h-[860px] sm:rounded-[28px] sm:shadow-[0_30px_60px_-20px_rgba(15,30,60,0.35)]">
          {children}
        </div>
      </div>
    );
  }

  // nav === "app": full-screen on phone/tablet, sidebar + fluid content on desktop.
  return (
    <div className="h-[100dvh] w-full bg-surface overflow-hidden lg:flex lg:h-screen">
      <Sidebar />
      <div className="relative w-full h-[100dvh] bg-surface overflow-hidden flex flex-col lg:h-screen lg:flex-1 lg:min-w-0 lg:bg-card">
        {children}
      </div>
    </div>
  );
}
