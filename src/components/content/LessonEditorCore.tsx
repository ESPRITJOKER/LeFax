import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "../../lib/icons";
import { Spinner } from "../ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { LessonContent, parseImagePlaceholders, type SlotImages, type SlotMeta } from "../../lib/lessonContent";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { LessonRow } from "../../lib/database.types";
import { LessonCardsPanel, type LessonCardsHandle } from "./LessonCardsPanel";
import { LessonQuizPanel } from "./LessonQuizPanel";
import { MarkupField } from "../editor/MarkupField";
import { ZoomableImage } from "../ImageLightbox";

const BUCKET = "lesson-media";

/**
 * The lesson editor, shared by the admin panel and the teacher panel.
 *
 * Rebuilt for Correction N6 around the model the client sent back ("Voici le
 * modèle originel… la barre qui facilite la mise en page et tu peux voir
 * directement la modification sur l'écran (mobile) à côté. Ce que tu as fait
 * est bien, mais c'est un peu compliqué"):
 *
 *   ‹ retour · Matière › Chapitre › Leçon           [ Enregistrer ]   ← sticky
 *   ┌────────── tabs: Cours | Cartes | QCM ────────────────────────┐
 *   │  formatting toolbar + editor        │   live phone preview    │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * What made the old screen "compliqué" was structural, not cosmetic: FR and EN
 * bodies stacked as two raw monospace textareas, the preview hidden behind a
 * toggle, and the cards and quiz panels dumped below in the same scroll. Now
 * the language is a two-button switch, the preview is permanent beside the
 * editor on wide screens, and cards/quiz are tabs rather than more scroll.
 *
 * Everything functional is deliberately unchanged: bilingual columns, the
 * line-based markup, per-placeholder uploads, the story-card deck, the question
 * bank, the role bar (`renderStatusBar`), the read-only predicate (`canEdit`),
 * and honest writes — every mutation `.select("id")`s and treats a 0-row result
 * as a permission failure, so the UI never claims a save RLS silently dropped.
 */
export interface LessonEditorCoreProps {
  lessonId: string;
  /** False renders every field read-only (submitted / approved / not yours). */
  canEdit: boolean | ((lesson: LessonRow) => boolean);
  onBack: () => void;
  backLabel: string;
  /** Role-specific bar: publish toggle for admins, review status for teachers. */
  renderStatusBar?: (lesson: LessonRow, reload: () => Promise<void>) => ReactNode;
  /** Hide the story-card deck + question bank (e.g. before the lesson has a body). */
  showPanels?: boolean;
}

type Flash = { ok: boolean; msg: string } | null;
type Tab = "content" | "cards" | "quiz";

/** text[] columns are edited as one-item-per-line textareas. */
const toLines = (arr: string[] | null | undefined) => (arr ?? []).join("\n");
const fromLines = (text: string) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

export function LessonEditorCore({ lessonId, canEdit: canEditProp, onBack, backLabel, renderStatusBar, showPanels = true }: LessonEditorCoreProps) {
  const { t, lang } = useI18n();
  const { profile } = useAuth();

  const [lesson, setLesson] = useState<LessonRow | null>(null);
  const [crumbs, setCrumbs] = useState<{ subject: string; chapter: string }>({ subject: "", chapter: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const [tab, setTab] = useState<Tab>("content");
  // A panel is mounted the first time its tab is opened and then stays mounted,
  // just hidden. Mounting late means opening a lesson no longer fires the cards
  // AND quiz queries before anyone asks for them; staying mounted means a tab
  // switch cannot discard their per-item unsaved edits.
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set<Tab>(["content"]));
  const openTab = (id: Tab) => {
    setTab(id);
    setVisited((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  };
  /** Which language the body editor and the preview are showing. */
  const [which, setWhich] = useState<"fr" | "en">(lang === "en" ? "en" : "fr");

  // editable fields
  const [titleFr, setTitleFr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [contentFr, setContentFr] = useState("");
  const [contentEn, setContentEn] = useState("");
  const [objectivesFr, setObjectivesFr] = useState("");
  const [objectivesEn, setObjectivesEn] = useState("");
  const [summaryFr, setSummaryFr] = useState("");
  const [summaryEn, setSummaryEn] = useState("");
  const [keyPointsFr, setKeyPointsFr] = useState("");
  const [keyPointsEn, setKeyPointsEn] = useState("");

  // slot -> image url + its references (0021)
  const [images, setImages] = useState<Record<number, SlotMeta>>({});
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});
  const cardsRef = useRef<LessonCardsHandle>(null);

  // Editability can depend on the loaded row (a teacher loses the lesson while a
  // reviewer holds it), so the prop accepts a predicate. Before the row is in,
  // assume read-only rather than briefly offering edits we may have to retract.
  const canEdit = lesson ? (typeof canEditProp === "function" ? canEditProp(lesson) : canEditProp) : false;

  /**
   * `select("*")` rather than naming the 0021 reference columns: PostgREST
   * rejects the WHOLE query with 42703 if one column is missing, so an explicit
   * list would break the editor everywhere migration 0021 has not been applied
   * yet. With `*` the reference fields simply come back undefined until it is.
   * A lesson has a handful of media rows, so the wider row costs nothing.
   */
  const loadMedia = useCallback(async (id: string) => {
    const { data } = await supabase.from("media_library").select("*").eq("lesson_id", id).not("image_slot", "is", null);
    const map: Record<number, SlotMeta> = {};
    for (const m of data ?? [])
      if (m.image_slot != null)
        map[m.image_slot] = { url: m.storage_path, caption: m.caption ?? null, credit: m.credit ?? null, creditUrl: m.credit_url ?? null };
    setImages(map);
  }, []);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !lessonId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle();
    if (data) {
      setLesson(data);
      setTitleFr(data.title_fr);
      setTitleEn(data.title_en);
      setContentFr(data.content_fr);
      setContentEn(data.content_en);
      setObjectivesFr(toLines(data.objectives_fr));
      setObjectivesEn(toLines(data.objectives_en));
      setSummaryFr(data.summary_fr ?? "");
      setSummaryEn(data.summary_en ?? "");
      setKeyPointsFr(toLines(data.key_points_fr));
      setKeyPointsEn(toLines(data.key_points_en));

      // Breadcrumb + media in parallel — they do not depend on each other.
      const [chapterRes] = await Promise.all([
        supabase.from("chapters").select("name_fr, name_en, subject_id").eq("id", data.chapter_id).maybeSingle(),
        loadMedia(lessonId),
      ]);
      const chapter = chapterRes.data;
      if (chapter) {
        const { data: subject } = await supabase.from("subjects").select("name_fr, name_en").eq("id", chapter.subject_id).maybeSingle();
        setCrumbs({
          subject: subject ? (lang === "fr" ? subject.name_fr : subject.name_en) : "",
          chapter: lang === "fr" ? chapter.name_fr : chapter.name_en,
        });
      }
    }
    setLoading(false);
  }, [lessonId, loadMedia, lang]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!lessonId || !canEdit) return;
    setSaving(true);
    setFlash(null);
    const { data, error } = await supabase
      .from("lessons")
      .update({
        title_fr: titleFr,
        title_en: titleEn || titleFr,
        content_fr: contentFr,
        content_en: contentEn || contentFr,
        objectives_fr: fromLines(objectivesFr),
        objectives_en: fromLines(objectivesEn),
        summary_fr: summaryFr || null,
        summary_en: summaryEn || null,
        key_points_fr: fromLines(keyPointsFr),
        key_points_en: fromLines(keyPointsEn),
      })
      .eq("id", lessonId)
      .select("id");
    if (error) {
      setFlash({ ok: false, msg: error.message || t("admin_saveError") });
      setSaving(false);
      return;
    }
    // A 0-row "success" means RLS refused the write — never report "saved".
    if (!data || data.length === 0) {
      setFlash({ ok: false, msg: t("admin_saveBlocked") });
      setSaving(false);
      return;
    }
    const cardsOk = (await cardsRef.current?.saveAll()) ?? true;
    setFlash(cardsOk ? { ok: true, msg: t("admin_lessonSaved") } : { ok: false, msg: t("admin_cardsSaveError") });
    await load();
    setSaving(false);
  }

  async function uploadForSlot(slot: number, file: File) {
    if (!lessonId || !profile || !canEdit) return;
    if (!file.type.startsWith("image/")) {
      setFlash({ ok: false, msg: t("admin_saveError") });
      return;
    }
    setUploadingSlot(slot);
    setFlash(null);
    try {
      const path = `${lessonId}/${slot}`; // fixed key per slot → replace overwrites
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`; // cache-bust: same key, new bytes
      const { data: rows, error: dbErr } = await supabase
        .from("media_library")
        .upsert(
          {
            lesson_id: lessonId,
            image_slot: slot,
            storage_path: url,
            file_name: file.name,
            mime_type: file.type,
            uploaded_by: profile.id,
          },
          { onConflict: "lesson_id,image_slot" }
        )
        .select("id");
      if (dbErr) throw dbErr;
      if (!rows || rows.length === 0) throw new Error(t("admin_saveBlocked"));
      setImages((prev) => ({ ...prev, [slot]: { ...(prev[slot] ?? {}), url } }));
      setFlash({ ok: true, msg: t("admin_lessonSaved") });
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : t("admin_saveError") });
    }
    setUploadingSlot(null);
  }

  /** Persist an image's references (0021). Separate from the lesson save so a
   *  caption can be fixed without touching the body. */
  async function saveMeta(slot: number, patch: Partial<SlotMeta>) {
    if (!lessonId || !canEdit) return;
    const next = { ...(images[slot] ?? { url: "" }), ...patch };
    setImages((prev) => ({ ...prev, [slot]: next }));
    const { data, error } = await supabase
      .from("media_library")
      .update({ caption: next.caption ?? null, credit: next.credit ?? null, credit_url: next.creditUrl ?? null, alt_text: next.caption ?? null })
      .eq("lesson_id", lessonId)
      .eq("image_slot", slot)
      .select("id");
    // 42703 = the 0021 columns are not in this database yet. Say so, rather
    // than reporting a generic failure the admin cannot act on.
    if (error) setFlash({ ok: false, msg: error.code === "42703" ? t("ed_metaMigration") : error.message });
    else if (!data || data.length === 0) setFlash({ ok: false, msg: t("admin_saveBlocked") });
    else setFlash({ ok: true, msg: t("ed_metaSaved") });
  }

  async function removeSlot(slot: number) {
    if (!lessonId || !canEdit) return;
    setUploadingSlot(slot);
    try {
      await supabase.storage.from(BUCKET).remove([`${lessonId}/${slot}`]);
      await supabase.from("media_library").delete().eq("lesson_id", lessonId).eq("image_slot", slot);
      setImages((prev) => {
        const next = { ...prev };
        delete next[slot];
        return next;
      });
    } catch {
      setFlash({ ok: false, msg: t("admin_saveError") });
    }
    setUploadingSlot(null);
  }

  if (loading) return <Spinner />;
  if (!lesson) return <div className="text-sm text-muted">{isSupabaseConfigured ? t("common_error") : t("backend_banner")}</div>;

  const body = which === "fr" ? contentFr : contentEn;
  const setBody = which === "fr" ? setContentFr : setContentEn;
  // Slots are language-independent; captions are shown in the edited language.
  const placeholders = parseImagePlaceholders(body);
  const previewImages: SlotImages = images;
  const title = which === "fr" ? titleFr : titleEn;

  function leave() {
    if (cardsRef.current?.hasDirty() && !window.confirm(t("admin_unsavedCardsWarn"))) return;
    onBack();
  }

  return (
    <div className="w-full max-w-[1500px]">
      {/* ── sticky header: back · breadcrumb · save ─────────────────────── */}
      {/* The negative margins exactly cancel the panel shell's own padding
          (`p-5 lg:p-7` in Admin/TeacherLayout), so the bar spans the full
          width without creating a horizontal scrollbar at any size. */}
      <div className="sticky top-0 z-20 -mx-5 px-5 lg:-mx-7 lg:px-7 pt-1 pb-3 bg-surface/95 backdrop-blur border-b border-border mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={leave} className="flex items-center gap-1.5 text-[13px] font-semibold text-muted border-none bg-transparent p-0">
            <Icon name="chevleft" size={16} />
            {backLabel}
          </button>
          <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-[12.5px] min-w-0 flex-1">
            {crumbs.subject && <span className="font-bold text-ink-900 truncate">{crumbs.subject}</span>}
            {crumbs.chapter && (
              <>
                <span className="text-ink-300">›</span>
                <span className="font-bold text-ink-900 truncate">{crumbs.chapter}</span>
              </>
            )}
            <span className="text-ink-300">›</span>
            <span className="text-muted truncate">{title || t("admin_editLesson")}</span>
          </nav>
          <button
            onClick={save}
            disabled={saving || !canEdit}
            className="border-none px-5 py-2 rounded-xl text-[13px] font-bold bg-brand-600 text-white disabled:opacity-60 flex-none"
          >
            {saving ? t("admin_uploading") : t("admin_saveAll")}
          </button>
        </div>
      </div>

      {renderStatusBar?.(lesson, load)}

      {flash && (
        <div
          role="status"
          aria-live="polite"
          className={`mb-4 rounded-xl px-4 py-2.5 text-[13px] font-semibold ${flash.ok ? "bg-success-600/10 text-success-600" : "bg-danger-600/10 text-danger-600"}`}
        >
          {flash.msg}
        </div>
      )}

      {/* ── tabs ───────────────────────────────────────────────────────── */}
      {showPanels && (
        <div role="tablist" className="flex gap-1.5 mb-4 flex-wrap">
          {(["content", "cards", "quiz"] as Tab[]).map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => openTab(id)}
              className={`px-4 py-2 rounded-xl text-[12.5px] font-bold border transition-colors ${
                tab === id ? "border-brand-600 bg-brand-600 text-white" : "border-border bg-card text-ink-800"
              }`}
            >
              {id === "content" ? t("ed_contentTab") : id === "cards" ? t("ed_cardsTab") : t("ed_quizTab")}
            </button>
          ))}
        </div>
      )}

      {tab === "content" && (
        <fieldset disabled={!canEdit} className="border-none p-0 m-0 disabled:opacity-100">
          <div className="flex flex-col xl:flex-row gap-5 items-start">
            {/* ── editor column ──────────────────────────────────────── */}
            <div className="flex-1 min-w-0 w-full flex flex-col gap-4">
              {/* language switch */}
              <div className="flex items-center gap-2 flex-wrap">
                {(["fr", "en"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setWhich(l)}
                    aria-pressed={which === l}
                    className={`px-3.5 py-1.5 rounded-pill text-[12px] font-bold border ${
                      which === l ? "border-brand-600 bg-brand-600/10 text-brand-600" : "border-border bg-card text-ink-700"
                    }`}
                  >
                    {l === "fr" ? "Français" : "English"}
                  </button>
                ))}
                <span className="text-[11px] text-muted">{t("ed_bodyHint")}</span>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-bold text-muted">{which === "fr" ? t("admin_titleFr") : t("admin_titleEn")}</span>
                <input
                  value={which === "fr" ? titleFr : titleEn}
                  onChange={(e) => (which === "fr" ? setTitleFr : setTitleEn)(e.target.value)}
                  className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 bg-card text-[13px] disabled:bg-ink-50"
                />
              </label>

              <MarkupField
                label={which === "fr" ? t("admin_contentFr") : t("admin_contentEn")}
                value={body}
                onChange={setBody}
                disabled={!canEdit}
                rows={18}
                minHeight={340}
              />

              <div className="text-[11px] text-muted leading-relaxed">{t("admin_markupHint")}</div>

              {/* Pedagogical framing: objectives, summary, key points (bilingual) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LineField label={t("te_objectivesFr")} value={objectivesFr} onChange={setObjectivesFr} />
                <LineField label={t("te_objectivesEn")} value={objectivesEn} onChange={setObjectivesEn} />
                <LineField label={t("te_summaryFr")} value={summaryFr} onChange={setSummaryFr} />
                <LineField label={t("te_summaryEn")} value={summaryEn} onChange={setSummaryEn} />
                <LineField label={t("te_keyPointsFr")} value={keyPointsFr} onChange={setKeyPointsFr} />
                <LineField label={t("te_keyPointsEn")} value={keyPointsEn} onChange={setKeyPointsEn} />
              </div>

              {/* ── illustrations ────────────────────────────────────── */}
              <div className="font-bold text-[14px] text-ink-900 flex items-center gap-2 mt-2">
                <Icon name="upload" size={16} className="text-ink-700" />
                {t("admin_illustrations")}
              </div>

              {placeholders.length === 0 ? (
                <div className="bg-ink-50 border border-ink-100 rounded-2xl px-4 py-5 text-[13px] text-muted">{t("admin_noPlaceholders")}</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {placeholders.map((p) => (
                    <SlotEditor
                      key={p.slot}
                      slot={p.slot}
                      caption={p.caption}
                      meta={images[p.slot]}
                      busy={uploadingSlot === p.slot}
                      canEdit={canEdit}
                      inputRef={(el) => (fileInputs.current[p.slot] = el)}
                      onPick={() => fileInputs.current[p.slot]?.click()}
                      onFile={(f) => uploadForSlot(p.slot, f)}
                      onRemove={() => removeSlot(p.slot)}
                      onSaveMeta={(patch) => saveMeta(p.slot, patch)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── live student preview ───────────────────────────────── */}
            <aside className="w-full xl:w-[360px] xl:flex-none xl:sticky xl:top-[86px]">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted mb-2">{t("ed_livePreview")}</div>
              <div className="rounded-[34px] border-[10px] border-ink-900 bg-ink-900 shadow-[0_18px_40px_-18px_rgba(15,30,60,0.55)]">
                <div className="rounded-[24px] bg-card overflow-hidden flex flex-col h-[560px]">
                  <div className="px-4 pt-4 pb-2 border-b border-border">
                    <div className="font-serif font-bold text-[16px] text-ink-900 leading-snug">{title || "—"}</div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
                    {body.trim() ? <LessonContent text={body} images={previewImages} /> : <div className="text-[12.5px] text-muted">{t("ed_noBody")}</div>}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </fieldset>
      )}

      {/* Both panels are mounted once and merely HIDDEN on the other tabs.
          Each keeps per-item unsaved edits (the cards' dirty set, which the top
          "Enregistrer" flushes through `cardsRef.saveAll`, and the quiz panel's
          own per-question dirty set), so unmounting them on a tab switch would
          silently throw away whatever the author had just typed. */}
      {showPanels && (
        <>
          {visited.has("cards") && (
            <div className={tab === "cards" ? "" : "hidden"}>
              <LessonCardsPanel ref={cardsRef} lessonId={lessonId} canEdit={canEdit} />
            </div>
          )}
          {visited.has("quiz") && (
            <div className={tab === "quiz" ? "" : "hidden"}>
              <LessonQuizPanel lessonId={lessonId} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** One `[[IMG:]]` placeholder: upload / replace / remove plus its references. */
function SlotEditor({
  slot,
  caption,
  meta,
  busy,
  canEdit,
  inputRef,
  onPick,
  onFile,
  onRemove,
  onSaveMeta,
}: {
  slot: number;
  caption: string;
  meta?: SlotMeta;
  busy: boolean;
  canEdit: boolean;
  inputRef: (el: HTMLInputElement | null) => void;
  onPick: () => void;
  onFile: (f: File) => void;
  onRemove: () => void;
  onSaveMeta: (patch: Partial<SlotMeta>) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [credit, setCredit] = useState(meta?.credit ?? "");
  const [creditUrl, setCreditUrl] = useState(meta?.creditUrl ?? "");
  const [cap, setCap] = useState(meta?.caption ?? "");
  const url = meta?.url;

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex gap-4 items-start flex-wrap">
        <div className="w-[130px] max-w-full flex-none">
          {url ? (
            <ZoomableImage
              src={url}
              alt={caption}
              meta={{ caption: cap || caption, credit, creditUrl }}
              className="w-full aspect-[16/10] object-cover rounded-lg border border-border bg-ink-50"
            />
          ) : (
            <div className="w-full aspect-[16/10] rounded-lg border-[1.5px] border-dashed border-ink-300 bg-ink-50 flex items-center justify-center text-ink-300">
              <Icon name="upload" size={20} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-[180px]">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1">
            {t("admin_slot")} {slot}
          </div>
          <div className="text-[13px] text-ink-900 leading-snug mb-3">{caption}</div>
          <div className="flex gap-2 flex-wrap">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) onFile(f);
              }}
            />
            <button onClick={onPick} disabled={busy || !canEdit} className="border-none px-3.5 py-1.5 rounded-lg text-[12px] font-bold bg-brand-600 text-white disabled:opacity-60">
              {busy ? t("admin_uploading") : url ? t("admin_replace") : t("admin_upload")}
            </button>
            {url && (
              <>
                <button
                  type="button"
                  onClick={() => setOpen((o) => !o)}
                  className="border border-border bg-card px-3.5 py-1.5 rounded-lg text-[12px] font-bold text-ink-900"
                >
                  {t("ed_imageMeta")}
                </button>
                <button onClick={onRemove} disabled={busy || !canEdit} className="border border-border bg-card px-3.5 py-1.5 rounded-lg text-[12px] font-bold text-danger-600 disabled:opacity-60">
                  {t("admin_remove")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {open && url && (
        <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetaInput label={t("ed_imgCaption")} value={cap} onChange={setCap} />
          <MetaInput label={t("ed_imgCredit")} value={credit} onChange={setCredit} />
          <MetaInput label={t("ed_imgCreditUrl")} value={creditUrl} onChange={setCreditUrl} placeholder="https://..." />
          <div className="md:col-span-3">
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => onSaveMeta({ caption: cap || null, credit: credit || null, creditUrl: creditUrl || null })}
              className="border-none px-4 py-1.5 rounded-lg text-[12px] font-bold bg-ink-800 text-white disabled:opacity-60"
            >
              {t("admin_saveCard")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-bold text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-2.5 py-1.5 rounded-lg border-[1.5px] border-ink-300 bg-card text-[12.5px]"
      />
    </label>
  );
}

function LineField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-bold text-muted">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 bg-card text-[12.5px] leading-relaxed resize-y min-h-[70px] disabled:bg-ink-50"
      />
    </label>
  );
}
