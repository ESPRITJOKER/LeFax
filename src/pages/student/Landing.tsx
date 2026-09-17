import { useNavigate } from "react-router-dom";
import { LogoMark } from "../../components/BrandLogo";
import { useI18n } from "../../lib/i18n";
import heroImg from "../../assets/landing/hero.webp";
import learnImg from "../../assets/landing/learn.webp";
import cardSciencesImg from "../../assets/landing/card-sciences.webp";
import cardArtsImg from "../../assets/landing/card-arts.webp";
import cardExamsImg from "../../assets/landing/card-exams.webp";
import resourcesImg from "../../assets/landing/resources.webp";
import examsImg from "../../assets/landing/exams.webp";
import testimonialImg from "../../assets/landing/testimonial.webp";
import mobileImg from "../../assets/landing/mobile.webp";

/**
 * Illustration slots for the landing page. Drop the artwork into
 * `src/assets/landing/` and import it here, e.g.
 *   import hero from "../../assets/landing/hero.webp";
 *   const ART = { hero, ... };
 * Any slot left `undefined` renders a soft brand placeholder of the same shape.
 */
const ART: Record<
  "hero" | "learn" | "resources" | "exams" | "mobile" | "testimonial" | "cardSciences" | "cardArts" | "cardExams",
  string | undefined
> = {
  hero: heroImg,
  learn: learnImg,
  resources: resourcesImg,
  exams: examsImg,
  mobile: mobileImg,
  testimonial: testimonialImg,
  cardSciences: cardSciencesImg,
  cardArts: cardArtsImg,
  cardExams: cardExamsImg,
};

function Illustration({
  src,
  alt = "",
  aspect = "aspect-[4/3]",
  placeholder = "rounded-2xl bg-brand-50",
  className = "",
}: {
  src?: string;
  alt?: string;
  aspect?: string;
  placeholder?: string;
  className?: string;
}) {
  if (src) {
    return <img src={src} alt={alt} className={`w-full h-auto object-contain rounded-2xl ${className}`} />;
  }
  return (
    <div className={`w-full ${aspect} ${placeholder} flex items-center justify-center ${className}`}>
      <LogoMark size={72} className="opacity-30" />
    </div>
  );
}

export default function Landing() {
  const { lang, setLang } = useI18n();
  const navigate = useNavigate();
  const fr = lang === "fr";

  const howSteps = fr
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
    { name: fr ? "Biologie" : "Biology", emoji: "🧬", bg: "#dcf5e3" },
    { name: fr ? "Physique" : "Physics", emoji: "⚛️", bg: "#e8f4ff" },
    { name: fr ? "Chimie" : "Chemistry", emoji: "🧪", bg: "#fff4e0" },
    { name: fr ? "Français" : "French", emoji: "📖", bg: "#fdeaf0" },
    { name: fr ? "Culture générale" : "General knowledge", emoji: "🌍", bg: "#f3e8ff" },
  ];

  const courseCards = [
    { img: ART.cardSciences, title: fr ? "Sciences et technologies" : "Science & technology", body: fr ? "Des ressources claires et pratiques." : "Clear, practical resources." },
    { img: ART.cardArts, title: fr ? "Arts & sciences" : "Arts & sciences", body: fr ? "Cours, fiches et exercices pour progresser." : "Lessons, summaries and exercises to improve." },
    { img: ART.cardExams, title: fr ? "Examens & concours" : "Exams & entrance tests", body: fr ? "Annales et corrections à portée de main." : "Past papers and answers at hand." },
  ];

  const features = fr
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

  const stats = [
    { n: "58", l: fr ? "QCM" : "MCQs" },
    { n: "10", l: fr ? "Leçons" : "Lessons" },
    { n: "1.2k+", l: fr ? "Élèves actifs" : "Active students" },
  ];

  const footerCols = [
    { title: fr ? "Examens" : "Exams", items: ["BEPC", "BAC", "BTS", "ENS"] },
    { title: "Concours", items: ["ENAM", "ENS", "ENSP", "IRIC"] },
    { title: fr ? "Plus" : "More", items: [fr ? "Ressources" : "Resources", fr ? "Cours" : "Courses", "Premium"] },
  ];

  const sectionTitle = "font-serif font-bold text-[18px] lg:text-[26px] text-ink-900";
  const bodyText = "text-[#647084] leading-[1.6]";
  const wrap = "max-w-6xl mx-auto px-4 sm:px-6";

  return (
    <div className="min-h-full bg-white text-ink-900 overflow-x-clip">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#f0f2f5]">
        <div className={`${wrap} flex items-center justify-between py-3.5`}>
          <div className="flex items-center gap-2">
            <LogoMark />
            <span className="font-serif font-extrabold text-[22px] text-ink-900">LeFax</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex bg-ink-100 rounded-pill p-[3px] gap-0.5">
              {(["fr", "en"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`rounded-pill px-2.5 py-1 text-[11px] font-bold ${lang === l ? "bg-brand-800 text-white" : "text-muted"}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              onClick={() => navigate("/login")}
              className="hidden sm:block text-[14px] font-semibold text-ink-900 hover:text-brand-600"
            >
              {fr ? "Se connecter" : "Log in"}
            </button>
            <button
              onClick={() => navigate("/register")}
              className="hidden sm:block bg-brand-600 text-white rounded-[10px] px-4 py-2 font-serif font-bold text-[13px]"
            >
              {fr ? "S'inscrire" : "Sign up"}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className={`${wrap} pt-6 lg:pt-16 pb-6 lg:pb-12 grid lg:grid-cols-2 gap-8 lg:gap-12 items-center`}>
        <div className="text-center lg:text-left">
          <div className="lg:hidden w-[150px] h-[150px] mx-auto mb-[18px] rounded-2xl bg-brand-50 flex items-center justify-center">
            <LogoMark size={112} />
          </div>
          <h1 className="font-serif font-bold text-[26px] sm:text-[34px] lg:text-[46px] text-ink-900 leading-[1.2] mb-3 lg:mb-5">
            {fr ? "Commence ta préparation" : "Start your prep"}
          </h1>
          <p className={`text-[15px] lg:text-[18px] ${bodyText} mb-[22px] lg:mb-8 max-w-xl mx-auto lg:mx-0`}>
            {fr
              ? "Révise ton concours de médecine où que tu sois, en français et en anglais."
              : "Study for your medicine entrance exam anywhere, in French and English."}
          </p>
          <button
            onClick={() => navigate("/register")}
            className="w-full sm:w-auto sm:px-10 bg-brand-600 text-white rounded-[10px] py-4 font-serif font-bold text-[15px] tracking-[0.3px]"
          >
            {fr ? "S'inscrire gratuitement" : "Sign up for free"}
          </button>
          <div className="mt-3.5 text-[14px] text-[#647084]">
            {fr ? "Déjà un compte ?" : "Already have an account?"}{" "}
            <a onClick={() => navigate("/login")} className="cursor-pointer font-semibold">
              {fr ? "Se connecter" : "Log in"}
            </a>
          </div>
        </div>
        <div className="hidden sm:block">
          <Illustration src={ART.hero} alt={fr ? "Élèves qui révisent" : "Students studying"} />
        </div>
      </section>

      {/* Stats */}
      <div className="border-y border-[#f0f2f5] animate-fadeup">
        <div className={`${wrap} flex justify-around py-[26px] lg:py-8`}>
          {stats.map((s) => (
            <div key={s.l} className="text-center">
              <div className="font-serif font-extrabold text-[20px] lg:text-[30px] text-ink-900">{s.n}</div>
              <div className="text-[11px] lg:text-[13px] text-muted mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section className={`${wrap} pt-[30px] lg:pt-20 pb-1.5 lg:pb-8 grid lg:grid-cols-2 gap-8 lg:gap-14 items-center animate-fadeup`}>
        <div className="hidden lg:block">
          <Illustration src={ART.learn} />
        </div>
        <div className="max-w-xl mx-auto lg:mx-0 w-full">
          <p className={`${sectionTitle} text-center lg:text-left mb-5 lg:mb-8`}>
            {fr ? "Comment ça marche" : "How it works"}
          </p>
          {howSteps.map((hs) => (
            <div key={hs.num} className="flex gap-3.5 items-start mb-[18px] lg:mb-6">
              <div className="w-[34px] h-[34px] rounded-full bg-brand-100 text-brand-600 font-serif font-extrabold text-[14px] flex items-center justify-center flex-shrink-0">
                {hs.num}
              </div>
              <div>
                <div className="font-serif font-bold text-[14.5px] lg:text-[16px] text-ink-900 mb-[3px]">{hs.title}</div>
                <div className={`text-[13px] lg:text-[14.5px] ${bodyText}`}>{hs.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Subjects + course cards */}
      <section className={`${wrap} pt-5 lg:pt-16 pb-2 animate-fadeup`}>
        <p className={`${sectionTitle} text-center mb-4 lg:mb-8`}>
          {fr ? "Toutes les matières du concours" : "Every subject in the exam"}
        </p>
        <div className="grid sm:grid-cols-3 gap-4 lg:gap-6 mb-5 lg:mb-8">
          {courseCards.map((c) => (
            <button
              key={c.title}
              onClick={() => navigate("/register")}
              className="text-left bg-white rounded-[14px] overflow-hidden shadow-[0_4px_14px_rgba(20,30,60,0.08)] hover:-translate-y-0.5 transition-transform"
            >
              {c.img ? (
                <img src={c.img} alt="" className="w-full aspect-[29/30] object-cover block" />
              ) : (
                <Illustration aspect="aspect-[16/10]" placeholder="bg-brand-50" />
              )}
              <div className="px-4 py-3.5">
                <div className="font-serif font-bold text-[14.5px] text-ink-900 mb-[3px]">{c.title}</div>
                <div className={`text-[13px] ${bodyText}`}>{c.body}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {subjects.map((ls) => (
            <div key={ls.name} className="flex items-center gap-2.5 rounded-xl px-3.5 py-3" style={{ background: ls.bg }}>
              <span className="text-[20px]">{ls.emoji}</span>
              <span className="font-serif font-semibold text-[12.5px] lg:text-[13.5px] text-ink-900">{ls.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className={`${wrap} pt-[26px] lg:pt-20 pb-2 lg:pb-8 grid lg:grid-cols-2 gap-8 lg:gap-14 items-center animate-fadeup`}>
        <div className="max-w-xl mx-auto lg:mx-0 w-full">
          <p className={`${sectionTitle} text-center lg:text-left mb-4 lg:mb-8`}>
            {fr ? "Pensé pour réviser partout" : "Built to study anywhere"}
          </p>
          {features.map((ft) => (
            <div key={ft.title} className="flex gap-3.5 items-start bg-ink-50 rounded-xl px-4 py-3.5 mb-2.5">
              <span className="text-[20px]">{ft.icon}</span>
              <div>
                <div className="font-serif font-bold text-[13.5px] lg:text-[15px] text-ink-900 mb-[3px]">{ft.title}</div>
                <div className={`text-[12.5px] lg:text-[14px] ${bodyText}`}>{ft.body}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden lg:block">
          <Illustration src={ART.resources} />
        </div>
      </section>

      {/* Exams band */}
      <section className="mt-8 lg:mt-16 bg-brand-800 text-white animate-fadeup">
        <div className={`${wrap} py-8 lg:py-14 grid lg:grid-cols-2 gap-8 items-center`}>
          <div className="text-center lg:text-left">
            <h2 className="font-serif font-bold text-[20px] lg:text-[28px] leading-[1.3] mb-3">
              {fr ? "Tous tes examens et concours sont sur LeFax" : "All your exams are on LeFax"}
            </h2>
            <p className="text-[13.5px] lg:text-[15px] leading-[1.6] text-white/80 mb-5">
              {fr
                ? "Retrouve au même endroit les anciennes épreuves, corrections et quiz dont tu as besoin."
                : "Find past papers, answers and quizzes all in one place."}
            </p>
            <button
              onClick={() => navigate("/register")}
              className="bg-white text-brand-800 rounded-[10px] px-6 py-3 font-serif font-bold text-[14px]"
            >
              {fr ? "Trouver mes épreuves" : "Find my papers"}
            </button>
          </div>
          <div className="hidden lg:block">
            <Illustration src={ART.exams} placeholder="rounded-2xl bg-white/10" />
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="bg-[#f4f7fb] animate-fadeup">
        <div className={`${wrap} py-[22px] lg:py-16`}>
          <p className={`font-serif font-bold text-[16px] lg:text-[26px] text-ink-900 text-center mb-3.5 lg:mb-8`}>
            {fr ? "Ce qu'ils disent de nous" : "What they say about us"}
          </p>
          <div className="max-w-3xl mx-auto bg-white rounded-[14px] overflow-hidden flex shadow-[0_4px_14px_rgba(20,30,60,0.08)]">
            <div className="w-[130px] lg:w-[240px] flex-shrink-0 bg-brand-50 flex items-center justify-center text-[38px] lg:text-[64px]">
              {ART.testimonial ? (
                <img
                  src={ART.testimonial}
                  alt=""
                  className="w-full h-full object-cover object-[55%_22%]"
                />
              ) : (
                "🧑🏾‍🏫"
              )}
            </div>
            <div className="bg-[#f5b23b] px-4 py-3.5 lg:px-8 lg:py-7 flex-1">
              <p className="m-0 text-[13px] lg:text-[17px] leading-[1.5] text-[#3a2400] italic">
                {fr
                  ? "Tous mes élèves révisent sur LeFax, et le résultat est tout simplement exceptionnel."
                  : "All my students study on LeFax, and the result is simply exceptional."}
              </p>
              <p className="mt-2.5 mb-0 text-[11px] lg:text-[13px] font-bold text-[#3a2400]">
                {fr ? "Martin Embolo, Prof. Physique" : "Martin Embolo, Physics Teacher"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile apps */}
      <section className={`${wrap} py-[22px] lg:py-20 grid lg:grid-cols-2 gap-8 lg:gap-14 items-center animate-fadeup`}>
        <div className="text-center lg:text-left max-w-xl mx-auto lg:mx-0">
          <p className="font-serif font-bold text-[19px] lg:text-[30px] text-ink-900 mb-2.5 lg:mb-4 leading-[1.3]">
            {fr ? "LeFax dans ta poche, au lit et partout" : "LeFax in your pocket, in bed and everywhere"}
          </p>
          <p className={`text-[13.5px] lg:text-[16px] ${bodyText} mb-4 lg:mb-6`}>
            {fr
              ? "Prépare tes examens et concours sur le pouce avec nos applications iOS et Android. Continue à apprendre même sans wifi avec notre mode hors-ligne."
              : "Prep for your exams on the go with our iOS and Android apps. Keep learning even without wifi with offline mode."}
          </p>
          <div className="flex gap-2.5 lg:max-w-sm">
            {["Google Play", "App Store"].map((store) => (
              <div
                key={store}
                className="flex-1 bg-brand-800 text-white rounded-[10px] py-2 text-center"
              >
                <div className="text-[12px] lg:text-[13px] font-semibold leading-tight">{store}</div>
                <div className="text-[10px] lg:text-[11px] font-semibold text-white/70 leading-tight">
                  {fr ? "Bientôt disponible" : "Coming soon"}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden sm:block">
          <Illustration src={ART.mobile} alt={fr ? "Aperçu de l'application mobile" : "Mobile app preview"} />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#f0f2f5]">
        <div className={`${wrap} py-8 lg:py-12 grid grid-cols-2 sm:grid-cols-4 gap-6`}>
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-2">
              <LogoMark size={22} />
              <span className="font-serif font-extrabold text-[18px] text-ink-900">LeFax</span>
            </div>
            <div className="text-[12.5px] text-[#647084]">
              {fr ? "Prépare tes examens en ligne." : "Prep for your exams online."}
            </div>
          </div>
          {footerCols.map((col) => (
            <div key={col.title}>
              <div className="font-serif font-bold text-[13px] text-ink-900 mb-2">{col.title}</div>
              {col.items.map((it) => (
                <a
                  key={it}
                  onClick={() => navigate("/register")}
                  className="block cursor-pointer text-[12.5px] text-[#647084] hover:text-brand-600 py-0.5"
                >
                  {it}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div className="px-6 py-5 text-center border-t border-[#f0f2f5]">
          <div className="text-[11px] text-[#c3cbd6]">
            {fr ? "© 2026 LeFax — Préparation aux concours, Cameroun" : "© 2026 LeFax — Exam prep, Cameroon"}
          </div>
        </div>
      </footer>
    </div>
  );
}
