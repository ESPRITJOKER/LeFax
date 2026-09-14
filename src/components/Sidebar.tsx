import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { LogoMark } from "./BrandLogo";
import { TABS, TabIcon, deriveActive } from "./BottomTabs";

/**
 * Desktop-only left navigation rail (shown at `lg` and up by PhoneFrame's app
 * shell; hidden on phones/tablets where BottomTabs + Drawer take over). It
 * mirrors the phone navigation: the four primary destinations from
 * {@link TABS}, the secondary links from the Drawer, plus the profile block,
 * FR/EN toggle and logout. Coins stay in the per-screen TopBar.
 */
export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();

  const activeTab = deriveActive(location.pathname);
  const name = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "—" : "—";
  const initial = (profile?.first_name?.[0] ?? "?").toUpperCase();

  const secondary: { label: string; path: string }[] = [
    { label: lang === "fr" ? "Mon profil" : "My profile", path: "/profile" },
    { label: lang === "fr" ? "Boutique" : "Shop", path: "/shop" },
    { label: lang === "fr" ? "Tâches du jour" : "Daily tasks", path: "/tasks" },
    { label: lang === "fr" ? "Classement" : "Leaderboard", path: "/leaderboard" },
    { label: lang === "fr" ? "Notifications" : "Notifications", path: "/notifications" },
  ];

  async function handleLogout() {
    await signOut();
    navigate("/login");
  }

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-[264px] lg:flex-none h-screen bg-card border-r border-ink-100 px-4 py-5 overflow-y-auto">
      <button
        onClick={() => navigate("/dashboard")}
        className="flex items-center gap-2 px-2 mb-6"
      >
        <LogoMark size={30} />
        <span className="font-serif font-extrabold text-[20px] text-ink-900">LeFax</span>
      </button>

      <nav className="flex flex-col gap-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const color = isActive ? "#2f9bf0" : "#647084";
          return (
            <button
              key={tab.key}
              onClick={() => navigate(tab.to)}
              className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] font-semibold transition-colors ${
                isActive ? "bg-brand-50 text-brand-600" : "text-ink-700 hover:bg-ink-50"
              }`}
            >
              <TabIcon name={tab.key} color={color} />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </nav>

      <div className="my-4 border-t border-ink-100" />

      <nav className="flex flex-col gap-0.5">
        {secondary.map((l) => {
          const isActive = location.pathname.startsWith(l.path);
          return (
            <button
              key={l.path}
              onClick={() => navigate(l.path)}
              className={`text-left rounded-[10px] px-3 py-2 text-[13px] font-medium transition-colors ${
                isActive ? "bg-brand-50 text-brand-600" : "text-ink-600 hover:bg-ink-50"
              }`}
            >
              {l.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pt-4">
        <button
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2.5 w-full px-1 py-2 rounded-[10px] hover:bg-ink-50"
        >
          <div className="w-[38px] h-[38px] rounded-full bg-brand-500 text-white font-serif font-extrabold text-[15px] flex items-center justify-center flex-none">
            {initial}
          </div>
          <div className="min-w-0 text-left">
            <div className="font-serif font-bold text-[13px] text-ink-900 truncate">{name}</div>
            <div className="text-[11px] text-muted truncate">{lang === "fr" ? "Filière Médecine" : "Medicine Track"}</div>
          </div>
        </button>

        <div className="flex gap-1.5 mt-3 bg-[#f4f7fb] rounded-pill p-1">
          <button
            onClick={() => setLang("fr")}
            className={`flex-1 text-center py-1.5 rounded-[16px] text-[12px] font-bold ${
              lang === "fr" ? "bg-brand-800 text-white" : "text-[#647084]"
            }`}
          >
            FR
          </button>
          <button
            onClick={() => setLang("en")}
            className={`flex-1 text-center py-1.5 rounded-[16px] text-[12px] font-bold ${
              lang === "en" ? "bg-brand-800 text-white" : "text-[#647084]"
            }`}
          >
            EN
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="mt-3 w-full text-left px-3 py-2 text-[13px] font-semibold text-danger-600 rounded-[10px] hover:bg-danger-50"
        >
          {lang === "fr" ? "Déconnexion" : "Log out"}
        </button>
      </div>
    </aside>
  );
}
