import { Fragment, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { useI18n } from "./i18n";

/**
 * Lightweight, dependency-free renderer for lesson bodies (lessons.content_fr /
 * content_en). Lesson text is stored as a line-based mini-markup so authors and
 * the AI pipeline can write rich micro-learning content into a plain `text`
 * column without a heavy Markdown/MDX dependency.
 *
 * Grammar (one construct per line, blocks separated by blank lines):
 *   ## Heading                     → section heading
 *   ### Sub-heading                → sub-heading
 *   - item                         → bullet (consecutive lines grouped)
 *   [[IMG: caption]]               → captioned image-upload placeholder. The
 *                                    caption identifies exactly which diagram an
 *                                    admin should upload here (CDC 6.7 media).
 *   [!PIEGE] text                  → "watch out" callout (common exam trap)
 *   [!INFO] text                   → note / etymology / historical marker
 *   [!APP] consigne ||| correction → self-test box; correction hidden behind a
 *                                    toggle so students try first
 *   plain text                     → paragraph
 * Inline **bold** and *italic* / _italic_ are supported everywhere. Italics are
 * kept (and not flattened to bold) so emphasis from the source texts survives —
 * a wall of uniform bold is tiring and doesn't help memory (Correction N3).
 */

/**
 * Render inline markup inside a single line of text:
 *   **bold**              → <strong>
 *   *italic* / _italic_   → <em>
 *   ==highlight==         → <mark>  (yellow marker — "mettre en valeur", Correction N4)
 *   __underline__         → <u>
 * Colour is inherited from the surrounding text, so this renders correctly on
 * both the light document viewer and the dark story cards. The italic forms
 * require a non-space right after the opening mark so a lone `*` (e.g. "2 * 3")
 * is left untouched. `__underline__` is matched before single-`_` italic so a
 * double underscore is never mistaken for two italic runs.
 */
export function inline(text: string): ReactNode {
  const re = /\*\*([^*]+?)\*\*|\*([^\s*][^*]*?)\*|==([^=]+?)==|__([^_]+?)__|_([^\s_][^_]*?)_/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);
    if (m[1] !== undefined) nodes.push(<strong key={key++} className="font-bold">{m[1]}</strong>);
    else if (m[2] !== undefined || m[5] !== undefined) nodes.push(<em key={key++} className="italic">{(m[2] ?? m[5]) as string}</em>);
    else if (m[3] !== undefined) nodes.push(<mark key={key++} className="rounded px-0.5" style={{ background: "#fff2a8", color: "inherit" }}>{m[3]}</mark>);
    else nodes.push(<u key={key++} className="underline underline-offset-2">{m[4] as string}</u>);
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return nodes;
}

/**
 * Colour-inheriting block renderer for the SHORT rich fields on story cards
 * (point / sous-titre / explication / astuces / pièges). Unlike `LessonContent`
 * — which is styled for the light document viewer with fixed dark text — this
 * inherits its colour and sizing from the surrounding card block, so the same
 * markup renders correctly on the dark card front and the light card back.
 *
 * Supports the subset of the lesson mini-markup that makes sense inside a card
 * field, so an admin can structure an explanation the same way everywhere:
 *   ## Titre / ### Sous-titre → headings (sized in `em`, relative to the block)
 *   - item  /  • item         → bullet list, one item per line (Correction N4:
 *                               a "- a - b - c" list was collapsing onto one
 *                               line because the field ran through `inline()`
 *                               only, which ignores line breaks)
 *   [[IMG]] / [[IMG: …]]      → the card's uploaded image, placed inline exactly
 *                               where the admin dropped the token (Correction N4:
 *                               "insérer une image même dans les explications")
 *   blank line                → paragraph break; **bold** *italic* ==surligné==
 *                               __souligné__ inline everywhere.
 */
export function RichCardText({ text, image }: { text: string; image?: ReactNode }) {
  const lines = (text ?? "").replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let list: string[] | null = null;
  let key = 0;
  const flush = () => {
    if (list && list.length) {
      out.push(
        <ul key={key++} className="list-disc pl-[1.2em] flex flex-col gap-1 my-1.5">
          {list.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ul>
      );
    }
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const bullet = line.match(/^(?:-|•|–)\s+(.*)$/);
    if (bullet) {
      (list ??= []).push(bullet[1]);
      continue;
    }
    flush();
    if (line === "") continue;

    let mm: RegExpMatchArray | null;
    if ((mm = line.match(/^##\s+(.*)$/))) out.push(<div key={key++} className="font-serif font-bold text-[1.22em] leading-snug mt-2 mb-1 first:mt-0">{inline(mm[1])}</div>);
    else if ((mm = line.match(/^###\s+(.*)$/))) out.push(<div key={key++} className="font-bold text-[1.08em] leading-snug mt-1.5 mb-0.5">{inline(mm[1])}</div>);
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

function ImageBlock({ caption, url }: { caption: string; url?: string }) {
  const { t } = useI18n();
  if (url) {
    return (
      <figure className="my-4">
        <img src={url} alt={caption} className="w-full rounded-2xl border border-border object-contain bg-ink-50" />
        <figcaption className="mt-1.5 text-[11px] text-muted text-center leading-snug">{caption}</figcaption>
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
          <div className="rounded-lg bg-white border border-border px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wide text-success-600 mb-1">{t("corr_title")}</div>
            <div className="text-[12.5px] leading-relaxed text-text">{inline(correction)}</div>
            <button onClick={() => setShow(false)} className="mt-2 text-[11px] font-bold text-muted border-none bg-transparent p-0">
              {t("lesson_hideCorrection")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShow(true)}
            className="w-full py-2 rounded-lg border-[1.5px] border-brand-600/40 bg-white text-brand-600 text-[12px] font-bold"
          >
            {t("lesson_showCorrection")}
          </button>
        ))}
    </div>
  );
}

type Block =
  | { type: "h2" | "h3" | "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "img"; caption: string; slot: number }
  | { type: "callout"; kind: "piege" | "info"; text: string }
  | { type: "app"; consigne: string; correction: string };

function parse(raw: string): Block[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let list: string[] | null = null;
  let imgSlot = 0;
  const flush = () => {
    if (list && list.length) blocks.push({ type: "ul", items: list });
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const bullet = line.match(/^-\s+(.*)$/);
    if (bullet) {
      (list ??= []).push(bullet[1]);
      continue;
    }
    flush();
    if (line === "") continue;

    let m: RegExpMatchArray | null;
    if ((m = line.match(/^##\s+(.*)$/))) blocks.push({ type: "h2", text: m[1] });
    else if ((m = line.match(/^###\s+(.*)$/))) blocks.push({ type: "h3", text: m[1] });
    else if ((m = line.match(/^\[\[IMG:\s*(.*?)\]\]$/i))) blocks.push({ type: "img", caption: m[1], slot: ++imgSlot });
    else if ((m = line.match(/^\[!PIEGE\]\s*(.*)$/i))) blocks.push({ type: "callout", kind: "piege", text: m[1] });
    else if ((m = line.match(/^\[!INFO\]\s*(.*)$/i))) blocks.push({ type: "callout", kind: "info", text: m[1] });
    else if ((m = line.match(/^\[!APP\]\s*(.*)$/i))) {
      const [consigne, correction = ""] = m[1].split("|||");
      blocks.push({ type: "app", consigne: consigne.trim(), correction: correction.trim() });
    } else blocks.push({ type: "p", text: line });
  }
  flush();
  return blocks;
}

/** List a lesson's image placeholders (1-based slot + caption) for the editor. */
export function parseImagePlaceholders(text: string): { slot: number; caption: string }[] {
  return parse(text ?? "")
    .filter((b): b is Extract<Block, { type: "img" }> => b.type === "img")
    .map((b) => ({ slot: b.slot, caption: b.caption }));
}

/** `images` maps a placeholder slot (1-based) to an uploaded image URL. */
export function LessonContent({ text, images }: { text: string; images?: Record<number, string> }) {
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
          case "ul":
            return (
              <ul key={i} className="list-disc pl-[18px] flex flex-col gap-1.5 mb-3">
                {b.items.map((it, j) => (
                  <li key={j} className="text-[13px] text-text leading-normal">
                    {inline(it)}
                  </li>
                ))}
              </ul>
            );
          case "img":
            return <ImageBlock key={i} caption={b.caption} url={images?.[b.slot]} />;
          case "callout":
            return <Callout key={i} kind={b.kind} text={b.text} />;
          case "app":
            return <AppBox key={i} consigne={b.consigne} correction={b.correction} />;
        }
      })}
    </div>
  );
}
