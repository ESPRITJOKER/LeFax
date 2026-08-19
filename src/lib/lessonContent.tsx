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
 *   **bold**            → <strong>
 *   *italic* / _italic_ → <em>
 * Colour is inherited from the surrounding text, so this renders correctly on
 * both the light document viewer and the dark story cards. The italic forms
 * require a non-space right after the opening mark so a lone `*` (e.g. "2 * 3")
 * is left untouched.
 */
export function inline(text: string): ReactNode {
  const re = /\*\*([^*]+?)\*\*|\*([^\s*][^*]*?)\*|_([^\s_][^_]*?)_/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);
    if (m[1] !== undefined) nodes.push(<strong key={key++} className="font-bold">{m[1]}</strong>);
    else nodes.push(<em key={key++} className="italic">{(m[2] ?? m[3]) as string}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return nodes;
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
            return (
              <h2 key={i} className="font-serif font-bold text-[16px] text-text mt-4 mb-2 first:mt-0">
                {b.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="font-bold text-[13.5px] text-text mt-3 mb-1.5">
                {b.text}
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
