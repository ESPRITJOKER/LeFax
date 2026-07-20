import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../components/ui/MaterialIcon";

export function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-50 flex items-center gap-md px-margin-mobile h-14 bg-surface border-b border-outline-variant">
        <Link to="/" className="p-1 rounded-full hover:bg-surface-container-low">
          <MaterialIcon name="arrow_back" className="text-primary" />
        </Link>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-excellence-blue">
          {t("landing.footerPrivacy")}
        </h1>
      </header>

      <main className="px-margin-mobile py-xl max-w-[720px] mx-auto space-y-xl">
        <p className="font-body-sm text-body-sm text-text-secondary">
          {t("privacy.lastUpdated")}
        </p>

        {(["dataCollection", "dataUse", "dataSharing", "security", "cookies", "rights", "changes"] as const).map((section) => (
          <section key={section}>
            <h2 className="font-headline-md text-headline-md text-excellence-blue mb-sm">
              {t(`privacy.sections.${section}.title`)}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t(`privacy.sections.${section}.body`)}
            </p>
          </section>
        ))}
      </main>
    </div>
  );
}
