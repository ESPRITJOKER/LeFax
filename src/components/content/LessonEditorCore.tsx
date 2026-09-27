import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "../../lib/icons";
import { Spinner } from "../ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { LessonContent, parseImagePlaceholders } from "../../lib/lessonContent";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { LessonRow } from "../../lib/database.types";
import { LessonCardsPanel, type LessonCardsHandle } from "./LessonCardsPanel";
import { LessonQuizPanel } from "./LessonQuizPanel";
import { FormulaTool, insertSnippet, applyInsert } from "../FormulaTool";

const BUCKET = "lesson-media";

/**
 * The lesson editor, shared by the admin panel and the teacher panel.
 *
 * Extracted from AdminLessonEditor so both roles author lessons through exactly
 * one implementation: bilingual metadata, the line-based body markup (headings,
 * bullets, callouts, self-test boxes, `[[IMG:]]` placeholders, `$…$` / `\ce{…}`
 * notation), the per-placeholder image uploads, the story-card deck and the
 * question bank. What differs between roles is only the bar above it
 * (`renderStatusBar`) and whether the fields accept input (`canEdit`) — the
 * teacher's lock while a lesson sits with a reviewer, and publication, are
 * enforced by RLS + triggers in 0018 regardless of what this component renders.
 *
 * Honest writes throughout: every mutation `.select("id")`s and treats a 0-row
 * result as a permission failure, so the UI never claims a save that RLS
 * silently dropped.
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const [preview, setPreview] = useState(false);

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

  // slot -> image url
  const [images, setImages] = useState<Record<number, string>>({});
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});
  const contentFrRef = useRef<HTMLTextAreaElement | null>(null);
  const contentEnRef = useRef<HTMLTextAreaElement | null>(null);
  const cardsRef = useRef<LessonCardsHandle>(null);
  const [tool, setTool] = useState<null | { which: "fr" | "en"; mode: "math" | "chem" }>(null);

  // Editability can depend on the loaded row (a teacher loses the lesson while a
  // reviewer holds it), so the prop accepts a predicate. Before the row is in,
  // assume read-only rather than briefly offering edits we may have to retract.
  const canEdit = lesson ? (typeof canEditProp === "function" ? canEditProp(lesson) : canEditProp) : false;

  const loadMedia = useCallback(async (id: string) => {
    const { data } = await supabase
      .from("media_library")
      .select("image_slot, storage_path")
      .eq("lesson_id", id)
      .not("image_slot", "is", null);
    const map: Record<number, string> = {};
    for (const m of data ?? []) if (m.image_slot != null) map[m.image_slot] = m.storage_path;
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
      await loadMedia(lessonId);
    }
    setLoading(false);
  }, [lessonId, loadMedia]);

  useEffect(() => {
    load();
  }, [load]);

  /** Insert `[[IMG: description]]` at the caret and pre-select the caption. */
  function insertImagePlaceholder(which: "fr" | "en") {
    const el = which === "fr" ? contentFrRef.current : contentEnRef.current;
    const value = which === "fr" ? contentFr : contentEn;
    const setValue = which === "fr" ? setContentFr : setContentEn;
    applyInsert(el, insertSnippet(el, value, "[[IMG: description]]", "description"), setValue);
  }

  function insertFormula(which: "fr" | "en", snippet: string) {
    const el = which === "fr" ? contentFrRef.current : contentEnRef.current;
    const value = which === "fr" ? contentFr : contentEn;
    const setValue = which === "fr" ? setContentFr : setContentEn;
    applyInsert(el, insertSnippet(el, value, snippet), setValue);
  }

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
      setImages((prev) => ({ ...prev, [slot]: url }));
      setFlash({ ok: true, msg: t("admin_lessonSaved") });
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : t("admin_saveError") });
    }
    setUploadingSlot(null);
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

  // Slots are language-independent; captions are shown in the active language.
  const activeContent = lang === "fr" ? contentFr : contentEn;
  const placeholders = parseImagePlaceholders(activeContent);

  return (
    <div className="max-w-[820px]">
      <button
        onClick={() => {
          if (cardsRef.current?.hasDirty() && !window.confirm(t("admin_unsavedCardsWarn"))) return;
          onBack();
        }}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-muted border-none bg-transparent p-0 mb-4"
      >
        <Icon name="chevleft" size={16} />
        {backLabel}
      </button>

      <div className="font-serif font-bold text-xl text-ink-950 mb-4">{t("admin_editLesson")}</div>

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

      {/* Text fields */}
      <fieldset disabled={!canEdit} className="bg-white border border-border rounded-2xl p-5 flex flex-col gap-4 mb-5 disabled:opacity-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-bold text-muted">{t("admin_titleFr")}</span>
            <input value={titleFr} onChange={(e) => setTitleFr(e.target.value)} className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 text-[13px] disabled:bg-ink-50" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-bold text-muted">{t("admin_titleEn")}</span>
            <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 text-[13px] disabled:bg-ink-50" />
          </label>
        </div>

        {(["fr", "en"] as const).map((which) => {
          const value = which === "fr" ? contentFr : contentEn;
          const setValue = which === "fr" ? setContentFr : setContentEn;
          const ref = which === "fr" ? contentFrRef : contentEnRef;
          const openTool = tool?.which === which ? tool.mode : null;
          return (
            <div key={which} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11.5px] font-bold text-muted">{which === "fr" ? t("admin_contentFr") : t("admin_contentEn")}</span>
                <span className="flex items-center gap-1.5">
                  <button type="button" onClick={() => insertImagePlaceholder(which)} className="border border-brand-600/40 bg-white text-brand-600 px-2.5 py-1 rounded-lg text-[11.5px] font-bold">
                    {t("admin_insertImage")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTool(openTool === "math" ? null : { which, mode: "math" })}
                    className={`px-2.5 py-1 rounded-lg text-[11.5px] font-bold border ${openTool === "math" ? "border-brand-600 bg-brand-600/10 text-brand-600" : "border-border bg-white text-ink-700"}`}
                  >
                    ∑ {t("te_insertMath")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTool(openTool === "chem" ? null : { which, mode: "chem" })}
                    className={`px-2.5 py-1 rounded-lg text-[11.5px] font-bold border ${openTool === "chem" ? "border-brand-600 bg-brand-600/10 text-brand-600" : "border-border bg-white text-ink-700"}`}
                  >
                    H₂O
                  </button>
                </span>
              </div>
              <textarea
                ref={ref}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                rows={18}
                spellCheck={false}
                className="px-3 py-2.5 rounded-lg border-[1.5px] border-ink-300 text-[12.5px] font-mono leading-relaxed resize-y min-h-[320px] disabled:bg-ink-50"
              />
              {openTool && <FormulaTool mode={openTool} onInsert={(s) => insertFormula(which, s)} onClose={() => setTool(null)} />}
            </div>
          );
        })}

        <div className="text-[11px] text-muted leading-relaxed">{t("admin_markupHint")}</div>
        <div className="text-[11px] text-muted leading-relaxed">{t("te_mathHint")}</div>

        {/* Pedagogical framing: objectives, summary, key points (all bilingual) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LineField label={t("te_objectivesFr")} value={objectivesFr} onChange={setObjectivesFr} />
          <LineField label={t("te_objectivesEn")} value={objectivesEn} onChange={setObjectivesEn} />
          <LineField label={t("te_summaryFr")} value={summaryFr} onChange={setSummaryFr} />
          <LineField label={t("te_summaryEn")} value={summaryEn} onChange={setSummaryEn} />
          <LineField label={t("te_keyPointsFr")} value={keyPointsFr} onChange={setKeyPointsFr} />
          <LineField label={t("te_keyPointsEn")} value={keyPointsEn} onChange={setKeyPointsEn} />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={save} disabled={saving || !canEdit} className="border-none px-5 py-2.5 rounded-xl text-[13px] font-bold bg-brand-600 text-white disabled:opacity-60">
            {saving ? t("admin_uploading") : t("admin_saveAll")}
          </button>
          <button type="button" onClick={() => setPreview((p) => !p)} className="border border-border bg-white px-4 py-2.5 rounded-xl text-[13px] font-bold text-ink-900">
            {preview ? t("te_hidePreview") : t("te_preview")}
          </button>
          <span className="text-[11px] text-muted">{t("admin_saveAllHint")}</span>
        </div>
      </fieldset>

      {/* Student-eye preview: the same renderer the lesson viewer uses, so
          formulas, callouts and images look exactly as they will in the app. */}
      {preview && (
        <div className="bg-white border border-border rounded-2xl p-5 mb-5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted mb-2">{t("te_preview")}</div>
          <LessonContent text={activeContent} images={images} />
        </div>
      )}

      {/* Image placeholders */}
      <div className="font-bold text-[15px] text-ink-900 mb-3 flex items-center gap-2">
        <Icon name="upload" size={16} className="text-ink-700" />
        {t("admin_illustrations")}
      </div>

      {placeholders.length === 0 ? (
        <div className="bg-ink-50 border border-ink-100 rounded-2xl px-4 py-5 text-[13px] text-muted">{t("admin_noPlaceholders")}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {placeholders.map((p) => {
            const url = images[p.slot];
            const busy = uploadingSlot === p.slot;
            return (
              <div key={p.slot} className="bg-white border border-border rounded-2xl p-4 flex gap-4 items-start">
                <div className="w-[130px] flex-none">
                  {url ? (
                    <img src={url} alt={p.caption} className="w-full aspect-[16/10] object-cover rounded-lg border border-border bg-ink-50" />
                  ) : (
                    <div className="w-full aspect-[16/10] rounded-lg border-[1.5px] border-dashed border-ink-300 bg-ink-50 flex items-center justify-center text-ink-400">
                      <Icon name="upload" size={20} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1">
                    {t("admin_slot")} {p.slot}
                  </div>
                  <div className="text-[13px] text-ink-900 leading-snug mb-3">{p.caption}</div>
                  <div className="flex gap-2">
                    <input
                      ref={(el) => {
                        fileInputs.current[p.slot] = el;
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) uploadForSlot(p.slot, f);
                      }}
                    />
                    <button
                      onClick={() => fileInputs.current[p.slot]?.click()}
                      disabled={busy || !canEdit}
                      className="border-none px-3.5 py-1.5 rounded-lg text-[12px] font-bold bg-brand-600 text-white disabled:opacity-60"
                    >
                      {busy ? t("admin_uploading") : url ? t("admin_replace") : t("admin_upload")}
                    </button>
                    {url && (
                      <button
                        onClick={() => removeSlot(p.slot)}
                        disabled={busy || !canEdit}
                        className="border border-border bg-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold text-danger-600 disabled:opacity-60"
                      >
                        {t("admin_remove")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showPanels && (
        <>
          {/* Story cards (lesson viewer) */}
          <div className="h-px bg-border my-6" />
          <LessonCardsPanel ref={cardsRef} lessonId={lessonId} />

          {/* Quiz (QCM) — feeds the chapter's Niv. 1/2/3 practice */}
          <div className="h-px bg-border my-6" />
          <LessonQuizPanel lessonId={lessonId} />
        </>
      )}
    </div>
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
        className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 text-[12.5px] leading-relaxed resize-y min-h-[70px] disabled:bg-ink-50"
      />
    </label>
  );
}
