import { useTranslation } from "react-i18next";

interface LanguageSwitcherProps {
  className?: string;
}

/** CDC NFR-11 — French and English interface. Toggles + persists to localStorage. */
export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "fr";

  return (
    <div className={`flex rounded-full bg-surface-container-low border border-outline-variant p-0.5 ${className ?? ""}`}>
      {(["fr", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => i18n.changeLanguage(code)}
          aria-label={code === "fr" ? "Français" : "English"}
          aria-pressed={lang === code}
          className={`px-2.5 py-1 rounded-full text-label-md font-label-md uppercase transition-all ${
            lang === code ? "bg-white shadow-sm text-primary" : "text-on-surface-variant"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
