import { NavLink } from "react-router-dom";
import { Icon, type IconName } from "../lib/icons";
import { useI18n } from "../lib/i18n";

const TABS: { to: string; icon: IconName; labelKey: "nav_home" | "nav_courses" | "nav_shop" | "nav_leaderboard" }[] = [
  { to: "/dashboard", icon: "home", labelKey: "nav_home" },
  { to: "/subjects/biologie", icon: "book", labelKey: "nav_courses" },
  { to: "/shop", icon: "coin", labelKey: "nav_shop" },
  { to: "/leaderboard", icon: "trophy", labelKey: "nav_leaderboard" },
];

/**
 * Persistent left nav shown at the lg breakpoint (desktop) in place of
 * BottomTabs, which stays mobile/tablet-only (see BottomTabs' `lg:hidden`).
 * Same destinations as BottomTabs — this is a layout/responsiveness fix
 * (desktop shouldn't have zero persistent nav once the bottom tab bar
 * disappears), not a new navigation surface.
 */
export function Sidebar() {
  const { t } = useI18n();
  return (
    <div className="hidden lg:flex flex-none w-[220px] bg-ink-950 flex-col">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <Icon name="cap" size={26} color="#fff" />
        <div className="font-serif font-bold text-[17px] text-white">{t("appName")}</div>
      </div>
      <div className="flex flex-col gap-0.5 px-3">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-[10px] ${
                isActive ? "bg-ink-700 text-white" : "text-ink-100/80 hover:bg-ink-800"
              }`
            }
          >
            <Icon name={tab.icon} size={18} />
            <span className="text-[13.5px] font-semibold">{t(tab.labelKey)}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
