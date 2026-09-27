import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Icon, type IconName } from "../../lib/icons";
import { useI18n, type DictKey } from "../../lib/i18n";
import { LangSwitcher } from "../../components/LangSwitcher";
import { BackendBanner } from "../../components/BackendBanner";
import { useAuth } from "../../lib/auth";

/**
 * Teacher panel shell (CDC 6.10).
 *
 * Three things the audited version was missing and that this fixes: the header
 * showed "Teacher dashboard" on every tab, there was no way to sign out at all
 * (the only `signOut` callers were student screens), and the nav covered four of
 * the eight areas a teacher actually works in.
 */
const NAV: { to: string; icon: IconName; labelKey: DictKey }[] = [
  { to: "dashboard", icon: "chart", labelKey: "teacher_dashboard" },
  { to: "subjects", icon: "book", labelKey: "teacher_subjects" },
  { to: "content", icon: "quill", labelKey: "teacher_myContent" },
  { to: "ai-assist", icon: "wand", labelKey: "teacher_aiAssist" },
  { to: "question-bank", icon: "flask", labelKey: "teacher_questionBank" },
  { to: "performance", icon: "users", labelKey: "teacher_performance" },
  { to: "notifications", icon: "bell", labelKey: "teacher_notifications" },
  { to: "account", icon: "gear", labelKey: "teacher_account" },
];

export default function TeacherLayout() {
  const { t } = useI18n();
  const { profile, signOut } = useAuth();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Title follows the open tab (content/lesson/:id keeps the "My content" title).
  const current = NAV.find((n) => pathname.includes(`/teacher/${n.to}`));
  const title = current ? t(current.labelKey) : t("teacher_dashboard");
  const initials = profile ? `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`.toUpperCase() : "EN";

  return (
    <div className="min-h-screen flex">
      {mobileOpen && <div onClick={() => setMobileOpen(false)} className="lg:hidden fixed inset-0 bg-black/40 z-40" />}

      <div
        className={`w-[220px] bg-brand-800 flex flex-col z-50 fixed inset-y-0 left-0 transform transition-transform lg:static lg:transform-none lg:flex-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-center gap-2.5 px-[18px] py-5">
          <Icon name="cap" size={26} color="#fff" />
          <div className="font-serif font-bold text-[17px] text-white">
            Lefax <span className="opacity-60 font-medium">Teacher</span>
          </div>
        </div>
        <div className="flex flex-col gap-0.5 px-3 flex-1 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-[10px] ${isActive ? "bg-brand-600 text-white" : "text-ink-100/80 hover:bg-brand-700"}`
              }
            >
              <Icon name={n.icon} size={18} />
              <span className="text-[13.5px] font-semibold">{t(n.labelKey)}</span>
            </NavLink>
          ))}
        </div>

        {/* Identity + sign-out (Defect 3: the teacher shell had neither) */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-2.5 px-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-[12px] font-bold flex-none">{initials}</div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-bold text-white truncate">
                {profile ? `${profile.first_name} ${profile.last_name}` : "—"}
              </div>
              <div className="text-[11px] text-ink-100/60 truncate">{profile?.role ?? ""}</div>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-ink-100/80 hover:bg-brand-700 border-none bg-transparent cursor-pointer"
          >
            <Icon name="logout" size={18} />
            <span className="text-[13.5px] font-semibold">{t("teacher_signOut")}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <BackendBanner />
        <div className="flex items-center justify-between px-5 lg:px-7 py-[18px] border-b border-border bg-white gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden flex items-center justify-center -ml-1" aria-label={t("teacher_dashboard")}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M3 12h18M3 18h18" stroke="#1e2a3a" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <div className="font-serif font-bold text-lg lg:text-xl text-ink-950 truncate">{title}</div>
          </div>
          <LangSwitcher />
        </div>
        <div className="flex-1 p-5 lg:p-7 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
