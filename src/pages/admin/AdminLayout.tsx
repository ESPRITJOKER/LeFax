import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Icon, type IconName } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { LangSwitcher } from "../../components/LangSwitcher";
import { BackendBanner } from "../../components/BackendBanner";
import { useAuth } from "../../lib/auth";

const NAV: { to: string; icon: IconName; labelKey: "admin_overview" | "admin_students" | "admin_content" | "admin_ai" | "admin_mocks" | "admin_admins" | "admin_logs" | "admin_settings" }[] = [
  { to: "overview", icon: "chart", labelKey: "admin_overview" },
  { to: "students", icon: "users", labelKey: "admin_students" },
  { to: "content", icon: "book", labelKey: "admin_content" },
  { to: "ai-review", icon: "wand", labelKey: "admin_ai" },
  { to: "mock-exams", icon: "calendar", labelKey: "admin_mocks" },
  { to: "admins", icon: "shield", labelKey: "admin_admins" },
  { to: "logs", icon: "clipboard", labelKey: "admin_logs" },
  { to: "settings", icon: "gear", labelKey: "admin_settings" },
];

export default function AdminLayout() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const [open, setOpen] = useState(true);

  const initials = profile ? `${profile.first_name[0] ?? ""}${profile.last_name[0] ?? ""}`.toUpperCase() : "AD";

  return (
    <div className="min-h-screen flex">
      <div className={`flex-none bg-ink-950 flex flex-col overflow-hidden transition-[width] ${open ? "w-[232px]" : "w-[72px]"}`}>
        <div className="flex items-center gap-2.5 px-4.5 px-[18px] py-5 whitespace-nowrap">
          <Icon name="cap" size={26} color="#fff" />
          {open && (
            <div className="font-serif font-bold text-[17px] text-white">
              Lefax <span className="opacity-60 font-medium">Admin</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-0.5 px-3 flex-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-[10px] whitespace-nowrap ${
                  isActive ? "bg-ink-700 text-white" : "text-ink-100/80 hover:bg-ink-800"
                }`
              }
            >
              <Icon name={n.icon} size={18} />
              {open && <span className="text-[13.5px] font-semibold">{t(n.labelKey)}</span>}
            </NavLink>
          ))}
        </div>
        <button onClick={() => setOpen((v) => !v)} className="cursor-pointer px-4.5 px-[18px] py-4 text-ink-100/70 flex items-center gap-2.5 hover:text-white">
          <Icon name="collapse" size={16} />
          {open && <span className="text-xs font-semibold">{t("common_back")}</span>}
        </button>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <BackendBanner />
        <div className="flex items-center justify-between px-7 py-4.5 py-[18px] border-b border-border bg-white gap-4 flex-wrap">
          <div className="font-serif font-bold text-xl text-ink-950">{t("admin_overview")}</div>
          <div className="flex items-center gap-3.5">
            <LangSwitcher />
            <div className="w-9 h-9 rounded-full bg-ink-700 text-white flex items-center justify-center text-[13px] font-bold">{initials}</div>
          </div>
        </div>
        <div className="flex-1 p-7 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
