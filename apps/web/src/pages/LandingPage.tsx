import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../components/ui/MaterialIcon";
import { LanguageSwitcher } from "../components/ui/LanguageSwitcher";
import { BRANCH_SLUGS, LAUNCH_BRANCH } from "@lefax/shared";

const FEATURES = [
  { icon: "timer", titleKey: "landing.featureMicroTitle", bodyKey: "landing.featureMicroBody" },
  { icon: "quiz", titleKey: "landing.featureExamTitle", bodyKey: "landing.featureExamBody" },
  { icon: "psychology", titleKey: "landing.featureAiTitle", bodyKey: "landing.featureAiBody" },
] as const;

export function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile h-16 bg-surface border-b border-outline-variant">
        <div className="flex items-center gap-sm">
          <div className="w-8 h-8 bg-excellence-blue rounded-lg flex items-center justify-center">
            <MaterialIcon name="school" filled className="text-white text-[18px]" />
          </div>
          <span className="text-headline-lg-mobile font-headline-lg-mobile font-bold text-excellence-blue">
            {t("common.appName")}
          </span>
        </div>
        <div className="flex items-center gap-md">
          <LanguageSwitcher />
          <Link to="/login" className="font-label-lg text-label-lg text-primary">
            {t("landing.login")}
          </Link>
        </div>
      </header>

      <main className="pt-16 flex-1">
        <section className="relative overflow-hidden px-margin-mobile pt-12 pb-16 bg-background">
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-secondary-container opacity-20 rounded-full blur-3xl" />
          <div className="relative z-10 max-w-[720px] mx-auto">
            <h1 className="font-display-lg text-display-lg text-excellence-blue mb-4">{t("landing.tagline")}</h1>
            <Link
              to="/signup"
              className="bg-excellence-blue text-on-primary font-bold px-lg py-md rounded-xl w-full md:w-auto flex items-center justify-center gap-sm shadow-lg active:scale-95 transition-transform"
            >
              {t("landing.cta")}
              <MaterialIcon name="arrow_forward" />
            </Link>
            <div className="mt-12 rounded-2xl overflow-hidden shadow-2xl border border-outline-variant">
              <img
                className="w-full aspect-video object-cover"
                alt=""
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB1hAfRsbsuJCakGLzGfYhZq_5oe5pj4fiUkRxcqH0FwEviymHTytn6kyCRhqbWei5fPwr8PZIvtTABjUY7F7f_beZsxpfpix4NUbV1MYZbmvdLc8xdZMBgyav97F4jBj47-ZEVdFetGBuFOvSzhiTkLWr1kzPohYGxUWvsaNqP4v5_4GDaRNqo8qRMimZXKgwH0e1I8RU9saLIJij1mV09x7OkFxk9EWPd1HUYXIU6PLuikzfT9GNtMnTV3M8-sLPbBdt1IHCM_gI"
              />
            </div>
          </div>
        </section>

        <section className="px-margin-mobile py-16 bg-white">
          <div className="mb-10 text-center">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-excellence-blue mb-2">
              {t("landing.whyTitle")}
            </h2>
            <div className="h-1 w-12 bg-achievement-gold mx-auto rounded-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-md max-w-[1024px] mx-auto">
            {FEATURES.map((feature) => (
              <div
                key={feature.icon}
                className="p-lg bg-surface-container-low rounded-xl border border-outline-variant flex flex-col gap-sm"
              >
                <div className="w-12 h-12 bg-primary-container rounded-lg flex items-center justify-center mb-2">
                  <MaterialIcon name={feature.icon} className="text-white" />
                </div>
                <h3 className="font-headline-md text-headline-md text-excellence-blue">{t(feature.titleKey)}</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{t(feature.bodyKey)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-margin-mobile py-16 text-center">
          <div className="bg-achievement-gold/10 rounded-3xl p-xl border border-achievement-gold/20 max-w-[600px] mx-auto">
            <h2 className="font-display-lg text-display-lg text-excellence-blue mb-4">{t("landing.cta")}</h2>
            <Link
              to="/signup"
              className="inline-block bg-excellence-blue text-white font-bold px-xl py-md rounded-full shadow-lg hover:opacity-90 active:scale-95 transition-all"
            >
              {t("landing.cta")}
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-excellence-blue text-white px-margin-mobile py-12">
        <div className="max-w-[1024px] mx-auto flex flex-col gap-lg">
          <div className="flex flex-col gap-sm">
            <span className="text-headline-md font-headline-md font-bold">{t("common.appName")}</span>
            <p className="font-body-sm text-body-sm opacity-70 max-w-sm">{t("landing.footerTagline")}</p>
          </div>
          <div className="grid grid-cols-2 gap-lg">
            <div className="flex flex-col gap-xs">
              <span className="font-label-lg text-label-lg uppercase tracking-wider opacity-50">
                {t("landing.footerBranches")}
              </span>
              {BRANCH_SLUGS.map((slug) => (
                <span key={slug} className="font-body-sm text-body-sm opacity-80">
                  {t(`branches.${slug}`)}
                  {slug === LAUNCH_BRANCH ? "" : ` (${t("onboarding.comingSoon")})`}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-xs">
              <span className="font-label-lg text-label-lg uppercase tracking-wider opacity-50">
                {t("landing.footerCompany")}
              </span>
              <a className="font-body-sm text-body-sm opacity-80 hover:opacity-100" href="#">
                {t("landing.footerAbout")}
              </a>
              <a className="font-body-sm text-body-sm opacity-80 hover:opacity-100" href="#">
                {t("landing.footerContact")}
              </a>
              <a className="font-body-sm text-body-sm opacity-80 hover:opacity-100" href="#">
                {t("landing.footerPrivacy")}
              </a>
            </div>
          </div>
          <div className="pt-lg border-t border-white/10">
            <p className="font-label-md text-label-md opacity-60">© 2026 {t("common.appName")}. {t("landing.footerRights")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
