import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../../components/ui/MaterialIcon";

export function TutorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="fixed top-0 left-0 w-full z-50 flex items-center gap-sm px-margin-mobile h-16 bg-surface border-b border-outline-variant">
        <button
          type="button"
          onClick={() => navigate("/app")}
          className="p-2 hover:bg-surface-container-low rounded-full transition-transform active:scale-95"
        >
          <MaterialIcon name="arrow_back" className="text-excellence-blue" />
        </button>
        <h1 className="text-headline-lg-mobile font-headline-lg-mobile font-bold text-excellence-blue">
          {t("tutorLock.title")}
        </h1>
      </header>

      <main className="pt-16 flex-1 flex flex-col items-center justify-center px-margin-mobile text-center gap-lg">
        <div className="w-20 h-20 rounded-full bg-primary-container flex items-center justify-center relative">
          <MaterialIcon name="smart_toy" filled className="text-white text-[36px]" />
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-surface border border-outline-variant flex items-center justify-center">
            <MaterialIcon name="lock" className="text-excellence-blue text-[18px]" />
          </div>
        </div>

        <div className="max-w-xs">
          <p className="text-headline-md font-headline-md text-excellence-blue mb-sm">
            {t("tutorLock.heading")}
          </p>
          <p className="text-body-sm text-on-surface-variant">{t("tutorLock.body")}</p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/app")}
          className="mt-md bg-excellence-blue text-white px-6 py-3 rounded-xl font-label-lg text-label-lg shadow-md active:scale-95 transition-transform"
        >
          {t("tutorLock.cta")}
        </button>
      </main>
    </div>
  );
}
