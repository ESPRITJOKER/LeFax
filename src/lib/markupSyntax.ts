/**
 * The lesson mini-markup — grammar and parser, with no React and no KaTeX.
 *
 * This is the half of `lessonContent.tsx` that is pure string work. It was split
 * out when the Word-style ribbon arrived, for one concrete reason: this project
 * has no test runner, and `lessonContent.tsx` imports `react`, `katex` and
 * `katex.min.css` at module scope, so nothing in it can be loaded by a plain
 * `node` script. Everything here can, which is what makes the grammar — and the
 * ribbon's table surgery in `components/editor/markupCommands.ts`, which imports
 * from this file — assertable at all.
 *
 * `lessonContent.tsx` re-exports every name below, so no existing import site
 * had to change.
 *
 * Grammar (one construct per line, blocks separated by blank lines):
 *   # Title                        → big title
 *   ## Heading                     → section heading
 *   ### Sub-heading                → sub-heading
 *   [align=center] text            → centre (or left / right) a heading or
 *                                    paragraph; centre / droite / gauche too
 *   > quoted                       → block quote (consecutive lines group)
 *   ---                            → horizontal divider
 *   | a | b |                      → table; a row of `---` cells (which may
 *   | --- | :---: |                  carry `:` for per-column alignment) makes
 *   | 1 | 2 |                        the row above it a header
 *   - item                         → bullet (consecutive lines grouped); two
 *                                    leading spaces nest it one level
 *   1. item                        → numbered list (same nesting rule)
 *   [[IMG: caption | key=… | w=60 | align=right | credit=… | source=… | alt=…]]
 *   [[VIDEO: url]]                 → embedded player or clickable card
 *   [!PIEGE] text                  → "watch out" callout (common exam trap)
 *   [!INFO] text                   → note / etymology / historical marker
 *   [!APP] consigne ||| correction → self-test box
 *   plain text                     → paragraph
 *
 * Inline everywhere: **bold**, *italic* / _italic_, ==highlight==, __underline__,
 * ~~struck~~, ^superscript^, ~subscript~, `code`, [label](url), and $…$ / \ce{…}
 * notation.
 */

export type CellAlign = "left" | "center" | "right";

/* ─────────────────────────── inline grammar ────────────────────────────── */

/**
 * Highlight fills. Every one is paired with a FIXED dark ink rather than
 * `color: inherit` — Correction N6: "Jaune qui rend invisible les écritures".
 * The story-card front is a dark surface whatever the theme, so an inherited
 * near-white colour on a pale yellow fill was unreadable, and no theme token can
 * fix that. Pinning both halves of the pair is the only form that is legible on
 * every surface.
 */
export const HIGHLIGHT_INK = "#1e2a3a";
export const HIGHLIGHT_COLORS = {
  jaune: "#ffe9a8",
  vert: "#c8f0d2",
  bleu: "#cfe6ff",
  rose: "#fcd9e8",
} as const;
export type HighlightColor = keyof typeof HIGHLIGHT_COLORS;

/**
 * Maths / chemistry spans, carved out of a line BEFORE any markup rule sees it.
 * The source lives here rather than in `math.tsx` so that this module stays
 * free of KaTeX (and therefore Node-loadable) while remaining the single
 * definition of what counts as notation — `math.tsx` builds `NOTATION_SPLIT`
 * from it, and the table cell splitter below uses it to protect a `|` that
 * belongs to TeX.
 *
 * Order matters: `$$…$$` before `$…$`, and `\ce{…}` is matched with one level of
 * nested braces so `\ce{Ca(OH)2}` and `\ce{SO4^{2-}}` both survive.
 */
export const NOTATION_SOURCE = /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\(?:ce|pu)\{(?:[^{}]|\{[^{}]*\})*\}/.source;

/**
 * Only these schemes may become an `<a href>`. Author text is never injected as
 * HTML, but a `[clic](javascript:…)` would otherwise be a working script URL, so
 * the allowlist is applied at render time rather than at authoring time.
 */
export function safeUrl(raw: string): string | null {
  const url = (raw ?? "").trim();
  if (!url) return null;
  if (/^(https?:|mailto:)/i.test(url)) return url;
  // A bare domain ("www.exemple.com") is a link an author plainly meant.
  if (/^www\./i.test(url)) return `https://${url}`;
  return null;
}

/**
 * Inline markup rules, in one pass. Order matters: `code` first so that an
 * author can show the markup itself, links next so a URL's characters are never
 * eaten by another rule, `**bold**` before `*italic*`, `~~struck~~` before
 * `~sub~` and `__underline__` before `_italic_`. The italic forms require a
 * non-space right after the opening mark so a lone `*` ("2 * 3") is untouched.
 * Group names are distinct per alternative — duplicate names are not portable.
 */
export const INLINE_RE = new RegExp(
  [
    /`(?<code>[^`\n]+)`/,
    /\[(?<linkText>[^\]\n]+)\]\((?<linkUrl>[^)\s]+)\)/,
    /\*\*(?<bold>[^*]+?)\*\*/,
    /\*(?<italic>[^\s*][^*]*?)\*/,
    /==(?:(?<hlColor>jaune|vert|bleu|rose)\|)?(?<hl>[^=]+?)==/,
    /__(?<underline>[^_]+?)__/,
    /_(?<italic2>[^\s_][^_]*?)_/,
    /~~(?<strike>[^~]+?)~~/,
    /\^(?<sup>[^\s^]+)\^/,
    /~(?<sub>[^\s~]+)~/,
  ]
    .map((r) => r.source)
    .join("|"),
  "g"
);

/* ─────────────────────────── line grammar ──────────────────────────────── */

export const BULLET_RE = /^(?:-|•|–)\s+(.*)$/;
export const ORDERED_RE = /^\d+[.)]\s+(.*)$/;
/** A table row. No other construct puts `|` at the start of a line. */
export const TABLE_LINE_RE = /^\|/;
export const QUOTE_RE = /^>+\s?(.*)$/;
/** `---` or longer, alone. `- ` (bullet) needs the space, so no clash. */
export const DIVIDER_RE = /^-{3,}$/;
/**
 * `[align=…]` on a heading or paragraph. The `key=value` shape is the one
 * `parseImageSpec` already uses, and the French spellings are accepted because
 * the authors are French-speaking.
 */
export const ALIGN_RE = /^\[align=(left|gauche|center|centre|right|droite)\]\s*(.*)$/i;

/** Split a leading `[align=…]` off a line. Returns `rest` unchanged when absent. */
export function readAlign(line: string): { align?: CellAlign; rest: string } {
  const m = line.match(ALIGN_RE);
  if (!m) return { rest: line };
  const word = m[1].toLowerCase();
  const align: CellAlign =
    word === "center" || word === "centre" ? "center" : word === "right" || word === "droite" ? "right" : "left";
  return { align, rest: m[2] };
}

/** Leading-space depth, capped at one nesting level (the toolbar's indent). */
export function indentDepth(rawLine: string): number {
  const spaces = rawLine.match(/^[ \t]*/)?.[0] ?? "";
  const width = spaces.replace(/\t/g, "  ").length;
  return width >= 2 ? 1 : 0;
}

/* ─────────────────────────── tables ────────────────────────────────────── */

/**
 * Spans that legitimately contain a `|` and must survive cell splitting:
 * notation (`$\|v\| = 1$`, `\ce{A|B}`) and the closed set of highlight colour
 * prefixes (`==vert|texte==`). Building the guard from `NOTATION_SOURCE` is the
 * load-bearing part — it means a cell renders exactly what `inline()` would
 * render, and the two can never drift apart.
 */
const CELL_GUARD = new RegExp(`(${NOTATION_SOURCE}|==(?:jaune|vert|bleu|rose)\\|)`, "g");

/**
 * Split one table row into cells on unescaped pipes. Outer pipes are optional,
 * `\|` is a literal pipe, and anything matched by {@link CELL_GUARD} is copied
 * through untouched.
 *
 * A `|` inside a link URL cannot be escaped this way (`\|` would corrupt the
 * URL) — percent-encode it as `%7C` instead.
 */
export function splitRow(row: string): string[] {
  const cells: string[] = [""];
  const parts = row.split(CELL_GUARD);
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part == null) continue;
    if (i % 2 === 1) {
      // A guarded span: append verbatim, never split inside it.
      cells[cells.length - 1] += part;
      continue;
    }
    const pieces = part.split(/(?<!\\)\|/);
    cells[cells.length - 1] += pieces[0].replace(/\\\|/g, "|");
    for (let j = 1; j < pieces.length; j += 1) cells.push(pieces[j].replace(/\\\|/g, "|"));
  }
  const out = cells.map((c) => c.trim());
  if (out.length > 1 && out[0] === "") out.shift();
  if (out.length > 1 && out[out.length - 1] === "") out.pop();
  return out;
}

/** `["---", ":---:"]` → per-column alignment; null when this is a data row. */
export function rowAlignment(cells: string[]): CellAlign[] | null {
  if (cells.length === 0) return null;
  const out: CellAlign[] = [];
  for (const cell of cells) {
    const m = cell.match(/^(:?)-{2,}(:?)$/);
    if (!m) return null;
    out.push(m[1] && m[2] ? "center" : m[2] ? "right" : "left");
  }
  return out;
}

/* ─────────────────────────── images ────────────────────────────────────── */

/**
 * Optional options on an image placeholder, after the caption:
 *   [[IMG: caption]]                        → full width, centred (the default,
 *                                             and what all existing content uses)
 *   [[IMG: caption | key=k7f3a2m1]]         → bound to an uploaded file by its
 *                                             stable key (migration 0022)
 *   [[IMG: caption | w=60]]                 → 60% of the column width
 *   [[IMG: caption | align=right]]          → pushed right on wide screens
 *   [[IMG: caption | credit=OMS 2024]]      → source line under the figure
 *   [[IMG: caption | source=https://…]]     → the credit becomes a link
 *   [[IMG: caption | alt=texte alternatif]] → screen-reader text
 * Unknown options are ignored, so a typo degrades to the default rather than
 * breaking the lesson — and so a `key=` token renders correctly even on a build
 * that predates migration 0022.
 */
export interface ImageOptions {
  widthPct?: number;
  align?: CellAlign;
  credit?: string;
  sourceUrl?: string;
  alt?: string;
  author?: string;
  /**
   * Stable id of the uploaded file (migration 0022). Written by the image
   * dialog, never by hand. With a key the picture follows its caption wherever
   * the line is moved; without one the image is resolved by position, the way
   * every lesson written before the dialog existed is.
   */
  key?: string;
}

/** The shape a `key=` must have: it becomes a Storage object path segment. */
export const IMAGE_KEY_RE = /^[a-z0-9]{4,16}$/;

export function parseImageSpec(raw: string): { caption: string; options: ImageOptions } {
  const parts = raw.split("|");
  const caption = (parts.shift() ?? "").trim();
  const options: ImageOptions = {};
  for (const part of parts) {
    // Only the FIRST "=" separates key from value, so a URL's query string
    // survives (`source=https://x.org/i?a=1`).
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const rawValue = part.slice(eq + 1).trim();
    const value = rawValue.toLowerCase();
    if ((key === "w" || key === "width") && value) {
      const pct = Number.parseInt(value.replace("%", ""), 10);
      if (Number.isFinite(pct) && pct >= 10 && pct <= 100) options.widthPct = pct;
    } else if (key === "align" && (value === "left" || value === "right" || value === "center")) {
      options.align = value;
    } else if ((key === "credit" || key === "ref" || key === "reference") && rawValue) {
      options.credit = rawValue;
    } else if ((key === "source" || key === "src") && rawValue) {
      options.sourceUrl = safeUrl(rawValue) ?? undefined;
    } else if (key === "alt" && rawValue) {
      options.alt = rawValue;
    } else if ((key === "author" || key === "auteur") && rawValue) {
      options.author = rawValue;
    } else if (key === "key" && IMAGE_KEY_RE.test(value)) {
      options.key = value;
    }
  }
  return { caption, options };
}

/* ─────────────────────────── video ─────────────────────────────────────── */

/**
 * Turn any video URL into something embeddable. The id is parsed out of the
 * URL — nothing is hardcoded, so a course added next year works with no code
 * change (Correction N6: "ne pas coder en dur une vidéo").
 *
 * YouTube goes through `youtube-nocookie.com`, which does not set tracking
 * cookies until the student actually presses play.
 */
export function parseVideo(raw: string): { embed: string | null; href: string | null; provider: "youtube" | "vimeo" | "other" } {
  const href = safeUrl(raw);
  if (!href) return { embed: null, href: null, provider: "other" };
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      if (id) return { embed: `https://www.youtube-nocookie.com/embed/${id}`, href, provider: "youtube" };
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const id = u.searchParams.get("v") ?? u.pathname.match(/\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1];
      if (id) {
        const list = u.searchParams.get("list");
        return {
          embed: `https://www.youtube-nocookie.com/embed/${id}${list ? `?list=${encodeURIComponent(list)}` : ""}`,
          href,
          provider: "youtube",
        };
      }
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = u.pathname.match(/(\d+)/)?.[1];
      if (id) return { embed: `https://player.vimeo.com/video/${id}`, href, provider: "vimeo" };
    }
  } catch {
    /* not a parseable URL — fall through to the link card */
  }
  return { embed: null, href, provider: "other" };
}

/* ─────────────────────────── block parser ─────────────────────────────── */

export interface ListItem {
  text: string;
  /** 0 = top level, 1 = one nesting level (the editor's indent button). */
  depth: number;
}

export type Block =
  | { type: "h1" | "h2" | "h3" | "p"; text: string; align?: CellAlign }
  | { type: "list"; ordered: boolean; items: ListItem[] }
  | { type: "img"; caption: string; slot: number; options: ImageOptions }
  | { type: "video"; url: string }
  | { type: "callout"; kind: "piege" | "info"; text: string }
  | { type: "app"; consigne: string; correction: string }
  | { type: "math"; tex: string }
  | { type: "table"; head: string[] | null; rows: string[][]; align: CellAlign[] }
  | { type: "quote"; lines: string[] }
  | { type: "hr" };

export function parse(raw: string): Block[] {
  const lines = (raw ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let list: { items: ListItem[]; ordered: boolean } | null = null;
  let quote: string[] | null = null;
  let imgSlot = 0;
  // An image key is written into the text, so it is editable — and duplicable,
  // the moment an author copies a figure line. The second token to claim a key
  // loses it and falls back to its own slot, which shows up as a visible empty
  // placeholder instead of two figures silently sharing one picture.
  const keysSeen = new Set<string>();
  // Collecting the body of a `$$` … `$$` display-equation fence. Inside it,
  // blank lines and markup characters are TeX, not markup, so the fence is
  // checked before every other rule.
  let fence: string[] | null = null;

  // Two separate flushers, because a list and a quote can both be pending and
  // the order they are emitted in has to follow the order they were written in.
  const flushList = () => {
    if (list && list.items.length) blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  };
  const flushQuote = () => {
    if (quote && quote.length) blocks.push({ type: "quote", lines: quote });
    quote = null;
  };
  const flush = () => {
    flushList();
    flushQuote();
  };

  // Indexed rather than for-of: a table consumes the whole run of `|` lines in
  // one step, which needs lookahead the line-at-a-time loop did not have.
  for (let li = 0; li < lines.length; li += 1) {
    const rawLine = lines[li];
    const line = rawLine.trim();

    if (fence) {
      if (line === "$$") {
        blocks.push({ type: "math", tex: fence.join("\n").trim() });
        fence = null;
      } else {
        fence.push(rawLine);
      }
      continue;
    }
    if (line === "$$") {
      flush();
      fence = [];
      continue;
    }
    const oneLineMath = line.match(/^\$\$([\s\S]+)\$\$$/);
    if (oneLineMath) {
      flush();
      blocks.push({ type: "math", tex: oneLineMath[1].trim() });
      continue;
    }

    // ── table: the whole run of consecutive `|` lines, in one step ─────────
    if (TABLE_LINE_RE.test(line)) {
      flush();
      const rows: string[][] = [];
      let j = li;
      while (j < lines.length && TABLE_LINE_RE.test(lines[j].trim())) {
        rows.push(splitRow(lines[j]));
        j += 1;
      }
      li = j - 1;
      const align = rows.length > 1 ? rowAlignment(rows[1]) : null;
      // With an alignment row the first line is a header; without one the author
      // has not typed the separator (yet), so every row is a body row.
      if (align) blocks.push({ type: "table", head: rows[0], rows: rows.slice(2), align });
      else blocks.push({ type: "table", head: null, rows, align: [] });
      continue;
    }

    const quoted = line.match(QUOTE_RE);
    if (quoted) {
      flushList();
      (quote ??= []).push(quoted[1]);
      continue;
    }

    const bullet = line.match(BULLET_RE);
    const ordered = line.match(ORDERED_RE);
    if (bullet || ordered) {
      const isOrdered = Boolean(ordered);
      flushQuote();
      if (list && list.ordered !== isOrdered) flushList();
      (list ??= { items: [], ordered: isOrdered }).items.push({
        text: (bullet?.[1] ?? ordered?.[1]) as string,
        depth: indentDepth(rawLine),
      });
      continue;
    }
    flush();
    if (line === "") continue;

    if (DIVIDER_RE.test(line)) {
      blocks.push({ type: "hr" });
      continue;
    }

    // `[align=…]` may prefix any heading or paragraph; it is stripped here so
    // every rule below sees the text it would have seen without it.
    const { align: lineAlign, rest } = readAlign(line);

    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^##\s+(.*)$/))) blocks.push({ type: "h2", text: m[1], align: lineAlign });
    else if ((m = rest.match(/^###\s+(.*)$/))) blocks.push({ type: "h3", text: m[1], align: lineAlign });
    else if ((m = rest.match(/^#\s+(.*)$/))) blocks.push({ type: "h1", text: m[1], align: lineAlign });
    else if ((m = rest.match(/^\[\[IMG:\s*(.*?)\]\]$/i))) {
      const spec = parseImageSpec(m[1]);
      if (spec.options.key) {
        if (keysSeen.has(spec.options.key)) delete spec.options.key;
        else keysSeen.add(spec.options.key);
      }
      blocks.push({ type: "img", caption: spec.caption, slot: ++imgSlot, options: spec.options });
    } else if ((m = rest.match(/^\[\[VIDEO:\s*(.*?)\]\]$/i))) blocks.push({ type: "video", url: m[1].trim() });
    else if ((m = rest.match(/^\[!PIEGE\]\s*(.*)$/i))) blocks.push({ type: "callout", kind: "piege", text: m[1] });
    else if ((m = rest.match(/^\[!INFO\]\s*(.*)$/i))) blocks.push({ type: "callout", kind: "info", text: m[1] });
    else if ((m = rest.match(/^\[!APP\]\s*(.*)$/i))) {
      const [consigne, correction = ""] = m[1].split("|||");
      blocks.push({ type: "app", consigne: consigne.trim(), correction: correction.trim() });
    } else blocks.push({ type: "p", text: rest, align: lineAlign });
  }
  // An unterminated fence is still an equation the author meant to write —
  // render it rather than swallowing the text.
  if (fence && fence.length) blocks.push({ type: "math", tex: fence.join("\n").trim() });
  flush();
  return blocks;
}

/**
 * A lesson's image placeholders, in reading order, for the editor's upload list.
 * `key` is present once the placeholder was written by the image dialog; `slot`
 * is always there, and is what a keyless (pre-0022) placeholder is bound by.
 */
export function parseImagePlaceholders(text: string): { slot: number; caption: string; key?: string; options: ImageOptions }[] {
  return parse(text ?? "")
    .filter((b): b is Extract<Block, { type: "img" }> => b.type === "img")
    .map((b) => ({ slot: b.slot, caption: b.caption, key: b.options.key, options: b.options }));
}

/** True when a card text field asks for the card image to be placed inline. */
export function hasInlineImageToken(...texts: (string | null | undefined)[]): boolean {
  return texts.some((s) => s != null && /\[\[IMG(?::[^\]]*)?\]\]/i.test(s));
}
