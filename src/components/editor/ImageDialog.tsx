import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../lib/i18n";
import type { CellAlign, ImageOptions } from "../../lib/markupSyntax";
import { newImageKey } from "./markupCommands";
import { DialogButton, DialogField, EditorDialog, dialogInputClass } from "./EditorDialog";

/**
 * Insert an image anywhere in the lesson, with its placement and its references,
 * in one pass.
 *
 * The flow this replaces was: type `[[IMG: description]]` by hand, scroll to the
 * "Illustrations" list under the editor, find the matching slot, upload there —
 * which is why the client reported simply "I could not add image in text". And
 * because a slot was just the placeholder's POSITION, inserting a new image
 * above an existing one re-bound every picture below it.
 *
 * So: pick a file, set its caption and placement, press insert. The dialog writes
 * one complete token and hands the file to the caller, which uploads it to
 * whichever address the inserted placeholder ended up with — its stable key
 * (migration 0022) when the column exists, its position when it does not. Either
 * way the author never leaves the dialog and never matches a slot number by hand.
 *
 * The author can also insert with no file at all, because a lesson is often
 * written before its figures exist; the Illustrations list below the editor still
 * fills those in.
 *
 * `canEdit` is re-checked here rather than inherited: the dialog is portalled out
 * of `LessonEditorCore`'s `<fieldset disabled>`, so the fieldset cannot stop it
 * uploading on a read-only lesson. That is the price of escaping the fieldset,
 * and this is where it is paid.
 */
export function ImageDialog({
  onClose,
  onInsert,
  keysSupported,
  canEdit,
  existingKeys,
}: {
  onClose: () => void;
  /**
   * Insert the token, then upload `file` to whatever address the inserted
   * placeholder ended up with. Insert-then-upload, not upload-then-insert: the
   * positional fallback has no address until the token is actually in the text,
   * and making the upload go first is what used to leave the file picker
   * disabled — and the author unable to add an image at all — on any database
   * where migration 0022 had not been applied.
   */
  onInsert: (caption: string, options: ImageOptions, file: File | null) => void;
  /** False until migration 0022 is applied — see above. */
  keysSupported: boolean;
  canEdit: boolean;
  /** Keys already used in this body, so a minted one cannot collide. */
  existingKeys: string[];
}) {
  const { t } = useI18n();
  const fileInput = useRef<HTMLInputElement>(null);
  // Minted once per dialog so the token and the eventual upload agree.
  const keyRef = useRef<string>(newImageKey(existingKeys));

  const [caption, setCaption] = useState("");
  const [alt, setAlt] = useState("");
  const [credit, setCredit] = useState("");
  const [source, setSource] = useState("");
  const [width, setWidth] = useState(100);
  const [align, setAlign] = useState<CellAlign>("center");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A local object URL, so the author sees the picture they chose before it is
  // uploaded. Revoked on unmount — these leak for the lifetime of the document
  // otherwise.
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(picked: File) {
    if (!canEdit) return;
    if (!picked.type.startsWith("image/")) {
      setError(t("common_error"));
      return;
    }
    setError(null);
    setFile(picked);
    // A sensible default caption beats "image": the file name is usually what
    // the author would have typed anyway.
    if (!caption.trim()) setCaption(picked.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim());
  }

  function insert() {
    const options: ImageOptions = {
      align,
      widthPct: width,
      alt: alt.trim() || undefined,
      credit: credit.trim() || undefined,
      // `parseImageSpec` runs the URL through `safeUrl`, so a refused scheme is
      // dropped at render time; this keeps an obviously empty one out of the token.
      sourceUrl: source.trim() || undefined,
      // Without 0022 there is nowhere to store a key, so the placeholder is
      // bound by its position instead and the token stays keyless.
      key: keysSupported ? keyRef.current : undefined,
    };
    onInsert(caption.trim() || t("lesson_imgLabel"), options, file);
    onClose();
  }

  const ALIGN_LABEL: Record<CellAlign, string> = {
    left: t("ed_alignLeft"),
    center: t("ed_alignCenter"),
    right: t("ed_alignRight"),
  };

  return (
    <EditorDialog
      title={t("ed_image")}
      onClose={onClose}
      footer={
        <>
          <DialogButton onClick={onClose}>{t("common_cancel")}</DialogButton>
          <DialogButton variant="primary" onClick={insert}>
            {file ? t("ed_imageInsert") : t("ed_imageLater")}
          </DialogButton>
        </>
      }
    >
      <DialogField label={t("ed_imageFile")} hint={file ? undefined : t("ed_imageNoFile")}>
        <div className="flex items-start gap-3 flex-wrap">
          <div className="w-[108px] flex-none">
            {preview ? (
              <img src={preview} alt="" className="w-full aspect-[16/10] object-cover rounded-lg border border-border bg-ink-50" />
            ) : (
              <div className="w-full aspect-[16/10] rounded-lg border-[1.5px] border-dashed border-ink-300 bg-ink-50" />
            )}
          </div>
          <div className="flex-1 min-w-[140px]">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) pick(f);
              }}
            />
            <DialogButton variant="primary" disabled={!canEdit} onClick={() => fileInput.current?.click()}>
              {file ? t("ed_imageReplaceFile") : t("ed_imageChoose")}
            </DialogButton>
            {file && <div className="mt-1.5 text-[10.5px] text-muted truncate">{file.name}</div>}
            {error && <div className="mt-2 text-[11px] font-semibold text-danger-600">{error}</div>}
          </div>
        </div>
      </DialogField>

      <DialogField label={t("ed_imgCaption")}>
        <input value={caption} onChange={(e) => setCaption(e.target.value)} className={dialogInputClass} />
      </DialogField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
        <DialogField label={t("ed_imageWidth")}>
          <select value={width} onChange={(e) => setWidth(Number(e.target.value))} className={dialogInputClass}>
            {[25, 40, 50, 60, 75, 100].map((w) => (
              <option key={w} value={w}>
                {w}%
              </option>
            ))}
          </select>
        </DialogField>

        <DialogField label={t("ed_imageAlign")}>
          <div className="flex gap-1.5">
            {(["left", "center", "right"] as CellAlign[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAlign(a)}
                aria-pressed={align === a}
                title={ALIGN_LABEL[a]}
                className={`flex-1 px-2 py-2 rounded-lg text-[11.5px] font-bold border ${
                  align === a ? "border-brand-600 bg-ink-100 text-brand-600" : "border-border bg-card text-ink-800"
                }`}
              >
                {ALIGN_LABEL[a]}
              </button>
            ))}
          </div>
        </DialogField>
      </div>

      <DialogField label={t("ed_imgAlt")}>
        <input value={alt} onChange={(e) => setAlt(e.target.value)} className={dialogInputClass} />
      </DialogField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
        <DialogField label={t("ed_imgCredit")}>
          <input value={credit} onChange={(e) => setCredit(e.target.value)} className={dialogInputClass} />
        </DialogField>
        <DialogField label={t("ed_imgCreditUrl")}>
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://…" className={dialogInputClass} />
        </DialogField>
      </div>
    </EditorDialog>
  );
}

/** The link and video prompts, promoted from inline rows to real dialogs. */
export function LinkDialog({
  kind,
  initialText,
  onClose,
  onConfirm,
}: {
  kind: "link" | "video";
  initialText: string;
  onClose: () => void;
  onConfirm: (url: string, text: string) => void;
}) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [text, setText] = useState(initialText);

  function confirm() {
    if (!url.trim()) return;
    onConfirm(url.trim(), text);
    onClose();
  }

  return (
    <EditorDialog
      title={kind === "video" ? t("ed_video") : t("ed_link")}
      onClose={onClose}
      width={440}
      footer={
        <>
          <DialogButton onClick={onClose}>{t("common_cancel")}</DialogButton>
          <DialogButton variant="primary" onClick={confirm} disabled={!url.trim()}>
            {t("fx_insert")}
          </DialogButton>
        </>
      }
    >
      <DialogField label={kind === "video" ? t("ed_videoUrl") : t("ed_linkUrl")}>
        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirm();
            }
          }}
          placeholder="https://…"
          className={dialogInputClass}
        />
      </DialogField>
      {kind === "link" && (
        <DialogField label={t("ed_linkText")}>
          <input value={text} onChange={(e) => setText(e.target.value)} className={dialogInputClass} />
        </DialogField>
      )}
    </EditorDialog>
  );
}
