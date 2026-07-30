import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";

/**
 * Slide-in navigation drawer from the LeFax design, opened by the hamburger in
 * the menu-variant TopBar. Wires the design's link list to the real routes,
 * the FR/EN toggle to the i18n context, and logout to Supabase sign-out.
 */
export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { lang, setLang } = useI18n();

  if (!open) return null;

  const name = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "—" : "—";
  const initial = (profile?.first_name?.[0] ?? "?").toUpperCase();

  const go = (path: string) => () => {
    onClose();
    navigate(path);
  };

  const links: { label: string; path: string }[] = [
    { label: lang === "fr" ? "Mon profil" : "My profile", path: "/profile" },
    { label: lang === "fr" ? "Boutique" : "Shop", path: "/shop" },
    { label: lang === "fr" ? "Tâches du jour" : "Daily tasks", path: "/tasks" },
    { label: lang === "fr" ? "Classement" : "Leaderboard", path: "/leaderboard" },
    { label: lang === "fr" ? "Notifications" : "Notifications", path: "/notifications" },
    { label: lang === "fr" ? "Rechercher" : "Search", path: "/search" },
  ];

  async function handleLogout() {
    onClose();
    await signOut();
    navigate("/login");
  }

  return (
    <>
      <div onClick={onClose} className="absolute inset-0 z-40" style={{ background: "rgba(15,23,42,0.45)" }} />
      <div className="absolute top-0 left-0 bottom-0 w-[270px] bg-card z-[41] px-5 py-[26px] shadow-[4px_0_24px_rgba(0,0,0,0.15)]">
        <div className="flex items-center gap-2.5 mb-[26px]">
          <div className="w-[46px] h-[46px] rounded-full bg-brand-500 text-white font-serif font-extrabold text-[17px] flex items-center justify-center">
            {initial}
          </div>
          <div>
            <div className="font-serif font-bold text-[14px] text-ink-900">{name}</div>
            <div className="text-[11px] text-muted">{lang === "fr" ? "Filière Médecine" : "Medicine Track"}</div>
          </div>
        </div>

        {links.map((l) => (
          <div
            key={l.path}
            onClick={go(l.path)}
            className="py-3 px-1 text-[13.5px] font-semibold text-ink-900 cursor-pointer border-b border-[#f4f6f9]"
          >
            {l.label}
          </div>
        ))}

        <div className="flex gap-1.5 mt-[22px] bg-[#f4f7fb] rounded-pill p-1">
          <button
            onClick={() => setLang("fr")}
            className={`flex-1 text-center py-2 rounded-[16px] text-[12.5px] font-bold ${
              lang === "fr" ? "bg-brand-800 text-white" : "text-[#647084]"
            }`}
          >
            FR
          </button>
          <button
            onClick={() => setLang("en")}
            className={`flex-1 text-center py-2 rounded-[16px] text-[12.5px] font-bold ${
              lang === "en" ? "bg-brand-800 text-white" : "text-[#647084]"
            }`}
          >
            EN
          </button>
        </div>

        <div onClick={handleLogout} className="mt-[22px] text-[13px] font-semibold text-danger-600 cursor-pointer">
          {lang === "fr" ? "Déconnexion" : "Log out"}
        </div>
      </div>
    </>
  );
}
