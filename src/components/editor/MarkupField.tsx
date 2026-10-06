import { useCallback, useRef, useState } from "react";
import { useI18n } from "../../lib/i18n";
import { applyInsert, insertSnippet, mapSelectedLines, wrapSelection } from "../FormulaTool";
import { Ribbon, TableTools } from "./Ribbon";
import { InsertPanel } from "./InsertPanel";
import { ImageDialog, LinkDialog } from "./ImageDialog";
import { parse, type ImageOptions } from "../../lib/markupSyntax";
import {
  alignAt,
  blockStyleAt,
  calloutAt,
  imageToken,
  insertBlock,
  insertTable,
  isQuoteAt,
  setAlign,
  setBlockStyle,
  tableAt,
  tableDeleteColumn,
  tableDeleteRow,
  tableInsertColumn,
  tableInsertRow,
  tableSetColumnAlign,
  tableToggleHeader,
  toggleCallout,
  toggleQuote,
  type Edit,
} from "./markupCommands";
import type { MarkupCmd, RibbonDialog, RibbonPanel, RibbonState, RibbonVariant } from "./ribbonTypes";

/**
 * One text field with the formatting ribbon above it — the editing unit the
 * client asked for: "la barre qui facilite la mise en page", with the change
 * visible straight away in the preview beside it.
 *
 * It stays a plain `<textarea>` over the project's line-based mini-markup rather
 * than becoming a contentEditable WYSIWYG, deliberately: the very same markup is
 * parsed by the student renderers (`LessonContent`, `RichCardText`, `inline`), by
 * the AI content pipeline and by every row already in the database. A ribbon that
 * writes that markup gives the author the convenience without forking the format
 * — nothing has to be migrated, and what the live preview shows is literally what
 * the student will get.
 *
 * Undo/redo is ours because programmatic writes destroy the browser's native
 * textarea history: the moment a toolbar button sets the value, Ctrl+Z would jump
 * back past everything.
 *
 * Every string transform lives in `./markupCommands` as a pure function, so the
 * grammar surgery is testable without React and this component stays a router.
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
  /**
   * Which tools this field gets — driven by what the field's READER can render.
   * See `capabilitiesFor` in `./ribbonTypes`; the short version is that a quiz
   * field only renders inline marks, so it must not be offered headings or
   * tables.
   */
  variant?: RibbonVariant;
  /**
   * Supplied by the lesson editor. Without it the image button just inserts a
   * bare `[[IMG: …]]` placeholder for the Illustrations list to fill.
   */
  imageUpload?: {
    /** Binds the file to a stable key (0022) or, keyless, to its position. */
    upload: (target: { key?: string; slot: number }, file: File) => Promise<string | null>;
    /** False until migration 0022 is applied. */
    keysSupported: boolean;
    canEdit: boolean;
  };
  /** Keys already used in this body, so a newly minted one cannot collide. */
  usedImageKeys?: string[];
  /**
   * Reveal the bar only while the field is being edited. The card editor has five
   * rich fields on screen at once; five permanent ribbons is exactly the "c'est un
   * peu compliqué" the client complained about, so there only the focused field
   * shows its bar.
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
  variant = "lesson",
  imageUpload,
  usedImageKeys = [],
  toolbarOnFocus = false,
  className = "",
}: MarkupFieldProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLTextAreaElement>(null);
  const hist = useRef<{ past: Snapshot[]; future: Snapshot[]; at: number }>({ past: [], future: [], at: 0 });
  const [, bump] = useState(0);
  const [panel, setPanel] = useState<RibbonPanel | null>(null);
  const [dialog, setDialog] = useState<RibbonDialog | null>(null);
  const [source, setSource] = useState(false);
  const [focused, setFocused] = useState(false);
  /** Caret, mirrored into state so the ribbon can show pressed states. */
  const [caret, setCaret] = useState(0);

  /**
   * The selection as it was when a dialog or panel opened.
   *
   * Every ribbon BUTTON works because it never takes focus
   * (`onMouseDown preventDefault`), so `selectionStart` is still valid when the
   * command runs. A dialog does take focus — it has inputs — and the textarea's
   * selection collapses, which would land every insertion at index 0. So the
   * live selection is snapshotted before anything focusable opens, and the
   * snapshot is what the commands read until it is applied.
   */
  const pendingSel = useRef<{ start: number; end: number } | null>(null);

  const liveSel = useCallback(() => {
    const el = ref.current;
    return { start: el?.selectionStart ?? value.length, end: el?.selectionEnd ?? value.length };
  }, [value.length]);

  const sel = useCallback(() => pendingSel.current ?? liveSel(), [liveSel]);

  const snap = useCallback((): Snapshot => ({ value, ...liveSel() }), [value, liveSel]);

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
        setCaret(s.start);
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

  /** Apply an `{next,start,end}` edit, recording one undo step. */
  function apply(result: Edit) {
    push(false);
    applyInsert(ref.current, result, onChange);
    // The snapshot has served its purpose; the live selection is authoritative
    // again from here, or the next command would reuse a stale range.
    pendingSel.current = null;
    requestAnimationFrame(() => setCaret(result.start));
  }

  function wrap(before: string, after: string = before) {
    const { start, end } = sel();
    apply(wrapSelection({ selectionStart: start, selectionEnd: end }, value, before, after));
  }

  /**
   * Toggle a list marker over every selected line. Pressing the same button on an
   * existing list removes it, which is what every editor does and what makes the
   * two list buttons feel like a toggle rather than a stamp.
   */
  function toggleList(ordered: boolean) {
    const marker = /^(\s*)(?:(?:-|•|–)\s+|\d+[.)]\s+)/;
    const { start, end } = sel();
    const from = value.lastIndexOf("\n", start - 1) + 1;
    const toIdx = value.indexOf("\n", end);
    const block = value.slice(from, toIdx === -1 ? value.length : toIdx);
    const alreadyList = block
      .split("\n")
      .filter((l) => l.trim())
      .every((l) => (ordered ? /^\s*\d+[.)]\s+/.test(l) : /^\s*(?:-|•|–)\s+/.test(l)));

    let n = 0;
    apply(
      mapSelectedLines({ selectionStart: start, selectionEnd: end }, value, (line) => {
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
    const { start, end } = sel();
    apply(
      mapSelectedLines({ selectionStart: start, selectionEnd: end }, value, (line) =>
        dir === 1 ? (line.trim() ? `  ${line}` : line) : line.replace(/^ {1,2}/, "")
      )
    );
  }

  /**
   * Strip every inline mark from the selection. This is a hand-maintained second
   * copy of the inline grammar in `lib/markupSyntax.ts` — a new inline mark has
   * to be added in both places or "clear formatting" silently leaves it behind.
   */
  function clearFormat() {
    const { start, end } = sel();
    if (start === end) return;
    const plain = value
      .slice(start, end)
      .replace(/`([^`\n]+)`/g, "$1")
      .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, "$1")
      .replace(/\*\*([^*]+?)\*\*/g, "$1")
      .replace(/==(?:(?:jaune|vert|bleu|rose)\|)?([^=]+?)==/g, "$1")
      .replace(/__([^_]+?)__/g, "$1")
      .replace(/~~([^~]+?)~~/g, "$1")
      .replace(/\*([^\s*][^*]*?)\*/g, "$1")
      .replace(/_([^\s_][^_]*?)_/g, "$1")
      .replace(/\^([^\s^]+)\^/g, "$1")
      .replace(/~([^\s~]+)~/g, "$1");
    apply({ next: value.slice(0, start) + plain + value.slice(end), start, end: start + plain.length });
  }

  /** Snapshot the selection, then open something focusable. */
  function openPanel(next: RibbonPanel | null) {
    pendingSel.current = next ? liveSel() : null;
    setDialog(null);
    setPanel(next);
  }

  function openDialog(next: RibbonDialog | null) {
    pendingSel.current = next ? liveSel() : null;
    setPanel(null);
    setDialog(next);
  }

  function closeOverlays() {
    pendingSel.current = null;
    setPanel(null);
    setDialog(null);
  }

  /**
   * Insert the image token, then upload the chosen file to the address that
   * placeholder actually ended up with.
   *
   * The order matters. A keyed placeholder (migration 0022) could be uploaded
   * before insertion, but a KEYLESS one has no address until the token is in the
   * text — its address is its ordinal among the body's `[[IMG:]]` tokens. Doing
   * the insert first means the one code path serves both, which is what makes
   * "add an image here" work on a database where 0022 has not been applied.
   */
  function insertImage(caption: string, options: ImageOptions, file: File | null) {
    const { start, end } = sel();
    const token = imageToken(caption, options);
    const edit = insertBlock(value, start, end, token);
    apply(edit);
    if (!file || !imageUpload) return;
    // `insertBlock` leaves the caret just past the token it wrote.
    const tokenAt = edit.start - token.length;
    // Count the placeholders BEFORE it through the real parser rather than by
    // counting `[[IMG:` substrings: only a token alone on its line is a
    // placeholder, and the slot numbering has to agree with `parse()` exactly or
    // the file binds to the wrong figure.
    const slot = parse(edit.next.slice(0, tokenAt)).filter((b) => b.type === "img").length + 1;
    void imageUpload.upload({ key: options.key, slot }, file);
  }

  function onCmd(cmd: MarkupCmd) {
    const { start, end } = sel();
    switch (cmd.k) {
      case "history":
        return cmd.dir === "undo" ? undo() : redo();
      case "wrap": {
        const MARKS = { bold: "**", italic: "*", underline: "__", strike: "~~", sup: "^", sub: "~", code: "`" } as const;
        return wrap(MARKS[cmd.mark]);
      }
      case "highlight":
        return wrap(cmd.color === "jaune" ? "==" : `==${cmd.color}|`, "==");
      case "style":
        return apply(setBlockStyle(value, start, end, cmd.style));
      case "list":
        return toggleList(cmd.ordered);
      case "shift":
        return shift(cmd.dir);
      case "align":
        return apply(setAlign(value, start, end, cmd.align));
      case "box":
        return apply(toggleCallout(value, start, end, cmd.kind, t("ed_boxAnswer")));
      case "quote":
        return apply(toggleQuote(value, start, end));
      case "divider":
        return apply(insertBlock(value, start, end, "---"));
      case "clear":
        return clearFormat();
      case "insertText":
        return apply(insertSnippet({ selectionStart: start, selectionEnd: end }, value, cmd.text, cmd.select));
      case "panel":
        return openPanel(cmd.panel);
      case "dialog":
        if (cmd.dialog === "image" && !imageUpload) {
          // No upload wiring (card fields, quiz fields): the bare placeholder is
          // still the right thing to write.
          return apply(insertSnippet({ selectionStart: start, selectionEnd: end }, value, "[[IMG: description]]", "description"));
        }
        return openDialog(cmd.dialog);
      case "insertTable":
        return apply(insertTable(value, start, end, cmd.rows, cmd.cols, t("ed_tableHeadLabel")));
      case "table": {
        // Recomputed from the live text rather than read off render state: the
        // author may have typed since the last caret sync, which would make a
        // cached table range point at the wrong characters.
        const at = tableAt(value, start);
        if (!at) return;
        switch (cmd.op.op) {
          case "addRow":
            return apply(tableInsertRow(value, at, cmd.op.where));
          case "addCol":
            return apply(tableInsertColumn(value, at, cmd.op.where));
          case "delRow":
            return apply(tableDeleteRow(value, at));
          case "delCol":
            return apply(tableDeleteColumn(value, at));
          case "colAlign":
            return apply(tableSetColumnAlign(value, at, cmd.op.align));
          case "toggleHeader":
            return apply(tableToggleHeader(value, at));
        }
        return;
      }
      case "source":
        return setSource((s) => !s);
    }
  }

  // Ctrl/Cmd shortcuts, so the ribbon is a convenience and not the only way in.
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "z") {
      e.preventDefault();
      return e.shiftKey ? redo() : undo();
    }
    if (k === "y") {
      e.preventDefault();
      return redo();
    }
    const map: Record<string, MarkupCmd> = {
      b: { k: "wrap", mark: "bold" },
      i: { k: "wrap", mark: "italic" },
      u: { k: "wrap", mark: "underline" },
      k: { k: "dialog", dialog: "link" },
    };
    if (map[k]) {
      e.preventDefault();
      onCmd(map[k]);
    }
  }

  /** Mirror the caret so the ribbon's pressed states follow it. */
  function syncCaret() {
    if (pendingSel.current) return;
    setCaret(ref.current?.selectionStart ?? 0);
  }

  const state: RibbonState = {
    canUndo: hist.current.past.length > 0,
    canRedo: hist.current.future.length > 0,
    source,
    panel,
    style: blockStyleAt(value, caret),
    align: alignAt(value, caret),
    quote: isQuoteAt(value, caret),
    box: calloutAt(value, caret),
    inTable: tableAt(value, caret) !== null,
  };

  // An open panel keeps the bar on screen even though the textarea lost focus to
  // one of its inputs.
  const showToolbar = !toolbarOnFocus || focused || Boolean(panel);
  const showTableTools = state.inTable && showToolbar;

  return (
    <div
      className={`flex flex-col ${className}`}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      {label && <span className="text-[11.5px] font-bold text-muted mb-1.5">{label}</span>}

      {showToolbar && <Ribbon onCmd={onCmd} state={state} disabled={disabled} variant={variant} />}
      {showTableTools && <TableTools onCmd={onCmd} disabled={disabled} />}

      <textarea
        ref={ref}
        value={value}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        spellCheck={!source}
        onKeyDown={onKeyDown}
        onKeyUp={syncCaret}
        onClick={syncCaret}
        onSelect={syncCaret}
        onChange={(e) => {
          push(true);
          onChange(e.target.value);
          setCaret(e.target.selectionStart);
        }}
        style={{ minHeight }}
        className={`px-3 py-2.5 border-[1.5px] border-ink-300 text-[13px] leading-relaxed resize-y bg-card text-text disabled:bg-ink-50 ${
          showToolbar ? "rounded-b-lg" : "rounded-lg"
        } ${source ? "font-mono text-[12.5px]" : ""}`}
      />

      {panel && (
        <InsertPanel
          panel={panel}
          onInsert={(text) => apply(insertSnippet({ selectionStart: sel().start, selectionEnd: sel().end }, value, text))}
          onSwitch={(next) => setPanel(next)}
          onClose={closeOverlays}
        />
      )}

      {dialog === "image" && imageUpload && (
        <ImageDialog
          onClose={closeOverlays}
          onInsert={insertImage}
          keysSupported={imageUpload.keysSupported}
          canEdit={imageUpload.canEdit}
          existingKeys={usedImageKeys}
        />
      )}

      {(dialog === "link" || dialog === "video") && (
        <LinkDialog
          kind={dialog}
          initialText={value.slice(sel().start, sel().end)}
          onClose={closeOverlays}
          onConfirm={(url, text) => {
            const { start, end } = sel();
            if (dialog === "video") {
              apply(insertBlock(value, start, end, `[[VIDEO: ${url}]]`));
            } else {
              const snippet = `[${text.trim() || url}](${url})`;
              apply({ next: value.slice(0, start) + snippet + value.slice(end), start: start + snippet.length, end: start + snippet.length });
            }
          }}
        />
      )}
    </div>
  );
}
