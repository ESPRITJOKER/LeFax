import { IMAGE_KEY_RE, rowAlignment, splitRow, type CellAlign, type ImageOptions } from "../../lib/markupSyntax";

/**
 * Every block-level transform the Word-style ribbon applies, as pure functions
 * over `(value, selectionStart, selectionEnd)`.
 *
 * They live here, away from React, for two reasons. The ribbon grew from 19 flat
 * buttons to a style gallery, alignment, quotes, dividers, callout boxes and a
 * full set of table operations; threading all of that through `MarkupField`'s
 * `onCmd` switch would have buried the editing logic in component code. And
 * being pure — and importing only `lib/markupSyntax`, which pulls in neither
 * React nor KaTeX — every function here can be asserted on by a plain `node`
 * script, which is the only form of test this project has.
 *
 * Each one returns the same `{ next, start, end }` shape as `insertSnippet` /
 * `wrapSelection` in `../FormulaTool`, so `MarkupField.apply` handles all of
 * them identically: one undo step, caret restored.
 */

export interface Edit {
  next: string;
  start: number;
  end: number;
}

/* ───────────────────────── line addressing ─────────────────────────────── */

/** The character range of every line the selection touches. */
export function lineRange(value: string, start: number, end: number): { from: number; to: number } {
  const from = value.lastIndexOf("\n", start - 1) + 1;
  const nl = value.indexOf("\n", end);
  return { from, to: nl === -1 ? value.length : nl };
}

/** Replace the touched lines with `fn`'s output, selecting the whole new block. */
function rewriteLines(value: string, start: number, end: number, fn: (line: string, i: number) => string): Edit {
  const { from, to } = lineRange(value, start, end);
  const rewritten = value.slice(from, to).split("\n").map(fn).join("\n");
  return { next: value.slice(0, from) + rewritten + value.slice(to), start: from, end: from + rewritten.length };
}

/** Drop a block construct on its own line at the caret. */
export function insertBlock(value: string, start: number, end: number, text: string, select?: string): Edit {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const lead = before && !before.endsWith("\n") ? "\n" : "";
  const trail = after && !after.startsWith("\n") ? "\n" : "";
  const next = `${before}${lead}${text}${trail}${after}`;
  const at = before.length + lead.length;
  if (select) {
    const rel = text.indexOf(select);
    if (rel >= 0) return { next, start: at + rel, end: at + rel + select.length };
  }
  const caret = at + text.length;
  return { next, start: caret, end: caret };
}

/* ───────────────────────── paragraph style ─────────────────────────────── */

/**
 * `[align=…]` sits BEFORE the heading marks (`[align=center] ## Titre`), because
 * that is the order `parse()` reads them in: it strips the alignment first and
 * then matches `##` on what is left. Every transform here therefore splits the
 * prefix off, changes the body, and puts the prefix back — forgetting that is
 * how a centred heading silently loses its centring.
 */
const ALIGN_PREFIX_RE = /^(\[align=(?:left|gauche|center|centre|right|droite)\]\s*)/i;

function splitAlign(line: string): [prefix: string, rest: string] {
  const m = line.match(ALIGN_PREFIX_RE);
  return m ? [m[1], line.slice(m[1].length)] : ["", line];
}

export type BlockStyle = "p" | "h1" | "h2" | "h3";

const HEADING_RE = /^(#{1,3})\s+/;
const BLOCK_MARKS: Record<BlockStyle, string> = { p: "", h1: "# ", h2: "## ", h3: "### " };

/** Which style the line at the caret already has — drives the gallery's label. */
export function blockStyleAt(value: string, caret: number): BlockStyle {
  const { from, to } = lineRange(value, caret, caret);
  const [, rest] = splitAlign(value.slice(from, to).trim());
  const m = rest.match(HEADING_RE);
  if (!m) return "p";
  return m[1].length === 1 ? "h1" : m[1].length === 2 ? "h2" : "h3";
}

/** Apply one paragraph style to every touched line ("p" removes the marks). */
export function setBlockStyle(value: string, start: number, end: number, style: BlockStyle): Edit {
  return rewriteLines(value, start, end, (line) => {
    if (!line.trim()) return line;
    const [prefix, rest] = splitAlign(line.trimStart());
    return prefix + BLOCK_MARKS[style] + rest.replace(HEADING_RE, "");
  });
}

/* ───────────────────────── alignment ───────────────────────────────────── */

/** Centre / right-align the touched lines. "left" clears the marker (default). */
export function setAlign(value: string, start: number, end: number, align: CellAlign): Edit {
  return rewriteLines(value, start, end, (line) => {
    if (!line.trim()) return line;
    const [, rest] = splitAlign(line.trimStart());
    return align === "left" ? rest : `[align=${align}] ${rest}`;
  });
}

/** The alignment of the line at the caret, for the pressed state of the buttons. */
export function alignAt(value: string, caret: number): CellAlign {
  const { from, to } = lineRange(value, caret, caret);
  const m = value.slice(from, to).trim().match(ALIGN_PREFIX_RE);
  if (!m) return "left";
  const word = m[1].toLowerCase();
  return word.includes("cent") ? "center" : word.includes("right") || word.includes("droite") ? "right" : "left";
}

/* ───────────────────────── quote ───────────────────────────────────────── */

/** Toggle `> ` on the touched lines — on only if they are not already quoted. */
export function toggleQuote(value: string, start: number, end: number): Edit {
  const { from, to } = lineRange(value, start, end);
  const quoted = value
    .slice(from, to)
    .split("\n")
    .filter((l) => l.trim())
    .every((l) => /^\s*>\s?/.test(l));
  return rewriteLines(value, start, end, (line) => {
    if (!line.trim()) return line;
    return quoted ? line.replace(/^(\s*)>+\s?/, "$1") : `> ${line.trimStart()}`;
  });
}

/** True when the line at the caret is quoted — for the button's pressed state. */
export function isQuoteAt(value: string, caret: number): boolean {
  const { from, to } = lineRange(value, caret, caret);
  return /^\s*>/.test(value.slice(from, to));
}

/* ───────────────────────── callout boxes ───────────────────────────────── */

export type CalloutKind = "piege" | "info" | "app";

const CALLOUT_RE = /^\[!(PIEGE|INFO|APP)\]\s*/i;

/** Which box the line at the caret is, if any — for the pressed state. */
export function calloutAt(value: string, caret: number): CalloutKind | null {
  const { from, to } = lineRange(value, caret, caret);
  const m = value.slice(from, to).trim().match(CALLOUT_RE);
  return m ? (m[1].toLowerCase() as CalloutKind) : null;
}

/**
 * Turn the line at the caret into a callout, or back into a paragraph when it is
 * already that kind of callout — so the three box buttons behave like toggles
 * rather than stamping `[!INFO] [!PIEGE] texte`. Switching kind replaces the
 * marker in place.
 *
 * `answerLabel` is the placeholder for the answer half of an application box,
 * which the format separates from the exercise with `|||`.
 */
export function toggleCallout(value: string, start: number, end: number, kind: CalloutKind, answerLabel: string): Edit {
  const { from, to } = lineRange(value, start, end);
  const line = value.slice(from, to);
  const existing = line.trim().match(CALLOUT_RE);
  const body = line.trim().replace(CALLOUT_RE, "");

  if (existing && existing[1].toLowerCase() === kind) {
    const plain = kind === "app" ? body.split("|||")[0].trim() : body;
    return { next: value.slice(0, from) + plain + value.slice(to), start: from, end: from + plain.length };
  }

  const marker = `[!${kind.toUpperCase()}] `;
  const needsAnswer = kind === "app" && !body.includes("|||");
  const replacement = marker + (needsAnswer ? `${body} ||| ${answerLabel}` : body);
  const next = value.slice(0, from) + replacement + value.slice(to);
  // Select what the author types over next: the answer placeholder for a new
  // application box, otherwise the whole line.
  if (needsAnswer) {
    const at = from + replacement.length - answerLabel.length;
    return { next, start: at, end: at + answerLabel.length };
  }
  return { next, start: from + marker.length, end: from + replacement.length };
}

/* ───────────────────────── images ──────────────────────────────────────── */

// No l/o/0/1: a key is read off the screen and retyped by hand often enough
// that the ambiguous glyphs are not worth the extra entropy.
const KEY_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/**
 * Mint a stable image key (migration 0022). `taken` is every key already used in
 * this body, so a collision inside one lesson is impossible rather than merely
 * unlikely — `parse()` drops a duplicate key and the figure would silently come
 * back unbound.
 */
export function newImageKey(taken: Iterable<string> = []): string {
  const used = new Set(taken);
  for (;;) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const key = Array.from(bytes, (n) => KEY_ALPHABET[n % KEY_ALPHABET.length]).join("");
    if (IMAGE_KEY_RE.test(key) && !used.has(key)) return key;
  }
}

/**
 * Build an `[[IMG: …]]` token. Options are emitted only when they differ from
 * the default, so the common case stays the short token that every existing
 * lesson already uses and that is readable in the source view.
 */
export function imageToken(caption: string, options: ImageOptions): string {
  const parts: string[] = [caption.replace(/[|\]]/g, " ").trim() || "image"];
  if (options.key) parts.push(`key=${options.key}`);
  if (options.widthPct && options.widthPct !== 100) parts.push(`w=${options.widthPct}`);
  if (options.align && options.align !== "center") parts.push(`align=${options.align}`);
  if (options.alt) parts.push(`alt=${options.alt.replace(/[|\]]/g, " ").trim()}`);
  if (options.credit) parts.push(`credit=${options.credit.replace(/[|\]]/g, " ").trim()}`);
  if (options.sourceUrl) parts.push(`source=${options.sourceUrl}`);
  return `[[IMG: ${parts.join(" | ")}]]`;
}

/* ───────────────────────── tables ──────────────────────────────────────── */

/** A pipe is the cell delimiter, so one inside a cell has to be escaped. */
export function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|");
}

/**
 * Render a table back to markup with the columns padded to a common width, so
 * the source in the textarea reads as a grid rather than as ragged pipes. The
 * padding is cosmetic — `splitRow` trims every cell — but it is most of what
 * makes a table feel editable in a plain text field.
 */
export function serializeTable(rows: string[][], align: CellAlign[], hasHeader: boolean): string {
  const width = rows.reduce((w, r) => (r.length > w ? r.length : w), 1);
  const cells = rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
  const colWidth = Array.from({ length: width }, (_, i) => cells.reduce((w, r) => (r[i].length > w ? r[i].length : w), 3));
  const pad = (text: string, i: number) => text + " ".repeat(Math.max(0, colWidth[i] - text.length));
  const line = (r: string[]) => `| ${r.map(pad).join(" | ")} |`;
  const separator = `| ${Array.from({ length: width }, (_, i) => {
    const a = align[i] ?? "left";
    const room = colWidth[i] - (a === "center" ? 2 : a === "left" ? 0 : 1);
    const dashes = "-".repeat(Math.max(3, room));
    return a === "center" ? `:${dashes}:` : a === "right" ? `${dashes}:` : dashes;
  })
    .map(pad)
    .join(" | ")} |`;

  if (!hasHeader || cells.length === 0) return cells.map(line).join("\n");
  return [line(cells[0]), separator, ...cells.slice(1).map(line)].join("\n");
}

/** A fresh `rows × cols` table, header row included. */
export function insertTable(value: string, start: number, end: number, rows: number, cols: number, headLabel: string): Edit {
  const head = Array.from({ length: cols }, (_, i) => `${headLabel} ${i + 1}`);
  const body = Array.from({ length: Math.max(1, rows - 1) }, () => Array.from({ length: cols }, () => ""));
  const align: CellAlign[] = Array.from({ length: cols }, () => "left");
  return insertBlock(value, start, end, serializeTable([head, ...body], align, true), head[0]);
}

export interface TableAt {
  /** Character range of the whole table block in `value`. */
  from: number;
  to: number;
  /** Cells, header row included; the alignment row is NOT one of these. */
  rows: string[][];
  align: CellAlign[];
  hasHeader: boolean;
  /** Where the caret is in the grid. `row` indexes `rows`. */
  row: number;
  col: number;
}

/**
 * Locate the table the caret sits in, if any. This is what makes the table
 * controls contextual: the ribbon reveals its table group only when this returns
 * non-null, the way Word reveals its table tabs.
 */
export function tableAt(value: string, caret: number): TableAt | null {
  const lines = value.split("\n");
  const offsets: number[] = [];
  let at = 0;
  for (const l of lines) {
    offsets.push(at);
    at += l.length + 1;
  }
  let li = 0;
  for (let i = 0; i < lines.length; i += 1) if (offsets[i] <= caret) li = i;
  if (!/^\|/.test(lines[li].trim())) return null;

  let first = li;
  while (first > 0 && /^\|/.test(lines[first - 1].trim())) first -= 1;
  let last = li;
  while (last < lines.length - 1 && /^\|/.test(lines[last + 1].trim())) last += 1;

  const raw = lines.slice(first, last + 1);
  const parsed = raw.map(splitRow);
  const separator = parsed.length > 1 ? rowAlignment(parsed[1]) : null;
  const align = separator ?? [];
  const rows = separator ? [parsed[0], ...parsed.slice(2)] : parsed;

  // The caret's line as an index into `rows` (skipping the separator), and its
  // cell, counted by the unescaped pipes to its left.
  const lineIdx = li - first;
  const row = separator && lineIdx > 0 ? Math.max(0, lineIdx - 1) : lineIdx;
  const beforeCaret = lines[li].slice(0, caret - offsets[li]);
  let col = -1;
  for (let i = 0; i < beforeCaret.length; i += 1) {
    if (beforeCaret[i] === "\\") i += 1;
    else if (beforeCaret[i] === "|") col += 1;
  }

  return {
    from: offsets[first],
    to: offsets[last] + raw[raw.length - 1].length,
    rows,
    align,
    hasHeader: Boolean(separator),
    row: Math.max(0, Math.min(row, rows.length - 1)),
    col: Math.max(0, Math.min(col, (rows[0]?.length ?? 1) - 1)),
  };
}

/** Rewrite a located table from new cells, leaving the caret inside the grid. */
function writeTable(value: string, t: TableAt, rows: string[][], align: CellAlign[], hasHeader = t.hasHeader): Edit {
  const text = serializeTable(rows, align, hasHeader);
  const next = value.slice(0, t.from) + text + value.slice(t.to);
  const caret = t.from + text.length;
  return { next, start: caret, end: caret };
}

export function tableInsertRow(value: string, t: TableAt, where: "above" | "below"): Edit {
  const width = t.rows[0]?.length ?? 1;
  const blank = Array.from({ length: width }, () => "");
  // "Above" the header row would produce a second header, so a row asked for
  // above row 0 of a headed table goes below it instead — the only place a body
  // row can legally go.
  const index = where === "above" ? (t.hasHeader && t.row === 0 ? 1 : t.row) : t.row + 1;
  const rows = [...t.rows];
  rows.splice(index, 0, blank);
  return writeTable(value, t, rows, t.align);
}

export function tableInsertColumn(value: string, t: TableAt, where: "left" | "right"): Edit {
  const index = where === "left" ? t.col : t.col + 1;
  const rows = t.rows.map((r) => {
    const copy = [...r];
    copy.splice(index, 0, "");
    return copy;
  });
  const align = [...t.align];
  align.splice(index, 0, "left");
  return writeTable(value, t, rows, align);
}

export function tableDeleteRow(value: string, t: TableAt): Edit {
  // Removing the last row would leave a separator with nothing around it, which
  // parses as a one-row table of dashes. Drop the whole block instead.
  if (t.rows.length <= 1) return { next: value.slice(0, t.from) + value.slice(t.to), start: t.from, end: t.from };
  const rows = t.rows.filter((_, i) => i !== t.row);
  return writeTable(value, t, rows, t.align);
}

export function tableDeleteColumn(value: string, t: TableAt): Edit {
  const width = t.rows[0]?.length ?? 1;
  if (width <= 1) return { next: value.slice(0, t.from) + value.slice(t.to), start: t.from, end: t.from };
  const rows = t.rows.map((r) => r.filter((_, i) => i !== t.col));
  const align = t.align.filter((_, i) => i !== t.col);
  return writeTable(value, t, rows, align);
}

/** Align the column the caret is in. A headless table gains its separator row. */
export function tableSetColumnAlign(value: string, t: TableAt, align: CellAlign): Edit {
  const width = t.rows[0]?.length ?? 1;
  const next = Array.from({ length: width }, (_, i) => (i === t.col ? align : t.align[i] ?? "left"));
  return writeTable(value, t, t.rows, next, true);
}

/** Give a headless table a header row, or take it away again. */
export function tableToggleHeader(value: string, t: TableAt): Edit {
  const width = t.rows[0]?.length ?? 1;
  const align = Array.from({ length: width }, (_, i) => t.align[i] ?? "left");
  return writeTable(value, t, t.rows, align, !t.hasHeader);
}
