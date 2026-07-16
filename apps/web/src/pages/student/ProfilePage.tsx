import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { LanguageSwitcher } from "../../components/ui/LanguageSwitcher";
import { api } from "../../lib/api-client";
import { useSessionStore } from "../../stores/session.store";

/** No matching Stitch design — built from tokens (WEB-E15 profil & paramètres). */
export function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const clear = useSessionStore((s) => s.clear);

  async function logout() {
    await api.logout().catch(() => {});
    clear();
    navigate("/");
  }

  return (
    <div className="max-w-[560px] mx-auto">
      <div className="flex flex-col items-center text-center mb-xl">
        <div className="w-20 h-20 rounded-full bg-primary-container flex items-center justify-center text-white text-headline-lg font-headline-lg mb-md">
          {(user?.firstName ?? user?.phone ?? "?").charAt(0).toUpperCase()}
        </div>
        <h1 className="font-headline-lg text-headline-lg text-excellence-blue">{user?.firstName ?? "Étudiant"}</h1>
        <p className="font-body-sm text-body-sm text-text-secondary">{user?.phone}</p>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl divide-y divide-outline-variant mb-lg overflow-hidden">
        <div className="flex items-center justify-between p-md">
          <div className="flex items-center gap-md">
            <MaterialIcon name="school" className="text-on-surface-variant" />
            <span className="font-body-md text-body-md text-on-surface">Mon parcours</span>
          </div>
          <span className="font-label-md text-label-md text-text-secondary">
            {(user?.branchPreferences ?? []).map((slug) => t(`branches.${slug}`)).join(", ") || "—"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate("/onboarding/track")}
          className="flex items-center justify-between p-md w-full hover:bg-surface-container-low transition-colors"
        >
          <div className="flex items-center gap-md">
            <MaterialIcon name="edit" className="text-on-surface-variant" />
            <span className="font-body-md text-body-md text-on-surface">Modifier mes filières</span>
          </div>
          <MaterialIcon name="chevron_right" className="text-on-surface-variant" />
        </button>
        <div className="flex items-center justify-between p-md">
          <div className="flex items-center gap-md">
            <MaterialIcon name="notifications" className="text-on-surface-variant" />
            <span className="font-body-md text-body-md text-on-surface">Notifications</span>
          </div>
          <span className="font-label-md text-label-md text-text-secondary">Bientôt disponible</span>
        </div>
        <div className="flex items-center justify-between p-md">
          <div className="flex items-center gap-md">
            <MaterialIcon name="language" className="text-on-surface-variant" />
            <span className="font-body-md text-body-md text-on-surface">{t("profile.language")}</span>
          </div>
          <LanguageSwitcher />
        </div>
      </div>

      <button
        type="button"
        onClick={logout}
        className="w-full flex items-center justify-center gap-sm p-md bg-error-container/40 text-error-red rounded-xl font-label-lg text-label-lg"
      >
        <MaterialIcon name="logout" />
        Déconnexion
      </button>
    </div>
  );
}
