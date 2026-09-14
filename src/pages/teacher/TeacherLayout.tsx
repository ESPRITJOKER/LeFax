import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Icon, type IconName } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { LangSwitcher } from "../../components/LangSwitcher";
import { BackendBanner } from "../../components/BackendBanner";

const NAV: { to: string; icon: IconName; labelKey: "teacher_dashboard" | "teacher_myContent" | "teacher_aiAssist" | "teacher_performance" }[] = [
  { to: "dashboard", icon: "chart", labelKey: "teacher_dashboard" },
  { to: "content", icon: "book", labelKey: "teacher_myContent" },
  { to: "ai-assist", icon: "wand", labelKey: "teacher_aiAssist" },
  { to: "performance", icon: "users", labelKey: "teacher_performance" },
];

export default function TeacherLayout() {
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} className="lg:hidden fixed inset-0 bg-black/40 z-40" />
      )}

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
        <div className="flex flex-col gap-0.5 px-3 flex-1">
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
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <BackendBanner />
        <div className="flex items-center justify-between px-5 lg:px-7 py-[18px] border-b border-border bg-white gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden flex items-center justify-center -ml-1" aria-label="Menu">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M3 12h18M3 18h18" stroke="#1e2a3a" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <div className="font-serif font-bold text-lg lg:text-xl text-ink-950 truncate">{t("teacher_dashboard")}</div>
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
