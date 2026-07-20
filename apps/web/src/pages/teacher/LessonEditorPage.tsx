import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type TeacherContentItemDto, type TeacherLessonOptionDto } from "../../lib/api-client";
import { ContentListPanel } from "./ContentListPanel";

/**
 * No matching Stitch design — built from tokens (WEB-T02 éditeur de fiches).
 * text_content only — no TipTap/R2 image upload pipeline configured yet
 * (image_url accepts a plain URL, matching the API's honest scope).
 */
export function LessonEditorPage() {
  const { t } = useTranslation();
  const [lessons, setLessons] = useState<TeacherLessonOptionDto[]>([]);
  const [cards, setCards] = useState<TeacherContentItemDto[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ lessonId: "", textContent: "", imageUrl: "" });
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.teacherContent().then((res) => setCards(res.items.filter((i) => i.type === "lesson_card")));
  }

  useEffect(() => {
    refresh();
    api.teacherLessonsList().then((res) => setLessons(res.lessons));
  }, []);

  async function create() {
    setError(null);
    if (!form.lessonId || !form.textContent) {
      setError(t("lessonEditor.validationRequired"));
      return;
    }
    try {
      await api.createLessonCard({
        lessonId: form.lessonId,
        cardType: form.imageUrl ? "text_image" : "text",
        textContent: form.textContent,
        imageUrl: form.imageUrl || undefined,
      });
      setShowForm(false);
      setForm({ lessonId: "", textContent: "", imageUrl: "" });
      refresh();
    } catch {
      setError(t("lessonEditor.createError"));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-lg">
        <h1 className="font-headline-lg text-headline-lg text-excellence-blue">{t("lessonEditor.title")}</h1>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="bg-excellence-blue text-white px-md py-sm rounded-xl font-label-lg text-label-lg flex items-center gap-xs"
        >
          <MaterialIcon name="add" className="text-[16px]" />
          {t("lessonEditor.newCard")}
        </button>
      </div>

      {showForm && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md mb-lg space-y-sm">
          <select
            value={form.lessonId}
            onChange={(e) => setForm({ ...form, lessonId: e.target.value })}
            className="w-full px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
          >
            <option value="">{t("lessonEditor.selectLesson")}</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.chapters?.subjects?.name} → {l.chapters?.name} → {l.title}
              </option>
            ))}
          </select>
          <textarea
            placeholder={t("lessonEditor.contentPlaceholder")}
            value={form.textContent}
            onChange={(e) => setForm({ ...form, textContent: e.target.value })}
            rows={4}
            className="w-full px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
          />
          <input
            placeholder={t("lessonEditor.imageUrlPlaceholder")}
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            className="w-full px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
          />
          {error && <p className="font-label-md text-label-md text-error-red">{error}</p>}
          <button type="button" onClick={create} className="bg-excellence-blue text-white px-md py-sm rounded-xl font-label-lg text-label-lg">
            {t("common.saveAsDraft")}
          </button>
        </div>
      )}

      <ContentListPanel
        items={cards}
        titleOf={(item) => String(item.text_content ?? "").slice(0, 80) || t("lessonEditor.untitled")}
        onSubmitted={refresh}
      />
    </div>
  );
}
