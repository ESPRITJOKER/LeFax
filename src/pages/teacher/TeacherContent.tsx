import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../../lib/icons";
import { SubjectGlyph } from "../../components/SubjectBadge";
import { Pill, Spinner } from "../../components/ui";
import { StateNotice } from "../../components/StateNotice";
import { ReviewStatusPill } from "../../components/content/ReviewStatusPill";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { useMySubjects, submitLessonForReview, isTeacherEditable } from "../../lib/teacher";
import type { ChapterRow, ReviewStatus } from "../../lib/database.types";

type LessonLite = {
  id: string;
  title_fr: string;
  title_en: string;
  published: boolean;
  position: number;
  review_status: ReviewStatus;
  review_feedback: string | null;
  author_id: string | null;
};

/**
 * "My content" — the authoring tree, scoped to one assigned subject at a time.
 *
 * Shape follows the admin content tree (chapters expand to lessons, reorder,
 * add, delete) but every operation is bounded by the teacher's grant:
 *   * the subject tabs come from the server's `my_subjects`;
 *   * `chapters.created_by` decides which chapters they may rename or delete
 *     (the seeded curriculum is read-only to them);
 *   * only their own lessons are listed, and only drafts/returned ones can be
 *     edited or deleted;
 *   * "Submit for review" is the one status transition they can drive.
 * RLS (0018) enforces all of that independently — this just avoids offering
 * actions the database would refuse.
 */
export default function TeacherContent() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const { subjects, loading: subjectsLoading, error: subjectsError, reload: reloadSubjects } = useMySubjects();

  const subjectId = params.get("subject") ?? subjects[0]?.id ?? "";
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [lessonsByChapter, setLessonsByChapter] = useState<Record<string, LessonLite[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const loadLessons = useCallback(
    async (chapterId: string) => {
      if (!profile) return [];
      const { data } = await supabase
        .from("lessons")
        .select("id, title_fr, title_en, published, position, review_status, review_feedback, author_id")
        .eq("chapter_id", chapterId)
        .eq("author_id", profile.id)
        .order("position");
      const rows = (data ?? []) as LessonLite[];
      setLessonsByChapter((prev) => ({ ...prev, [chapterId]: rows }));
      return rows;
    },
    [profile]
  );

  const loadChapters = useCallback(async () => {
    if (!isSupabaseConfigured || !subjectId) return;
    setLoading(true);
    const { data } = await supabase.from("chapters").select("*").eq("subject_id", subjectId).order("position");
    setChapters(data ?? []);
    setLessonsByChapter({});
    setExpandedId(null);
    setLoading(false);
  }, [subjectId]);

  useEffect(() => {
    loadChapters();
  }, [loadChapters]);

  if (subjectsLoading) return <Spinner />;
  if (subjectsError || subjects.length === 0) {
    return (
      <StateNotice
        error={subjectsError}
        emptyLabel={t("td_noSubjectsHint")}
        errorLabel={t("common_error")}
        onRetry={reloadSubjects}
      />
    );
  }

  async function toggleChapter(c: ChapterRow) {
    if (expandedId === c.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(c.id);
    if (!lessonsByChapter[c.id] && isSupabaseConfigured) await loadLessons(c.id);
  }

  async function addChapter() {
    if (!subjectId || !profile || busy) return;
    setBusy(true);
    setFlash(null);
    const nextPos = chapters.length ? Math.max(...chapters.map((c) => c.position)) + 1 : 0;
    const { data, error } = await supabase
      .from("chapters")
      .insert({
        subject_id: subjectId,
        slug: `chapter-${Date.now()}`,
        name_fr: lang === "fr" ? "Nouveau chapitre" : "New chapter",
        name_en: "New chapter",
        position: nextPos,
        created_by: profile.id, // required by chapters_insert_teacher (0018)
      })
      .select("*");
    if (error || !data?.length) setFlash({ ok: false, msg: error?.message || t("admin_saveBlocked") });
    else setChapters((prev) => [...prev, data[0]]);
    setBusy(false);
  }

  async function saveChapterName(c: ChapterRow) {
    // Branch rather than compute the key: a dynamic key widens the update type
    // and loses the column check.
    const patch = lang === "fr" ? { name_fr: editValue } : { name_en: editValue };
    const { data, error } = await supabase.from("chapters").update(patch).eq("id", c.id).select("id");
    if (error || !data?.length) {
      setFlash({ ok: false, msg: error?.message || t("admin_saveBlocked") });
    } else {
      setChapters((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
    }
    setEditingId(null);
  }

  async function deleteChapter(c: ChapterRow) {
    if (busy || !window.confirm(t("admin_confirmDeleteChapter"))) return;
    setBusy(true);
    const { error } = await supabase.from("chapters").delete().eq("id", c.id);
    if (error) setFlash({ ok: false, msg: error.message });
    else {
      setChapters((prev) => prev.filter((x) => x.id !== c.id));
      if (expandedId === c.id) setExpandedId(null);
    }
    setBusy(false);
  }

  async function addLesson(c: ChapterRow) {
    if (busy || !profile) return;
    setBusy(true);
    setFlash(null);
    const existing = lessonsByChapter[c.id] ?? (await loadLessons(c.id));
    const nextPos = existing.length ? Math.max(...existing.map((l) => l.position)) + 1 : 0;
    const { data, error } = await supabase
      .from("lessons")
      .insert({
        chapter_id: c.id,
        slug: `lesson-${Date.now()}`,
        title_fr: t("admin_newLesson"),
        title_en: "New lesson",
        position: nextPos,
        author_id: profile.id,
        published: false, // the trigger enforces this too — teachers create drafts
      })
      .select("id");
    setBusy(false);
    if (error || !data?.length) {
      setFlash({ ok: false, msg: error?.message || t("admin_saveBlocked") });
      return;
    }
    navigate(`/teacher/content/lesson/${data[0].id}`);
  }

  async function deleteLesson(chapterId: string, lesson: LessonLite) {
    if (busy || !window.confirm(t("admin_confirmDeleteLesson"))) return;
    setBusy(true);
    const { error } = await supabase.from("lessons").delete().eq("id", lesson.id);
    if (error) setFlash({ ok: false, msg: error.message });
    else setLessonsByChapter((prev) => ({ ...prev, [chapterId]: (prev[chapterId] ?? []).filter((l) => l.id !== lesson.id) }));
    setBusy(false);
  }

  async function moveLesson(chapterId: string, lesson: LessonLite, dir: -1 | 1) {
    if (busy) return;
    const list = [...(lessonsByChapter[chapterId] ?? [])].sort((a, b) => a.position - b.position);
    const idx = list.findIndex((l) => l.id === lesson.id);
    const neighbor = list[idx + dir];
    if (!neighbor) return;
    setBusy(true);
    await supabase.from("lessons").update({ position: neighbor.position }).eq("id", lesson.id);
    await supabase.from("lessons").update({ position: lesson.position }).eq("id", neighbor.id);
    setLessonsByChapter((prev) => ({
      ...prev,
      [chapterId]: (prev[chapterId] ?? [])
        .map((l) => (l.id === lesson.id ? { ...l, position: neighbor.position } : l.id === neighbor.id ? { ...l, position: lesson.position } : l))
        .sort((a, b) => a.position - b.position),
    }));
    setBusy(false);
  }

  async function submit(chapterId: string, lesson: LessonLite) {
    if (busy || !window.confirm(t("tc_confirmSubmit"))) return;
    setBusy(true);
    setFlash(null);
    const { error } = await submitLessonForReview(lesson.id);
    if (error) {
      setFlash({ ok: false, msg: error });
    } else {
      setFlash({ ok: true, msg: t("tc_submitted") });
      await loadLessons(chapterId);
    }
    setBusy(false);
  }

  const sortedChapters = [...chapters].sort((a, b) => a.position - b.position);

  return (
    <div className="max-w-[980px]">
      {/* Subject tabs — only the teacher's assigned subjects exist here. */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {subjects.map((s) => (
          <Pill key={s.id} active={s.id === subjectId} onClick={() => setParams({ subject: s.id })}>
            <span className="flex items-center gap-1.5">
              <SubjectGlyph slug={s.slug} size={13} />
              {lang === "fr" ? s.name_fr : s.name_en}
            </span>
          </Pill>
        ))}
        <div className="flex-1" />
        <button onClick={addChapter} disabled={busy} className="border-none px-4 py-2.5 rounded-xl text-xs font-bold bg-brand-600 text-white flex items-center gap-1.5 disabled:opacity-60">
          <Icon name="plus" size={14} />
          {t("admin_addChapter")}
        </button>
      </div>

      <div className="text-[11.5px] text-muted mb-3">{t("tc_onlyOwnDrafts")}</div>

      {flash && (
        <div
          role="status"
          aria-live="polite"
          className={`mb-4 rounded-xl px-4 py-2.5 text-[13px] font-semibold ${flash.ok ? "bg-success-600/10 text-success-600" : "bg-danger-600/10 text-danger-600"}`}
        >
          {flash.msg}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : sortedChapters.length === 0 ? (
        <StateNotice emptyLabel={t("tc_noChapters")} errorLabel={t("common_error")} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {sortedChapters.map((c) => {
            const mine = c.created_by === profile?.id;
            const lessons = [...(lessonsByChapter[c.id] ?? [])].sort((a, b) => a.position - b.position);
            return (
              <div key={c.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-[18px] py-4 flex items-center gap-3.5 flex-wrap">
                  <div className="w-9 h-9 rounded-[10px] bg-ink-100 flex items-center justify-center flex-none">
                    <Icon name="book" size={17} className="text-ink-700" />
                  </div>
                  {editingId === c.id ? (
                    <>
                      <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="flex-1 min-w-[160px] px-2.5 py-2 rounded-lg border-[1.5px] border-ink-300 text-[13px]" />
                      <button onClick={() => saveChapterName(c)} className="border-none bg-success-600 text-white px-3.5 py-1.5 rounded-lg text-[11.5px] font-bold">
                        {t("admin_save")}
                      </button>
                      <button onClick={() => setEditingId(null)} className="border border-border bg-white px-3.5 py-1.5 rounded-lg text-[11.5px] font-bold text-ink-900">
                        {t("admin_cancel")}
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => toggleChapter(c)} className="flex-1 min-w-0 flex items-center gap-2 bg-transparent border-none text-left p-0 cursor-pointer">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-ink-900 truncate">{lang === "fr" ? c.name_fr : c.name_en}</div>
                          <div className="text-xs text-muted">
                            {lessons.length || 0} {t("admin_lessons").toLowerCase()}
                          </div>
                        </div>
                        <Icon name={expandedId === c.id ? "collapse" : "chevright"} size={15} className="text-muted flex-none" />
                      </button>
                      {/* Only chapters this teacher created are theirs to rename or remove. */}
                      {mine && (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(c.id);
                              setEditValue(lang === "fr" ? c.name_fr : c.name_en);
                            }}
                            className="border border-border bg-white px-3.5 py-1.5 rounded-lg text-[11.5px] font-bold text-ink-900 flex-none"
                          >
                            {t("admin_edit")}
                          </button>
                          <button onClick={() => deleteChapter(c)} disabled={busy} title={t("admin_deleteChapter")} className="p-1.5 rounded-lg border border-border text-danger-600 disabled:opacity-40 flex-none">
                            <Icon name="close" size={14} />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>

                {expandedId === c.id && editingId !== c.id && (
                  <div className="border-t border-border bg-ink-50 px-[18px] py-1.5">
                    {lessons.length === 0 ? (
                      <div className="text-xs text-muted py-2.5">{t("admin_noLessons")}</div>
                    ) : (
                      lessons.map((l, li, arr) => {
                        const editable = isTeacherEditable(l);
                        return (
                          <div key={l.id} className="py-2.5 border-b border-border/60 last:border-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <Icon name="book" size={14} className="text-muted flex-none" />
                              <button
                                onClick={() => navigate(`/teacher/content/lesson/${l.id}`)}
                                className="flex-1 min-w-[140px] text-left bg-transparent border-none p-0 cursor-pointer text-[13px] text-ink-900 truncate"
                              >
                                {lang === "fr" ? l.title_fr : l.title_en || l.title_fr}
                              </button>
                              <ReviewStatusPill status={l.review_status} published={l.published} size="sm" />
                              <button onClick={() => moveLesson(c.id, l, -1)} disabled={busy || li === 0} title={t("admin_moveUp")} className="p-1 rounded-md border border-border text-ink-700 disabled:opacity-40 flex-none">
                                <Icon name="chevleft" size={12} className="rotate-90" />
                              </button>
                              <button onClick={() => moveLesson(c.id, l, 1)} disabled={busy || li === arr.length - 1} title={t("admin_moveDown")} className="p-1 rounded-md border border-border text-ink-700 disabled:opacity-40 flex-none">
                                <Icon name="chevleft" size={12} className="-rotate-90" />
                              </button>
                              <button onClick={() => navigate(`/teacher/content/lesson/${l.id}`)} className="text-[11px] font-bold text-brand-600 flex items-center gap-0.5 flex-none bg-transparent border-none cursor-pointer">
                                {editable ? t("admin_editLesson") : t("te_preview")}
                                <Icon name="chevright" size={12} />
                              </button>
                              {editable && (
                                <>
                                  <button
                                    onClick={() => submit(c.id, l)}
                                    disabled={busy}
                                    className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border-none bg-brand-600 text-white flex-none disabled:opacity-60"
                                  >
                                    {busy ? t("tc_submitting") : t("tc_submitForReview")}
                                  </button>
                                  <button onClick={() => deleteLesson(c.id, l)} disabled={busy} title={t("admin_deleteLesson")} className="p-1 rounded-md border border-border text-danger-600 disabled:opacity-40 flex-none">
                                    <Icon name="close" size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                            {l.review_status === "rejected" && l.review_feedback && (
                              <div className="mt-1.5 ml-6 rounded-lg bg-white border border-danger-600/30 px-2.5 py-2 text-[11.5px] text-ink-800">
                                <span className="font-bold text-danger-600">{t("tc_feedback")}: </span>
                                {l.review_feedback}
                              </div>
                            )}
                            {(l.review_status === "submitted" || l.review_status === "under_review") && (
                              <div className="mt-1.5 ml-6 text-[11px] text-muted">{t("tc_lockedSubmitted")}</div>
                            )}
                            {l.review_status === "approved" && <div className="mt-1.5 ml-6 text-[11px] text-muted">{t("tc_lockedApproved")}</div>}
                          </div>
                        );
                      })
                    )}
                    <div className="py-2.5">
                      <button onClick={() => addLesson(c)} disabled={busy} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-bold border-[1.5px] border-brand-600/40 text-brand-600 bg-white disabled:opacity-60">
                        <Icon name="plus" size={14} />
                        {t("admin_addLesson")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
