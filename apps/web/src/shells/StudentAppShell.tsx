import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../components/ui/MaterialIcon";
import { api } from "../lib/api-client";
import { useSessionStore } from "../stores/session.store";

const NAV_ITEMS = [
  { to: "/app", icon: "dashboard", labelKey: "studentNav.dashboard", end: true },
  { to: "/app/lessons", icon: "menu_book", labelKey: "studentNav.lessons" },
  { to: "/app/exams", icon: "quiz", labelKey: "studentNav.exams" },
  { to: "/app/wallet", icon: "payments", labelKey: "studentNav.wallet" },
] as const;

export function StudentAppShell() {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    api.coinsBalance().then((res) => setBalance(res.balance)).catch(() => {});
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile h-16 bg-surface border-b border-outline-variant">
        <div className="flex items-center gap-md">
          <button type="button" onClick={() => navigate("/app/profile")} className="p-1 rounded-full hover:bg-surface-container-low" aria-label="Profil">
            <MaterialIcon name="menu" className="text-primary" />
          </button>
          <h1 className="text-headline-lg-mobile font-headline-lg-mobile font-bold text-excellence-blue">
            {t("common.appName")}
          </h1>
        </div>
        <div className="flex items-center gap-md">
          <div className="flex items-center gap-xs px-3 py-1 bg-surface-container-low rounded-full border border-outline-variant">
            <MaterialIcon name="monetization_on" filled className="text-achievement-gold" />
            <span className="font-label-lg text-label-lg text-primary">{balance ?? "—"}</span>
          </div>
        </div>
      </header>

      <main className="pt-20 pb-24 px-margin-mobile max-w-[720px] mx-auto">
        <Outlet context={{ user }} />
      </main>

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-xs pb-safe h-16 bg-surface border-t border-outline-variant">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={"end" in item ? item.end : false}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center px-3 py-1 rounded-xl transition-all ${
                isActive
                  ? "bg-secondary-container text-on-secondary-container"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <MaterialIcon name={item.icon} filled={isActive} />
                <span className="text-label-md font-label-md">{t(item.labelKey)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
