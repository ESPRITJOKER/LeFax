import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { useI18n } from "../../lib/i18n";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/auth";

interface TrackDef {
  id: string;
  fr: string;
  en: string;
  active: boolean;
}

const TRACKS: TrackDef[] = [
  { id: "medicine", fr: "Médecine", en: "Medicine", active: true },
  { id: "engineering", fr: "Ingénierie & Technologie", en: "Engineering & Technology", active: false },
  { id: "nursing", fr: "Infirmerie & Médico-Sanitaire", en: "Nursing & Health Sciences", active: false },
  { id: "education", fr: "Enseignement", en: "Education", active: false },
  { id: "management", fr: "Management & Diplomatie", en: "Management & Diplomacy", active: false },
  { id: "agronomy", fr: "Agronomie & Environnement", en: "Agronomy & Environment", active: false },
];

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="#94a3b8" strokeWidth="1.6" />
      <path d="M8 11V7a4 4 0 018 0v4" stroke="#94a3b8" strokeWidth="1.6" />
    </svg>
  );
}

export default function Track() {
  const { lang } = useI18n();
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
      <div className="bg-white flex-1 min-h-0 flex flex-col px-6 pt-[50px] pb-[30px] overflow-y-auto">
        <h2 className="font-serif font-bold text-[21px] text-ink-900 text-center mb-2">
          {lang === "fr" ? "Choisis ton concours" : "Choose your exam track"}
        </h2>
        <p className="text-center text-[#647084] text-[13.5px] mb-[26px]">
          {lang === "fr" ? "Nous ajoutons de nouvelles filières très bientôt" : "We're adding new tracks very soon"}
        </p>

        {TRACKS.map((tr) => {
          const name = lang === "fr" ? tr.fr : tr.en;
          const status = tr.active
            ? lang === "fr" ? "Disponible" : "Available"
            : lang === "fr" ? "Bientôt disponible" : "Coming soon";
          return (
            <div
              key={tr.id}
              onClick={tr.active ? selectMedicine : undefined}
              className="flex items-center gap-3.5 p-4 rounded-[14px] mb-3 border-2"
              style={{
                borderColor: tr.active ? "#29b6f6" : "#eef1f5",
                background: tr.active ? "#eef8ff" : "#f8fafc",
                opacity: tr.active ? 1 : 0.55,
                cursor: tr.active ? "pointer" : "default",
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-[20px] flex-shrink-0 text-white font-serif font-bold"
                style={{ background: tr.active ? "#22c55e" : "#94a3b8" }}
              >
                {name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="font-serif font-semibold text-[14.5px] text-ink-900">{name}</div>
                <div className="text-[12px] text-muted">{status}</div>
              </div>
              {!tr.active && <LockIcon />}
            </div>
          );
        })}
      </div>
    </PhoneFrame>
  );
}
