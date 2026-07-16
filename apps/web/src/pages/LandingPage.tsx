import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../components/ui/MaterialIcon";
import { LanguageSwitcher } from "../components/ui/LanguageSwitcher";
import { BRANCH_SLUGS, LAUNCH_BRANCH } from "@lefax/shared";

const FEATURES = [
  { icon: "timer", titleKey: "landing.featureMicroTitle", bodyKey: "landing.featureMicroBody", accent: "bg-primary-container" },
  { icon: "quiz", titleKey: "landing.featureExamTitle", bodyKey: "landing.featureExamBody", accent: "bg-secondary-container" },
  { icon: "psychology", titleKey: "landing.featureAiTitle", bodyKey: "landing.featureAiBody", accent: "ai" },
] as const;

export function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile h-16 bg-surface border-b border-outline-variant">
        <div className="flex items-center gap-sm">
          <MaterialIcon name="menu" className="text-primary" />
          <span className="text-headline-lg-mobile font-headline-lg-mobile font-bold text-excellence-blue">
            {t("common.appName")}
          </span>
        </div>
        <div className="flex items-center gap-md">
          <LanguageSwitcher />
        </div>
      </header>

      <main className="pt-16 pb-24 flex-1">
        <section className="relative overflow-hidden px-margin-mobile pt-12 pb-16 bg-background">
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-secondary-container opacity-20 rounded-full blur-3xl" />
          <div className="relative z-10">
            <h1 className="font-display-lg text-display-lg text-excellence-blue mb-4">
              {t("landing.tagline")}
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-8 max-w-md">
              {t("landing.heroSubtitle")}
            </p>
            <Link
              to="/signup"
              className="bg-excellence-blue text-on-primary font-bold px-lg py-md rounded-xl w-full flex items-center justify-center gap-sm shadow-lg active:scale-95 transition-transform"
            >
              {t("landing.cta")}
              <MaterialIcon name="arrow_forward" />
            </Link>
          </div>
          <div className="mt-12 rounded-2xl overflow-hidden shadow-2xl border border-outline-variant">
            <img
              className="w-full aspect-video object-cover"
              alt=""
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuB1hAfRsbsuJCakGLzGfYhZq_5oe5pj4fiUkRxcqH0FwEviymHTytn6kyCRhqbWei5fPwr8PZIvtTABjUY7F7f_beZsxpfpix4NUbV1MYZbmvdLc8xdZMBgyav97F4jBj47-ZEVdFetGBuFOvSzhiTkLWr1kzPohYGxUWvsaNqP4v5_4GDaRNqo8qRMimZXKgwH0e1I8RU9saLIJij1mV09x7OkFxk9EWPd1HUYXIU6PLuikzfT9GNtMnTV3M8-sLPbBdt1IHCM_gI"
            />
          </div>
        </section>

        <section className="px-margin-mobile py-16 bg-white">
          <div className="mb-10 text-center">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-excellence-blue mb-2">
              {t("landing.whyTitle")}
            </h2>
            <div className="h-1 w-12 bg-achievement-gold mx-auto rounded-full" />
          </div>
          <div className="grid grid-cols-1 gap-md">
            {FEATURES.map((feature) =>
              feature.accent === "ai" ? (
                <div
                  key={feature.icon}
                  className="p-lg bg-primary-container text-white rounded-xl flex flex-col gap-sm relative overflow-hidden"
                >
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mb-2">
                      <MaterialIcon name={feature.icon} className="text-white" />
                    </div>
                    <h3 className="font-headline-md text-headline-md">{t(feature.titleKey)}</h3>
                    <p className="font-body-sm text-body-sm opacity-90">{t(feature.bodyKey)}</p>
                  </div>
                  <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/5 rounded-full" />
                </div>
              ) : (
                <div
                  key={feature.icon}
                  className="p-lg bg-surface-container-low rounded-xl border border-outline-variant flex flex-col gap-sm"
                >
                  <div className={`w-12 h-12 ${feature.accent} rounded-lg flex items-center justify-center mb-2`}>
                    <MaterialIcon
                      name={feature.icon}
                      className={feature.accent === "bg-secondary-container" ? "text-on-secondary-container" : "text-white"}
                    />
                  </div>
                  <h3 className="font-headline-md text-headline-md text-excellence-blue">{t(feature.titleKey)}</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{t(feature.bodyKey)}</p>
                </div>
              )
            )}
          </div>
        </section>

        <section className="px-margin-mobile py-16 bg-background">
          <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-excellence-blue mb-8">
            {t("landing.successStories")}
          </h2>
          <div className="flex flex-col gap-md">
            <div className="bg-white p-lg rounded-xl border border-outline-variant shadow-sm flex flex-col gap-md">
              <div className="flex items-center gap-md">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-surface-dim">
                  <img
                    className="w-full h-full object-cover"
                    alt=""
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuC-eJmjbVvM_PlhKppjIUlHkG2gtevJgHQE9aVtxNyAUHTceJR8Lh3FvPV6lUXut0IOstOuJTDd8py8L3aZunfUzfuL8IYmMy5QKZka2UKfeFJpj-oeVCcF5bAPrI6IOmQ89pQmv5aBckn3-G1vWJocb0ROrHn48F-Kd1BBd7PiIUPmsm_foL8kRovnOY3vwdEd3QDqsm3lC2JTGiOAvybotl99gz-ZUBmQw098OuHvxqD7LbD5gmgKI7W9CHQV3w57Ckc_-V_WglY"
                  />
                </div>
                <div>
                  <p className="font-headline-md text-headline-md text-primary m-0">{t("landing.testimonial1Name")}</p>
                  <p className="font-label-md text-label-md text-success-green">{t("landing.testimonial1Status")}</p>
                </div>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant italic leading-relaxed">
                {t("landing.testimonial1Quote")}
              </p>
            </div>

            <div className="bg-white p-lg rounded-xl border border-outline-variant shadow-sm flex flex-col gap-md">
              <div className="flex items-center gap-md">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-surface-dim">
                  <img
                    className="w-full h-full object-cover"
                    alt=""
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuB31FwLLcay0SLgHmfQbP1xrQMULFG0yVTZ0p0mYoD41D83KVV2oU7g82OFdmFA7sa9g00iBhCg5Ak0_mDWBwNdgMs3u3Ot5kaDivuZfugYZ-QEESpDDjhFI5FUBzusSdK09r9uCJ7bkC11LXyCQjlf-pEa7DhcZ0FcoabqQ5ucgKrN7Kp3oS6GULKtl0FA4X3Z8ys0UZFn8mqrqlHWUZLb3w46qs8IIGxUbrquRxLP68osG3Fy9fYwj-fuyeSXfPMeBglHl0KqQz4"
                  />
                </div>
                <div>
                  <p className="font-headline-md text-headline-md text-primary m-0">{t("landing.testimonial2Name")}</p>
                  <p className="font-label-md text-label-md text-success-green">{t("landing.testimonial2Status")}</p>
                </div>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant italic leading-relaxed">
                {t("landing.testimonial2Quote")}
              </p>
            </div>
          </div>
        </section>

        <section className="px-margin-mobile py-16 text-center">
          <div className="bg-achievement-gold/10 rounded-3xl p-xl border border-achievement-gold/20">
            <h2 className="font-display-lg text-display-lg text-excellence-blue mb-4">
              {t("landing.ctaTitle")}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mb-8">
              {t("landing.ctaBody")}
            </p>
            <Link
              to="/signup"
              className="inline-block bg-excellence-blue text-white font-bold px-xl py-md rounded-full shadow-lg hover:opacity-90 active:scale-95 transition-all"
            >
              {t("landing.ctaButton")}
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-excellence-blue text-white px-margin-mobile py-12">
        <div className="flex flex-col gap-lg">
          <div className="flex flex-col gap-sm">
            <span className="text-headline-md font-headline-md font-bold">{t("common.appName")}</span>
            <p className="font-body-sm text-body-sm opacity-70">{t("landing.footerTagline")}</p>
          </div>
          <div className="grid grid-cols-2 gap-lg">
            <div className="flex flex-col gap-xs">
              <span className="font-label-lg text-label-lg uppercase tracking-wider opacity-50">
                {t("landing.footerBranches")}
              </span>
              {BRANCH_SLUGS.map((slug) => (
                <a key={slug} className="font-body-sm text-body-sm" href="#">
                  {t(`branches.${slug}`)}
                  {slug === LAUNCH_BRANCH ? "" : ""}
                </a>
              ))}
            </div>
            <div className="flex flex-col gap-xs">
              <span className="font-label-lg text-label-lg uppercase tracking-wider opacity-50">
                {t("landing.footerCompany")}
              </span>
              <a className="font-body-sm text-body-sm" href="/about">
                {t("landing.footerAbout")}
              </a>
              <a className="font-body-sm text-body-sm" href="/contact">
                {t("landing.footerContact")}
              </a>
              <a className="font-body-sm text-body-sm" href="/privacy">
                {t("landing.footerPrivacy")}
              </a>
            </div>
          </div>
          <div className="pt-lg border-t border-white/10 flex justify-between items-center">
            <p className="font-label-md text-label-md opacity-60">© 2026 {t("common.appName")}. {t("landing.footerRights")}</p>
            <div className="flex gap-md">
              <MaterialIcon name="face_nod" className="text-white/70" />
              <MaterialIcon name="language" className="text-white/70" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
