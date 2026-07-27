import { useI18n } from "../lib/i18n";

export function LangSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex bg-ink-100 rounded-pill p-[3px] gap-0.5">
      <button
        onClick={() => setLang("fr")}
        className={`rounded-pill px-2.5 py-1 text-[11px] font-bold ${lang === "fr" ? "bg-brand-600 text-white" : "text-muted"}`}
      >
        FR
      </button>
      <button
        onClick={() => setLang("en")}
        className={`rounded-pill px-2.5 py-1 text-[11px] font-bold ${lang === "en" ? "bg-brand-600 text-white" : "text-muted"}`}
      >
        EN
      </button>
    </div>
  );
}
