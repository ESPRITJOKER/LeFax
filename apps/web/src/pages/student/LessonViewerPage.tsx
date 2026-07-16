import { useEffect, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type LessonDetailDto } from "../../lib/api-client";

const BOTTOM_NAV = [
  { to: "/app", icon: "dashboard", labelKey: "studentNav.dashboard", end: true },
  { to: "/app/lessons", icon: "menu_book", labelKey: "studentNav.lessons" },
  { to: "/app/exams", icon: "quiz", labelKey: "studentNav.exams" },
  { to: "/app/wallet", icon: "payments", labelKey: "studentNav.wallet" },
] as const;

/** Ported from stitch_lefax_course_exam_prep/lesson_cards (WEB-E05). Full-screen, outside StudentAppShell (own header + bottom nav). */
export function LessonViewerPage() {
  const { t } = useTranslation();
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<LessonDetailDto | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  // Bookmarks in this app are QCM-only (no per-card bookmark exists in the
  // schema) — this toggle is visual-only, matching the design's affordance
  // without pretending to persist something the data model doesn't support.
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    if (!lessonId) return;
    api
      .lesson(lessonId)
      .then((res) => setLesson(res.lesson))
      .finally(() => setLoading(false));
    api.coinsBalance().then((res) => setBalance(res.balance));
  }, [lessonId]);

  if (loading) return null;
  if (!lesson || lesson.cards.length === 0) {
    return (
      <div className="pt-20 px-margin-mobile max-w-[720px] mx-auto text-center">
        <p className="font-body-md text-body-md text-text-secondary">{t("lessonViewer.noContent")}</p>
      </div>
    );
  }

  const card = lesson.cards[index];
  if (!card) return null;
  const total = lesson.cards.length;
  const percent = Math.round(((index + 1) / total) * 100);
  const subjectChapter = lesson.chapters
    ? `${lesson.chapters.subjects?.name ?? ""} • ${lesson.chapters.name}`
    : "";

  async function goNext() {
    if (!lessonId || advancing) return;
    setAdvancing(true);
    try {
      const res = await api.cardSeen(lessonId);
      if (res.coinsAwarded > 0) {
        setToast(`+${res.coinsAwarded} FaxCoins`);
        setBalance((b) => (b ?? 0) + res.coinsAwarded);
        setTimeout(() => setToast(null), 2500);
      }
      if (index < total - 1) {
        setIndex(index + 1);
      } else {
        navigate(`/app/lessons/${lessonId}/practice`);
      }
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div className="bg-background text-on-surface font-body-md h-dvh flex flex-col overflow-hidden fixed inset-0">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile h-16 bg-surface border-b border-outline-variant">
        <div className="flex items-center gap-md">
          <button type="button" onClick={() => navigate("/app/lessons")} className="p-1 rounded-full hover:bg-surface-container-low">
            <MaterialIcon name="arrow_back" className="text-primary" />
          </button>
          <h1 className="text-headline-lg-mobile font-headline-lg-mobile font-bold text-excellence-blue">Lefax Course</h1>
        </div>
        <div className="flex items-center gap-xs px-3 py-1 bg-surface-container-low rounded-full border border-outline-variant">
          <MaterialIcon name="monetization_on" filled className="text-achievement-gold" />
          <span className="font-label-lg text-label-lg text-primary">{balance ?? "—"}</span>
        </div>
      </header>

      <main className="pt-16 pb-20 flex-1 flex flex-col max-w-[720px] mx-auto w-full overflow-hidden">
        <section className="px-margin-mobile py-md">
          <div className="flex items-center justify-between mb-sm">
            <div className="flex flex-col">
              {subjectChapter && (
                <span className="text-label-md font-label-md text-text-secondary uppercase tracking-wider">{subjectChapter}</span>
              )}
              <h2 className="text-headline-md font-headline-md text-primary">{lesson.title}</h2>
            </div>
            <button
              type="button"
              onClick={() => setBookmarked((b) => !b)}
              className="p-1 hover:bg-surface-container-high rounded-full transition-colors"
              aria-label="Bookmark"
            >
              <MaterialIcon
                name="bookmark"
                filled={bookmarked}
                className={bookmarked ? "text-achievement-gold" : "text-on-surface-variant"}
              />
            </button>
          </div>
          <div className="flex flex-col gap-xs">
            <div className="flex justify-between items-center mb-1">
              <span className="text-label-md font-label-md text-on-surface-variant">
                {t("lessonViewer.stepOf", { current: index + 1, total })}
              </span>
              <span className="text-label-md font-label-md text-excellence-blue font-bold">{t("lessonViewer.percentComplete", { percent })}</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div
                className="h-full bg-excellence-blue transition-all duration-500 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </section>

        <section className="flex-1 px-margin-mobile flex items-center justify-center relative overflow-hidden">
          <div className="w-full bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-lg flex flex-col max-h-[85%] overflow-y-auto">
            {card.image_url && (
              <div className="w-full aspect-video rounded-lg overflow-hidden bg-surface-container-low mb-lg border border-outline-variant">
                <img className="w-full h-full object-cover" src={card.image_url} alt={card.image_alt ?? ""} />
              </div>
            )}
            <div className="space-y-md">
              <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed">{card.text_content}</p>
            </div>
          </div>
        </section>

        <section className="p-margin-mobile flex justify-between items-center gap-md">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0 || advancing}
            className="flex-1 py-3 px-lg border border-excellence-blue text-excellence-blue font-label-lg rounded-xl flex items-center justify-center gap-base active:opacity-80 transition-all disabled:opacity-40"
          >
            <MaterialIcon name="arrow_back" />
            {t("lessonViewer.previous")}
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={advancing}
            className="flex-1 py-3 px-lg bg-excellence-blue text-white font-label-lg rounded-xl flex items-center justify-center gap-base active:opacity-80 transition-all shadow-md disabled:opacity-60"
          >
            {index < total - 1 ? t("lessonViewer.next") : t("lessonViewer.finish")}
            <MaterialIcon name="arrow_forward" />
          </button>
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-xs pb-safe h-16 bg-surface border-t border-outline-variant md:hidden">
        {BOTTOM_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={"end" in item ? item.end : false}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center px-3 py-1 rounded-xl transition-all ${
                isActive ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant hover:bg-surface-container-high"
              }`
            }
          >
            <MaterialIcon name={item.icon} />
            <span className="text-label-md font-label-md">{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-lg py-sm rounded-full shadow-lg font-label-lg text-label-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
