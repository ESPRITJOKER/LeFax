import { NavLink } from "react-router-dom";
import { Icon, type IconName } from "../lib/icons";
import { useI18n } from "../lib/i18n";

const TABS: { to: string; icon: IconName; labelKey: "nav_home" | "nav_courses" | "nav_shop" | "nav_leaderboard" }[] = [
  { to: "/dashboard", icon: "home", labelKey: "nav_home" },
  { to: "/subjects/biologie", icon: "book", labelKey: "nav_courses" },
  { to: "/shop", icon: "coin", labelKey: "nav_shop" },
  { to: "/leaderboard", icon: "trophy", labelKey: "nav_leaderboard" },
];

export function BottomTabs() {
  const { t } = useI18n();
  return (
    <div className="lg:hidden sticky bottom-0 bg-card border-t border-border flex px-2 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-1 py-1.5 ${isActive ? "text-ink-700" : "text-muted"}`
          }
        >
          <Icon name={tab.icon} size={20} />
          <span className="text-[10px] font-bold">{t(tab.labelKey)}</span>
        </NavLink>
      ))}
    </div>
  );
}
