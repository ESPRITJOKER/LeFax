import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../lib/i18n";
import { HIGHLIGHT_COLORS, type HighlightColor } from "../../lib/lessonContent";

/**
 * The formatting bar from the model the client asked for (Correction N6:
 * "Voici le modèle originel. Tu vois bien la barre qui facilite la mise en
 * page"). Pure presentation: it knows the buttons and their grouping, and
 * reports a command id upwards. {@link MarkupField} owns the text and turns
 * each command into mini-markup.
 *
 * Every control is a real `<button type="button">` with an `aria-label` and a
 * title, and the whole bar is a `role="toolbar"` — the icons alone would be
 * unusable with a screen reader or on hover-less touch devices.
 */
export type MarkupCommand =
  | "undo"
  | "redo"
  | "bold"
  | "italic"
  | "underline"
  | "sup"
  | "sub"
  | "highlight"
  | "ul"
  | "ol"
  | "outdent"
  | "indent"
  | "clear"
  | "link"
  | "image"
  | "video"
  | "math"
  | "chem"
  | "source";

export interface ToolbarState {
  canUndo: boolean;
  canRedo: boolean;
  source: boolean;
  mathOpen: boolean;
  chemOpen: boolean;
}

export function MarkupToolbar({
  onCmd,
  state,
  disabled,
  showImage = true,
  showMedia = true,
}: {
  onCmd: (cmd: MarkupCommand, arg?: string) => void;
  state: ToolbarState;
  disabled?: boolean;
  /** The `[[IMG:]]` button only makes sense where slots can be uploaded. */
  showImage?: boolean;
  /** Maths / chemistry / video — hidden in the very narrow card fields. */
  showMedia?: boolean;
}) {
  const { t } = useI18n();
  const [hlOpen, setHlOpen] = useState(false);
  const hlRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hlOpen) return;
    function onDown(e: MouseEvent) {
      if (!hlRef.current?.contains(e.target as Node)) setHlOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [hlOpen]);

  const B = (p: {
    cmd: MarkupCommand;
    label: string;
    children: React.ReactNode;
    active?: boolean;
    off?: boolean;
  }) => (
    <button
      type="button"
      // Keep the textarea's selection: a mousedown on the button would blur it
      // first, and every command needs selectionStart/End to still be valid.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onCmd(p.cmd)}
      disabled={disabled || p.off}
      title={p.label}
      aria-label={p.label}
      aria-pressed={p.active}
      className={`w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold border transition-colors disabled:opacity-35 ${
        p.active ? "border-brand-600 bg-brand-600/10 text-brand-600" : "border-transparent text-ink-800 hover:bg-ink-100"
      }`}
    >
      {p.children}
    </button>
  );

  const Sep = () => <span className="w-px h-5 bg-border mx-0.5 flex-none" aria-hidden />;

  return (
    <div
      role="toolbar"
      aria-label={t("ed_toolbar")}
      className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-[1.5px] border-b-0 border-ink-300 rounded-t-lg bg-card"
    >
      <B cmd="undo" label={t("ed_undo")} off={!state.canUndo}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v6h6" />
          <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
        </svg>
      </B>
      <B cmd="redo" label={t("ed_redo")} off={!state.canRedo}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 7v6h-6" />
          <path d="M21 13a9 9 0 1 1-3-7.7L21 8" />
        </svg>
      </B>

      <Sep />

      <B cmd="bold" label={t("ed_bold")}>
        <span className="font-serif font-extrabold text-[15px]">B</span>
      </B>
      <B cmd="italic" label={t("ed_italic")}>
        <span className="font-serif italic text-[15px]">I</span>
      </B>
      <B cmd="underline" label={t("ed_underline")}>
        <span className="font-serif underline text-[14px]">U</span>
      </B>
      <B cmd="sup" label={t("ed_sup")}>
        <span className="text-[13px]">
          X<sup className="text-[9px]">2</sup>
        </span>
      </B>
      <B cmd="sub" label={t("ed_sub")}>
        <span className="text-[13px]">
          X<sub className="text-[9px]">2</sub>
        </span>
      </B>

      {/* Highlight: the button applies yellow, the caret picks a colour. */}
      <div className="relative flex items-center" ref={hlRef}>
        <B cmd="highlight" label={t("ed_highlight")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 4l5 5-9 9H6v-5z" />
            <path d="M4 21h16" />
          </svg>
        </B>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setHlOpen((o) => !o)}
          disabled={disabled}
          aria-label={t("ed_highlightColor")}
          aria-expanded={hlOpen}
          title={t("ed_highlightColor")}
          className="w-4 h-8 flex items-center justify-center text-ink-700 border-none bg-transparent disabled:opacity-35"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="w-3 h-3">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {hlOpen && (
          <div className="absolute top-full left-0 z-30 mt-1 p-1.5 rounded-xl border border-border bg-card shadow-[0_10px_24px_-10px_rgba(15,30,60,0.4)] flex gap-1.5">
            {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onCmd("highlight", c);
                  setHlOpen(false);
                }}
                title={c}
                aria-label={c}
                className="w-6 h-6 rounded-md border border-border"
                style={{ background: HIGHLIGHT_COLORS[c] }}
              />
            ))}
          </div>
        )}
      </div>

      <Sep />

      <B cmd="ul" label={t("ed_bulletList")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" strokeLinecap="round">
          <path d="M8 6h13M8 12h13M8 18h13" />
          <circle cx="3.5" cy="6" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="3.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="3.5" cy="18" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      </B>
      <B cmd="ol" label={t("ed_numberList")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" strokeLinecap="round">
          <path d="M9 6h12M9 12h12M9 18h12" />
          <text x="1" y="8" fontSize="7" fill="currentColor" stroke="none">1</text>
          <text x="1" y="14.5" fontSize="7" fill="currentColor" stroke="none">2</text>
          <text x="1" y="21" fontSize="7" fill="currentColor" stroke="none">3</text>
        </svg>
      </B>
      <B cmd="outdent" label={t("ed_outdent")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 6h10M11 12h10M11 18h10M7 9l-4 3 4 3" />
        </svg>
      </B>
      <B cmd="indent" label={t("ed_indent")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 6h10M11 12h10M11 18h10M3 9l4 3-4 3" />
        </svg>
      </B>

      <Sep />

      <B cmd="clear" label={t("ed_clearFormat")}>
        <span className="text-[13px] italic line-through">T</span>
      </B>
      <B cmd="link" label={t("ed_link")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
          <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
        </svg>
      </B>
      {showImage && (
        <B cmd="image" label={t("admin_insertImage")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2.5" />
            <circle cx="8.5" cy="9.5" r="1.6" />
            <path d="M21 16l-5-5-6 6-3-3-4 4" />
          </svg>
        </B>
      )}
      {showMedia && (
        <>
          <B cmd="video" label={t("ed_video")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" strokeLinejoin="round">
              <rect x="2.5" y="5" width="19" height="14" rx="3" />
              <path d="M10.5 9.5l4.5 2.5-4.5 2.5z" fill="currentColor" stroke="none" />
            </svg>
          </B>
          <B cmd="math" label={t("te_insertMath")} active={state.mathOpen}>
            <span className="text-[14px]">∑</span>
          </B>
          <B cmd="chem" label={t("fx_titleChem")} active={state.chemOpen}>
            <span className="text-[11px] font-bold">H₂O</span>
          </B>
        </>
      )}

      <div className="flex-1 min-w-0" />

      <B cmd="source" label={t("ed_source")} active={state.source}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
        </svg>
      </B>
    </div>
  );
}
