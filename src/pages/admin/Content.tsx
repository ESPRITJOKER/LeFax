import { useEffect, useState } from "react";
import { Icon } from "../../lib/icons";
import { Pill, Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { SubjectRow, ChapterRow } from "../../lib/database.types";

interface ChapterWithCounts extends ChapterRow {
  lessonsCount: number;
}

export default function AdminContent() {
  const { t, lang } = useI18n();
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string>("");
  const [chapters, setChapters] = useState<ChapterWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

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
              {lang === "fr" ? s.name_fr : s.name_en}
            </Pill>
          ))
        )}
        <div className="flex-1" />
        <button onClick={addChapter} className="border-none px-4 py-2.5 rounded-xl text-xs font-bold bg-ink-700 text-white flex items-center gap-1.5">
          <Icon name="plus" size={14} />
          {t("admin_addChapter")}
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {chapters.length === 0 ? (
          <EmptyState label={isSupabaseConfigured ? t("common_error") : t("backend_banner")} />
        ) : (
          chapters.map((c) => (
            <div key={c.id} className="bg-white border border-border rounded-2xl px-4.5 px-[18px] py-4 flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-[10px] bg-ink-100 flex items-center justify-center text-ink-700">
                <Icon name="book" size={17} />
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
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-ink-900">{lang === "fr" ? c.name_fr : c.name_en}</div>
                    <div className="text-xs text-muted">
                      {c.lessonsCount} {lang === "fr" ? "leçons" : "lessons"}
                    </div>
                  </div>
                  <button onClick={() => startEdit(c)} className="border border-border bg-white px-3.5 py-1.5 rounded-lg text-[11.5px] font-bold text-ink-900">
                    {t("admin_edit")}
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
