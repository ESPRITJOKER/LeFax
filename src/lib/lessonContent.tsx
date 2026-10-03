import { Fragment, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { useI18n } from "./i18n";
import { Math, splitNotation } from "./math";
import { ZoomableImage, type ImageMeta } from "../components/ImageLightbox";

/**
 * Lightweight, dependency-free renderer for lesson bodies (lessons.content_fr /
 * content_en) and for the rich text fields on story cards. Lesson text is
 * stored as a line-based mini-markup so authors, the editor toolbar and the AI
 * pipeline can write rich micro-learning content into plain `text` columns
 * without a heavy Markdown/MDX dependency.
 *
 * Grammar (one construct per line, blocks separated by blank lines):
 *   ## Heading                     → section heading
 *   ### Sub-heading                → sub-heading
 *   - item                         → bullet (consecutive lines grouped);
 *                                    two leading spaces nest it one level
 *   1. item                        → numbered list (same nesting rule)
 *   [[IMG: caption]]               → captioned image-upload placeholder. The
 *                                    caption identifies exactly which diagram an
 *                                    admin should upload here (CDC 6.7 media).
 *   [[VIDEO: url]]                 → embedded player (YouTube / Vimeo) or a
 *                                    clickable card for any other URL
 *                                    (Correction N6: "les liens des vidéos
 *                                    hypertexte ne se connectaient pas").
 *   [!PIEGE] text                  → "watch out" callout (common exam trap)
 *   [!INFO] text                   → note / etymology / historical marker
 *   [!APP] consigne ||| correction → self-test box; correction hidden behind a
 *                                    toggle so students try first
 *   plain text                     → paragraph
 *
 * Inline everywhere: **bold**, *italic* / _italic_, ==highlight==, __underline__,
 * ^superscript^, ~subscript~, [label](url), and $…$ / \ce{…} notation.
 */

/**
 * Highlight fills. Every one of them is paired with a FIXED dark ink rather
 * than `color: inherit` — Correction N6: "Jaune qui rend invisible les
 * écritures". The story-card front is a dark surface whatever the theme, so an
 * inherited near-white colour on a pale yellow fill was unreadable, and no
 * theme token can fix that (the card is dark in light mode too). Pinning both
 * halves of the pair is the only form that is legible on every surface.
 */
const HIGHLIGHT_INK = "#1e2a3a";
export const HIGHLIGHT_COLORS = {
  jaune: "#ffe9a8",
  vert: "#c8f0d2",
  bleu: "#cfe6ff",
  rose: "#fcd9e8",
} as const;
export type HighlightColor = keyof typeof HIGHLIGHT_COLORS;

/**
 * Only these schemes may become an `<a href>`. Author text is never injected as
 * HTML, but a `[clic](javascript:…)` would otherwise be a working script URL,
 * so the allowlist is applied at render time rather than at authoring time.
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
 * Inline markup rules, in one pass. Order matters: links are matched first so a
 * URL's characters are never eaten by another rule, `**bold**` before `*italic*`
 * and `__underline__` before `_italic_`. The italic forms require a non-space
 * right after the opening mark so a lone `*` (e.g. "2 * 3") is left untouched.
 * Group names are distinct per alternative — duplicate names are not portable.
 */
const INLINE_RE = new RegExp(
  [
    /\[(?<linkText>[^\]\n]+)\]\((?<linkUrl>[^)\s]+)\)/,
    /\*\*(?<bold>[^*]+?)\*\*/,
    /\*(?<italic>[^\s*][^*]*?)\*/,
    /==(?:(?<hlColor>jaune|vert|bleu|rose)\|)?(?<hl>[^=]+?)==/,
    /__(?<underline>[^_]+?)__/,
    /_(?<italic2>[^\s_][^_]*?)_/,
    /\^(?<sup>[^\s^]+)\^/,
    /~(?<sub>[^\s~]+)~/,
  ]
    .map((r) => r.source)
    .join("|"),
  "g"
);

/**
 * Render inline markup inside a single line of text. Notation is carved out
 * FIRST and never passed through the markup pass: TeX is full of `_`, `^` and
 * `~`, so `$x_1$` would otherwise be eaten by the italic / subscript rules.
 */
export function inline(text: string): ReactNode {
  const segments = splitNotation(text ?? "");
  if (segments.length === 1 && segments[0].kind === "text") return markup(segments[0].value);
  return segments.map((seg, i) =>
    seg.kind === "math" ? <Math key={i} tex={seg.tex} display={seg.display} /> : <Fragment key={i}>{markup(seg.value)}</Fragment>
  );
}

/** The markup half of `inline()`. Colour is inherited except inside `<mark>`. */
function markup(text: string): ReactNode {
  const re = new RegExp(INLINE_RE.source, "g");
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const g = m.groups ?? {};
    if (m.index > last) nodes.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);

    if (g.linkText !== undefined) {
      const href = safeUrl(g.linkUrl ?? "");
      nodes.push(
        href ? (
          <a
            key={key++}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 font-semibold text-brand-600 break-words"
          >
            {g.linkText}
          </a>
        ) : (
          // A refused scheme still shows its label — the author's words are not
          // swallowed just because the URL was unusable.
          <Fragment key={key++}>{g.linkText}</Fragment>
        )
      );
    } else if (g.bold !== undefined) nodes.push(<strong key={key++} className="font-bold">{g.bold}</strong>);
    else if (g.italic !== undefined || g.italic2 !== undefined) nodes.push(<em key={key++} className="italic">{(g.italic ?? g.italic2) as string}</em>);
    else if (g.hl !== undefined)
      nodes.push(
        <mark
          key={key++}
          className="rounded px-0.5"
          style={{ background: HIGHLIGHT_COLORS[(g.hlColor as HighlightColor) ?? "jaune"], color: HIGHLIGHT_INK }}
        >
          {g.hl}
        </mark>
      );
    else if (g.underline !== undefined) nodes.push(<u key={key++} className="underline underline-offset-2">{g.underline}</u>);
    else if (g.sup !== undefined) nodes.push(<sup key={key++} className="text-[0.75em] align-super">{g.sup}</sup>);
    else nodes.push(<sub key={key++} className="text-[0.75em] align-sub">{g.sub as string}</sub>);

    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return nodes;
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
        return { embed: `https://www.youtube-nocookie.com/embed/${id}${list ? `?list=${encodeURIComponent(list)}` : ""}`, href, provider: "youtube" };
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

/**
 * A video block. An embeddable provider gets a responsive 16:9 player; anything
 * else gets a real, clickable card so the link still reaches its destination
 * instead of sitting in the page as inert text — which is exactly what used to
 * happen to the client's YouTube link.
 */
export function VideoBlock({ url, label }: { url: string; label?: string }) {
  const { lang } = useI18n();
  const { embed, href } = parseVideo(url);

  if (embed) {
    return (
      <div className="my-4 w-full rounded-2xl overflow-hidden border border-border bg-black">
        <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
          <iframe
            src={embed}
            title={label || (lang === "fr" ? "Vidéo du cours" : "Lesson video")}
            className="absolute inset-0 w-full h-full"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  if (!href) {
    return (
      <div className="my-4 rounded-xl border border-dashed border-ink-300 px-3.5 py-3 text-[12px] text-muted">
        {lang === "fr" ? "Lien vidéo invalide" : "Invalid video link"}
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="my-4 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 no-underline"
    >
      <span className="flex-none w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-bold text-ink-900 leading-snug">{label || (lang === "fr" ? "Regarder la vidéo" : "Watch the video")}</span>
        <span className="block text-[11px] text-muted truncate">{href}</span>
      </span>
    </a>
  );
}

/* ─────────────────────────── lists ─────────────────────────────────────── */

interface ListItem {
  text: string;
  /** 0 = top level, 1 = one nesting level (the editor's indent button). */
  depth: number;
}

/** Render a flat depth-tagged item array as (optionally nested) real lists. */
function renderList(items: ListItem[], ordered: boolean, itemClass: string, keyBase: string, topClass: string): ReactNode {
  const Tag = ordered ? "ol" : "ul";
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < items.length) {
    const item = items[i];
    const children: ListItem[] = [];
    let j = i + 1;
    while (j < items.length && items[j].depth > item.depth) {
      children.push({ ...items[j], depth: items[j].depth - 1 });
      j++;
    }
    out.push(
      <li key={`${keyBase}-${key++}`} className={itemClass}>
        {inline(item.text)}
        {children.length > 0 && renderList(children, ordered, itemClass, `${keyBase}-${key}`, "mt-1 pl-[1.1em]")}
      </li>
    );
    i = j;
  }
  return (
    <Tag className={`${ordered ? "list-decimal" : "list-disc"} ${topClass}`}>{out}</Tag>
  );
}

/** Leading-space depth, capped at one nesting level (the toolbar's indent). */
function indentDepth(rawLine: string): number {
  const spaces = rawLine.match(/^[ \t]*/)?.[0] ?? "";
  const width = spaces.replace(/\t/g, "  ").length;
  return width >= 2 ? 1 : 0;
}

const BULLET_RE = /^(?:-|•|–)\s+(.*)$/;
const ORDERED_RE = /^\d+[.)]\s+(.*)$/;

/* ───────────────────── card-field block renderer ───────────────────────── */

/**
 * Colour-inheriting block renderer for the SHORT rich fields on story cards
 * (point / sous-titre / explication / astuces / pièges). Unlike `LessonContent`
 * — styled for the light document viewer with fixed dark text — this inherits
 * its colour and sizing from the surrounding card block, so the same markup
 * renders correctly on the dark card front and the light card back.
 *
 * Supports the subset of the lesson mini-markup that makes sense inside a card
 * field: headings, bulleted AND numbered lists (one nesting level), an inline
 * `[[IMG]]` token placing the card's own image, `[[VIDEO: url]]`, and all the
 * inline marks.
 */
export function RichCardText({ text, image }: { text: string; image?: ReactNode }) {
  const lines = (text ?? "").replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let list: { items: ListItem[]; ordered: boolean } | null = null;
  let key = 0;
  const flush = () => {
    if (list && list.items.length) {
      out.push(
        <Fragment key={key++}>{renderList(list.items, list.ordered, "", `cl${key}`, "pl-[1.2em] flex flex-col gap-1 my-1.5")}</Fragment>
      );
    }
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const depth = indentDepth(rawLine);
    const bullet = line.match(BULLET_RE);
    const ordered = line.match(ORDERED_RE);
    if (bullet || ordered) {
      const isOrdered = Boolean(ordered);
      if (list && list.ordered !== isOrdered) flush();
      (list ??= { items: [], ordered: isOrdered }).items.push({ text: (bullet?.[1] ?? ordered?.[1]) as string, depth });
      continue;
    }
    flush();
    if (line === "") continue;

    let mm: RegExpMatchArray | null;
    if ((mm = line.match(/^\$\$([\s\S]+)\$\$$/))) out.push(<Math key={key++} tex={mm[1].trim()} display />);
    else if ((mm = line.match(/^##\s+(.*)$/)))
      out.push(
        <div key={key++} className="font-serif font-bold text-[1.22em] leading-snug mt-2 mb-1 first:mt-0">
          {inline(mm[1])}
        </div>
      );
    else if ((mm = line.match(/^###\s+(.*)$/)))
      out.push(
        <div key={key++} className="font-bold text-[1.08em] leading-snug mt-1.5 mb-0.5">
          {inline(mm[1])}
        </div>
      );
    else if ((mm = line.match(/^\[\[VIDEO:\s*(.*?)\]\]$/i))) out.push(<VideoBlock key={key++} url={mm[1]} />);
    else if (/^\[\[IMG(?::[^\]]*)?\]\]$/i.test(line)) {
      if (image) out.push(<div key={key++} className="my-2">{image}</div>);
    } else out.push(<p key={key++} className="my-1 first:mt-0 last:mb-0">{inline(line)}</p>);
  }
  flush();
  return <>{out}</>;
}

/** True when a card text field asks for the card image to be placed inline. */
export function hasInlineImageToken(...texts: (string | null | undefined)[]): boolean {
  return texts.some((s) => s != null && /\[\[IMG(?::[^\]]*)?\]\]/i.test(s));
}

/* ─────────────────────────── images ────────────────────────────────────── */

/**
 * Optional options on an image placeholder, after the caption:
 *   [[IMG: caption]]                        → full width, centred (the default,
 *                                             and what all existing content uses)
 *   [[IMG: caption | w=60]]                 → 60% of the column width
 *   [[IMG: caption | align=right]]          → pushed right on wide screens
 *   [[IMG: caption | credit=OMS 2024]]      → source line under the figure
 *   [[IMG: caption | source=https://…]]     → the credit becomes a link
 *   [[IMG: caption | alt=texte alternatif]] → screen-reader text
 * Unknown options are ignored, so a typo degrades to the default rather than
 * breaking the lesson.
 */
export interface ImageOptions {
  widthPct?: number;
  align?: "left" | "center" | "right";
  credit?: string;
  sourceUrl?: string;
  alt?: string;
  author?: string;
}

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
    }
  }
  return { caption, options };
}

/** Image metadata as stored on `media_library` (migration 0021), per slot. */
export type SlotMeta = { url: string } & ImageMeta;

/** `images` accepts either a bare URL per slot or a URL plus its references. */
export type SlotImages = Record<number, string | SlotMeta>;

function slotUrl(v: string | SlotMeta | undefined): string | undefined {
  return typeof v === "string" ? v : v?.url;
}

function ImageBlock({ caption, url, meta, options }: { caption: string; url?: string; meta?: ImageMeta; options?: ImageOptions }) {
  const { t } = useI18n();
  // Alignment is margin-based rather than a CSS float: a floated figure inside
  // the narrow mobile reading column produces text slivers beside the image.
  const width = options?.widthPct ? `${options.widthPct}%` : "100%";
  const align = options?.align ?? "center";
  const style = {
    width,
    maxWidth: "100%",
    marginLeft: align === "right" ? "auto" : align === "center" ? "auto" : undefined,
    marginRight: align === "left" ? "auto" : align === "center" ? "auto" : undefined,
  };

  // The placeholder spec and the stored media row can each carry references;
  // whatever the author typed inline wins, since it is the more specific one.
  const refs: ImageMeta = {
    caption: options?.credit ? caption : meta?.caption ?? caption,
    credit: options?.credit ?? meta?.credit,
    creditUrl: options?.sourceUrl ?? meta?.creditUrl,
    author: options?.author ?? meta?.author,
  };
  const altText = options?.alt ?? meta?.caption ?? caption;
  const creditLine = [refs.author, refs.credit].filter(Boolean).join(" · ");

  if (url) {
    return (
      <figure className="my-4" style={style}>
        <ZoomableImage
          src={url}
          alt={altText}
          meta={refs}
          className="w-full rounded-2xl border border-border object-contain bg-ink-50"
        />
        <figcaption className="mt-1.5 text-[11px] text-muted text-center leading-snug">
          {caption}
          {creditLine && (
            <span className="block text-[10px] opacity-80 mt-0.5">
              {refs.creditUrl ? (
                <a href={refs.creditUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  {creditLine}
                </a>
              ) : (
                creditLine
              )}
            </span>
          )}
        </figcaption>
      </figure>
    );
  }
  return (
    <figure className="my-4">
      <div className="w-full aspect-[16/10] rounded-2xl border-[1.5px] border-dashed border-ink-300 bg-ink-50 flex flex-col items-center justify-center gap-2 text-center px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-ink-100 flex items-center justify-center text-ink-700">
          <Icon name="upload" size={17} />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{t("lesson_imgLabel")}</div>
        <div className="text-[12px] font-semibold text-text leading-snug max-w-[85%]">{caption}</div>
      </div>
      <figcaption className="mt-1.5 text-[10.5px] font-mono text-muted text-center">{t("lesson_imgToUpload")}</figcaption>
    </figure>
  );
}

function Callout({ kind, text }: { kind: "piege" | "info"; text: string }) {
  const { t } = useI18n();
  const isPiege = kind === "piege";
  // LeFax design callouts: amber "exam trap" and blue "key point", each with a
  // 4px left accent border and a tinted fill.
  const s = isPiege
    ? { bg: "#fff4e0", border: "#f5b400", label: "#a35b00", body: "#5c3b00", mark: "⚠" }
    : { bg: "#e8f4ff", border: "#29b6f6", label: "#0b5f96", body: "#0b4a75", mark: "ℹ" };
  const label = isPiege ? t("lesson_calloutPiege") : t("lesson_calloutInfo");
  return (
    <div className="my-4 rounded-lg px-3.5 py-3" style={{ background: s.bg, borderLeft: `4px solid ${s.border}` }}>
      <div className="font-serif font-bold text-[12px] mb-1" style={{ color: s.label }}>
        {s.mark} {label}
      </div>
      <div className="text-[13px] leading-[1.55]" style={{ color: s.body }}>
        {inline(text)}
      </div>
    </div>
  );
}

function AppBox({ consigne, correction }: { consigne: string; correction: string }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  return (
    <div className="my-3.5 rounded-xl border-[1.5px] border-brand-600/30 bg-brand-600/[0.06] px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-bold mb-1.5 text-brand-600">
        <Icon name="wand" size={13} />
        {t("lesson_calloutApp")}
      </div>
      <div className="text-[12.5px] leading-relaxed text-text mb-2.5">{inline(consigne)}</div>
      {correction &&
        (show ? (
          <div className="rounded-lg bg-card border border-border px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wide text-success-600 mb-1">{t("corr_title")}</div>
            <div className="text-[12.5px] leading-relaxed text-text">{inline(correction)}</div>
            <button onClick={() => setShow(false)} className="mt-2 text-[11px] font-bold text-muted border-none bg-transparent p-0">
              {t("lesson_hideCorrection")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShow(true)}
            className="w-full py-2 rounded-lg border-[1.5px] border-brand-600/40 bg-card text-brand-600 text-[12px] font-bold"
          >
            {t("lesson_showCorrection")}
          </button>
        ))}
    </div>
  );
}

/* ─────────────────────────── block parser ──────────────────────────────── */

type Block =
  | { type: "h2" | "h3" | "p"; text: string }
  | { type: "list"; ordered: boolean; items: ListItem[] }
  | { type: "img"; caption: string; slot: number; options: ImageOptions }
  | { type: "video"; url: string }
  | { type: "callout"; kind: "piege" | "info"; text: string }
  | { type: "app"; consigne: string; correction: string }
  | { type: "math"; tex: string };

function parse(raw: string): Block[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let list: { items: ListItem[]; ordered: boolean } | null = null;
  let imgSlot = 0;
  // Collecting the body of a `$$` … `$$` display-equation fence. Inside it,
  // blank lines and markup characters are TeX, not markup, so the fence is
  // checked before every other rule.
  let fence: string[] | null = null;
  const flush = () => {
    if (list && list.items.length) blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  };

  for (const rawLine of lines) {
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

    const bullet = line.match(BULLET_RE);
    const ordered = line.match(ORDERED_RE);
    if (bullet || ordered) {
      const isOrdered = Boolean(ordered);
      if (list && list.ordered !== isOrdered) flush();
      (list ??= { items: [], ordered: isOrdered }).items.push({ text: (bullet?.[1] ?? ordered?.[1]) as string, depth: indentDepth(rawLine) });
      continue;
    }
    flush();
    if (line === "") continue;

    let m: RegExpMatchArray | null;
    if ((m = line.match(/^##\s+(.*)$/))) blocks.push({ type: "h2", text: m[1] });
    else if ((m = line.match(/^###\s+(.*)$/))) blocks.push({ type: "h3", text: m[1] });
    else if ((m = line.match(/^\[\[IMG:\s*(.*?)\]\]$/i))) {
      const spec = parseImageSpec(m[1]);
      blocks.push({ type: "img", caption: spec.caption, slot: ++imgSlot, options: spec.options });
    } else if ((m = line.match(/^\[\[VIDEO:\s*(.*?)\]\]$/i))) blocks.push({ type: "video", url: m[1].trim() });
    else if ((m = line.match(/^\[!PIEGE\]\s*(.*)$/i))) blocks.push({ type: "callout", kind: "piege", text: m[1] });
    else if ((m = line.match(/^\[!INFO\]\s*(.*)$/i))) blocks.push({ type: "callout", kind: "info", text: m[1] });
    else if ((m = line.match(/^\[!APP\]\s*(.*)$/i))) {
      const [consigne, correction = ""] = m[1].split("|||");
      blocks.push({ type: "app", consigne: consigne.trim(), correction: correction.trim() });
    } else blocks.push({ type: "p", text: line });
  }
  // An unterminated fence is still an equation the author meant to write —
  // render it rather than swallowing the text.
  if (fence && fence.length) blocks.push({ type: "math", tex: fence.join("\n").trim() });
  flush();
  return blocks;
}

/** List a lesson's image placeholders (1-based slot + caption) for the editor. */
export function parseImagePlaceholders(text: string): { slot: number; caption: string }[] {
  return parse(text ?? "")
    .filter((b): b is Extract<Block, { type: "img" }> => b.type === "img")
    .map((b) => ({ slot: b.slot, caption: b.caption }));
}

/** `images` maps a placeholder slot (1-based) to a URL, or to URL + references. */
export function LessonContent({ text, images }: { text: string; images?: SlotImages }) {
  const blocks = parse(text ?? "");
  return (
    <div className="flex flex-col">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h2":
            // Clear hierarchy: a section title must read as clearly bigger than a
            // sub-heading and body text (Correction N4: "les grands titres sont
            // moins grands que les sous-titres").
            return (
              <h2 key={i} className="font-serif font-bold text-[18px] text-text mt-4 mb-2 first:mt-0">
                {inline(b.text)}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="font-bold text-[15px] text-text mt-3 mb-1.5">
                {inline(b.text)}
              </h3>
            );
          case "p":
            return (
              <p key={i} className="text-[13.5px] leading-relaxed text-text mb-2.5">
                {inline(b.text)}
              </p>
            );
          case "list":
            return (
              <Fragment key={i}>
                {renderList(b.items, b.ordered, "text-[13px] text-text leading-normal", `l${i}`, "pl-[18px] flex flex-col gap-1.5 mb-3")}
              </Fragment>
            );
          case "math":
            return <Math key={i} tex={b.tex} display />;
          case "img": {
            const slot = images?.[b.slot];
            const meta = typeof slot === "object" ? slot : undefined;
            return <ImageBlock key={i} caption={b.caption} url={slotUrl(slot)} meta={meta} options={b.options} />;
          }
          case "video":
            return <VideoBlock key={i} url={b.url} />;
          case "callout":
            return <Callout key={i} kind={b.kind} text={b.text} />;
          case "app":
            return <AppBox key={i} consigne={b.consigne} correction={b.correction} />;
        }
      })}
    </div>
  );
}
