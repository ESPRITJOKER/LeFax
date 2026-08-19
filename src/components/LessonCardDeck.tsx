import { useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import { inline } from "../lib/lessonContent";
import { gradeStructural } from "../lib/practiceBank";
import type { LessonCardRow } from "../lib/database.types";

/**
 * Story-card lesson viewer (CDC Steps 2 & 5). Rebuilds the interaction model of
 * design-reference Lefax_Lesson_Cards_Preview.html — deal-and-flip navigation
 * between cards, flip-in-place to reveal each card's back face, with a cinematic
 * reveal flash + light sweep on every transition — but using the LIVE app tokens
 * (src/index.css) instead of the preview's approximate hexes, and driven by the
 * Web Animations API through refs (no animation dependency added).
 *
 * The last slot ("lesson complete") routes into practice via `onFinish`, keeping
 * the existing behaviour. Each card's back face carries the four Step-5 blocks:
 * explanation, a direct-match-graded structural question, tips, and traps.
 */

const NAV_MS = 500;

interface StructAnswerState {
  value: string;
  graded: boolean;
  correct: boolean;
}

// A lightweight swipe-direction hint (a pointing finger) shows on the first
// card of a lesson, fading with familiarity (corrections doc: "une main qui
// donne avec l'index la direction du défilement… plus l'utilisateur est
// habitué, moins elle s'affiche. Pas besoin d'écrire de long textes"). We
// count how many times it has been shown across lessons and stop after a few.
const HINT_KEY = "lefax_swipe_hint_seen";
function hintSeenCount(): number {
  if (typeof localStorage === "undefined") return 99;
  return Number(localStorage.getItem(HINT_KEY) ?? "0");
}

export function LessonCardDeck({
  cards,
  lessonTitle,
  chapterName,
  onFinish,
  onClose,
}: {
  cards: LessonCardRow[];
  lessonTitle: string;
  chapterName?: string | null;
  onFinish: () => void;
  onClose?: () => void;
}) {
  const { t, lang } = useI18n();
  // Show the finger hint on the very first card until the user has seen it a
  // handful of times, then retire it.
  const [showHint, setShowHint] = useState(hintSeenCount() < 3);

  // Slots: one per card, plus a final "lesson complete" slot.
  const totalSlots = cards.length + 1;
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answers, setAnswers] = useState<Record<string, StructAnswerState>>({});
  // Cards whose image URL failed to load — fall back to the illustration
  // placeholder instead of a broken-image icon.
  const [brokenImg, setBrokenImg] = useState<Record<string, boolean>>({});

  const animatingRef = useRef(false);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const vignetteRef = useRef<HTMLDivElement | null>(null);
  const startXRef = useRef<number | null>(null);

  function dismissHint() {
    if (!showHint) return;
    setShowHint(false);
    if (typeof localStorage !== "undefined") localStorage.setItem(HINT_KEY, String(hintSeenCount() + 1));
  }

  function goTo(newIndex: number, dir: 1 | -1) {
    dismissHint();
    if (animatingRef.current || newIndex < 0 || newIndex > totalSlots - 1 || newIndex === current) return;
    const oldEl = slotRefs.current[current];
    const newEl = slotRefs.current[newIndex];
    if (!oldEl || !newEl) {
      setCurrent(newIndex);
      setFlipped(false);
      return;
    }
    animatingRef.current = true;
    setFlipped(false); // always land on the front face of the incoming card

    // Prime the incoming slot (shown but off-stage) before animating in.
    newEl.style.display = "block";
    newEl.style.transform = "translate(0px,90px) scale(0.5) rotateY(90deg)";
    newEl.style.opacity = "0";

    requestAnimationFrame(() => {
      vignetteRef.current?.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: 0.4 },
          { opacity: 1, offset: 0.66 },
          { opacity: 0, offset: 0.95 },
        ],
        { duration: 520, easing: "ease-out" }
      );

      oldEl.animate(
        [
          { transform: "translate(0px,0px) scale(1) rotateY(0deg) rotate(0deg)", opacity: 1, offset: 0 },
          { transform: "translate(0px,3px) scale(0.96) rotateY(0deg) rotate(0deg)", opacity: 1, offset: 0.14 },
          {
            transform: `translate(${dir * 50}px,-14px) scale(0.82) rotateY(${dir * -70}deg) rotate(${dir * -6}deg)`,
            opacity: 0,
            offset: 1,
          },
        ],
        { duration: 440, easing: "cubic-bezier(.4,0,.7,0)", fill: "forwards" }
      );

      const newAnim = newEl.animate(
        [
          { transform: `translate(0px,90px) scale(0.5) rotateY(90deg) rotate(${dir * 4}deg)`, opacity: 0, offset: 0 },
          { transform: `translate(0px,20px) scale(0.78) rotateY(58deg) rotate(${dir * 2}deg)`, opacity: 0.7, offset: 0.5 },
          { transform: "translate(0px,-10px) scale(1.04) rotateY(14deg) rotate(0deg)", opacity: 1, offset: 0.85 },
          { transform: "translate(0px,0px) scale(1) rotateY(0deg) rotate(0deg)", opacity: 1, offset: 1 },
        ],
        { duration: NAV_MS, easing: "cubic-bezier(.22,.8,.3,1.1)", fill: "forwards" }
      );

      const sweep = newEl.querySelector<HTMLElement>(".deck-sweep i");
      sweep?.animate(
        [
          { transform: "translateX(-160%)", offset: 0 },
          { transform: "translateX(-160%)", offset: 0.38 },
          { transform: "translateX(320%)", offset: 0.78 },
          { transform: "translateX(320%)", offset: 1 },
        ],
        { duration: 520, easing: "cubic-bezier(.3,.6,.4,1)" }
      );

      newAnim.onfinish = () => {
        // Reset inline styles; React re-render will hide the old slot via `active`.
        oldEl.style.transform = "";
        oldEl.style.opacity = "";
        oldEl.style.display = "";
        newEl.style.transform = "";
        newEl.style.opacity = "";
        newEl.style.display = "";
        animatingRef.current = false;
        setCurrent(newIndex);
        setFlipped(false);
      };
    });
  }

  const goNext = () => goTo(current + 1, 1);
  const goPrev = () => goTo(current - 1, -1);

  function onPointerDown(e: React.PointerEvent) {
    // Don't arm swipe-nav while the back face is up — the structural answer
    // textarea lives there and a stray drag must not navigate away.
    startXRef.current = flipped ? null : e.clientX;
  }
  function onPointerUp(e: React.PointerEvent) {
    if (startXRef.current === null) return;
    const dx = e.clientX - startXRef.current;
    startXRef.current = null;
    if (Math.abs(dx) > 40) (dx < 0 ? goNext : goPrev)();
  }
  function onPointerCancel() {
    startXRef.current = null;
  }

  function submitStructural(card: LessonCardRow) {
    const expected = lang === "fr" ? card.structural_answer_fr : card.structural_answer_en;
    setAnswers((prev) => {
      const cur = prev[card.id];
      if (!cur || !cur.value.trim()) return prev;
      return { ...prev, [card.id]: { ...cur, graded: true, correct: gradeStructural(cur.value, expected) } };
    });
  }

  const cardLabel = (i: number) => (lang === "fr" ? `Carte ${i + 1} / ${cards.length}` : `Card ${i + 1} / ${cards.length}`);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-ink-900 text-white select-none">
      {/* Header + progress */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <div className="flex gap-[5px] mb-3.5">
          {Array.from({ length: totalSlots }).map((_, i) => (
            <div key={i} className="flex-1 h-[3px] rounded-full bg-white/25 overflow-hidden">
              <div className="h-full bg-white transition-[width] duration-300" style={{ width: i <= current ? "100%" : "0%" }} />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-serif font-extrabold text-[14px] truncate">{lessonTitle}</h1>
            {chapterName && <p className="text-[10.5px] text-white/60 truncate">{chapterName}</p>}
          </div>
          {/* Close (symbol only — corrections doc: "On rentre comment au menu ou
              sur les stories ?" → an always-visible ✕ back to the stories grid). */}
          {onClose && (
            <button onClick={onClose} aria-label={lang === "fr" ? "Fermer" : "Close"} className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Stage */}
      {/* touchAction:'pan-y' lets the browser keep vertical scroll (back-face
          content) while handing us horizontal drags — without it, a right→left
          swipe is claimed by the browser as a pan and the pointer stream is
          cancelled before onPointerUp fires, so swipe-nav never triggers on a
          phone (corrections doc note 7). */}
      <div className="relative flex-1 min-h-0" style={{ perspective: "1200px", touchAction: "pan-y" }} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
        {/* Side tap-zones navigate — front face only, so back-face taps reach its controls. */}
        {!flipped && <div className="absolute top-0 bottom-0 left-0 w-[34%] z-[5]" onClick={goPrev} />}
        {!flipped && <div className="absolute top-0 bottom-0 right-0 w-[34%] z-[5]" onClick={goNext} />}

        {/* Visible chevron affordances (symbols, matching the original reader). */}
        {!flipped && current > 0 && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-[6] w-8 h-8 rounded-full bg-white/10 flex items-center justify-center pointer-events-none">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" className="w-4 h-4"><path d="M15 6l-6 6 6 6" /></svg>
          </div>
        )}
        {!flipped && current < totalSlots - 1 && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-[6] w-8 h-8 rounded-full bg-white/10 flex items-center justify-center pointer-events-none">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" className="w-4 h-4"><path d="M9 6l6 6-6 6" /></svg>
          </div>
        )}

        {/* First-card swipe hint: a pointing finger nudging rightwards, no text. */}
        {showHint && !flipped && current === 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[7] pointer-events-none flex flex-col items-center gap-1">
            <div style={{ animation: "fingerNudge 1.2s ease-in-out infinite" }} className="text-[30px]">👉</div>
          </div>
        )}

        <div className="relative h-full">
          {/* Content card slots */}
          {cards.map((card, i) => {
            const rawImage = lang === "fr" ? card.image_fr : card.image_en;
            const image = rawImage && !brokenImg[card.id] ? rawImage : null;
            const point = lang === "fr" ? card.point_fr : card.point_en;
            const sub = lang === "fr" ? card.sub_fr : card.sub_en;
            const explanation = lang === "fr" ? card.explanation_fr : card.explanation_en;
            const tips = lang === "fr" ? card.tips_fr : card.tips_en;
            const traps = lang === "fr" ? card.traps_fr : card.traps_en;
            const structuralQ = lang === "fr" ? card.structural_question_fr : card.structural_question_en;
            const expectedAnswer = lang === "fr" ? card.structural_answer_fr : card.structural_answer_en;
            const ans = answers[card.id];
            const isActive = i === current;

            return (
              <div
                key={card.id}
                ref={(el) => (slotRefs.current[i] = el)}
                className="absolute inset-0 z-10"
                style={{ display: isActive ? "block" : "none", pointerEvents: isActive ? "auto" : "none" }}
              >
                <div
                  className="relative w-full h-full transition-transform duration-500"
                  style={{ transformStyle: "preserve-3d", transform: isActive && flipped ? "rotateY(180deg)" : "rotateY(0deg)", transitionTimingFunction: "cubic-bezier(.4,.2,.2,1)" }}
                >
                  {/* FRONT */}
                  <div
                    className="absolute inset-0 flex flex-col justify-center px-6 pb-8 pt-4"
                    style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
                  >
                    <div className="deck-sweep absolute inset-0 overflow-hidden pointer-events-none">
                      <i className="absolute top-[-30%] left-0 w-[42%] h-[160%] block" style={{ background: "linear-gradient(75deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.42) 48%, rgba(255,255,255,0) 100%)", transform: "translateX(-160%)" }} />
                    </div>

                    {/* No image → render nothing (previously a big yellow
                        bullseye placeholder that confused users — corrections
                        doc note 6). The card centres its text on its own. */}
                    {image && (
                      <img
                        src={image}
                        alt=""
                        onError={() => setBrokenImg((p) => ({ ...p, [card.id]: true }))}
                        className="w-full max-h-[38%] object-contain rounded-2xl mb-5 bg-white/5"
                      />
                    )}
                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-ochre-600 mb-2">{cardLabel(i)}</div>
                    {/* The point is a serif headline, but rendered semibold (not
                        extrabold) so a full sentence isn't one tiring block of
                        bold — emphasis instead comes from *italic* / **bold**
                        kept from the source text (Correction N3). */}
                    <div className="font-serif text-[21px] font-semibold leading-[1.35] mb-3.5">{inline(point)}</div>
                    {sub && <div className="text-[13.5px] text-white/70 leading-[1.5] mb-6">{inline(sub)}</div>}
                    {/* Reveal the back face — symbol only (corrections doc:
                        "pas besoin d'écrire : voir plus… juste de bons symboles"). */}
                    <button
                      onClick={() => setFlipped(true)}
                      aria-label={t("card_more")}
                      className="inline-flex items-center justify-center self-start w-11 h-11 bg-white/[0.12] border border-white/20 rounded-full"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-5 h-5">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  </div>

                  {/* BACK */}
                  <div
                    className="absolute inset-0 flex flex-col bg-surface text-text"
                    style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                  >
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border flex-shrink-0">
                      <h3 className="font-serif font-bold text-[14.5px] text-ink-900 truncate pr-2">{inline(point)}</h3>
                      {/* Flip back to the front — symbol only (no "Retourner" text). */}
                      <button
                        onClick={() => setFlipped(false)}
                        aria-label={t("card_flipBack")}
                        className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-full bg-ink-100 text-brand-600"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4">
                          <path d="M4 4v6h6M20 20v-6h-6" />
                          <path d="M5 15a8 8 0 0014-4M19 9a8 8 0 00-14 4" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-4">
                      {/* Keep the diagram in view while reading — tap to open it
                          full-size in a new tab for the detail the user wants. */}
                      {image && (
                        <a href={image} target="_blank" rel="noopener noreferrer" className="block">
                          <img
                            src={image}
                            alt=""
                            onError={() => setBrokenImg((p) => ({ ...p, [card.id]: true }))}
                            className="w-full max-h-[180px] object-contain rounded-xl border border-border bg-ink-50"
                          />
                        </a>
                      )}

                      {/* Explanation */}
                      {explanation && (
                        <div>
                          <div className="font-serif font-bold text-[12px] text-ink-900 mb-1.5">{t("card_explanation")}</div>
                          <p className="text-[13.5px] leading-[1.6] text-text whitespace-pre-line">{inline(explanation)}</p>
                        </div>
                      )}

                      {/* Structural question — direct-match graded, inline */}
                      {structuralQ && (
                        <div className="rounded-xl border border-brand-600/25 bg-brand-600/[0.05] px-3.5 py-3">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-brand-600 mb-1.5 uppercase tracking-wide">
                            {t("card_structuralQ")}
                          </div>
                          <p className="text-[13px] leading-relaxed text-text mb-2.5">{inline(structuralQ)}</p>
                          <textarea
                            value={ans?.value ?? ""}
                            onChange={(e) => setAnswers((prev) => ({ ...prev, [card.id]: { value: e.target.value, graded: false, correct: false } }))}
                            placeholder={t("card_yourAnswer")}
                            rows={2}
                            className="w-full rounded-lg border-[1.5px] border-ink-300 bg-white px-3 py-2 text-[13px] leading-relaxed resize-none"
                          />
                          {!ans?.graded ? (
                            <button
                              onClick={() => submitStructural(card)}
                              disabled={!ans?.value.trim()}
                              className="mt-2 px-4 py-1.5 rounded-lg text-[12px] font-bold bg-brand-600 text-white disabled:opacity-50"
                            >
                              {t("card_check")}
                            </button>
                          ) : (
                            <div className="mt-2.5">
                              <div className={`text-[12px] font-bold mb-1 ${ans.correct ? "text-success-600" : "text-danger-600"}`}>
                                {ans.correct ? `✓ ${t("card_correct")}` : `✕ ${t("card_incorrect")}`}
                              </div>
                              <div className="rounded-lg bg-white border border-border px-3 py-2">
                                <div className="text-[10px] font-bold uppercase tracking-wide text-success-600 mb-0.5">{t("card_expectedAnswer")}</div>
                                <div className="text-[12.5px] text-text leading-relaxed">{inline(expectedAnswer)}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tips — blue "note" palette (distinct from traps) */}
                      {tips && (
                        <div className="rounded-lg px-3.5 py-3" style={{ background: "#e8f4ff", borderLeft: "4px solid #29b6f6" }}>
                          <div className="font-serif font-bold text-[12px] mb-1" style={{ color: "#0b5f96" }}>
                            💡 {t("card_tips")}
                          </div>
                          <div className="text-[13px] leading-[1.55] whitespace-pre-line" style={{ color: "#0b4a75" }}>{inline(tips)}</div>
                        </div>
                      )}

                      {/* Traps — amber "watch out" palette (distinct from tips) */}
                      {traps && (
                        <div className="rounded-lg px-3.5 py-3" style={{ background: "#fff4e0", borderLeft: "4px solid #f5b400" }}>
                          <div className="font-serif font-bold text-[12px] mb-1" style={{ color: "#a35b00" }}>
                            ⚠ {t("card_traps")}
                          </div>
                          <div className="text-[13px] leading-[1.55] whitespace-pre-line" style={{ color: "#5c3b00" }}>{inline(traps)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Final slot */}
          <div
            key="final"
            ref={(el) => (slotRefs.current[cards.length] = el)}
            className="absolute inset-0 z-10"
            style={{ display: current === cards.length ? "block" : "none", pointerEvents: current === cards.length ? "auto" : "none" }}
          >
            <div className="relative w-full h-full">
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
                <div className="deck-sweep absolute inset-0 overflow-hidden pointer-events-none">
                  <i className="absolute top-[-30%] left-0 w-[42%] h-[160%] block" style={{ background: "linear-gradient(75deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.42) 48%, rgba(255,255,255,0) 100%)", transform: "translateX(-160%)" }} />
                </div>
                <div className="w-16 h-16 rounded-full bg-ochre-600 flex items-center justify-center mb-4">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#1e2a3a" strokeWidth="3" className="w-[30px] h-[30px]">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="font-serif font-extrabold text-[19px] mb-2">{t("card_lessonDone")}</h2>
                <p className="text-[13px] text-white/65 mb-6 max-w-[260px]">{t("card_lessonDoneSub")}</p>
                <button onClick={onFinish} className="bg-brand-600 text-white font-extrabold text-[14px] px-7 py-3.5 rounded-xl">
                  {t("card_startPractice")} →
                </button>
              </div>
            </div>
          </div>

          {/* Cinematic reveal flash */}
          <div
            ref={vignetteRef}
            className="absolute inset-0 z-[15] pointer-events-none opacity-0"
            style={{ background: "radial-gradient(circle at 50% 52%, rgba(255,222,150,.55) 0%, rgba(245,197,24,.18) 32%, rgba(245,197,24,0) 62%)" }}
          />
        </div>
      </div>

    </div>
  );
}
