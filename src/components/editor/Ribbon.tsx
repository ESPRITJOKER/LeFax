import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "../../lib/i18n";
import { HIGHLIGHT_COLORS, type CellAlign, type HighlightColor } from "../../lib/markupSyntax";
import type { BlockStyle } from "./markupCommands";
import { capabilitiesFor, type MarkupCmd, type RibbonState, type RibbonVariant } from "./ribbonTypes";

/**
 * The formatting ribbon — the word-processor bar the client asked for: grouped,
 * captioned sections with dropdown galleries, a table grid picker, and dedicated
 * buttons for every construct the format has, instead of the flat row of 19
 * icons it replaces.
 *
 * It is pure presentation. It knows the buttons, their grouping and their
 * pressed states, and reports a {@link MarkupCmd} upwards; `MarkupField` owns the
 * text and turns each command into markup via the pure functions in
 * `markupCommands.ts`.
 *
 * Two constraints shape the layout. Every control is a real
 * `<button type="button">` with `aria-label`, `title` and `aria-pressed`, inside
 * `role="group"`s under one `role="toolbar"` — the icons alone would be unusable
 * with a screen reader or on a hover-less touch device. And every button does
 * `onMouseDown={e => e.preventDefault()}`, because a mousedown that moved focus
 * would collapse the textarea's selection before the command could read it.
 *
 * Vertical budget is deliberate: the editor sits beside a 560px phone preview, so
 * the group captions only appear from `xl` up and the whole bar wraps. Adding a
 * second permanent strip of chrome above a 340px field is exactly the "c'est un
 * peu compliqué" the N6 rebuild was answering.
 *
 * No Tailwind opacity modifiers anywhere in this file. This project's colour
 * tokens are bare `var(--color-…)` values, which Tailwind cannot parse, so it
 * drops a class like `bg-brand-600/10` from the stylesheet **entirely** — which
 * is why the old toolbar's "active" state (`bg-brand-600/10 text-brand-600`) was
 * invisible. Pressed states here use solid tokens that work in both themes.
 */

/* ───────────────────────── small building blocks ───────────────────────── */

function Btn({
  label,
  onClick,
  children,
  active,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`h-8 min-w-[32px] px-1.5 rounded-lg flex items-center justify-center text-[13px] font-bold border transition-colors disabled:opacity-35 ${
        active
          ? "border-brand-600 bg-ink-100 text-brand-600"
          : danger
            ? "border-transparent text-danger-600 hover:bg-ink-100"
            : "border-transparent text-ink-800 hover:bg-ink-100"
      }`}
    >
      {children}
    </button>
  );
}

/** A labelled group of controls — the thing that makes this read as a ribbon. */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col">
      <div className="flex items-center gap-0.5 flex-wrap">{children}</div>
      <span className="hidden xl:block text-[9px] font-bold uppercase tracking-wide text-muted text-center mt-0.5 leading-none">
        {label}
      </span>
    </div>
  );
}

function Sep() {
  return <span className="w-px self-stretch my-1 bg-border mx-1 flex-none" aria-hidden />;
}

/**
 * An anchored dropdown. Generalised from the old highlight-colour popover, which
 * already had the right bones: outside-mousedown to close, and no focus stealing.
 * It stays in flow rather than portalling — the editor column has no clipping
 * ancestor — so it correctly goes dead with the editor's `disabled` fieldset.
 */
function Menu({
  label,
  trigger,
  children,
  disabled,
  active,
  wide,
}: {
  label: string;
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  disabled?: boolean;
  active?: boolean;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative flex items-center" ref={box}>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        title={label}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        className={`h-8 px-2 rounded-lg flex items-center gap-1 text-[12px] font-bold border transition-colors disabled:opacity-35 ${
          open || active ? "border-brand-600 bg-ink-100 text-brand-600" : "border-transparent text-ink-800 hover:bg-ink-100"
        }`}
      >
        {trigger}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="w-2.5 h-2.5 flex-none" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute top-full left-0 z-30 mt-1 p-1.5 rounded-xl border border-border bg-card shadow-[0_12px_28px_-10px_rgba(15,30,60,0.45)] ${
            wide ? "w-[232px]" : "min-w-[168px]"
          } max-w-[min(92vw,420px)]`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  children,
  active,
}: {
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[12.5px] border transition-colors ${
        active ? "border-brand-600 bg-ink-100 text-brand-600" : "border-transparent text-ink-800 hover:bg-ink-100"
      }`}
    >
      {children}
    </button>
  );
}

/* ───────────────────────── glyphs ──────────────────────────────────────── */
// Inline SVG rather than `Icon`: the icon set has no table / align / quote /
// divider glyph, and the old toolbar already drew its own this way.

const S = (props: { children: ReactNode; w?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.w ?? 2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    {props.children}
  </svg>
);

const GLYPH = {
  undo: (
    <S>
      <path d="M3 7v6h6" />
      <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
    </S>
  ),
  redo: (
    <S>
      <path d="M21 7v6h-6" />
      <path d="M21 13a9 9 0 1 1-3-7.7L21 8" />
    </S>
  ),
  highlight: (
    <S>
      <path d="M15 4l5 5-9 9H6v-5z" />
      <path d="M4 21h16" />
    </S>
  ),
  ul: (
    <S>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="3.5" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="18" r="1.3" fill="currentColor" stroke="none" />
    </S>
  ),
  ol: (
    <S>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <text x="1" y="8" fontSize="7" fill="currentColor" stroke="none">1</text>
      <text x="1" y="14.5" fontSize="7" fill="currentColor" stroke="none">2</text>
      <text x="1" y="21" fontSize="7" fill="currentColor" stroke="none">3</text>
    </S>
  ),
  outdent: (
    <S>
      <path d="M11 6h10M11 12h10M11 18h10M7 9l-4 3 4 3" />
    </S>
  ),
  indent: (
    <S>
      <path d="M11 6h10M11 12h10M11 18h10M3 9l4 3-4 3" />
    </S>
  ),
  alignLeft: (
    <S>
      <path d="M3 6h18M3 12h11M3 18h15" />
    </S>
  ),
  alignCenter: (
    <S>
      <path d="M3 6h18M6.5 12h11M4.5 18h15" />
    </S>
  ),
  alignRight: (
    <S>
      <path d="M3 6h18M10 12h11M6 18h15" />
    </S>
  ),
  quote: (
    <S>
      <path d="M7 7H4v5h3c0 2.2-1 3.4-3 4" />
      <path d="M17 7h-3v5h3c0 2.2-1 3.4-3 4" />
    </S>
  ),
  divider: (
    <S>
      <path d="M3 12h18" />
      <path d="M6 7h12M6 17h12" strokeDasharray="2 3" />
    </S>
  ),
  link: (
    <S>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </S>
  ),
  image: (
    <S>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M21 16l-5-5-6 6-3-3-4 4" />
    </S>
  ),
  video: (
    <S>
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="M10.5 9.5l4.5 2.5-4.5 2.5z" fill="currentColor" stroke="none" />
    </S>
  ),
  table: (
    <S>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M3 15h18M9 4v16M15 4v16" />
    </S>
  ),
  rowAbove: (
    <S>
      <path d="M4 14h16M4 19h16" />
      <path d="M12 3v7M8.5 6.5h7" />
    </S>
  ),
  rowBelow: (
    <S>
      <path d="M4 5h16M4 10h16" />
      <path d="M12 14v7M8.5 17.5h7" />
    </S>
  ),
  colLeft: (
    <S>
      <path d="M14 4v16M19 4v16" />
      <path d="M6 8v8M2.5 12h7" />
    </S>
  ),
  colRight: (
    <S>
      <path d="M5 4v16M10 4v16" />
      <path d="M18 8v8M14.5 12h7" />
    </S>
  ),
  delRow: (
    <S>
      <path d="M4 9h16M4 15h16" />
      <path d="M9 19l6 0" />
    </S>
  ),
  delCol: (
    <S>
      <path d="M9 4v16M15 4v16" />
      <path d="M19 9v6" />
    </S>
  ),
  clear: (
    <S>
      <path d="M4 7h11M9 7l-2 12M13 7l1 6" />
      <path d="M15 15l5 5M20 15l-5 5" />
    </S>
  ),
  source: (
    <S>
      <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
    </S>
  ),
};

/* ───────────────────────── the table grid picker ───────────────────────── */

const GRID_ROWS = 6;
const GRID_COLS = 7;

function TableGrid({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const { t } = useI18n();
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const size = hover ? `${hover.r} × ${hover.c}` : `— × —`;

  return (
    <div>
      <div className="text-[10.5px] font-bold text-muted mb-1.5 px-0.5">{t("ed_tableSize").replace("{n}", size)}</div>
      <div
        className="grid gap-[3px] px-0.5"
        style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
        onMouseLeave={() => setHover(null)}
      >
        {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => {
          const r = Math.floor(i / GRID_COLS) + 1;
          const c = (i % GRID_COLS) + 1;
          const on = hover !== null && r <= hover.r && c <= hover.c;
          return (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHover({ r, c })}
              onFocus={() => setHover({ r, c })}
              onClick={() => onPick(r, c)}
              aria-label={`${r} × ${c}`}
              className={`w-[22px] h-[18px] rounded-[3px] border ${on ? "border-brand-600 bg-ink-100" : "border-ink-300 bg-card"}`}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── the ribbon ──────────────────────────────────── */

export function Ribbon({
  onCmd,
  state,
  disabled,
  variant = "lesson",
}: {
  onCmd: (cmd: MarkupCmd) => void;
  state: RibbonState;
  disabled?: boolean;
  variant?: RibbonVariant;
}) {
  const { t } = useI18n();
  const can = capabilitiesFor(variant);

  const STYLE_LABEL: Record<BlockStyle, string> = {
    p: t("ed_styleNormal"),
    h1: t("ed_styleH1"),
    h2: t("ed_styleH2"),
    h3: t("ed_styleH3"),
  };
  // Each gallery entry is a SAMPLE of the style it applies. A ribbon over a text
  // field cannot preview the style on the author's actual selection the way Word
  // does; the live phone pane is what does that, and it already exists.
  const STYLE_SAMPLE: Record<BlockStyle, string> = {
    p: "text-[12.5px]",
    h1: "font-serif font-bold text-[17px]",
    h2: "font-serif font-bold text-[15px]",
    h3: "font-bold text-[13px]",
  };
  const ALIGN_GLYPH: Record<CellAlign, ReactNode> = {
    left: GLYPH.alignLeft,
    center: GLYPH.alignCenter,
    right: GLYPH.alignRight,
  };
  const ALIGN_LABEL: Record<CellAlign, string> = {
    left: t("ed_alignLeft"),
    center: t("ed_alignCenter"),
    right: t("ed_alignRight"),
  };

  return (
    <div
      role="toolbar"
      aria-label={t("ed_toolbar")}
      aria-orientation="horizontal"
      className="flex items-start gap-0.5 flex-wrap px-2 py-1.5 border-[1.5px] border-b-0 border-ink-300 rounded-t-lg bg-card"
    >
      <Group label={t("ed_grpHistory")}>
        <Btn label={t("ed_undo")} onClick={() => onCmd({ k: "history", dir: "undo" })} disabled={disabled || !state.canUndo}>
          {GLYPH.undo}
        </Btn>
        <Btn label={t("ed_redo")} onClick={() => onCmd({ k: "history", dir: "redo" })} disabled={disabled || !state.canRedo}>
          {GLYPH.redo}
        </Btn>
        <Btn label={t("ed_clearFormat")} onClick={() => onCmd({ k: "clear" })} disabled={disabled}>
          {GLYPH.clear}
        </Btn>
      </Group>

      {can.styles && (
        <>
          <Sep />
          <Group label={t("ed_grpStyle")}>
            <Menu
              label={t("ed_style")}
              disabled={disabled}
              wide
              trigger={<span className="truncate max-w-[72px]">{STYLE_LABEL[state.style]}</span>}
            >
              {(close) => (
                <>
                  {(["p", "h1", "h2", "h3"] as BlockStyle[]).map((s) => (
                    <MenuItem
                      key={s}
                      active={state.style === s}
                      onClick={() => {
                        onCmd({ k: "style", style: s });
                        close();
                      }}
                    >
                      <span className={STYLE_SAMPLE[s]}>{STYLE_LABEL[s]}</span>
                    </MenuItem>
                  ))}
                </>
              )}
            </Menu>
            <Btn label={t("ed_quote")} onClick={() => onCmd({ k: "quote" })} active={state.quote} disabled={disabled}>
              {GLYPH.quote}
            </Btn>
            <Btn label={t("ed_divider")} onClick={() => onCmd({ k: "divider" })} disabled={disabled}>
              {GLYPH.divider}
            </Btn>
          </Group>
        </>
      )}

      <Sep />

      <Group label={t("ed_grpFont")}>
        <Btn label={t("ed_bold")} onClick={() => onCmd({ k: "wrap", mark: "bold" })} disabled={disabled}>
          <span className="font-serif font-extrabold text-[15px]">B</span>
        </Btn>
        <Btn label={t("ed_italic")} onClick={() => onCmd({ k: "wrap", mark: "italic" })} disabled={disabled}>
          <span className="font-serif italic text-[15px]">I</span>
        </Btn>
        <Btn label={t("ed_underline")} onClick={() => onCmd({ k: "wrap", mark: "underline" })} disabled={disabled}>
          <span className="font-serif underline text-[14px]">U</span>
        </Btn>
        <Btn label={t("ed_strike")} onClick={() => onCmd({ k: "wrap", mark: "strike" })} disabled={disabled}>
          <span className="font-serif line-through text-[14px]">S</span>
        </Btn>
        <Btn label={t("ed_sup")} onClick={() => onCmd({ k: "wrap", mark: "sup" })} disabled={disabled}>
          <span className="text-[13px]">
            X<sup className="text-[9px]">2</sup>
          </span>
        </Btn>
        <Btn label={t("ed_sub")} onClick={() => onCmd({ k: "wrap", mark: "sub" })} disabled={disabled}>
          <span className="text-[13px]">
            X<sub className="text-[9px]">2</sub>
          </span>
        </Btn>
        <Btn label={t("ed_code")} onClick={() => onCmd({ k: "wrap", mark: "code" })} disabled={disabled}>
          <span className="font-mono text-[12px]">{"</>"}</span>
        </Btn>
        <Btn label={t("ed_highlight")} onClick={() => onCmd({ k: "highlight", color: "jaune" })} disabled={disabled}>
          {GLYPH.highlight}
        </Btn>
        <Menu label={t("ed_highlightColor")} disabled={disabled} trigger={<span className="sr-only">{t("ed_highlightColor")}</span>}>
          {(close) => (
            <div className="flex gap-1.5">
              {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onCmd({ k: "highlight", color: c });
                    close();
                  }}
                  title={c}
                  aria-label={c}
                  className="w-7 h-7 rounded-md border border-border"
                  style={{ background: HIGHLIGHT_COLORS[c] }}
                />
              ))}
            </div>
          )}
        </Menu>
      </Group>

      {can.paragraph && (
        <>
          <Sep />
          <Group label={t("ed_grpParagraph")}>
            <Btn label={t("ed_bulletList")} onClick={() => onCmd({ k: "list", ordered: false })} disabled={disabled}>
              {GLYPH.ul}
            </Btn>
            <Btn label={t("ed_numberList")} onClick={() => onCmd({ k: "list", ordered: true })} disabled={disabled}>
              {GLYPH.ol}
            </Btn>
            <Btn label={t("ed_outdent")} onClick={() => onCmd({ k: "shift", dir: -1 })} disabled={disabled}>
              {GLYPH.outdent}
            </Btn>
            <Btn label={t("ed_indent")} onClick={() => onCmd({ k: "shift", dir: 1 })} disabled={disabled}>
              {GLYPH.indent}
            </Btn>
            <Menu
              label={t("ed_align")}
              disabled={disabled}
              active={state.align !== "left"}
              trigger={<span className="w-4 h-4 flex items-center justify-center">{ALIGN_GLYPH[state.align]}</span>}
            >
              {(close) => (
                <>
                  {(["left", "center", "right"] as CellAlign[]).map((a) => (
                    <MenuItem
                      key={a}
                      active={state.align === a}
                      onClick={() => {
                        onCmd({ k: "align", align: a });
                        close();
                      }}
                    >
                      <span className="flex items-center gap-2">
                        {ALIGN_GLYPH[a]}
                        {ALIGN_LABEL[a]}
                      </span>
                    </MenuItem>
                  ))}
                </>
              )}
            </Menu>
          </Group>
        </>
      )}

      {can.boxes && (
        <>
          <Sep />
          <Group label={t("ed_grpBoxes")}>
            <Btn label={t("ed_boxPiege")} onClick={() => onCmd({ k: "box", kind: "piege" })} active={state.box === "piege"} disabled={disabled}>
              <span className="text-[13px]">⚠</span>
            </Btn>
            <Btn label={t("ed_boxInfo")} onClick={() => onCmd({ k: "box", kind: "info" })} active={state.box === "info"} disabled={disabled}>
              <span className="text-[13px]">ℹ</span>
            </Btn>
            <Btn label={t("ed_boxApp")} onClick={() => onCmd({ k: "box", kind: "app" })} active={state.box === "app"} disabled={disabled}>
              <span className="text-[12px]">✎</span>
            </Btn>
          </Group>
        </>
      )}

      <Sep />

      <Group label={t("ed_grpInsert")}>
        {can.image && (
          <Btn label={t("ed_image")} onClick={() => onCmd({ k: "dialog", dialog: "image" })} disabled={disabled}>
            {GLYPH.image}
          </Btn>
        )}
        {can.tables && (
          <Menu label={t("ed_table")} disabled={disabled} wide trigger={<span className="w-4 h-4">{GLYPH.table}</span>}>
            {(close) => (
              <TableGrid
                onPick={(rows, cols) => {
                  onCmd({ k: "insertTable", rows, cols });
                  close();
                }}
              />
            )}
          </Menu>
        )}
        <Btn label={t("ed_link")} onClick={() => onCmd({ k: "dialog", dialog: "link" })} disabled={disabled}>
          {GLYPH.link}
        </Btn>
        {can.video && (
          <Btn label={t("ed_video")} onClick={() => onCmd({ k: "dialog", dialog: "video" })} disabled={disabled}>
            {GLYPH.video}
          </Btn>
        )}
        {can.formulas && (
          <>
            <Btn
              label={t("te_insertMath")}
              onClick={() => onCmd({ k: "panel", panel: state.panel === "math" ? null : "math" })}
              active={state.panel === "math"}
              disabled={disabled}
            >
              <span className="text-[14px]">∑</span>
            </Btn>
            <Btn
              label={t("fx_titleChem")}
              onClick={() => onCmd({ k: "panel", panel: state.panel === "chem" ? null : "chem" })}
              active={state.panel === "chem"}
              disabled={disabled}
            >
              <span className="text-[11px] font-bold">H₂O</span>
            </Btn>
            <Btn
              label={t("ed_symbol")}
              onClick={() => onCmd({ k: "panel", panel: state.panel === "symbol" ? null : "symbol" })}
              active={state.panel === "symbol"}
              disabled={disabled}
            >
              <span className="text-[14px]">Ω</span>
            </Btn>
          </>
        )}
      </Group>

      <div className="flex-1 min-w-0" />

      <Btn label={t("ed_source")} onClick={() => onCmd({ k: "source" })} active={state.source}>
        {GLYPH.source}
      </Btn>
    </div>
  );
}

/**
 * The table group, revealed only while the caret is inside a table — the same
 * idea as Word's table tabs, and the reason `MarkupField` tracks the caret.
 */
export function TableTools({ onCmd, disabled }: { onCmd: (cmd: MarkupCmd) => void; disabled?: boolean }) {
  const { t } = useI18n();
  const ALIGN_LABEL: Record<CellAlign, string> = {
    left: t("ed_alignLeft"),
    center: t("ed_alignCenter"),
    right: t("ed_alignRight"),
  };
  return (
    <div
      role="toolbar"
      aria-label={t("ed_grpTable")}
      className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-x-[1.5px] border-t-[1.5px] border-brand-600 bg-ink-50"
    >
      <span className="text-[9.5px] font-bold uppercase tracking-wide text-brand-600 mr-1.5">{t("ed_grpTable")}</span>
      <Btn label={t("ed_tableRowAbove")} onClick={() => onCmd({ k: "table", op: { op: "addRow", where: "above" } })} disabled={disabled}>
        {GLYPH.rowAbove}
      </Btn>
      <Btn label={t("ed_tableRowBelow")} onClick={() => onCmd({ k: "table", op: { op: "addRow", where: "below" } })} disabled={disabled}>
        {GLYPH.rowBelow}
      </Btn>
      <Btn label={t("ed_tableColLeft")} onClick={() => onCmd({ k: "table", op: { op: "addCol", where: "left" } })} disabled={disabled}>
        {GLYPH.colLeft}
      </Btn>
      <Btn label={t("ed_tableColRight")} onClick={() => onCmd({ k: "table", op: { op: "addCol", where: "right" } })} disabled={disabled}>
        {GLYPH.colRight}
      </Btn>
      <Sep />
      <Btn label={t("ed_tableDelRow")} onClick={() => onCmd({ k: "table", op: { op: "delRow" } })} disabled={disabled} danger>
        {GLYPH.delRow}
      </Btn>
      <Btn label={t("ed_tableDelCol")} onClick={() => onCmd({ k: "table", op: { op: "delCol" } })} disabled={disabled} danger>
        {GLYPH.delCol}
      </Btn>
      <Sep />
      <Menu label={t("ed_tableColAlign")} disabled={disabled} trigger={<span className="w-4 h-4">{GLYPH.alignCenter}</span>}>
        {(close) => (
          <>
            {(["left", "center", "right"] as CellAlign[]).map((a) => (
              <MenuItem
                key={a}
                onClick={() => {
                  onCmd({ k: "table", op: { op: "colAlign", align: a } });
                  close();
                }}
              >
                {ALIGN_LABEL[a]}
              </MenuItem>
            ))}
          </>
        )}
      </Menu>
      <Btn label={t("ed_tableToggleHeader")} onClick={() => onCmd({ k: "table", op: { op: "toggleHeader" } })} disabled={disabled}>
        <span className="text-[11px] font-bold">T</span>
      </Btn>
    </div>
  );
}
