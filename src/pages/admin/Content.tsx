import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon, subjectIcon, subjectColors } from "../../lib/icons";
import { Pill, Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { SubjectRow, ChapterRow } from "../../lib/database.types";

interface ChapterWithCounts extends ChapterRow {
  lessonsCount: number;
}

type LessonLite = { id: string; title_fr: string; title_en: string; published: boolean; position: number };

export default function AdminContent() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string>("");
  const [chapters, setChapters] = useState<ChapterWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lessonsByChapter, setLessonsByChapter] = useState<Record<string, LessonLite[]>>({});
  const [busy, setBusy] = useState(false);

  async function loadLessons(chapterId: string) {
    const { data } = await supabase
      .from("lessons")
      .select("id, title_fr, title_en, published, position")
      .eq("chapter_id", chapterId)
      .order("position");
    setLessonsByChapter((prev) => ({ ...prev, [chapterId]: data ?? [] }));
    return data ?? [];
  }

  async function toggleChapter(c: ChapterWithCounts) {
    if (expandedId === c.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(c.id);
    if (!lessonsByChapter[c.id] && isSupabaseConfigured) await loadLessons(c.id);
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase.from("subjects").select("*").eq("track", "medicine").order("position");
      setSubjects(data ?? []);
      if (data && data.length > 0) setActiveSubjectId(data[0].id);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!activeSubjectId || !isSupabaseConfigured) return;
    (async () => {
      const { data: chapterRows } = await supabase.from("chapters").select("*").eq("subject_id", activeSubjectId).order("position");
      const chapterIds = (chapterRows ?? []).map((c) => c.id);
      const { data: lessonRows } = chapterIds.length
        ? await supabase.from("lessons").select("id, chapter_id").in("chapter_id", chapterIds)
        : { data: [] };
      setChapters(
        (chapterRows ?? []).map((c) => ({ ...c, lessonsCount: (lessonRows ?? []).filter((l) => l.chapter_id === c.id).length }))
      );
    })();
  }, [activeSubjectId]);

  async function addChapter() {
    if (!activeSubjectId) return;
    const label = lang === "fr" ? "Nouveau chapitre" : "New chapter";
    const slug = `chapter-${Date.now()}`;
    const nextPos = chapters.length ? Math.max(...chapters.map((c) => c.position)) + 1 : 0;
    const { data } = await supabase
      .from("chapters")
      .insert({ subject_id: activeSubjectId, slug, name_fr: label, name_en: "New chapter", position: nextPos })
      .select()
      .single();
    if (data) setChapters((prev) => [...prev, { ...data, lessonsCount: 0 }]);
  }

  // Reorder a chapter by swapping its position with the adjacent one. Neither
  // chapters nor lessons have a unique(position) constraint, so a direct swap
  // is safe (no temp value needed, unlike lesson_cards).
  async function moveChapter(c: ChapterWithCounts, dir: -1 | 1) {
    if (busy) return;
    const sorted = [...chapters].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((x) => x.id === c.id);
    const neighbor = sorted[idx + dir];
    if (!neighbor) return;
    setBusy(true);
    await supabase.from("chapters").update({ position: neighbor.position }).eq("id", c.id);
    await supabase.from("chapters").update({ position: c.position }).eq("id", neighbor.id);
    setChapters((prev) =>
      prev
        .map((x) => (x.id === c.id ? { ...x, position: neighbor.position } : x.id === neighbor.id ? { ...x, position: c.position } : x))
        .sort((a, b) => a.position - b.position)
    );
    setBusy(false);
  }

  async function deleteChapter(c: ChapterWithCounts) {
    if (busy) return;
    if (!window.confirm(t("admin_confirmDeleteChapter"))) return;
    setBusy(true);
    // lessons cascade-delete via chapters FK (on delete cascade).
    const { error } = await supabase.from("chapters").delete().eq("id", c.id);
    if (!error) {
      setChapters((prev) => prev.filter((x) => x.id !== c.id));
      if (expandedId === c.id) setExpandedId(null);
    }
    setBusy(false);
  }

  function startEdit(c: ChapterWithCounts) {
    setEditingId(c.id);
    setEditValue(lang === "fr" ? c.name_fr : c.name_en);
  }

  async function saveEdit(c: ChapterWithCounts) {
    if (lang === "fr") {
      await supabase.from("chapters").update({ name_fr: editValue }).eq("id", c.id);
      setChapters((prev) => prev.map((ch) => (ch.id === c.id ? { ...ch, name_fr: editValue } : ch)));
    } else {
      await supabase.from("chapters").update({ name_en: editValue }).eq("id", c.id);
      setChapters((prev) => prev.map((ch) => (ch.id === c.id ? { ...ch, name_en: editValue } : ch)));
    }
    setEditingId(null);
  }

  async function addLesson(c: ChapterWithCounts) {
    if (busy) return;
    setBusy(true);
    const existing = lessonsByChapter[c.id] ?? (await loadLessons(c.id));
    const nextPos = existing.length ? Math.max(...existing.map((l) => l.position)) + 1 : 0;
    const { data } = await supabase
      .from("lessons")
      .insert({
        chapter_id: c.id,
        slug: `lesson-${Date.now()}`,
        title_fr: t("admin_newLesson"),
        title_en: "New lesson",
        position: nextPos,
        published: false, // start as draft — hidden from students until ready
      })
      .select("id, title_fr, title_en, published, position")
      .single();
    setBusy(false);
    if (data) {
      setLessonsByChapter((prev) => ({ ...prev, [c.id]: [...(prev[c.id] ?? []), data] }));
      setChapters((prev) => prev.map((ch) => (ch.id === c.id ? { ...ch, lessonsCount: ch.lessonsCount + 1 } : ch)));
      navigate(`/admin/content/lesson/${data.id}`); // jump straight into editing
    }
  }

  async function deleteLesson(chapterId: string, lesson: LessonLite) {
    if (busy) return;
    if (!window.confirm(t("admin_confirmDeleteLesson"))) return;
    setBusy(true);
    const { error } = await supabase.from("lessons").delete().eq("id", lesson.id);
    if (!error) {
      setLessonsByChapter((prev) => ({ ...prev, [chapterId]: (prev[chapterId] ?? []).filter((l) => l.id !== lesson.id) }));
      setChapters((prev) => prev.map((ch) => (ch.id === chapterId ? { ...ch, lessonsCount: Math.max(0, ch.lessonsCount - 1) } : ch)));
    }
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

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {loading ? (
          <Spinner />
        ) : (
          subjects.map((s) => (
            <Pill key={s.id} active={s.id === activeSubjectId} onClick={() => setActiveSubjectId(s.id)}>
              <span className="flex items-center gap-1.5">
                <Icon name={subjectIcon(s.slug)} size={12} style={{ color: subjectColors(s.slug).accent }} />
                {lang === "fr" ? s.name_fr : s.name_en}
              </span>
            </Pill>
          ))
        )}
        <div className="flex-1" />
        <button onClick={addChapter} className="border-none px-4 py-2.5 rounded-xl text-xs font-bold bg-brand-600 text-white flex items-center gap-1.5">
          <Icon name="plus" size={14} />
          {t("admin_addChapter")}
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {chapters.length === 0 ? (
          <EmptyState label={isSupabaseConfigured ? t("common_error") : t("backend_banner")} />
        ) : (
          chapters
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((c, ci, arr) => (
              <div key={c.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-4.5 px-[18px] py-4 flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-[10px] bg-ink-100 flex items-center justify-center flex-none">
                    {(() => {
                      const sub = subjects.find((s) => s.id === c.subject_id);
                      return <Icon name={sub ? subjectIcon(sub.slug) : "book"} size={17} style={{ color: sub ? subjectColors(sub.slug).accent : undefined }} />;
                    })()}
                  </div>
                  {editingId === c.id ? (
                    <>
                      <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="flex-1 px-2.5 py-2 rounded-lg border-[1.5px] border-ink-300 text-[13px]" />
                      <button onClick={() => saveEdit(c)} className="border-none bg-success-600 text-white px-3.5 py-1.5 rounded-lg text-[11.5px] font-bold">
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
                          <div className="text-sm font-bold text-ink-900">{lang === "fr" ? c.name_fr : c.name_en}</div>
                          <div className="text-xs text-muted">
                            {c.lessonsCount} {t("admin_lessons").toLowerCase()}
                          </div>
                        </div>
                        <Icon name={expandedId === c.id ? "collapse" : "chevright"} size={15} className="text-muted flex-none" />
                      </button>
                      {/* Reorder / delete chapter */}
                      <button onClick={() => moveChapter(c, -1)} disabled={busy || ci === 0} title={t("admin_moveUp")} className="p-1.5 rounded-lg border border-border text-ink-700 disabled:opacity-40 flex-none">
                        <Icon name="chevleft" size={13} className="rotate-90" />
                      </button>
                      <button onClick={() => moveChapter(c, 1)} disabled={busy || ci === arr.length - 1} title={t("admin_moveDown")} className="p-1.5 rounded-lg border border-border text-ink-700 disabled:opacity-40 flex-none">
                        <Icon name="chevleft" size={13} className="-rotate-90" />
                      </button>
                      <button onClick={() => startEdit(c)} className="border border-border bg-white px-3.5 py-1.5 rounded-lg text-[11.5px] font-bold text-ink-900 flex-none">
                        {t("admin_edit")}
                      </button>
                      <button onClick={() => deleteChapter(c)} disabled={busy} title={t("admin_deleteChapter")} className="p-1.5 rounded-lg border border-border text-danger-600 disabled:opacity-40 flex-none">
                        <Icon name="close" size={14} />
                      </button>
                    </>
                  )}
                </div>

                {expandedId === c.id && editingId !== c.id && (
                  <div className="border-t border-border bg-ink-50 px-4.5 px-[18px] py-1.5">
                    {(lessonsByChapter[c.id] ?? []).length === 0 ? (
                      <div className="text-xs text-muted py-2.5">{t("admin_noLessons")}</div>
                    ) : (
                      (lessonsByChapter[c.id] ?? []).map((l, li, larr) => (
                        <div key={l.id} className="flex items-center gap-2.5 py-2.5 border-b border-border/60 last:border-0">
                          <Icon name="book" size={14} className="text-muted flex-none" />
                          <button onClick={() => navigate(`/admin/content/lesson/${l.id}`)} className="flex-1 min-w-0 text-left bg-transparent border-none p-0 cursor-pointer text-[13px] text-ink-900 truncate">
                            {lang === "fr" ? l.title_fr : l.title_en}
                          </button>
                          {!l.published && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-ink-100 text-muted flex-none">{t("admin_draft")}</span>}
                          <button onClick={() => moveLesson(c.id, l, -1)} disabled={busy || li === 0} title={t("admin_moveUp")} className="p-1 rounded-md border border-border text-ink-700 disabled:opacity-40 flex-none">
                            <Icon name="chevleft" size={12} className="rotate-90" />
                          </button>
                          <button onClick={() => moveLesson(c.id, l, 1)} disabled={busy || li === larr.length - 1} title={t("admin_moveDown")} className="p-1 rounded-md border border-border text-ink-700 disabled:opacity-40 flex-none">
                            <Icon name="chevleft" size={12} className="-rotate-90" />
                          </button>
                          <button onClick={() => navigate(`/admin/content/lesson/${l.id}`)} className="text-[11px] font-bold text-brand-600 flex items-center gap-0.5 flex-none bg-transparent border-none cursor-pointer">
                            {t("admin_editLesson")}
                            <Icon name="chevright" size={12} />
                          </button>
                          <button onClick={() => deleteLesson(c.id, l)} disabled={busy} title={t("admin_deleteLesson")} className="p-1 rounded-md border border-border text-danger-600 disabled:opacity-40 flex-none">
                            <Icon name="close" size={12} />
                          </button>
                        </div>
                      ))
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
            ))
        )}
      </div>
    </div>
  );
}
