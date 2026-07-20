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

  return (
    <div className="min-h-screen flex">
      <div className="flex-none w-[220px] bg-ink-950 flex flex-col">
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
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-[10px] ${isActive ? "bg-ink-700 text-white" : "text-ink-100/80 hover:bg-ink-800"}`
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
        <div className="flex items-center justify-between px-7 py-4.5 py-[18px] border-b border-border bg-white">
          <div className="font-serif font-bold text-xl text-ink-950">{t("teacher_dashboard")}</div>
          <LangSwitcher />
        </div>
        <div className="flex-1 p-7 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
