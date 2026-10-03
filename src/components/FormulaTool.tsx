import { useEffect, useRef, useState } from "react";
import { Icon } from "../lib/icons";
import { useI18n } from "../lib/i18n";
import { Math, texError, MATH_PALETTE, CHEM_PALETTE } from "../lib/math";

/**
 * Drop `snippet` into a textarea/input at the caret, on its own line when the
 * snippet is a block construct. Returns the new value plus the selection the
 * caller should restore, so the author can type straight over a placeholder.
 *
 * Generalised from AdminLessonEditor's `insertImagePlaceholder` (Correction N3:
 * "je n'arrive toujours pas à insérer d'image") so the image, maths and
 * chemistry tools all behave the same way.
 */
export function insertSnippet(
  el: HTMLTextAreaElement | HTMLInputElement | null,
  value: string,
  snippet: string,
  select?: string
): { next: string; start: number; end: number } {
  const pos = el ? (el.selectionStart ?? value.length) : value.length;
  const endPos = el ? (el.selectionEnd ?? pos) : pos;
  const before = value.slice(0, pos);
  const after = value.slice(endPos);
  const block = snippet.includes("\n") || snippet.startsWith("$$");
  const lead = block && before && !before.endsWith("\n") ? "\n" : "";
  const trail = block && after && !after.startsWith("\n") ? "\n" : "";
  const next = `${before}${lead}${snippet}${trail}${after}`;

  const insertedAt = before.length + lead.length;
  if (select) {
    const rel = snippet.indexOf(select);
    if (rel >= 0) return { next, start: insertedAt + rel, end: insertedAt + rel + select.length };
  }
  const caret = insertedAt + snippet.length;
  return { next, start: caret, end: caret };
}

/**
 * Wrap the current selection in a paired mark (`**…**`, `==…==`, `^…^`…) and
 * return the same `{next, start, end}` shape as {@link insertSnippet}, so both
 * go through `applyInsert`.
 *
 * Three behaviours the formatting toolbar needs:
 *  - nothing selected → insert the empty pair and put the caret between the
 *    marks, so the author just keeps typing;
 *  - selection already wrapped → UNWRAP it, so the button toggles rather than
 *    stacking `****bold****` on a second click;
 *  - otherwise → wrap, leaving the text selected so another button can be
 *    applied on top of it.
 */
export function wrapSelection(
  el: HTMLTextAreaElement | HTMLInputElement | null,
  value: string,
  before: string,
  after: string = before
): { next: string; start: number; end: number } {
  const start = el?.selectionStart ?? value.length;
  const end = el?.selectionEnd ?? start;
  const selected = value.slice(start, end);

  // Already wrapped — either inside the selection or just around it.
  if (selected.startsWith(before) && selected.endsWith(after) && selected.length >= before.length + after.length) {
    const inner = selected.slice(before.length, selected.length - after.length);
    return { next: value.slice(0, start) + inner + value.slice(end), start, end: start + inner.length };
  }
  const outerStart = start - before.length;
  if (outerStart >= 0 && value.slice(outerStart, start) === before && value.slice(end, end + after.length) === after) {
    return {
      next: value.slice(0, outerStart) + selected + value.slice(end + after.length),
      start: outerStart,
      end: outerStart + selected.length,
    };
  }

  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  return selected
    ? { next, start: start + before.length, end: start + before.length + selected.length }
    : { next, start: start + before.length, end: start + before.length };
}

/**
 * Rewrite every line touched by the selection. Used by the list, indent and
 * outdent buttons; the selection is restored across the whole rewritten range
 * so the author can press the button again on the same block.
 */
export function mapSelectedLines(
  el: HTMLTextAreaElement | HTMLInputElement | null,
  value: string,
  fn: (line: string, index: number) => string
): { next: string; start: number; end: number } {
  const selStart = el?.selectionStart ?? value.length;
  const selEnd = el?.selectionEnd ?? selStart;
  const lineStart = value.lastIndexOf("\n", selStart - 1) + 1;
  const lineEndIdx = value.indexOf("\n", selEnd);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;

  const block = value.slice(lineStart, lineEnd);
  const rewritten = block.split("\n").map(fn).join("\n");
  return { next: value.slice(0, lineStart) + rewritten + value.slice(lineEnd), start: lineStart, end: lineStart + rewritten.length };
}

/** Apply an `insertSnippet` result to a controlled field and restore the caret. */
export function applyInsert(
  el: HTMLTextAreaElement | HTMLInputElement | null,
  result: { next: string; start: number; end: number },
  setValue: (v: string) => void
) {
  setValue(result.next);
  requestAnimationFrame(() => {
    if (!el) return;
    el.focus();
    el.setSelectionRange(result.start, result.end);
  });
}

/**
 * The maths / chemistry insert panel: a template palette, a LaTeX field with a
 * live typeset preview and a validity message, then Insert. Authors who know
 * TeX type it; authors who don't pick a template and edit the placeholders.
 */
export function FormulaTool({
  mode,
  onInsert,
  onClose,
}: {
  mode: "math" | "chem";
  onInsert: (snippet: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const isChem = mode === "chem";
  const [expr, setExpr] = useState(isChem ? "\\ce{}" : "");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const palette = isChem ? CHEM_PALETTE : MATH_PALETTE;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // What the author typed, as it will be stored in the lesson: a bare TeX body
  // gets wrapped in `$…$`, while `$$…$$` / `\ce{…}` are already complete.
  const wrapped = (() => {
    const v = expr.trim();
    if (!v) return "";
    if (v.startsWith("$") || v.startsWith("\\ce{") || v.startsWith("\\pu{")) return v;
    return `$${v}$`;
  })();

  // Preview needs the naked TeX, whatever form the author used.
  const previewTex = (() => {
    const v = wrapped;
    if (v.startsWith("$$") && v.endsWith("$$")) return { tex: v.slice(2, -2), display: true };
    if (v.startsWith("$") && v.endsWith("$")) return { tex: v.slice(1, -1), display: false };
    return { tex: v, display: false };
  })();

  const error = texError(previewTex.tex, previewTex.display);

  return (
    <div className="rounded-2xl border-[1.5px] border-brand-600/40 bg-white p-4 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="wand" size={15} className="text-brand-600" />
        <div className="text-[12.5px] font-bold text-ink-900">{isChem ? t("fx_titleChem") : t("fx_titleMath")}</div>
        <div className="flex-1" />
        <button type="button" onClick={onClose} aria-label={t("common_cancel")} className="p-1 rounded-md border border-border text-ink-700">
          <Icon name="close" size={13} />
        </button>
      </div>

      <div className="text-[11px] font-bold text-muted mb-1.5">{t("fx_palette")}</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {palette.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setExpr(p.snippet)}
            title={p.label}
            className="px-2 py-1 rounded-lg border border-border bg-white hover:bg-ink-50 text-[12px] text-ink-800 flex items-center"
          >
            <Math tex={p.preview} />
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5 mb-3">
        <span className="text-[11px] font-bold text-muted">{t("fx_expression")}</span>
        <textarea
          ref={inputRef}
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          rows={3}
          spellCheck={false}
          className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 text-[12.5px] font-mono leading-relaxed resize-y"
        />
      </label>

      <div className="text-[11px] font-bold text-muted mb-1.5">{t("fx_preview")}</div>
      <div
        aria-live="polite"
        className={`rounded-xl border px-3 py-3 min-h-[52px] flex items-center justify-center text-center ${
          error ? "border-danger-600/40 bg-danger-600/5" : "border-border bg-ink-50"
        }`}
      >
        {!expr.trim() ? (
          <span className="text-[11.5px] text-muted">{t("fx_empty")}</span>
        ) : error ? (
          <span className="text-[11.5px] font-semibold text-danger-600">
            {t("fx_invalid")}: {error}
          </span>
        ) : (
          <Math tex={previewTex.tex} display={previewTex.display} />
        )}
      </div>

      <div className="flex gap-2 mt-3">
        <button
          type="button"
          disabled={!wrapped || !!error}
          onClick={() => {
            onInsert(wrapped);
            onClose();
          }}
          className="border-none px-4 py-2 rounded-xl text-[12.5px] font-bold bg-brand-600 text-white disabled:opacity-50"
        >
          {t("fx_insert")}
        </button>
        <button type="button" onClick={onClose} className="border border-border bg-white px-4 py-2 rounded-xl text-[12.5px] font-bold text-ink-900">
          {t("common_cancel")}
        </button>
      </div>
    </div>
  );
}
