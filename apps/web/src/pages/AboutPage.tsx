import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../components/ui/MaterialIcon";

export function AboutPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-50 flex items-center gap-md px-margin-mobile h-14 bg-surface border-b border-outline-variant">
        <Link to="/" className="p-1 rounded-full hover:bg-surface-container-low">
          <MaterialIcon name="arrow_back" className="text-primary" />
        </Link>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-excellence-blue">
          {t("landing.footerAbout")}
        </h1>
      </header>

      <main className="px-margin-mobile py-xl max-w-[720px] mx-auto space-y-xl">
        <section>
          <h2 className="font-headline-lg text-headline-lg text-excellence-blue mb-md">{t("about.title")}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">{t("about.mission")}</p>
        </section>

        <section>
          <h2 className="font-headline-lg text-headline-lg text-excellence-blue mb-md">{t("about.valuesTitle")}</h2>
          <div className="space-y-md">
            {(["access", "excellence", "innovation", "community"] as const).map((key) => (
              <div key={key} className="flex gap-md items-start">
                <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <MaterialIcon name={key === "access" ? "lock_open" : key === "excellence" ? "emoji_events" : key === "innovation" ? "lightbulb" : "groups"} className="text-white text-[20px]" />
                </div>
                <div>
                  <h3 className="font-headline-md text-headline-md text-excellence-blue">{t(`about.values.${key}.title`)}</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs">{t(`about.values.${key}.body`)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-headline-lg text-headline-lg text-excellence-blue mb-md">{t("about storyTitle")}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">{t("about.story")}</p>
        </section>
      </main>
    </div>
  );
}
