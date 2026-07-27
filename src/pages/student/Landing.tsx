import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { Icon } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";

export default function Landing() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();

  function pick(l: "fr" | "en") {
    setLang(l);
  }

  return (
    <PhoneFrame topBar={false} nav={false}>
      <div className="flex-1 flex flex-col items-center justify-center gap-7 p-8 bg-brand-800 sm:rounded-[26px]">
        <div className="flex flex-col items-center gap-2.5">
          <div className="w-[68px] h-[68px] rounded-2xl bg-brand-600 flex items-center justify-center animate-lazyreveal">
            <Icon name="cap" size={34} color="#fff" />
          </div>
          <div className="font-serif font-semibold text-2xl text-white tracking-wide">{t("appName")}</div>
        </div>
        <div className="text-center text-ink-100">
          <div className="text-[17px] font-semibold mb-1">{t("lang_heading")}</div>
          <div className="text-[13px] opacity-75">{t("lang_sub")}</div>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-[280px]">
          <button
            onClick={() => pick("fr")}
            className={`flex items-center justify-between px-5 py-4 rounded-2xl border-[1.5px] text-[15px] font-semibold transition-all duration-200 hover:scale-[1.03] hover:border-ochre-600 ${
              lang === "fr"
                ? "scale-[1.03] border-ochre-600 bg-brand-600 text-white shadow-[0_0_0_3px_rgba(196,144,10,0.25)]"
                : "border-ink-600 bg-brand-700 text-white"
            }`}
          >
            <span>Français</span>
            <span className={`text-xs font-bold transition-colors ${lang === "fr" ? "text-ochre-600 opacity-100" : "opacity-60"}`}>FR</span>
          </button>
          <button
            onClick={() => pick("en")}
            className={`flex items-center justify-between px-5 py-4 rounded-2xl border-[1.5px] text-[15px] font-semibold transition-all duration-200 hover:scale-[1.03] hover:border-ochre-600 ${
              lang === "en"
                ? "scale-[1.03] border-ochre-600 bg-brand-600 text-white shadow-[0_0_0_3px_rgba(196,144,10,0.25)]"
                : "border-ink-600 bg-brand-700 text-white"
            }`}
          >
            <span>English</span>
            <span className={`text-xs font-bold transition-colors ${lang === "en" ? "text-ochre-600 opacity-100" : "opacity-60"}`}>EN</span>
          </button>
        </div>
        <button
          onClick={() => navigate("/register")}
          className="mt-2 px-8 py-3 rounded-pill border-none bg-ochre-600 text-ink-950 text-sm font-bold transition-transform duration-150 hover:scale-105"
        >
          {t("lang_continue")}
        </button>
      </div>
    </PhoneFrame>
  );
}
