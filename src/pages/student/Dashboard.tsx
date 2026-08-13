import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { TopBar } from "../../components/TopBar";
import { Drawer } from "../../components/Drawer";
import { Spinner } from "../../components/ui";
import { subjectEmoji } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { SubjectRow } from "../../lib/database.types";

interface SubjectProgress extends SubjectRow {
  chapterCount: number;
}

// Day/night greeting (corrections doc note 1: "Ça ne suit pas le cycle jour
// nuit"). Bonjour in the day, Bonsoir in the evening, Bonne nuit late.
function greeting(lang: "fr" | "en"): string {
  const h = new Date().getHours();
  if (lang === "fr") {
    if (h >= 5 && h < 17) return "Bonjour";
    if (h >= 17 && h < 22) return "Bonsoir";
    return "Bonne nuit";
  }
  if (h >= 5 && h < 17) return "Good morning";
  if (h >= 17 && h < 22) return "Good evening";
  return "Good night";
}

// Rotating motivational subtitle (corrections doc note 2: "Tu peux mettre des
// rotations : discret mais déterminé ; garde en vue l'objectif ; tu vas y
// arriver…"). Picked by day so it's stable within a session but varies.
const SUBTITLES: Record<"fr" | "en", string[]> = {
  fr: [
    "Continue sur ta lancée",
    "Discret mais déterminé",
    "Garde en vue l'objectif",
    "Tu vas y arriver",
    "Que souhaites-tu apprendre aujourd'hui ?",
  ],
  en: [
    "Keep up the momentum",
    "Quiet but determined",
    "Keep your goal in sight",
    "You'll get there",
    "What would you like to learn today?",
  ],
};

export default function Dashboard() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [subjects, setSubjects] = useState<SubjectProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: subjectRows } = await supabase.from("subjects").select("*").eq("track", "medicine").order("position");

      // Chapter count per subject drives the "{N} chapitres" subtitle on each
      // subject card (corrections doc note 3: keep the original presentation,
      // drop the progress bar).
      const { data: chapterRows } = await supabase.from("chapters").select("id, subject_id");
      const chaptersBySubject: Record<string, number> = {};
      for (const c of chapterRows ?? []) chaptersBySubject[c.subject_id] = (chaptersBySubject[c.subject_id] ?? 0) + 1;

      setSubjects((subjectRows ?? []).map((s) => ({ ...s, chapterCount: chaptersBySubject[s.id] ?? 0 })));
      setLoading(false);
    })();
  }, [profile]);

  const firstName = profile?.first_name || (lang === "fr" ? "Étudiant" : "Student");
  const initial = (profile?.first_name?.[0] ?? "?").toUpperCase();
  const phrases = SUBTITLES[lang];
  const subtitle = phrases[Math.floor(Date.now() / 86_400_000) % phrases.length];

  return (
    <PhoneFrame>
      <div className="flex-1 min-h-0 flex flex-col">
        <TopBar
          variant="menu"
          coins={profile?.faxcoins ?? 0}
          initial={initial}
          onMenu={() => setDrawer(true)}
          onCoins={() => navigate("/shop")}
          onAvatar={() => navigate("/profile")}
        />

        <div className="flex-1 min-h-0 overflow-auto pb-[90px]">
          <div className="px-5 pt-5">
            <p className="font-serif font-bold text-[19px] text-ink-900 mb-0.5">
              {`${greeting(lang)} ${firstName} 👋`}
            </p>
            <p className="text-[13px] text-[#647084] mb-6">{subtitle}</p>

            <p className="font-serif font-bold text-[15px] text-ink-900 mb-3">{lang === "fr" ? "Mes matières" : "My subjects"}</p>
          </div>

          <div className="px-5 flex flex-col gap-3">
            {loading ? (
              <Spinner />
            ) : subjects.length === 0 ? (
              <div className="text-sm text-muted py-4">
                {isSupabaseConfigured ? (lang === "fr" ? "Aucune matière" : "No subjects") : (lang === "fr" ? "Backend non configuré" : "Backend not configured")}
              </div>
            ) : (
              subjects.map((s) => {
                const se = subjectEmoji(s.slug);
                return (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/subjects/${s.slug}`)}
                    className="flex items-center gap-3.5 bg-card rounded-[14px] px-4 py-3.5 shadow-[0_2px_10px_rgba(20,30,60,0.06)] cursor-pointer"
                  >
                    <div className="w-[46px] h-[46px] rounded-xl flex items-center justify-center text-[22px]" style={{ background: se.bg }}>
                      {se.emoji}
                    </div>
                    <div className="flex-1">
                      <div className="font-serif font-semibold text-[14.5px] text-ink-900">{lang === "fr" ? s.name_fr : s.name_en}</div>
                      <div className="text-[12.5px] text-muted mt-0.5">
                        {s.chapterCount} {lang === "fr" ? (s.chapterCount === 1 ? "chapitre" : "chapitres") : s.chapterCount === 1 ? "chapter" : "chapters"}
                      </div>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                      <path d="M9 6l6 6-6 6" stroke="#c3cbd6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <BottomTabs active="revisions" />
        <Drawer open={drawer} onClose={() => setDrawer(false)} />
      </div>
    </PhoneFrame>
  );
}
