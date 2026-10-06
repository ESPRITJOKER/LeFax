import { Fragment, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { useI18n } from "./i18n";
import { Math, splitNotation } from "./math";
import { ZoomableImage, type ImageMeta } from "../components/ImageLightbox";
import {
  BULLET_RE,
  DIVIDER_RE,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_INK,
  INLINE_RE,
  ORDERED_RE,
  QUOTE_RE,
  TABLE_LINE_RE,
  indentDepth,
  parse,
  parseVideo,
  readAlign,
  rowAlignment,
  safeUrl,
  splitRow,
  type Block,
  type CellAlign,
  type ImageOptions,
  type ListItem,
} from "./markupSyntax";

/**
 * Renderers for lesson bodies (lessons.content_fr / content_en) and for the rich
 * text fields on story cards. Lesson text is stored as a line-based mini-markup
 * so authors, the editor's ribbon and the AI pipeline can write rich
 * micro-learning content into plain `text` columns without a heavy Markdown/MDX
 * dependency.
 *
 * The grammar and the parser live in `./markupSyntax` — pure string work, no
 * React and no KaTeX, so that a plain `node` script can assert on them. This
 * file is the React half: it turns `Block[]` into elements. Import the grammar
 * from `./markupSyntax` directly rather than re-exporting it here; a `.tsx` file
 * that exports non-components trips `react-refresh/only-export-components` for
 * every one of them.
 */


/* ─────────────────────────── inline rendering ──────────────────────────── */

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

    if (g.code !== undefined) {
      nodes.push(
        <code key={key++} className="font-mono text-[0.88em] rounded px-1 py-px bg-ink-100 text-ink-900">
          {g.code}
        </code>
      );
    } else if (g.linkText !== undefined) {
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
          style={{ background: HIGHLIGHT_COLORS[(g.hlColor as keyof typeof HIGHLIGHT_COLORS) ?? "jaune"], color: HIGHLIGHT_INK }}
        >
          {g.hl}
        </mark>
      );
    else if (g.underline !== undefined) nodes.push(<u key={key++} className="underline underline-offset-2">{g.underline}</u>);
    else if (g.strike !== undefined) nodes.push(<s key={key++} className="line-through">{g.strike}</s>);
    else if (g.sup !== undefined) nodes.push(<sup key={key++} className="text-[0.75em] align-super">{g.sup}</sup>);
    else nodes.push(<sub key={key++} className="text-[0.75em] align-sub">{g.sub as string}</sub>);

    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return nodes;
}

/* ─────────────────────────── video ─────────────────────────────────────── */

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
  return <Tag className={`${ordered ? "list-decimal" : "list-disc"} ${topClass}`}>{out}</Tag>;
}

/* ─────────────────── alignment / table / quote / divider ───────────────── */

function alignClass(align?: CellAlign): string {
  return align === "center" ? "text-center" : align === "right" ? "text-right" : "";
}

/**
 * A pipe table.
 *
 * No `/opacity` modifiers anywhere in here, and that is not a style preference:
 * this project's colour tokens are bare `var(--color-…)` values, and Tailwind
 * cannot parse those, so it drops a class like `border-ink-300/40` from the
 * stylesheet **entirely** — the element then gets no border colour at all. A
 * tint has to be its own token. The card variant sits on a surface that is dark
 * in both themes, so there it uses literal `white/α`, which Tailwind does
 * compile.
 */
function TableBlock({
  head,
  rows,
  align,
  inherit,
}: {
  head: string[] | null;
  rows: string[][];
  align: CellAlign[];
  /** Card fields inherit their colour from a dark surface — see above. */
  inherit?: boolean;
}) {
  // `Math` is the KaTeX component in this module, so no Math.max here.
  const width = [head?.length ?? 0, ...rows.map((r) => r.length)].reduce((a, b) => (b > a ? b : a), 1);
  const cell = (i: number) => {
    const a = align[i] ?? "left";
    return a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";
  };
  const rule = inherit ? "border-white/20" : "border-border";
  const pad = inherit ? "px-2 py-1" : "px-2.5 py-1.5";

  // The wrapper scrolls, not the page: a four-column table cannot be made to fit
  // the 360px reading column, and letting it overflow would push the whole lesson
  // sideways. Two or three short columns simply wrap, which is the common case.
  return (
    <div className={`${inherit ? "my-2" : "my-4"} w-full overflow-x-auto rounded-xl border ${rule}`}>
      <table className={`w-full border-collapse ${inherit ? "text-[0.92em]" : "text-[12.5px] text-text"}`}>
        {head && (
          <thead>
            <tr>
              {Array.from({ length: width }, (_, i) => (
                <th
                  key={i}
                  scope="col"
                  className={`border-b ${rule} ${pad} font-bold align-top ${cell(i)} ${inherit ? "bg-white/10" : "bg-ink-50 text-ink-900"}`}
                >
                  {inline(head[i] ?? "")}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {Array.from({ length: width }, (_, i) => (
                <td key={i} className={`border-b ${rule} ${pad} align-top leading-snug ${cell(i)}`}>
                  {inline(row[i] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Quote({ lines, inherit }: { lines: string[]; inherit?: boolean }) {
  return (
    <blockquote
      className={`${inherit ? "my-2 pl-3 border-white/40" : "my-3.5 pl-3.5 border-brand-600 text-[13px] leading-relaxed text-muted"} border-l-[3px] italic`}
    >
      {lines.map((l, i) => (
        <p key={i} className={i === 0 ? "" : "mt-1.5"}>
          {inline(l)}
        </p>
      ))}
    </blockquote>
  );
}

function Divider({ inherit }: { inherit?: boolean }) {
  return <hr className={`border-0 border-t ${inherit ? "my-2.5 border-white/20" : "my-5 border-border"}`} />;
}

/* ───────────────────── card-field block renderer ───────────────────────── */

/**
 * Colour-inheriting block renderer for the SHORT rich fields on story cards
 * (point / sous-titre / explication / astuces / pièges). Unlike `LessonContent`
 * — styled for the light document viewer with fixed dark text — this inherits
 * its colour and sizing from the surrounding card block, so the same markup
 * renders correctly on the dark card front and the light card back.
 *
 * It renders the whole block grammar the lesson body does, including tables,
 * even though the card ribbon does not offer a table button: content moves
 * between the body and the card fields (AI generation, copy-paste), and a field
 * that silently dropped a table is how rows disappear without anyone noticing.
 */
export function RichCardText({ text, image }: { text: string; image?: ReactNode }) {
  const lines = (text ?? "").replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let list: { items: ListItem[]; ordered: boolean } | null = null;
  let quote: string[] | null = null;
  let key = 0;
  const flushList = () => {
    if (list && list.items.length) {
      out.push(<Fragment key={key++}>{renderList(list.items, list.ordered, "", `cl${key}`, "pl-[1.2em] flex flex-col gap-1 my-1.5")}</Fragment>);
    }
    list = null;
  };
  const flushQuote = () => {
    if (quote && quote.length) out.push(<Quote key={key++} lines={quote} inherit />);
    quote = null;
  };
  const flush = () => {
    flushList();
    flushQuote();
  };

  for (let li = 0; li < lines.length; li += 1) {
    const rawLine = lines[li];
    const line = rawLine.trim();
    const depth = indentDepth(rawLine);

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
      out.push(
        align ? (
          <TableBlock key={key++} head={rows[0]} rows={rows.slice(2)} align={align} inherit />
        ) : (
          <TableBlock key={key++} head={null} rows={rows} align={[]} inherit />
        )
      );
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
      (list ??= { items: [], ordered: isOrdered }).items.push({ text: (bullet?.[1] ?? ordered?.[1]) as string, depth });
      continue;
    }
    flush();
    if (line === "") continue;

    if (DIVIDER_RE.test(line)) {
      out.push(<Divider key={key++} inherit />);
      continue;
    }

    const { align: lineAlign, rest } = readAlign(line);
    const ac = alignClass(lineAlign);

    let mm: RegExpMatchArray | null;
    if ((mm = rest.match(/^\$\$([\s\S]+)\$\$$/))) out.push(<Math key={key++} tex={mm[1].trim()} display />);
    else if ((mm = rest.match(/^##\s+(.*)$/)))
      out.push(
        <div key={key++} className={`font-serif font-bold text-[1.22em] leading-snug mt-2 mb-1 first:mt-0 ${ac}`}>
          {inline(mm[1])}
        </div>
      );
    else if ((mm = rest.match(/^###\s+(.*)$/)))
      out.push(
        <div key={key++} className={`font-bold text-[1.08em] leading-snug mt-1.5 mb-0.5 ${ac}`}>
          {inline(mm[1])}
        </div>
      );
    else if ((mm = rest.match(/^#\s+(.*)$/)))
      out.push(
        <div key={key++} className={`font-serif font-bold text-[1.35em] leading-snug mt-2 mb-1 first:mt-0 ${ac}`}>
          {inline(mm[1])}
        </div>
      );
    else if ((mm = rest.match(/^\[\[VIDEO:\s*(.*?)\]\]$/i))) out.push(<VideoBlock key={key++} url={mm[1]} />);
    else if (/^\[\[IMG(?::[^\]]*)?\]\]$/i.test(rest)) {
      if (image) out.push(<div key={key++} className="my-2">{image}</div>);
    } else out.push(<p key={key++} className={`my-1 first:mt-0 last:mb-0 ${ac}`}>{inline(rest)}</p>);
  }
  flush();
  return <>{out}</>;
}

/* ─────────────────────────── images ────────────────────────────────────── */

/** Image metadata as stored on `media_library` (migrations 0021/0022), per slot. */
export type SlotMeta = { url: string } & ImageMeta;

/**
 * Uploaded lesson images, addressed by stable image key (migration 0022) AND by
 * 1-based positional slot — the loaders file every row under both, so a token
 * that carries `key=…` resolves by key and every keyless token written before
 * the image dialog existed still resolves by position. The value is either a
 * bare URL or a URL plus its references.
 */
export type SlotImages = Record<string, string | SlotMeta>;

/** The columns of a `media_library` row this module needs. */
export interface MediaRowLike {
  storage_path: string;
  image_slot?: number | null;
  image_key?: string | null;
  caption?: string | null;
  credit?: string | null;
  credit_url?: string | null;
}

/**
 * Turn `media_library` rows into the renderer's image map.
 *
 * Rows with neither a key nor a slot are generic library uploads, not lesson
 * figures, and are skipped here rather than filtered in the query: an
 * `image_key` filter would make the whole PostgREST request fail with 42703
 * anywhere migration 0022 has not been applied yet, which is the same trap the
 * callers' `select("*")` exists to avoid.
 */
export function buildImageMap(rows: MediaRowLike[] | null | undefined): SlotImages {
  const map: SlotImages = {};
  for (const row of rows ?? []) {
    if (!row.storage_path) continue;
    const meta: SlotMeta = {
      url: row.storage_path,
      caption: row.caption ?? null,
      credit: row.credit ?? null,
      creditUrl: row.credit_url ?? null,
    };
    // The column may be absent at runtime even though the type declares it: the
    // types describe the intended schema, this read tolerates the older one.
    const k = row.image_key ?? null;
    if (k) map[k] = meta;
    if (row.image_slot != null) map[row.image_slot] = meta;
  }
  return map;
}

function slotUrl(v: string | SlotMeta | undefined): string | undefined {
  return typeof v === "string" ? v : v?.url;
}

/** Key first, position second — see {@link SlotImages}. */
function resolveImage(images: SlotImages | undefined, key: string | undefined, slot: number): string | SlotMeta | undefined {
  if (!images) return undefined;
  if (key && images[key] !== undefined) return images[key];
  return images[slot];
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
        <ZoomableImage src={url} alt={altText} meta={refs} className="w-full rounded-2xl border border-border object-contain bg-ink-50" />
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

/* ─────────────────────────── callouts ──────────────────────────────────── */

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
    <div className="my-3.5 rounded-xl border-[1.5px] border-brand-600 bg-ink-50 px-3.5 py-3">
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
            className="w-full py-2 rounded-lg border-[1.5px] border-brand-600 bg-card text-brand-600 text-[12px] font-bold"
          >
            {t("lesson_showCorrection")}
          </button>
        ))}
    </div>
  );
}

/* ─────────────────────────── lesson renderer ───────────────────────────── */

/** `images` maps a stable image key and/or a 1-based slot to a URL + references. */
export function LessonContent({ text, images }: { text: string; images?: SlotImages }) {
  const blocks: Block[] = parse(text ?? "");
  return (
    <div className="flex flex-col">
      {blocks.map((b, i) => {
        switch (b.type) {
          // The heading ladder is `#`→h2, `##`→h3, `###`→h4, not h1/h2/h3: the
          // page's only `<h1>` is the lesson title in the reader's own header,
          // and a second one would break the document outline. The sizes below
          // are unchanged from before `#` existed, so nothing looks different.
          case "h1":
            return (
              <h2 key={i} className={`font-serif font-bold text-[21px] text-text mt-5 mb-2 first:mt-0 ${alignClass(b.align)}`}>
                {inline(b.text)}
              </h2>
            );
          case "h2":
            // Clear hierarchy: a section title must read as clearly bigger than a
            // sub-heading and body text (Correction N4: "les grands titres sont
            // moins grands que les sous-titres").
            return (
              <h3 key={i} className={`font-serif font-bold text-[18px] text-text mt-4 mb-2 first:mt-0 ${alignClass(b.align)}`}>
                {inline(b.text)}
              </h3>
            );
          case "h3":
            return (
              <h4 key={i} className={`font-bold text-[15px] text-text mt-3 mb-1.5 ${alignClass(b.align)}`}>
                {inline(b.text)}
              </h4>
            );
          case "p":
            return (
              <p key={i} className={`text-[13.5px] leading-relaxed text-text mb-2.5 ${alignClass(b.align)}`}>
                {inline(b.text)}
              </p>
            );
          case "list":
            return (
              <Fragment key={i}>
                {renderList(b.items, b.ordered, "text-[13px] text-text leading-normal", `l${i}`, "pl-[18px] flex flex-col gap-1.5 mb-3")}
              </Fragment>
            );
          case "table":
            return <TableBlock key={i} head={b.head} rows={b.rows} align={b.align} />;
          case "quote":
            return <Quote key={i} lines={b.lines} />;
          case "hr":
            return <Divider key={i} />;
          case "math":
            return <Math key={i} tex={b.tex} display />;
          case "img": {
            const bound = resolveImage(images, b.options.key, b.slot);
            const meta = typeof bound === "object" ? bound : undefined;
            return <ImageBlock key={i} caption={b.caption} url={slotUrl(bound)} meta={meta} options={b.options} />;
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
