import { Link } from "react-router-dom";
import { MaterialIcon } from "../components/ui/MaterialIcon";

export function NotFoundPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-md px-margin-mobile text-center bg-background">
      <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center">
        <MaterialIcon name="explore_off" className="text-on-surface-variant text-[32px]" />
      </div>
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-excellence-blue">Page introuvable</h1>
      <p className="font-body-sm text-body-sm text-text-secondary max-w-sm">
        Cette page n'existe pas ou a été déplacée.
      </p>
      <Link
        to="/"
        className="mt-sm bg-excellence-blue text-white px-lg py-sm rounded-lg font-label-lg text-label-lg"
      >
        Retour à l'accueil
      </Link>
    </div>
  );
}
