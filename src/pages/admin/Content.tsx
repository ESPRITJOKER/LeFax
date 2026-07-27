import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon, subjectIcon, subjectColors } from "../../lib/icons";
import { SubjectBadge } from "../../components/SubjectBadge";
import { Pill, Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { SubjectRow, ChapterRow } from "../../lib/database.types";

interface ChapterWithCounts extends ChapterRow {
  lessonsCount: number;
}

type LessonLite = { id: string; title_fr: string; title_en: string };

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

  async function toggleChapter(c: ChapterWithCounts) {
    if (expandedId === c.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(c.id);
    if (!lessonsByChapter[c.id] && isSupabaseConfigured) {
      const { data } = await supabase
        .from("lessons")
        .select("id, title_fr, title_en")
        .eq("chapter_id", c.id)
        .order("position");
      setLessonsByChapter((prev) => ({ ...prev, [c.id]: data ?? [] }));
    }
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
    const { data } = await supabase
      .from("chapters")
      .insert({ subject_id: activeSubjectId, slug, name_fr: label, name_en: "New chapter", position: chapters.length + 1 })
      .select()
      .single();
    if (data) setChapters((prev) => [...prev, { ...data, lessonsCount: 0 }]);
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
          chapters.map((c) => (
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
                    <button onClick={() => startEdit(c)} className="border border-border bg-white px-3.5 py-1.5 rounded-lg text-[11.5px] font-bold text-ink-900 flex-none">
                      {t("admin_edit")}
                    </button>
                  </>
                )}
              </div>

              {expandedId === c.id && editingId !== c.id && (
                <div className="border-t border-border bg-ink-50 px-4.5 px-[18px] py-1.5">
                  {(lessonsByChapter[c.id] ?? []).length === 0 ? (
                    <div className="text-xs text-muted py-2.5">{t("admin_noLessons")}</div>
                  ) : (
                    lessonsByChapter[c.id].map((l) => (
                      <button
                        key={l.id}
                        onClick={() => navigate(`/admin/content/lesson/${l.id}`)}
                        className="w-full flex items-center gap-2.5 py-2.5 bg-transparent border-none border-b border-border/60 last:border-0 text-left cursor-pointer"
                      >
                        <Icon name="book" size={14} className="text-muted flex-none" />
                        <span className="flex-1 min-w-0 text-[13px] text-ink-900 truncate">{lang === "fr" ? l.title_fr : l.title_en}</span>
                        <span className="text-[11px] font-bold text-brand-600 flex items-center gap-0.5 flex-none">
                          {t("admin_editLesson")}
                          <Icon name="chevright" size={12} />
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
