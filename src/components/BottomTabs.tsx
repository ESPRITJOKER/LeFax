import { useNavigate, useLocation } from "react-router-dom";
import { useI18n } from "../lib/i18n";

export type NavKey = "revisions" | "evaluations" | "questions" | "perfs";

const TABS: { key: NavKey; to: string; labelKey: "nav_revisions" | "nav_evaluations" | "nav_questions" | "nav_perfs" }[] = [
  { key: "revisions", to: "/dashboard", labelKey: "nav_revisions" },
  { key: "evaluations", to: "/mock-exam", labelKey: "nav_evaluations" },
  { key: "questions", to: "/search", labelKey: "nav_questions" },
  { key: "perfs", to: "/leaderboard", labelKey: "nav_perfs" },
];

function deriveActive(pathname: string): NavKey | undefined {
  if (pathname.startsWith("/mock-exam")) return "evaluations";
  if (pathname.startsWith("/search")) return "questions";
  if (pathname.startsWith("/leaderboard")) return "perfs";
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/subjects") ||
    pathname.startsWith("/lessons") ||
    pathname.startsWith("/lesson") ||
    pathname.startsWith("/chapter")
  )
    return "revisions";
  return undefined;
}

function TabIcon({ name, color }: { name: NavKey; color: string }) {
  switch (name) {
    case "revisions":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 3L2 8l10 5 10-5-10-5z" stroke={color} strokeWidth="1.6" />
          <path d="M6 10.5V15c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" stroke={color} strokeWidth="1.6" />
        </svg>
      );
    case "evaluations":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="5" y="3" width="14" height="18" rx="2" stroke={color} strokeWidth="1.6" />
          <path d="M8 8h8M8 12h8M8 16h5" stroke={color} strokeWidth="1.6" />
        </svg>
      );
    case "questions":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M4 5h16v11H9l-4 4V5z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
    case "perfs":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="6" cy="18" r="2" stroke={color} strokeWidth="1.6" />
          <circle cx="18" cy="6" r="2" stroke={color} strokeWidth="1.6" />
          <circle cx="14" cy="14" r="2" stroke={color} strokeWidth="1.6" />
          <path d="M7.5 16.7L12.5 15M15.5 12.7L16.7 8" stroke={color} strokeWidth="1.6" />
        </svg>
      );
  }
}

/**
 * Bottom tab bar from the LeFax design — four destinations
 * (Révisions/Evaluations/Questions/Perfs → dashboard/mock-exam/search/
 * leaderboard). Absolutely positioned at the bottom of the phone frame.
 */
export function BottomTabs({ active }: { active?: NavKey }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const activeKey = active ?? deriveActive(location.pathname);

  return (
    <div className="absolute left-0 right-0 bottom-0 bg-card border-t border-ink-100 flex px-2.5 pt-2.5 pb-[calc(14px+env(safe-area-inset-bottom))]">
      {TABS.map((tab) => {
        const isActive = activeKey === tab.key;
        // Active tab reads in brand blue + bold (corrections doc: "colorer en
        // bleu comme ça"); inactive stays muted grey.
        const color = isActive ? "#2f9bf0" : "#9aa5b1";
        return (
          <button
            key={tab.key}
            onClick={() => navigate(tab.to)}
            className="flex-1 flex flex-col items-center gap-1"
          >
            <TabIcon name={tab.key} color={color} />
            <span className="text-[10.5px]" style={{ color, fontWeight: isActive ? 700 : 500 }}>
              {t(tab.labelKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
