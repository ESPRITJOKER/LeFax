import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type ChapterDto, type LessonListDto, type SubjectDto } from "../../lib/api-client";
import { useSessionStore } from "../../stores/session.store";

/**
 * No matching Stitch design — built from the extracted design tokens
 * (WEB-E04 content hierarchy: matières -> chapitres -> leçons).
 */
export function CourseLibraryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectDto[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SubjectDto | null>(null);
  const [chapters, setChapters] = useState<ChapterDto[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<ChapterDto | null>(null);
  const [lessons, setLessons] = useState<LessonListDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const branchSlug = user?.branchPreferences[0];
    if (!branchSlug) {
      setLoading(false);
      return;
    }
    api.branches().then(({ branches }) => {
      const branch = branches.find((b) => b.slug === branchSlug);
      if (!branch) {
        setLoading(false);
        return;
      }
      setBranchId(branch.id);
      api.subjects(branch.id).then((res) => {
        setSubjects(res.subjects);
        setLoading(false);
      });
    });
  }, [user]);

  function openSubject(subject: SubjectDto) {
    setSelectedSubject(subject);
    setSelectedChapter(null);
    api.chapters(subject.id).then((res) => setChapters(res.chapters));
  }

  function openChapter(chapter: ChapterDto) {
    setSelectedChapter(chapter);
    api.lessons(chapter.id).then((res) => setLessons(res.lessons));
  }

  if (loading) return null;
  if (!branchId) {
    return <p className="font-body-md text-body-md text-text-secondary text-center py-xl">{t("courseLibrary.selectBranch")}</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-xs mb-lg font-label-md text-label-md text-text-secondary flex-wrap">
        <button
          type="button"
          onClick={() => {
            setSelectedSubject(null);
            setSelectedChapter(null);
          }}
          className={selectedSubject ? "text-excellence-blue" : "text-primary font-bold"}
        >
          {t("courseLibrary.subjects")}
        </button>
        {selectedSubject && (
          <>
            <MaterialIcon name="chevron_right" className="text-[16px]" />
            <button
              type="button"
              onClick={() => setSelectedChapter(null)}
              className={selectedChapter ? "text-excellence-blue" : "text-primary font-bold"}
            >
              {selectedSubject.name}
            </button>
          </>
        )}
        {selectedChapter && (
          <>
            <MaterialIcon name="chevron_right" className="text-[16px]" />
            <span className="text-primary font-bold">{selectedChapter.name}</span>
          </>
        )}
      </div>

      {!selectedSubject && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
          {subjects.length === 0 && <p className="font-body-md text-body-md text-text-secondary">{t("courseLibrary.noSubjects")}</p>}
          {subjects.map((subject) => (
            <button
              key={subject.id}
              type="button"
              onClick={() => openSubject(subject)}
              className="text-left bg-surface-container-lowest border border-outline-variant rounded-xl p-md hover:border-excellence-blue transition-all"
            >
              <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center mb-sm">
                <MaterialIcon name="menu_book" className="text-white" />
              </div>
              <h3 className="font-label-lg text-label-lg text-primary">{subject.name}</h3>
              <p className="font-label-md text-label-md text-text-secondary">{t("courseLibrary.chapterCount", { count: subject.chapterCount })}</p>
            </button>
          ))}
        </div>
      )}

      {selectedSubject && !selectedChapter && (
        <div className="flex flex-col gap-sm">
          {chapters.length === 0 && <p className="font-body-md text-body-md text-text-secondary">{t("courseLibrary.noChapters")}</p>}
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              type="button"
              onClick={() => openChapter(chapter)}
              className="flex items-center justify-between p-md bg-surface-container-lowest border border-outline-variant rounded-xl hover:border-excellence-blue transition-all"
            >
              <span className="font-label-lg text-label-lg text-primary">{chapter.name}</span>
              <MaterialIcon name="chevron_right" className="text-on-surface-variant" />
            </button>
          ))}
        </div>
      )}

      {selectedChapter && (
        <div className="flex flex-col gap-sm">
          {lessons.length === 0 && <p className="font-body-md text-body-md text-text-secondary">{t("courseLibrary.noLessons")}</p>}
          {lessons.map((lesson) => (
            <button
              key={lesson.id}
              type="button"
              onClick={() => navigate(`/app/lessons/${lesson.id}`)}
              className="flex items-center justify-between p-md bg-surface-container-lowest border border-outline-variant rounded-xl hover:border-excellence-blue transition-all"
            >
              <div>
                <span className="font-label-lg text-label-lg text-primary block">{lesson.title}</span>
                <span className="font-label-md text-label-md text-text-secondary">
                  {lesson.estimated_minutes ? t("common.minutes", { count: lesson.estimated_minutes }) : ""}
                  {lesson.progress.completed ? ` • ${t("courseLibrary.completed")}` : ""}
                </span>
              </div>
              <MaterialIcon name="chevron_right" className="text-on-surface-variant" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
