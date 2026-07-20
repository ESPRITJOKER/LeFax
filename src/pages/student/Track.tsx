import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { Icon, type IconName } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/auth";

interface TrackDef {
  id: string;
  fr: string;
  en: string;
  icon: IconName;
  active: boolean;
  fr_desc: string;
  en_desc: string;
}

const TRACKS: TrackDef[] = [
  { id: "medicine", fr: "Médecine", en: "Medicine", icon: "medcross", active: true, fr_desc: "Concours de Médecine, faculté de médecine et sciences biomédicales", en_desc: "Medicine entrance exam, faculty of medicine and biomedical sciences" },
  { id: "engineering", fr: "Ingénierie & Technologie", en: "Engineering & Technology", icon: "gear", active: false, fr_desc: "Grandes écoles d'ingénieurs", en_desc: "Engineering grandes écoles" },
  { id: "nursing", fr: "Infirmerie & Médico-Sanitaire", en: "Nursing & Health Sciences", icon: "flask", active: false, fr_desc: "Écoles d'infirmiers et professions médico-sanitaires", en_desc: "Nursing and allied health schools" },
  { id: "education", fr: "Enseignement", en: "Education", icon: "cap", active: false, fr_desc: "Concours d'entrée à l'ENS", en_desc: "ENS entrance exam" },
  { id: "management", fr: "Management, communication & diplomatie", en: "Management, Communication & Diplomacy", icon: "scale", active: false, fr_desc: "Grandes écoles de commerce et diplomatie", en_desc: "Business and diplomacy grandes écoles" },
  { id: "agronomy", fr: "Agronomie & sciences environnementales", en: "Agronomy & Environmental Sciences", icon: "chart", active: false, fr_desc: "Écoles d'agronomie", en_desc: "Agronomy schools" },
];

export default function Track() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { session } = useAuth();

  async function selectMedicine() {
    if (isSupabaseConfigured && session?.user?.id) {
      await supabase.from("profiles").update({ track: "medicine" }).eq("id", session.user.id);
    }
    navigate("/dashboard");
  }

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col px-[22px] pb-6 pt-1.5 overflow-y-auto">
        <div className="font-serif font-bold text-[23px] text-ink-950 mt-2.5 mb-1">{t("track_title")}</div>
        <div className="text-[13px] text-muted mb-5">{t("track_sub")}</div>

        <div className="flex flex-col gap-3.5">
          {TRACKS.map((tr) => (
            <div
              key={tr.id}
              className={`rounded-2xl p-4.5 p-[18px] flex gap-3.5 items-start relative border-[1.5px] ${
                tr.active ? "border-ink-300 bg-ink-50" : "border-border bg-white opacity-60"
              }`}
            >
              <div
                className={`w-11 h-11 flex-none rounded-xl flex items-center justify-center ${
                  tr.active ? "bg-ink-700 text-white" : "bg-ink-100 text-muted"
                }`}
              >
                <Icon name={tr.icon} size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15.5px] font-bold text-ink-900">{lang === "fr" ? tr.fr : tr.en}</div>
                <div className="text-[12.5px] text-muted mt-0.5 leading-snug">{lang === "fr" ? tr.fr_desc : tr.en_desc}</div>
              </div>
              {tr.active ? (
                <button onClick={selectMedicine} className="flex-none px-4 py-2 rounded-pill border-none bg-ink-700 text-white text-xs font-bold whitespace-nowrap">
                  {t("track_select")}
                </button>
              ) : (
                <div className="flex-none flex items-center gap-1 px-2.5 py-1.5 rounded-pill bg-ink-100 text-muted text-[11px] font-bold">
                  <Icon name="lock" size={12} />
                  {t("track_soon")}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}
