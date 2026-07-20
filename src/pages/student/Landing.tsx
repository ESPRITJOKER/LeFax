import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { Icon } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";

export default function Landing() {
  const { t, setLang } = useI18n();
  const navigate = useNavigate();

  function pick(lang: "fr" | "en") {
    setLang(lang);
  }

  return (
    <PhoneFrame topBar={false}>
      <div className="flex-1 flex flex-col items-center justify-center gap-7 p-8 bg-ink-950 rounded-[26px]">
        <div className="flex flex-col items-center gap-2.5">
          <div className="w-[68px] h-[68px] rounded-2xl bg-ink-700 flex items-center justify-center">
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
            className="flex items-center justify-between px-5 py-4 rounded-2xl border-[1.5px] border-ink-600 bg-ink-800 text-white text-[15px] font-semibold"
          >
            <span>Français</span>
            <span className="text-xs font-bold opacity-60">FR</span>
          </button>
          <button
            onClick={() => pick("en")}
            className="flex items-center justify-between px-5 py-4 rounded-2xl border-[1.5px] border-ink-600 bg-ink-800 text-white text-[15px] font-semibold"
          >
            <span>English</span>
            <span className="text-xs font-bold opacity-60">EN</span>
          </button>
        </div>
        <button
          onClick={() => navigate("/register")}
          className="mt-2 px-8 py-3 rounded-pill border-none bg-ochre-600 text-ink-950 text-sm font-bold"
        >
          {t("lang_continue")}
        </button>
      </div>
    </PhoneFrame>
  );
}
