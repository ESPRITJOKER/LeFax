import { useCallback, useEffect, useState } from "react";
import { Icon } from "../../lib/icons";
import { Button, Spinner, Select } from "../../components/ui";
import { StateNotice } from "../../components/StateNotice";
import { FormulaTool, insertSnippet, applyInsert } from "../../components/FormulaTool";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured, invokeFn } from "../../lib/supabaseClient";
import { useMySubjects, isTeacherEditable } from "../../lib/teacher";
import { hasNotation } from "../../lib/math";
import { inline } from "../../lib/lessonContent";
import type { DifficultyLevel, ReviewStatus } from "../../lib/database.types";

interface GeneratedOption {
  text_fr: string;
  text_en: string;
  is_correct: boolean;
}

interface GeneratedQuestion {
  text_fr: string;
  text_en: string;
  options: GeneratedOption[];
  explanation_fr?: string;
  explanation_en?: string;
  difficulty?: DifficultyLevel;
}

/** Review state a teacher assigns to each generated item before submitting. */
type Verdict = "pending" | "accepted" | "rejected";

interface DraftItem extends GeneratedQuestion {
  verdict: Verdict;
}

type LessonOption = {
  id: string;
  title_fr: string;
  title_en: string;
  published: boolean;
  review_status: ReviewStatus;
  /** Carried so a submission is tagged with the lesson own subject, not the first assigned one. */
  subjectId: string | null;
};

const CONTENT_TYPES = ["mcq", "true_false", "short_answer", "lesson", "summary"] as const;
type ContentType = (typeof CONTENT_TYPES)[number];

/**
 * AI-assisted authoring + the MCQ review desk.
 *
 * The teacher chooses a lesson in one of their subjects, optionally attaches a
 * source document, states the topic / level / objectives, and generates draft
 * items. Nothing generated is content yet: each item is reviewed here —
 * editable in both languages, correct answer changeable, options addable and
 * removable, accept or reject per item — and only the accepted ones are
 * submitted to the admin approval queue. The admin's approval is what
 * materialises them into the live question bank (`ai-content` / `approve`), so
 * unreviewed AI output can never reach a student (CDC 6.8).
 */
export default function TeacherAiAssist() {
  const { t, lang } = useI18n();
  const { profile } = useAuth();
  const { subjects, loading: subjectsLoading, error: subjectsError, reload: reloadSubjects } = useMySubjects();

  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [lessonId, setLessonId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [contentType, setContentType] = useState<ContentType>("mcq");
  const [count, setCount] = useState(5);
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("");
  const [objectives, setObjectives] = useState("");

  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [lessonDraft, setLessonDraft] = useState<{ content_fr?: string; content_en?: string; summary_fr?: string; summary_en?: string } | null>(null);
  const [sourceNote, setSourceNote] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadLessons = useCallback(async () => {
    if (!isSupabaseConfigured || !profile || subjects.length === 0) return;
    const { data: chapters } = await supabase
      .from("chapters")
      .select("id, subject_id")
      .in("subject_id", subjects.map((s) => s.id));
    const chapterIds = (chapters ?? []).map((c) => c.id);
    if (!chapterIds.length) {
      setLessons([]);
      return;
    }
    const { data } = await supabase
      .from("lessons")
      .select("id, title_fr, title_en, published, review_status, chapter_id")
      .eq("author_id", profile.id)
      .in("chapter_id", chapterIds)
      .order("updated_at", { ascending: false });
    const subjectByChapter = new Map((chapters ?? []).map((c) => [c.id, c.subject_id]));
    // Only lessons the teacher may still change can receive generated material.
    const editable = (data ?? [])
      .filter((l) => isTeacherEditable(l))
      .map((l) => ({ ...l, subjectId: subjectByChapter.get(l.chapter_id) ?? null })) as LessonOption[];
    setLessons(editable);
    if (editable.length && !editable.some((l) => l.id === lessonId)) setLessonId(editable[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, subjects]);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  async function generate() {
    if (!lessonId || !profile) return;
    setGenerating(true);
    setFlash(null);
    setSourceNote(null);
    try {
      let mediaId: string | null = null;
      if (file) {
        // `teacher/<uid>/…` is the prefix the lesson-sources storage policies
        // require (0018) — anything else is refused.
        const path = `teacher/${profile.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from("lesson-sources").upload(path, file);
        if (uploadError) throw uploadError;
        const { data: mediaRow, error: mediaError } = await supabase
          .from("media_library")
          .insert({ storage_path: path, file_name: file.name, mime_type: file.type, uploaded_by: profile.id, lesson_id: lessonId })
          .select("id")
          .single();
        if (mediaError) throw mediaError;
        mediaId = mediaRow?.id ?? null;
      }

      const { data, error } = await invokeFn("ai-content", {
        action: "generate",
        lesson_id: lessonId,
        media_id: mediaId,
        content_type: contentType,
        count,
        topic,
        level,
        objectives,
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));

      if (data?.sourceNote === "unsupported_source_format") setSourceNote(t("ta_sourceUnsupported"));
      else if (data?.sourceNote === "source_truncated") setSourceNote(t("ta_sourceTruncated"));
      else setSourceNote(data?.source === "uploaded_document" ? t("ta_sourceDoc") : t("ta_sourceLesson"));

      if (contentType === "lesson" || contentType === "summary") {
        setLessonDraft(data?.lesson ?? null);
        setDraft([]);
      } else {
        const questions = (data?.questions as GeneratedQuestion[]) ?? [];
        setDraft(questions.map((q) => ({ ...q, verdict: "pending" as Verdict, options: q.options ?? [] })));
        setLessonDraft(null);
      }
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    }
    setGenerating(false);
  }

  function patch(index: number, patchObj: Partial<DraftItem>) {
    setDraft((prev) => prev.map((d, i) => (i === index ? { ...d, ...patchObj } : d)));
  }

  function patchOption(qi: number, oi: number, patchObj: Partial<GeneratedOption>) {
    setDraft((prev) =>
      prev.map((d, i) => (i === qi ? { ...d, options: d.options.map((o, j) => (j === oi ? { ...o, ...patchObj } : o)) } : d))
    );
  }

  function setCorrect(qi: number, oi: number) {
    setDraft((prev) => prev.map((d, i) => (i === qi ? { ...d, options: d.options.map((o, j) => ({ ...o, is_correct: j === oi })) } : d)));
  }

  function addOption(qi: number) {
    setDraft((prev) => prev.map((d, i) => (i === qi ? { ...d, options: [...d.options, { text_fr: "", text_en: "", is_correct: false }] } : d)));
  }

  function removeOption(qi: number, oi: number) {
    setDraft((prev) => prev.map((d, i) => (i === qi ? { ...d, options: d.options.filter((_, j) => j !== oi) } : d)));
  }

  /** Same shape check the server re-applies before materialising (ai-content). */
  function validate(items: DraftItem[]): string | null {
    for (const q of items) {
      if (!q.text_fr.trim()) return t("ta_invalidOptions");
      if (q.options.length < 2) return t("ta_invalidOptions");
      if (q.options.filter((o) => o.is_correct).length !== 1) return t("ta_invalidOptions");
    }
    return null;
  }

  async function submitAccepted() {
    if (!profile) return;
    const accepted = draft.filter((d) => d.verdict === "accepted");
    if (accepted.length === 0) {
      setFlash({ ok: false, msg: t("ta_nothingAccepted") });
      return;
    }
    const invalid = validate(accepted);
    if (invalid) {
      setFlash({ ok: false, msg: invalid });
      return;
    }
    setSubmitting(true);
    setFlash(null);
    const subjectId = lessons.find((l) => l.id === lessonId)?.subjectId ?? null;
    const { data, error } = await supabase
      .from("content_approval")
      .insert(
        accepted.map((q) => ({
          submitted_by: profile.id,
          lesson_id: lessonId,
          subject_id: subjectId,
          kind: "mcq" as const,
          status: "pending" as const,
          generated_payload: {
            text_fr: q.text_fr,
            text_en: q.text_en,
            explanation_fr: q.explanation_fr ?? "",
            explanation_en: q.explanation_en ?? "",
            difficulty: q.difficulty ?? "medium",
            options: q.options,
          } as unknown as Record<string, unknown>,
        }))
      )
      .select("id");
    if (error || !data?.length) {
      setFlash({ ok: false, msg: error?.message || t("admin_saveBlocked") });
    } else {
      setFlash({ ok: true, msg: t("teacher_submitForApproval") });
      setDraft((prev) => prev.filter((d) => d.verdict !== "accepted"));
    }
    setSubmitting(false);
  }

  if (subjectsLoading) return <Spinner />;
  if (subjectsError || subjects.length === 0) {
    return <StateNotice error={subjectsError} emptyLabel={t("td_noSubjectsHint")} errorLabel={t("common_error")} onRetry={reloadSubjects} />;
  }

  const acceptedCount = draft.filter((d) => d.verdict === "accepted").length;

  return (
    <div className="max-w-[900px]">
      {/* Generation brief */}
      <div className="bg-white border border-border rounded-2xl p-5 mb-5">
        <div className="text-[13.5px] font-bold text-ink-900 mb-3.5">{t("teacher_uploadSource")}</div>

        {lessons.length === 0 ? (
          <div className="text-[12.5px] text-muted">{t("ta_noLessons")}</div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-muted">{t("admin_lessons")}</span>
                <Select
                  value={lessonId}
                  onChange={(e) => setLessonId(e.target.value)}
                  className="px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[13px] bg-white w-full"
                  wrapperClassName="w-full"
                >
                  {lessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      {lang === "fr" ? l.title_fr : l.title_en || l.title_fr}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-muted">{t("ta_contentType")}</span>
                <Select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value as ContentType)}
                  className="px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[13px] bg-white w-full"
                  wrapperClassName="w-full"
                >
                  <option value="mcq">{t("ta_typeMcq")}</option>
                  <option value="true_false">{t("ta_typeTrueFalse")}</option>
                  <option value="short_answer">{t("ta_typeShort")}</option>
                  <option value="lesson">{t("ta_typeLesson")}</option>
                  <option value="summary">{t("ta_typeSummary")}</option>
                </Select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-muted">{t("ta_topic")}</span>
                <input value={topic} onChange={(e) => setTopic(e.target.value)} className="px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[13px]" />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-muted">{t("ta_level")}</span>
                <input value={level} onChange={(e) => setLevel(e.target.value)} className="px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[13px]" />
              </label>

              <label className="flex flex-col gap-1.5 md:col-span-2">
                <span className="text-[11px] font-bold text-muted">{t("ta_objectives")}</span>
                <textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} rows={2} className="px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[13px] resize-y" />
              </label>

              {contentType !== "lesson" && contentType !== "summary" && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-muted">{t("ta_count")}</span>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={count}
                    onChange={(e) => setCount(Math.min(15, Math.max(1, Number(e.target.value) || 1)))}
                    className="px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[13px]"
                  />
                </label>
              )}

              <label className="flex items-center gap-2.5 px-3 py-3 rounded-lg border-[1.5px] border-dashed border-border cursor-pointer md:col-span-2">
                <Icon name="upload" size={18} className="text-ink-700" />
                <span className="text-xs text-ink-800 flex-1 truncate">{file ? file.name : t("teacher_uploadSource")}</span>
                <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} accept=".pdf,.doc,.docx,.md,.txt,.ppt,.pptx" />
              </label>
            </div>

            <Button onClick={generate} disabled={generating || !lessonId} className="mt-3.5">
              {generating ? t("ta_generating") : t("teacher_generate")}
            </Button>
          </>
        )}

        {sourceNote && <div className="mt-2.5 text-[11.5px] text-muted leading-relaxed">{sourceNote}</div>}
        {flash && (
          <div role="status" aria-live="polite" className={`mt-2.5 text-xs font-semibold ${flash.ok ? "text-success-600" : "text-danger-600"}`}>
            {flash.msg}
          </div>
        )}
      </div>

      {generating && <Spinner />}

      {/* Generated lesson body (review + copy into the editor) */}
      {lessonDraft && (
        <div className="bg-white border border-border rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-600/10 text-brand-600">{t("ta_aiDraft")}</span>
            <span className="text-[12px] text-muted">{t("ta_lessonGenerated")}</span>
          </div>
          <textarea
            readOnly
            value={lang === "fr" ? (lessonDraft.content_fr ?? "") : (lessonDraft.content_en ?? "")}
            rows={14}
            className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-ink-300 text-[12.5px] font-mono leading-relaxed resize-y"
          />
          <div className="text-[11px] text-muted mt-2">{t("tc_onlyOwnDrafts")}</div>
        </div>
      )}

      {/* MCQ review desk */}
      {draft.length > 0 && (
        <>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="text-[13.5px] font-bold text-ink-900">{t("ta_reviewTitle")}</div>
            <span className="text-[11.5px] text-muted">
              {acceptedCount}/{draft.length} {t("ta_accepted").toLowerCase()}
            </span>
            <div className="flex-1" />
            <button
              onClick={() => setDraft((prev) => prev.map((d) => ({ ...d, verdict: "accepted" })))}
              className="border border-border bg-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold text-ink-900"
            >
              {t("ta_acceptAll")}
            </button>
          </div>

          <div className="flex flex-col gap-3 mb-4">
            {draft.map((q, qi) => (
              <QuestionReviewCard
                key={qi}
                index={qi}
                item={q}
                onPatch={(p) => patch(qi, p)}
                onPatchOption={(oi, p) => patchOption(qi, oi, p)}
                onSetCorrect={(oi) => setCorrect(qi, oi)}
                onAddOption={() => addOption(qi)}
                onRemoveOption={(oi) => removeOption(qi, oi)}
              />
            ))}
          </div>

          <Button onClick={submitAccepted} disabled={submitting || acceptedCount === 0}>
            {submitting ? t("tc_submitting") : `${t("ta_submitAccepted")} (${acceptedCount})`}
          </Button>
        </>
      )}

      {!generating && draft.length === 0 && !lessonDraft && (
        <StateNotice emptyLabel={lang === "fr" ? "Aucune question générée pour le moment" : "No generated questions yet"} errorLabel={t("common_error")} />
      )}
    </div>
  );
}

const DIFFS: { key: DifficultyLevel; label: "admin_easy" | "admin_medium" | "admin_hard"; color: string }[] = [
  { key: "easy", label: "admin_easy", color: "#22c55e" },
  { key: "medium", label: "admin_medium", color: "#f5b400" },
  { key: "hard", label: "admin_hard", color: "#ef4444" },
];

function QuestionReviewCard({
  index,
  item,
  onPatch,
  onPatchOption,
  onSetCorrect,
  onAddOption,
  onRemoveOption,
}: {
  index: number;
  item: DraftItem;
  onPatch: (p: Partial<DraftItem>) => void;
  onPatchOption: (oi: number, p: Partial<GeneratedOption>) => void;
  onSetCorrect: (oi: number) => void;
  onAddOption: () => void;
  onRemoveOption: (oi: number) => void;
}) {
  const { t, lang } = useI18n();
  const rejected = item.verdict === "rejected";
  const accepted = item.verdict === "accepted";

  const correctCount = item.options.filter((o) => o.is_correct).length;
  const shapeError = item.options.length < 2 || correctCount !== 1;

  return (
    <div className={`bg-white border rounded-2xl p-[18px] ${rejected ? "border-border opacity-60" : accepted ? "border-success-600/50" : "border-border"}`}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
          {t("admin_question")} {index + 1}
        </span>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-600/10 text-brand-600">{t("ta_aiDraft")}</span>
        {accepted && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success-600/10 text-success-600">{t("ta_accepted")}</span>}
        {rejected && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-ink-100 text-muted">{t("ta_rejected")}</span>}
        <div className="flex-1" />
        {rejected ? (
          <button onClick={() => onPatch({ verdict: "pending" })} className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-border text-ink-900">
            {t("ta_restore")}
          </button>
        ) : (
          <>
            <button
              onClick={() => onPatch({ verdict: accepted ? "pending" : "accepted" })}
              disabled={shapeError && !accepted}
              title={shapeError ? t("ta_invalidOptions") : undefined}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border-none text-white disabled:opacity-50 ${accepted ? "bg-ink-700" : "bg-success-600"}`}
            >
              {accepted ? t("admin_cancel") : t("ta_accept")}
            </button>
            <button onClick={() => onPatch({ verdict: "rejected" })} className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-border text-danger-600">
              {t("ta_rejectItem")}
            </button>
          </>
        )}
      </div>

      <NotationField label={t("admin_questionFr")} value={item.text_fr} onChange={(v) => onPatch({ text_fr: v })} />
      <NotationField label={t("admin_questionEn")} value={item.text_en} onChange={(v) => onPatch({ text_en: v })} />

      <div className="flex flex-col gap-2 my-3">
        {item.options.map((o, oi) => (
          <div key={oi} className={`rounded-xl border p-2.5 ${o.is_correct ? "border-success-600/50 bg-success-600/5" : "border-border"}`}>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => onSetCorrect(oi)}
                aria-label={t("admin_correct")}
                title={t("admin_correct")}
                className={`w-5 h-5 rounded-full border-[1.5px] flex-none flex items-center justify-center ${o.is_correct ? "bg-success-600 border-success-600" : "border-ink-300 bg-white"}`}
              >
                {o.is_correct && <Icon name="check" size={12} className="text-white" />}
              </button>
              <span className={`text-[11px] font-bold ${o.is_correct ? "text-success-600" : "text-muted"}`}>{o.is_correct ? t("admin_correct") : `#${oi + 1}`}</span>
              <div className="flex-1" />
              <button onClick={() => onRemoveOption(oi)} title={t("ta_removeOption")} className="p-1 rounded-md border border-border text-danger-600">
                <Icon name="close" size={12} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input value={o.text_fr} onChange={(e) => onPatchOption(oi, { text_fr: e.target.value })} placeholder={t("admin_choiceFr")} className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 text-[12.5px]" />
              <input value={o.text_en} onChange={(e) => onPatchOption(oi, { text_en: e.target.value })} placeholder={t("admin_choiceEn")} className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 text-[12.5px]" />
            </div>
            {(hasNotation(o.text_fr) || hasNotation(o.text_en)) && (
              <div className="mt-1.5 text-[12px] text-text">{inline(lang === "fr" ? o.text_fr : o.text_en)}</div>
            )}
          </div>
        ))}
        <button onClick={onAddOption} className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-bold border-[1.5px] border-ink-200 text-ink-700 bg-white">
          <Icon name="plus" size={13} />
          {t("ta_addOption")}
        </button>
      </div>

      <NotationField label={t("ta_explanationFr")} value={item.explanation_fr ?? ""} onChange={(v) => onPatch({ explanation_fr: v })} />
      <NotationField label={t("ta_explanationEn")} value={item.explanation_en ?? ""} onChange={(v) => onPatch({ explanation_en: v })} />

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className="text-[11px] font-bold text-muted">{t("admin_difficulty")}:</span>
        {DIFFS.map((d) => {
          const active = (item.difficulty ?? "medium") === d.key;
          return (
            <button
              key={d.key}
              onClick={() => onPatch({ difficulty: d.key })}
              className="px-2.5 py-1 rounded-pill text-[11px] font-bold border"
              style={{ background: active ? d.color : "#fff", color: active ? "#fff" : "#64748b", borderColor: active ? d.color : "#e2e8f0" }}
            >
              {t(d.label)}
            </button>
          );
        })}
      </div>

      {shapeError && (
        <div role="alert" className="mt-2 text-[11.5px] font-semibold text-danger-600">
          {t("ta_invalidOptions")}
        </div>
      )}
    </div>
  );
}

/** A bilingual field with the formula tools and a typeset preview. */
function NotationField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const [tool, setTool] = useState<null | "math" | "chem">(null);
  // Callback ref in state: the formula tool needs the element to compute the
  // caret position, and a state ref re-renders the tool once it's attached.
  const [el, setEl] = useState<HTMLTextAreaElement | null>(null);

  return (
    <div className="flex flex-col gap-1.5 mb-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-muted">{label}</span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTool(tool === "math" ? null : "math")}
            aria-label={t("te_insertMath")}
            className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${tool === "math" ? "border-brand-600 text-brand-600" : "border-border text-ink-700"}`}
          >
            ∑
          </button>
          <button
            type="button"
            onClick={() => setTool(tool === "chem" ? null : "chem")}
            aria-label={t("te_insertChem")}
            className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${tool === "chem" ? "border-brand-600 text-brand-600" : "border-border text-ink-700"}`}
          >
            H₂O
          </button>
        </span>
      </div>
      <textarea
        ref={setEl}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 text-[12.5px] leading-relaxed resize-y"
      />
      {tool && <FormulaTool mode={tool} onInsert={(s) => applyInsert(el, insertSnippet(el, value, s), onChange)} onClose={() => setTool(null)} />}
      {hasNotation(value) && <div className="rounded-lg bg-ink-50 border border-ink-100 px-2.5 py-2 text-[12.5px] text-text">{inline(value)}</div>}
    </div>
  );
}
