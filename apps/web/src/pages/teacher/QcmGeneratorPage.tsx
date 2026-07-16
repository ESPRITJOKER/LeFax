import { useEffect, useState } from "react";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type TeacherContentItemDto, type TeacherLessonOptionDto } from "../../lib/api-client";
import { ContentListPanel } from "./ContentListPanel";

const EMPTY_OPTIONS = [
  { id: "a", text: "" },
  { id: "b", text: "" },
  { id: "c", text: "" },
  { id: "d", text: "" },
];

/** No matching Stitch design — built from tokens (WEB-T03 créateur de QCM). */
export function QcmGeneratorPage() {
  const [lessons, setLessons] = useState<TeacherLessonOptionDto[]>([]);
  const [qcms, setQcms] = useState<TeacherContentItemDto[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [lessonId, setLessonId] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(EMPTY_OPTIONS.map((o) => ({ ...o })));
  const [correctOptionId, setCorrectOptionId] = useState("");
  const [explanation, setExplanation] = useState("");
  const [difficulty, setDifficulty] = useState("easy");
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.teacherContent().then((res) => setQcms(res.items.filter((i) => i.type === "qcm")));
  }

  useEffect(() => {
    refresh();
    api.teacherLessonsList().then((res) => setLessons(res.lessons));
  }, []);

  function resetForm() {
    setLessonId("");
    setQuestion("");
    setOptions(EMPTY_OPTIONS.map((o) => ({ ...o })));
    setCorrectOptionId("");
    setExplanation("");
    setDifficulty("easy");
  }

  async function create() {
    setError(null);
    if (!lessonId || !question || options.some((o) => !o.text) || !correctOptionId) {
      setError("Leçon, question, 4 options et une bonne réponse sont requises.");
      return;
    }
    if (explanation.length < 30) {
      setError("L'explication doit contenir au moins 30 caractères.");
      return;
    }
    try {
      await api.createQcm({ lessonId, question, options, correctOptionId, explanation, difficulty });
      setShowForm(false);
      resetForm();
      refresh();
    } catch {
      setError("Erreur lors de la création du QCM.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-lg">
        <h1 className="font-headline-lg text-headline-lg text-excellence-blue">QCMs</h1>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="bg-excellence-blue text-white px-md py-sm rounded-xl font-label-lg text-label-lg flex items-center gap-xs"
        >
          <MaterialIcon name="add" className="text-[16px]" />
          Nouveau QCM
        </button>
      </div>

      {showForm && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md mb-lg space-y-sm">
          <select
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
            className="w-full px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
          >
            <option value="">Sélectionner une leçon</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.chapters?.subjects?.name} → {l.chapters?.name} → {l.title}
              </option>
            ))}
          </select>
          <textarea
            placeholder="Question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            className="w-full px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
          />
          {options.map((option, i) => (
            <div key={option.id} className="flex items-center gap-sm">
              <input
                type="radio"
                name="correct"
                checked={correctOptionId === option.id}
                onChange={() => setCorrectOptionId(option.id)}
                title="Bonne réponse"
              />
              <input
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                value={option.text}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = { ...next[i]!, text: e.target.value };
                  setOptions(next);
                }}
                className="flex-1 px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
              />
            </div>
          ))}
          <textarea
            placeholder="Explication (min. 30 caractères)"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={2}
            className="w-full px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
          />
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
          >
            <option value="easy">Facile</option>
            <option value="intermediate">Intermédiaire</option>
            <option value="hard">Difficile</option>
          </select>
          {error && <p className="font-label-md text-label-md text-error-red">{error}</p>}
          <button type="button" onClick={create} className="bg-excellence-blue text-white px-md py-sm rounded-xl font-label-lg text-label-lg">
            Enregistrer comme brouillon
          </button>
        </div>
      )}

      <ContentListPanel items={qcms} titleOf={(item) => String(item.question ?? "")} onSubmitted={refresh} />
    </div>
  );
}
