import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../components/ui/MaterialIcon";

export function ContactPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-50 flex items-center gap-md px-margin-mobile h-14 bg-surface border-b border-outline-variant">
        <Link to="/" className="p-1 rounded-full hover:bg-surface-container-low">
          <MaterialIcon name="arrow_back" className="text-primary" />
        </Link>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-excellence-blue">
          {t("landing.footerContact")}
        </h1>
      </header>

      <main className="px-margin-mobile py-xl max-w-[720px] mx-auto space-y-xl">
        <section className="text-center">
          <div className="w-16 h-16 bg-primary-container rounded-2xl flex items-center justify-center mx-auto mb-md">
            <MaterialIcon name="mail" className="text-white text-[32px]" />
          </div>
          <h2 className="font-headline-lg text-headline-lg text-excellence-blue mb-sm">{t("contact.title")}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">{t("contact.subtitle")}</p>
        </section>

        <div className="space-y-md">
          <div className="bg-white p-lg rounded-xl border border-outline-variant flex items-center gap-md">
            <div className="w-10 h-10 bg-secondary-container rounded-lg flex items-center justify-center shrink-0">
              <MaterialIcon name="mail" className="text-on-secondary-container text-[20px]" />
            </div>
            <div>
              <p className="font-label-lg text-label-lg text-primary">{t("contact.emailLabel")}</p>
              <a href="mailto:contact@lefaxcourse.com" className="font-body-md text-body-md text-excellence-blue hover:underline">
                contact@lefaxcourse.com
              </a>
            </div>
          </div>

          <div className="bg-white p-lg rounded-xl border border-outline-variant flex items-center gap-md">
            <div className="w-10 h-10 bg-secondary-container rounded-lg flex items-center justify-center shrink-0">
              <MaterialIcon name="phone" className="text-on-secondary-container text-[20px]" />
            </div>
            <div>
              <p className="font-label-lg text-label-lg text-primary">{t("contact.phoneLabel")}</p>
              <a href="tel:+237600000000" className="font-body-md text-body-md text-excellence-blue hover:underline">
                +237 600 000 000
              </a>
            </div>
          </div>

          <div className="bg-white p-lg rounded-xl border border-outline-variant flex items-center gap-md">
            <div className="w-10 h-10 bg-secondary-container rounded-lg flex items-center justify-center shrink-0">
              <MaterialIcon name="location_on" className="text-on-secondary-container text-[20px]" />
            </div>
            <div>
              <p className="font-label-lg text-label-lg text-primary">{t("contact.locationLabel")}</p>
              <p className="font-body-md text-body-md text-on-surface-variant">{t("contact.locationValue")}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
