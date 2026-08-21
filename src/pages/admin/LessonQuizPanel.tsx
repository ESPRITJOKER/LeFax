import { useEffect, useRef, useState } from "react";
import { Icon } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { supabase } from "../../lib/supabaseClient";
import type { DifficultyLevel, QuestionRow, ChoiceRow } from "../../lib/database.types";

// A choice being edited: existing rows carry their db id; freshly added ones
// don't (undefined id) until first save, when they're inserted.
type EditChoice = { id?: string; text_fr: string; text_en: string; is_correct: boolean };
type EditQuestion = QuestionRow & { choices: EditChoice[] };

const DIFFS: { key: DifficultyLevel; label: "admin_easy" | "admin_medium" | "admin_hard"; color: string }[] = [
  { key: "easy", label: "admin_easy", color: "#22c55e" },
  { key: "medium", label: "admin_medium", color: "#f5b400" },
  { key: "hard", label: "admin_hard", color: "#ef4444" },
];

/**
 * Admin editor for a lesson's quiz (QCM). One quiz per lesson: create/edit/
 * delete questions, edit bilingual prompt + explanation, pick difficulty, and
 * manage the answer choices (exactly one correct). The lesson's quiz row is
 * created lazily on the first question. These questions feed the chapter's
 * Niv. 1/2/3 practice (ChapterPractice aggregates quizzes -> questions).
 *
 * Honest writes throughout: every mutation `.select("id")`s and treats a 0-row
 * result as a permission failure so we never claim a save that didn't happen
 * (mirrors LessonCardsPanel / LessonEditor).
 */
export function LessonQuizPanel({ lessonId }: { lessonId: string }) {
  const { t, lang } = useI18n();
  const [quizId, setQuizId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<EditQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  // Choices removed from a question in the UI, to delete on that question's save.
  const removedChoiceIds = useRef<Record<string, string[]>>({});

  async function load() {
    const { data: quiz } = await supabase.from("quizzes").select("id").eq("lesson_id", lessonId).maybeSingle();
    if (!quiz) {
      setQuizId(null);
      setQuestions([]);
      setLoading(false);
      return;
    }
    setQuizId(quiz.id);
    const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", quiz.id).order("position");
    const questionIds = (qs ?? []).map((q) => q.id);
    const { data: cs } = questionIds.length
      ? await supabase.from("choices").select("*").in("question_id", questionIds).order("position")
      : { data: [] as ChoiceRow[] };
    setQuestions(
      (qs ?? []).map((q) => ({
        ...q,
        choices: (cs ?? []).filter((c) => c.question_id === q.id).map((c) => ({ id: c.id, text_fr: c.text_fr, text_en: c.text_en, is_correct: c.is_correct })),
      }))
    );
    setDirty(new Set());
    removedChoiceIds.current = {};
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  function markDirty(id: string) {
    setDirty((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }

  function patchQuestion(id: string, patch: Partial<EditQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    markDirty(id);
  }

  function patchChoice(qid: string, idx: number, patch: Partial<EditChoice>) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qid) return q;
        const choices = q.choices.map((c, i) => (i === idx ? { ...c, ...patch } : c));
        return { ...q, choices };
      })
    );
    markDirty(qid);
  }

  // Exactly-one-correct: selecting a choice as correct clears the others.
  function setCorrect(qid: string, idx: number) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qid ? { ...q, choices: q.choices.map((c, i) => ({ ...c, is_correct: i === idx })) } : q))
    );
    markDirty(qid);
  }

  function addChoice(qid: string) {
    setQuestions((prev) => prev.map((q) => (q.id === qid ? { ...q, choices: [...q.choices, { text_fr: "", text_en: "", is_correct: false }] } : q)));
    markDirty(qid);
  }

  function removeChoice(qid: string, idx: number) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qid) return q;
        const c = q.choices[idx];
        if (c.id) (removedChoiceIds.current[qid] ??= []).push(c.id);
        return { ...q, choices: q.choices.filter((_, i) => i !== idx) };
      })
    );
    markDirty(qid);
  }

  async function ensureQuiz(): Promise<string | null> {
    if (quizId) return quizId;
    const { data: les } = await supabase.from("lessons").select("title_fr, title_en").eq("id", lessonId).maybeSingle();
    const { data, error } = await supabase
      .from("quizzes")
      .insert({ lesson_id: lessonId, title_fr: `Test — ${les?.title_fr ?? ""}`, title_en: `Test — ${les?.title_en || les?.title_fr || ""}` })
      .select("id");
    if (error || !data || data.length === 0) {
      setFlash({ ok: false, msg: error?.message || t("admin_saveBlocked") });
      return null;
    }
    setQuizId(data[0].id);
    return data[0].id;
  }

  async function addQuestion() {
    setBusyId("new");
    setFlash(null);
    const qz = await ensureQuiz();
    if (!qz) {
      setBusyId(null);
      return;
    }
    const nextPos = questions.length ? Math.max(...questions.map((q) => q.position)) + 1 : 0;
    const { data, error } = await supabase
      .from("questions")
      .insert({ quiz_id: qz, text_fr: "", text_en: "", explanation_fr: "", explanation_en: "", difficulty: "medium", ai_generated: false, position: nextPos })
      .select("*");
    if (error || !data || data.length === 0) {
      setFlash({ ok: false, msg: error?.message || t("admin_saveBlocked") });
      setBusyId(null);
      return;
    }
    const q = data[0] as QuestionRow;
    // Seed with two empty choices so the shape is obvious.
    setQuestions((prev) => [
      ...prev,
      { ...q, choices: [{ text_fr: "", text_en: "", is_correct: true }, { text_fr: "", text_en: "", is_correct: false }] },
    ]);
    markDirty(q.id);
    setBusyId(null);
  }

  async function saveQuestion(q: EditQuestion) {
    // Validate before writing so we never persist a broken question.
    const correct = q.choices.filter((c) => c.is_correct).length;
    if (q.choices.length < 2) return setFlash({ ok: false, msg: t("admin_needTwoChoices") });
    if (correct !== 1) return setFlash({ ok: false, msg: t("admin_needOneCorrect") });

    setBusyId(q.id);
    setFlash(null);
    // 1. Update the question row.
    const { data: qRow, error: qErr } = await supabase
      .from("questions")
      .update({ text_fr: q.text_fr, text_en: q.text_en, explanation_fr: q.explanation_fr ?? "", explanation_en: q.explanation_en ?? "", difficulty: q.difficulty })
      .eq("id", q.id)
      .select("id");
    if (qErr || !qRow || qRow.length === 0) {
      setFlash({ ok: false, msg: qErr?.message || t("admin_saveBlocked") });
      setBusyId(null);
      return;
    }
    // 2. Delete choices removed in the UI (student_answers.choice_id is ON
    //    DELETE SET NULL, so history is preserved, just detached).
    const toRemove = removedChoiceIds.current[q.id] ?? [];
    if (toRemove.length) await supabase.from("choices").delete().in("id", toRemove);
    // 3. Upsert current choices: update those with an id, insert the new ones.
    let ok = true;
    let errMsg = "";
    const insertedIds: (string | undefined)[] = [];
    for (let i = 0; i < q.choices.length; i++) {
      const c = q.choices[i];
      if (c.id) {
        const { data, error } = await supabase
          .from("choices")
          .update({ text_fr: c.text_fr, text_en: c.text_en, is_correct: c.is_correct, position: i })
          .eq("id", c.id)
          .select("id");
        if (error || !data || data.length === 0) { ok = false; errMsg = error?.message || t("admin_saveBlocked"); }
        insertedIds.push(c.id);
      } else {
        const { data, error } = await supabase
          .from("choices")
          .insert({ question_id: q.id, text_fr: c.text_fr, text_en: c.text_en, is_correct: c.is_correct, position: i })
          .select("id");
        if (error || !data || data.length === 0) { ok = false; errMsg = error?.message || t("admin_saveBlocked"); }
        insertedIds.push(data?.[0]?.id);
      }
    }
    if (ok) {
      // Attach the new ids so a subsequent save updates rather than re-inserts.
      setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, choices: x.choices.map((c, i) => ({ ...c, id: insertedIds[i] ?? c.id })) } : x)));
      removedChoiceIds.current[q.id] = [];
      setDirty((prev) => { const n = new Set(prev); n.delete(q.id); return n; });
    }
    setFlash(ok ? { ok: true, msg: t("admin_questionSaved") } : { ok: false, msg: errMsg || t("admin_saveError") });
    setBusyId(null);
  }

  async function deleteQuestion(q: EditQuestion) {
    setBusyId(q.id);
    // choices cascade-delete via questions FK (ON DELETE CASCADE).
    const { error } = await supabase.from("questions").delete().eq("id", q.id);
    if (error) setFlash({ ok: false, msg: error.message });
    else setQuestions((prev) => prev.filter((x) => x.id !== q.id));
    setBusyId(null);
  }

  async function move(q: EditQuestion, dir: -1 | 1) {
    const sorted = [...questions].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((x) => x.id === q.id);
    const neighbor = sorted[idx + dir];
    if (!neighbor) return;
    setBusyId(q.id);
    // questions has no unique(position) constraint → direct swap is safe.
    await supabase.from("questions").update({ position: neighbor.position }).eq("id", q.id);
    await supabase.from("questions").update({ position: q.position }).eq("id", neighbor.id);
    setQuestions((prev) =>
      prev
        .map((x) => (x.id === q.id ? { ...x, position: neighbor.position } : x.id === neighbor.id ? { ...x, position: q.position } : x))
        .sort((a, b) => a.position - b.position)
    );
    setBusyId(null);
  }

  if (loading) return null;
  const sorted = [...questions].sort((a, b) => a.position - b.position);

  return (
    <div>
      <div className="font-bold text-[15px] text-ink-900 mb-1 flex items-center gap-2">
        <Icon name="check" size={16} className="text-ink-700" />
        {t("admin_quiz")}
        <span className="text-[11px] font-semibold text-muted">({sorted.length})</span>
      </div>
      <div className="text-[11.5px] text-muted leading-relaxed mb-3">{t("admin_quizHint")}</div>

      {flash && (
        <div className={`mb-3 rounded-xl px-4 py-2.5 text-[13px] font-semibold ${flash.ok ? "bg-success-600/10 text-success-600" : "bg-danger-600/10 text-danger-600"}`}>
          {flash.msg}
        </div>
      )}

      {sorted.length === 0 && <div className="bg-ink-50 border border-ink-100 rounded-2xl px-4 py-5 text-[13px] text-muted mb-3">{t("admin_noQuestions")}</div>}

      <div className="flex flex-col gap-4">
        {sorted.map((q, i) => {
          const busy = busyId === q.id;
          return (
            <div key={q.id} className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="text-[12px] font-bold uppercase tracking-wide text-muted">
                    {t("admin_question")} {i + 1}
                  </div>
                  {dirty.has(q.id) && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{t("admin_unsaved")}</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => move(q, -1)} disabled={busy || i === 0} className="p-1.5 rounded-lg border border-border text-ink-700 disabled:opacity-40" title={t("admin_moveUp")}>
                    <Icon name="chevleft" size={14} className="rotate-90" />
                  </button>
                  <button onClick={() => move(q, 1)} disabled={busy || i === sorted.length - 1} className="p-1.5 rounded-lg border border-border text-ink-700 disabled:opacity-40" title={t("admin_moveDown")}>
                    <Icon name="chevleft" size={14} className="-rotate-90" />
                  </button>
                  <button onClick={() => deleteQuestion(q)} disabled={busy} className="p-1.5 rounded-lg border border-border text-danger-600 disabled:opacity-40" title={t("admin_deleteQuestion")}>
                    <Icon name="close" size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={t("admin_questionFr")} value={q.text_fr} onChange={(v) => patchQuestion(q.id, { text_fr: v })} area />
                <Field label={t("admin_questionEn")} value={q.text_en} onChange={(v) => patchQuestion(q.id, { text_en: v })} area />
                <Field label={t("admin_explanationFr")} value={q.explanation_fr ?? ""} onChange={(v) => patchQuestion(q.id, { explanation_fr: v })} area />
                <Field label={t("admin_explanationEn")} value={q.explanation_en ?? ""} onChange={(v) => patchQuestion(q.id, { explanation_en: v })} area />
              </div>

              {/* Difficulty */}
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[11px] font-bold text-muted">{t("admin_difficulty")}:</span>
                {DIFFS.map((d) => {
                  const active = q.difficulty === d.key;
                  return (
                    <button
                      key={d.key}
                      onClick={() => patchQuestion(q.id, { difficulty: d.key })}
                      className="px-2.5 py-1 rounded-pill text-[11px] font-bold border"
                      style={{ background: active ? d.color : "#fff", color: active ? "#fff" : "#64748b", borderColor: active ? d.color : "#e2e8f0" }}
                    >
                      {t(d.label)}
                    </button>
                  );
                })}
              </div>

              {/* Choices */}
              <div className="mt-3 flex flex-col gap-2.5">
                {q.choices.map((c, ci) => (
                  <div key={ci} className={`rounded-xl border p-2.5 ${c.is_correct ? "border-success-600/50 bg-success-600/5" : "border-border bg-white"}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={() => setCorrect(q.id, ci)}
                        title={t("admin_correct")}
                        className={`w-5 h-5 rounded-full border-[1.5px] flex-none flex items-center justify-center ${c.is_correct ? "bg-success-600 border-success-600" : "border-ink-300 bg-white"}`}
                      >
                        {c.is_correct && <Icon name="check" size={12} className="text-white" />}
                      </button>
                      <span className={`text-[11px] font-bold ${c.is_correct ? "text-success-600" : "text-muted"}`}>
                        {c.is_correct ? t("admin_correct") : `#${ci + 1}`}
                      </span>
                      <div className="flex-1" />
                      <button onClick={() => removeChoice(q.id, ci)} className="p-1 rounded-md border border-border text-danger-600" title={t("admin_remove")}>
                        <Icon name="close" size={12} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input value={c.text_fr} onChange={(e) => patchChoice(q.id, ci, { text_fr: e.target.value })} placeholder={t("admin_choiceFr")} className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 text-[12.5px]" />
                      <input value={c.text_en} onChange={(e) => patchChoice(q.id, ci, { text_en: e.target.value })} placeholder={t("admin_choiceEn")} className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 text-[12.5px]" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => addChoice(q.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold border-[1.5px] border-ink-200 text-ink-700 bg-white">
                  <Icon name="plus" size={13} />
                  {t("admin_addChoice")}
                </button>
                <div className="flex-1" />
                <button onClick={() => saveQuestion(q)} disabled={busy} className="border-none px-5 py-2.5 rounded-xl text-[13px] font-bold bg-brand-600 text-white disabled:opacity-60">
                  {busy ? t("admin_uploading") : dirty.has(q.id) ? `${t("admin_saveQuestion")} •` : t("admin_saveQuestion")}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={addQuestion} disabled={busyId === "new"} className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold border-[1.5px] border-brand-600/40 text-brand-600 bg-white disabled:opacity-60">
        <Icon name="plus" size={15} />
        {busyId === "new" ? t("admin_uploading") : t("admin_addQuestion")}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, area }: { label: string; value: string; onChange: (v: string) => void; area?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold text-muted">{label}</span>
      {area ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 text-[12.5px] leading-relaxed resize-y min-h-[72px]" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 text-[12.5px]" />
      )}
    </label>
  );
}
