import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../components/ui/MaterialIcon";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-md px-margin-mobile text-center bg-background">
      <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center">
        <MaterialIcon name="explore_off" className="text-on-surface-variant text-[32px]" />
      </div>
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-excellence-blue">{t("notFound.title")}</h1>
      <p className="font-body-sm text-body-sm text-text-secondary max-w-sm">
        {t("notFound.body")}
      </p>
      <Link
        to="/"
        className="mt-sm bg-excellence-blue text-white px-lg py-sm rounded-lg font-label-lg text-label-lg"
      >
        {t("notFound.cta")}
      </Link>
    </div>
  );
}
