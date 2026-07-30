import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { useI18n } from "../../lib/i18n";

function LogoMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M12 3L2 8l10 5 10-5-10-5z" stroke="#1e2a3a" strokeWidth="1.5" />
      <path d="M6 10.5V15c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" stroke="#1e2a3a" strokeWidth="1.5" />
      <path d="M21 8v5" stroke="#1e2a3a" strokeWidth="1.5" />
      <circle cx="21" cy="14.5" r="1.4" fill="#f5b400" />
    </svg>
  );
}

export default function Landing() {
  const { lang, setLang } = useI18n();
  const navigate = useNavigate();

  const howSteps =
    lang === "fr"
      ? [
          { num: 1, title: "Choisis ta filière", body: "Sélectionne ton concours et accède au programme officiel Biologie, Physique, Chimie." },
          { num: 2, title: "Révise leçon par leçon", body: "Cours courts, pièges d'examen signalés, puis un quiz pour valider chaque notion." },
          { num: 3, title: "Gagne des FaxCoins", body: "Chaque leçon et quiz réussi te rapporte des FaxCoins à dépenser dans la boutique." },
        ]
      : [
          { num: 1, title: "Choose your track", body: "Pick your entrance exam and get the official Biology, Physics, Chemistry syllabus." },
          { num: 2, title: "Study lesson by lesson", body: "Short lessons, flagged exam traps, then a quiz to lock in each concept." },
          { num: 3, title: "Earn FaxCoins", body: "Every completed lesson and quiz earns FaxCoins to spend in the shop." },
        ];

  const subjects = [
    { name: lang === "fr" ? "Biologie" : "Biology", emoji: "🧬", bg: "#dcf5e3" },
    { name: lang === "fr" ? "Physique" : "Physics", emoji: "⚛️", bg: "#e8f4ff" },
    { name: lang === "fr" ? "Chimie" : "Chemistry", emoji: "🧪", bg: "#fff4e0" },
    { name: lang === "fr" ? "Français" : "French", emoji: "📖", bg: "#fdeaf0" },
    { name: lang === "fr" ? "Culture générale" : "General knowledge", emoji: "🌍", bg: "#f3e8ff" },
  ];

  const features =
    lang === "fr"
      ? [
          { icon: "🌐", title: "Bilingue FR/EN", body: "Tout le contenu est disponible en français et en anglais." },
          { icon: "📡", title: "Mode hors-ligne", body: "Continue d'apprendre même sans connexion internet." },
          { icon: "🏅", title: "100% gamifié", body: "Séries, classements et récompenses pour rester motivé." },
        ]
      : [
          { icon: "🌐", title: "Bilingual FR/EN", body: "All content is available in French and English." },
          { icon: "📡", title: "Offline mode", body: "Keep learning even without an internet connection." },
          { icon: "🏅", title: "Fully gamified", body: "Streaks, rankings and rewards to stay motivated." },
        ];

  return (
    <PhoneFrame>
      <div className="bg-white flex-1 min-h-0 overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-5 py-[18px]">
          <div className="flex items-center gap-2">
            <LogoMark />
            <span className="font-serif font-extrabold text-[22px] text-ink-900">LeFax</span>
          </div>
          <div className="flex bg-ink-100 rounded-pill p-[3px] gap-0.5">
            <button
              onClick={() => setLang("fr")}
              className={`rounded-pill px-2.5 py-1 text-[11px] font-bold ${lang === "fr" ? "bg-brand-800 text-white" : "text-muted"}`}
            >
              FR
            </button>
            <button
              onClick={() => setLang("en")}
              className={`rounded-pill px-2.5 py-1 text-[11px] font-bold ${lang === "en" ? "bg-brand-800 text-white" : "text-muted"}`}
            >
              EN
            </button>
          </div>
        </div>

        <div className="px-7 pt-2 text-center">
          <div className="w-[150px] h-[150px] mx-auto mt-1.5 mb-[18px] rounded-2xl bg-brand-50 flex items-center justify-center text-[64px]">
            🎓
          </div>
          <h1 className="font-serif font-bold text-[26px] text-ink-900 leading-[1.3] mb-3">
            {lang === "fr" ? "Commence ta préparation" : "Start your prep"}
          </h1>
          <p className="text-[15px] text-[#647084] leading-[1.6] mb-[22px]">
            {lang === "fr"
              ? "Révise ton concours de médecine où que tu sois, en français et en anglais."
              : "Study for your medicine entrance exam anywhere, in French and English."}
          </p>
          <button
            onClick={() => navigate("/register")}
            className="w-full bg-brand-600 text-white rounded-[10px] py-4 font-serif font-bold text-[15px] tracking-[0.3px]"
          >
            {lang === "fr" ? "S'inscrire gratuitement" : "Sign up for free"}
          </button>
          <div className="mt-3.5 text-[14px] text-[#647084]">
            {lang === "fr" ? "Déjà un compte ?" : "Already have an account?"}{" "}
            <a onClick={() => navigate("/login")} className="cursor-pointer font-semibold">
              {lang === "fr" ? "Se connecter" : "Log in"}
            </a>
          </div>
        </div>

        <div className="flex justify-around px-5 py-[26px] mt-6 border-y border-[#f0f2f5] animate-fadeup">
          {[
            { n: "58", l: lang === "fr" ? "QCM" : "MCQs" },
            { n: "10", l: lang === "fr" ? "Leçons" : "Lessons" },
            { n: "1.2k+", l: lang === "fr" ? "Élèves actifs" : "Active students" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="font-serif font-extrabold text-[20px] text-ink-900">{s.n}</div>
              <div className="text-[11px] text-muted mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>

        <div className="px-6 pt-[30px] pb-1.5 animate-fadeup">
          <p className="font-serif font-bold text-[18px] text-ink-900 text-center mb-5">
            {lang === "fr" ? "Comment ça marche" : "How it works"}
          </p>
          {howSteps.map((hs) => (
            <div key={hs.num} className="flex gap-3.5 items-start mb-[18px]">
              <div className="w-[34px] h-[34px] rounded-full bg-brand-100 text-brand-600 font-serif font-extrabold text-[14px] flex items-center justify-center flex-shrink-0">
                {hs.num}
              </div>
              <div>
                <div className="font-serif font-bold text-[14.5px] text-ink-900 mb-[3px]">{hs.title}</div>
                <div className="text-[13px] text-[#647084] leading-[1.55]">{hs.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 pt-5 pb-2 animate-fadeup">
          <p className="font-serif font-bold text-[18px] text-ink-900 text-center mb-4">
            {lang === "fr" ? "Toutes les matières du concours" : "Every subject in the exam"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {subjects.map((ls) => (
              <div key={ls.name} className="flex items-center gap-2.5 rounded-xl px-3.5 py-3" style={{ background: ls.bg }}>
                <span className="text-[20px]">{ls.emoji}</span>
                <span className="font-serif font-semibold text-[12.5px] text-ink-900">{ls.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pt-[26px] pb-2 animate-fadeup">
          <p className="font-serif font-bold text-[18px] text-ink-900 text-center mb-4">
            {lang === "fr" ? "Pensé pour réviser partout" : "Built to study anywhere"}
          </p>
          {features.map((ft) => (
            <div key={ft.title} className="flex gap-3.5 items-start bg-ink-50 rounded-xl px-4 py-3.5 mb-2.5">
              <span className="text-[20px]">{ft.icon}</span>
              <div>
                <div className="font-serif font-bold text-[13.5px] text-ink-900 mb-[3px]">{ft.title}</div>
                <div className="text-[12.5px] text-[#647084] leading-[1.5]">{ft.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2.5 px-6 py-[22px] bg-[#f4f7fb] animate-fadeup">
          <p className="font-serif font-bold text-[16px] text-ink-900 text-center mb-3.5">
            {lang === "fr" ? "Ce qu'ils disent de nous" : "What they say about us"}
          </p>
          <div className="bg-white rounded-[14px] overflow-hidden flex shadow-[0_4px_14px_rgba(20,30,60,0.08)]">
            <div className="w-[110px] flex-shrink-0 bg-brand-50 flex items-center justify-center text-[38px]">🧑🏾‍🏫</div>
            <div className="bg-[#f5b23b] px-4 py-3.5 flex-1">
              <p className="m-0 text-[13px] leading-[1.5] text-[#3a2400] italic">
                {lang === "fr"
                  ? "Tous mes élèves révisent sur LeFax, et le résultat est tout simplement exceptionnel."
                  : "All my students study on LeFax, and the result is simply exceptional."}
              </p>
              <p className="mt-2.5 mb-0 text-[11px] font-bold text-[#3a2400]">
                {lang === "fr" ? "Martin Embolo, Prof. Physique" : "Martin Embolo, Physics Teacher"}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-[22px] text-center animate-fadeup">
          <p className="font-serif font-bold text-[19px] text-ink-900 mb-2.5">
            {lang === "fr" ? "LeFax dans ta poche, au lit et partout" : "LeFax in your pocket, in bed and everywhere"}
          </p>
          <p className="text-[13.5px] text-[#647084] leading-[1.6] mb-4">
            {lang === "fr"
              ? "Prépare tes examens et concours sur le pouce avec nos applications iOS et Android. Continue à apprendre même sans wifi avec notre mode hors-ligne."
              : "Prep for your exams on the go with our iOS and Android apps. Keep learning even without wifi with offline mode."}
          </p>
          <div className="flex gap-2.5">
            <div className="flex-1 bg-brand-800 text-white rounded-[10px] py-2.5 text-[12px] font-semibold">Google Play</div>
            <div className="flex-1 bg-brand-800 text-white rounded-[10px] py-2.5 text-[12px] font-semibold">App Store</div>
          </div>
        </div>

        <div className="px-6 py-5 text-center border-t border-[#f0f2f5]">
          <div className="text-[11px] text-[#c3cbd6]">
            {lang === "fr" ? "© 2026 LeFax — Préparation aux concours, Cameroun" : "© 2026 LeFax — Exam prep, Cameroon"}
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
