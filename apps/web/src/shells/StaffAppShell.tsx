import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../components/ui/MaterialIcon";
import { LanguageSwitcher } from "../components/ui/LanguageSwitcher";
import { useSessionStore } from "../stores/session.store";

export interface StaffNavItem {
  to: string;
  icon: string;
  labelKey: string;
  end?: boolean;
}

interface StaffAppShellProps {
  navItems: StaffNavItem[];
  roleLabel: string;
}

/**
 * Desktop sidebar + topbar shell, ported from the teacher_content_dashboard
 * Stitch screen — the one desktop pattern in the design export. Reused
 * verbatim for both Enseignant and Admin, differing only by nav items.
 */
export function StaffAppShell({ navItems, roleLabel }: StaffAppShellProps) {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);

  return (
    <div className="min-h-dvh flex bg-background">
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-surface-container-lowest border-r border-outline-variant">
        <div className="h-16 flex items-center px-md border-b border-outline-variant">
          <h1 className="text-headline-md font-headline-md font-bold text-excellence-blue">{t("common.appName")}</h1>
        </div>
        <nav className="flex-1 flex flex-col gap-xs p-sm">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-sm px-md py-sm rounded-lg font-label-lg text-label-lg transition-all ${
                  isActive
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`
              }
            >
              <MaterialIcon name={item.icon} />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="p-md border-t border-outline-variant flex items-center gap-sm">
          <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-label-lg">
            {(user?.firstName ?? user?.email ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-label-lg font-label-lg text-text-primary">{user?.firstName ?? user?.email}</span>
            <span className="text-label-md font-label-md text-text-secondary">{roleLabel}</span>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 flex items-center justify-between px-lg border-b border-outline-variant bg-surface-container-lowest">
          <div className="md:hidden text-headline-md font-headline-md font-bold text-excellence-blue">
            {t("common.appName")}
          </div>
          <div className="flex items-center gap-md">
            <LanguageSwitcher />
            <div className="hidden md:block text-label-md font-label-md text-text-secondary">{roleLabel}</div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-lg">
          <div className="max-w-[1200px] mx-auto">
            <Outlet context={{ user }} />
          </div>
        </main>
      </div>
    </div>
  );
}
