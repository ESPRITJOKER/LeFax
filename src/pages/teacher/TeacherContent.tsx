import { useEffect, useState } from "react";
import { Button, Spinner, EmptyState, Select } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { ChapterRow, LessonRow, QuizRow } from "../../lib/database.types";

export default function TeacherContent() {
  const { t, lang } = useI18n();
  const { profile } = useAuth();

  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [quizzesByLesson, setQuizzesByLesson] = useState<Record<string, QuizRow>>({});
  const [loading, setLoading] = useState(true);

  const [chapterId, setChapterId] = useState("");
  const [titleFr, setTitleFr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [contentFr, setContentFr] = useState("");
  const [contentEn, setContentEn] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!isSupabaseConfigured || !profile) {
      setLoading(false);
      return;
    }
    const { data: chapterRows } = await supabase.from("chapters").select("*").order("position");
    setChapters(chapterRows ?? []);
    if (chapterRows && chapterRows.length && !chapterId) setChapterId(chapterRows[0].id);

    const { data: lessonRows } = await supabase.from("lessons").select("*").eq("author_id", profile.id).order("created_at", { ascending: false });
    setLessons(lessonRows ?? []);

    const lessonIds = (lessonRows ?? []).map((l) => l.id);
    if (lessonIds.length) {
      const { data: quizRows } = await supabase.from("quizzes").select("*").in("lesson_id", lessonIds);
      setQuizzesByLesson(Object.fromEntries((quizRows ?? []).map((q) => [q.lesson_id as string, q])));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function uploadLesson() {
    if (!profile || !chapterId || !titleFr) return;
    setMessage(null);
    const slug = `lesson-${Date.now()}`;
    const { error } = await supabase.from("lessons").insert({
      chapter_id: chapterId,
      author_id: profile.id,
      slug,
      title_fr: titleFr,
      title_en: titleEn || titleFr,
      content_fr: contentFr,
      content_en: contentEn || contentFr,
      published: false,
    });
    if (error) {
      setMessage(t("common_error"));
      return;
    }
    setTitleFr("");
    setTitleEn("");
    setContentFr("");
    setContentEn("");
    setMessage(lang === "fr" ? "Leçon déposée (non publiée)." : "Lesson uploaded (unpublished).");
    await load();
  }

  async function createQuiz(lesson: LessonRow) {
    const { data } = await supabase
      .from("quizzes")
      .insert({ lesson_id: lesson.id, title_fr: `Test — ${lesson.title_fr}`, title_en: `Test — ${lesson.title_en}` })
      .select()
      .single();
    if (data) setQuizzesByLesson((prev) => ({ ...prev, [lesson.id]: data }));
  }

  return (
    <div>
      <div className="bg-white border border-border rounded-2xl p-5 mb-5">
        <div className="text-[13.5px] font-bold text-ink-900 mb-3.5">{t("teacher_uploadContent")}</div>
        <div className="flex flex-col gap-3">
          <Select value={chapterId} onChange={(e) => setChapterId(e.target.value)} className="px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[13px] bg-white w-full" wrapperClassName="w-full">
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {lang === "fr" ? c.name_fr : c.name_en}
              </option>
            ))}
          </Select>
          <input value={titleFr} onChange={(e) => setTitleFr(e.target.value)} placeholder={lang === "fr" ? "Titre (FR)" : "Title (FR)"} className="px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[13px]" />
          <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="Title (EN)" className="px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[13px]" />
          <textarea value={contentFr} onChange={(e) => setContentFr(e.target.value)} placeholder={lang === "fr" ? "Contenu (FR)" : "Content (FR)"} className="px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[13px] min-h-[80px]" />
          <textarea value={contentEn} onChange={(e) => setContentEn(e.target.value)} placeholder="Content (EN)" className="px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[13px] min-h-[80px]" />
        </div>
        <Button onClick={uploadLesson} className="mt-3.5">
          {t("teacher_uploadContent")}
        </Button>
        {message && <div className="mt-2.5 text-xs font-semibold text-ink-800">{message}</div>}
      </div>

      <div className="text-[13.5px] font-bold text-ink-900 mb-3">{t("teacher_myContent")}</div>
      <div className="flex flex-col gap-2.5">
        {loading ? (
          <Spinner />
        ) : lessons.length === 0 ? (
          <EmptyState label={isSupabaseConfigured ? t("common_error") : t("backend_banner")} />
        ) : (
          lessons.map((l) => (
            <div key={l.id} className="bg-white border border-border rounded-2xl px-4.5 px-[18px] py-3.5 flex items-center gap-3.5">
              <div className="flex-1">
                <div className="text-[13px] font-bold text-ink-900">{lang === "fr" ? l.title_fr : l.title_en}</div>
                <div className="text-[11.5px] text-muted">{l.published ? (lang === "fr" ? "Publié" : "Published") : lang === "fr" ? "Brouillon" : "Draft"}</div>
              </div>
              {quizzesByLesson[l.id] ? (
                <span className="text-[11px] font-bold text-success-600">{lang === "fr" ? "Quiz créé" : "Quiz created"}</span>
              ) : (
                <button onClick={() => createQuiz(l)} className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-border">
                  {t("teacher_createQuiz")}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
