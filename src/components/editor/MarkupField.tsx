import { useCallback, useRef, useState } from "react";
import { useI18n } from "../../lib/i18n";
import { FormulaTool, applyInsert, insertSnippet, mapSelectedLines, wrapSelection } from "../FormulaTool";
import { MarkupToolbar, type MarkupCommand, type ToolbarState } from "./MarkupToolbar";

/**
 * One text field with the formatting bar above it — the editing unit the client
 * asked for (Correction N6: a toolbar that makes layout easy, and the change
 * visible straight away in the preview beside it).
 *
 * It stays a plain `<textarea>` over the project's existing line-based
 * mini-markup rather than becoming a contentEditable WYSIWYG, deliberately:
 * the very same markup is parsed by the student renderers (`LessonContent`,
 * `RichCardText`), by the AI content pipeline and by every row already in the
 * database. A toolbar that writes that markup gives the author the convenience
 * without forking the format — nothing has to be migrated, and what the live
 * preview shows is literally what the student will get.
 *
 * Undo/redo is ours because `document.execCommand`-free programmatic writes
 * destroy the browser's native textarea history: the moment a toolbar button
 * sets the value, Ctrl+Z would jump back past everything.
 */

interface Snapshot {
  value: string;
  start: number;
  end: number;
}

/** Typing within this window folds into the previous undo step. */
const COALESCE_MS = 700;

export interface MarkupFieldProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  rows?: number;
  minHeight?: number;
  placeholder?: string;
  /** Label rendered above the bar; omit when the caller provides its own. */
  label?: string;
  /** Show the `[[IMG:]]` button (lesson body only — cards have one image). */
  showImage?: boolean;
  /** Show video / maths / chemistry (off for the short card fields). */
  showMedia?: boolean;
  /** Called instead of the default `[[IMG: description]]` insertion. */
  onInsertImage?: () => void;
  /**
   * Reveal the bar only while the field is being edited. The card editor has
   * five rich fields on screen at once; five permanent toolbars is exactly the
   * "c'est un peu compliqué" the client complained about, so there only the
   * focused field shows its bar — as in the reference screenshot, where one
   * editor has one toolbar.
   */
  toolbarOnFocus?: boolean;
  className?: string;
}

export function MarkupField({
  value,
  onChange,
  disabled,
  rows = 14,
  minHeight = 260,
  placeholder,
  label,
  showImage = true,
  showMedia = true,
  onInsertImage,
  toolbarOnFocus = false,
  className = "",
}: MarkupFieldProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLTextAreaElement>(null);
  const hist = useRef<{ past: Snapshot[]; future: Snapshot[]; at: number }>({ past: [], future: [], at: 0 });
  const [, bump] = useState(0);
  const [tool, setTool] = useState<null | "math" | "chem">(null);
  const [source, setSource] = useState(false);
  const [focused, setFocused] = useState(false);
  const [prompt, setPrompt] = useState<null | { kind: "link" | "video"; url: string; text: string }>(null);

  const snap = useCallback(
    (): Snapshot => ({ value, start: ref.current?.selectionStart ?? value.length, end: ref.current?.selectionEnd ?? value.length }),
    [value]
  );

  /** Record the pre-mutation state. `coalesce` folds consecutive keystrokes. */
  const push = useCallback(
    (coalesce: boolean) => {
      const h = hist.current;
      const now = Date.now();
      if (coalesce && h.past.length > 0 && now - h.at < COALESCE_MS) {
        h.at = now;
        return;
      }
      h.past.push(snap());
      if (h.past.length > 100) h.past.shift();
      h.future = [];
      h.at = now;
      bump((n) => n + 1);
    },
    [snap]
  );

  const restore = useCallback(
    (s: Snapshot) => {
      onChange(s.value);
      requestAnimationFrame(() => {
        ref.current?.focus();
        ref.current?.setSelectionRange(s.start, s.end);
      });
    },
    [onChange]
  );

  const undo = useCallback(() => {
    const h = hist.current;
    const prev = h.past.pop();
    if (!prev) return;
    h.future.push(snap());
    h.at = 0;
    restore(prev);
    bump((n) => n + 1);
  }, [restore, snap]);

  const redo = useCallback(() => {
    const h = hist.current;
    const next = h.future.pop();
    if (!next) return;
    h.past.push(snap());
    h.at = 0;
    restore(next);
    bump((n) => n + 1);
  }, [restore, snap]);

  /** Apply a `{next,start,end}` edit, recording one undo step. */
  function apply(result: { next: string; start: number; end: number }) {
    push(false);
    applyInsert(ref.current, result, onChange);
  }

  function wrap(before: string, after: string = before) {
    apply(wrapSelection(ref.current, value, before, after));
  }

  /**
   * Toggle a list marker over every selected line. Pressing the same button on
   * an existing list removes it, which is what every editor does and what makes
   * the two list buttons feel like a toggle rather than a stamp.
   */
  function toggleList(ordered: boolean) {
    const marker = /^(\s*)(?:(?:-|•|–)\s+|\d+[.)]\s+)/;
    const el = ref.current;
    const start = el?.selectionStart ?? 0;
    const end = el?.selectionEnd ?? start;
    const from = value.lastIndexOf("\n", start - 1) + 1;
    const toIdx = value.indexOf("\n", end);
    const block = value.slice(from, toIdx === -1 ? value.length : toIdx);
    const alreadyList = block
      .split("\n")
      .filter((l) => l.trim())
      .every((l) => (ordered ? /^\s*\d+[.)]\s+/.test(l) : /^\s*(?:-|•|–)\s+/.test(l)));

    let n = 0;
    apply(
      mapSelectedLines(el, value, (line) => {
        if (!line.trim()) return line;
        const indent = line.match(/^\s*/)?.[0] ?? "";
        // `marker` only strips the indent when there IS a list marker to strip;
        // on a plain line it matches nothing, so the indent must be removed
        // separately or it gets written twice ("  " + "- " + "  alpha").
        const body = line.replace(marker, "").replace(/^\s+/, "");
        if (alreadyList) return indent + body;
        n += 1;
        return `${indent}${ordered ? `${n}. ` : "- "}${body}`;
      })
    );
  }

  function shift(dir: 1 | -1) {
    apply(
      mapSelectedLines(ref.current, value, (line) =>
        dir === 1 ? (line.trim() ? `  ${line}` : line) : line.replace(/^ {1,2}/, "")
      )
    );
  }

  /** Strip every inline mark from the selection (the "T̶" button). */
  function clearFormat() {
    const el = ref.current;
    const start = el?.selectionStart ?? 0;
    const end = el?.selectionEnd ?? start;
    if (start === end) return;
    const plain = value
      .slice(start, end)
      .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, "$1")
      .replace(/\*\*([^*]+?)\*\*/g, "$1")
      .replace(/==(?:(?:jaune|vert|bleu|rose)\|)?([^=]+?)==/g, "$1")
      .replace(/__([^_]+?)__/g, "$1")
      .replace(/\*([^\s*][^*]*?)\*/g, "$1")
      .replace(/_([^\s_][^_]*?)_/g, "$1")
      .replace(/\^([^\s^]+)\^/g, "$1")
      .replace(/~([^\s~]+)~/g, "$1");
    apply({ next: value.slice(0, start) + plain + value.slice(end), start, end: start + plain.length });
  }

  function openPrompt(kind: "link" | "video") {
    const el = ref.current;
    const selected = value.slice(el?.selectionStart ?? 0, el?.selectionEnd ?? 0);
    setPrompt({ kind, url: "", text: selected });
  }

  function confirmPrompt() {
    if (!prompt) return;
    const url = prompt.url.trim();
    if (!url) return;
    if (prompt.kind === "video") {
      apply(insertSnippet(ref.current, value, `[[VIDEO: ${url}]]`));
    } else {
      const label2 = prompt.text.trim() || url;
      // Replace the selection when there was one, otherwise insert at the caret.
      const el = ref.current;
      const start = el?.selectionStart ?? value.length;
      const end = el?.selectionEnd ?? start;
      const snippet = `[${label2}](${url})`;
      apply({ next: value.slice(0, start) + snippet + value.slice(end), start: start + snippet.length, end: start + snippet.length });
    }
    setPrompt(null);
  }

  function onCmd(cmd: MarkupCommand, arg?: string) {
    switch (cmd) {
      case "undo":
        return undo();
      case "redo":
        return redo();
      case "bold":
        return wrap("**");
      case "italic":
        return wrap("*");
      case "underline":
        return wrap("__");
      case "sup":
        return wrap("^");
      case "sub":
        return wrap("~");
      case "highlight":
        return wrap(arg && arg !== "jaune" ? `==${arg}|` : "==", "==");
      case "ul":
        return toggleList(false);
      case "ol":
        return toggleList(true);
      case "indent":
        return shift(1);
      case "outdent":
        return shift(-1);
      case "clear":
        return clearFormat();
      case "link":
        return openPrompt("link");
      case "video":
        return openPrompt("video");
      case "image":
        if (onInsertImage) return onInsertImage();
        return apply(insertSnippet(ref.current, value, "[[IMG: description]]", "description"));
      case "math":
        return setTool((m) => (m === "math" ? null : "math"));
      case "chem":
        return setTool((m) => (m === "chem" ? null : "chem"));
      case "source":
        return setSource((s) => !s);
    }
  }

  // Ctrl/Cmd shortcuts, so the bar is a convenience and not the only way in.
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    const map: Record<string, MarkupCommand> = { b: "bold", i: "italic", u: "underline", k: "link" };
    if (k === "z") {
      e.preventDefault();
      return e.shiftKey ? redo() : undo();
    }
    if (k === "y") {
      e.preventDefault();
      return redo();
    }
    if (map[k]) {
      e.preventDefault();
      onCmd(map[k]);
    }
  }

  const state: ToolbarState = {
    canUndo: hist.current.past.length > 0,
    canRedo: hist.current.future.length > 0,
    source,
    mathOpen: tool === "math",
    chemOpen: tool === "chem",
  };

  // A panel open (link/video prompt, formula tool) keeps the bar on screen even
  // if the textarea itself lost focus to one of its inputs.
  const showToolbar = !toolbarOnFocus || focused || Boolean(prompt) || Boolean(tool);

  return (
    <div
      className={`flex flex-col ${className}`}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      {label && <span className="text-[11.5px] font-bold text-muted mb-1.5">{label}</span>}

      {showToolbar && <MarkupToolbar onCmd={onCmd} state={state} disabled={disabled} showImage={showImage} showMedia={showMedia} />}

      {prompt && (
        <div className="flex flex-wrap items-end gap-2 px-2 py-2 border-x-[1.5px] border-ink-300 bg-ink-50">
          <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <span className="text-[10.5px] font-bold text-muted">{prompt.kind === "video" ? t("ed_videoUrl") : t("ed_linkUrl")}</span>
            <input
              autoFocus
              value={prompt.url}
              onChange={(e) => setPrompt({ ...prompt, url: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmPrompt();
                } else if (e.key === "Escape") setPrompt(null);
              }}
              placeholder="https://..."
              className="px-2.5 py-1.5 rounded-lg border-[1.5px] border-ink-300 bg-card text-[12.5px]"
            />
          </label>
          {prompt.kind === "link" && (
            <label className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <span className="text-[10.5px] font-bold text-muted">{t("ed_linkText")}</span>
              <input
                value={prompt.text}
                onChange={(e) => setPrompt({ ...prompt, text: e.target.value })}
                className="px-2.5 py-1.5 rounded-lg border-[1.5px] border-ink-300 bg-card text-[12.5px]"
              />
            </label>
          )}
          <button type="button" onClick={confirmPrompt} className="border-none px-3.5 py-1.5 rounded-lg text-[12px] font-bold bg-brand-600 text-white">
            {t("fx_insert")}
          </button>
          <button type="button" onClick={() => setPrompt(null)} className="border border-border bg-card px-3 py-1.5 rounded-lg text-[12px] font-bold text-ink-900">
            {t("common_cancel")}
          </button>
        </div>
      )}

      <textarea
        ref={ref}
        value={value}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        spellCheck={!source}
        onKeyDown={onKeyDown}
        onChange={(e) => {
          push(true);
          onChange(e.target.value);
        }}
        style={{ minHeight }}
        className={`px-3 py-2.5 border-[1.5px] border-ink-300 text-[13px] leading-relaxed resize-y bg-card text-text disabled:bg-ink-50 ${
          showToolbar ? "rounded-b-lg" : "rounded-lg"
        } ${source ? "font-mono text-[12.5px]" : ""}`}
      />

      {tool && (
        <FormulaTool
          mode={tool}
          onInsert={(s) => apply(insertSnippet(ref.current, value, s))}
          onClose={() => setTool(null)}
        />
      )}
    </div>
  );
}
