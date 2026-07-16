import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type QaQuestionDto } from "../../lib/api-client";

/** No matching Stitch design — built from tokens (WEB-T06 boîte de réception Q&A). */
export function QaInboxPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"unanswered" | "answered">("unanswered");
  const [questions, setQuestions] = useState<QaQuestionDto[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  function refresh() {
    setLoading(true);
    api.teacherQaQuestions(tab).then((res) => {
      setQuestions(res.questions);
      setLoading(false);
    });
  }

  useEffect(refresh, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function answer(questionId: string) {
    const body = answers[questionId]?.trim();
    if (!body || body.length < 5) return;
    await api.answerQaQuestion(questionId, body);
    setAnswers((a) => ({ ...a, [questionId]: "" }));
    refresh();
  }

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-excellence-blue mb-lg">{t("qaInbox.title")}</h1>

      <div className="flex mb-lg rounded-lg bg-surface-container-low p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("unanswered")}
          className={`px-md py-xs rounded-lg font-label-lg text-label-lg ${tab === "unanswered" ? "bg-white shadow-sm text-primary" : "text-on-surface-variant"}`}
        >
          {t("qaInbox.unanswered")}
        </button>
        <button
          type="button"
          onClick={() => setTab("answered")}
          className={`px-md py-xs rounded-lg font-label-lg text-label-lg ${tab === "answered" ? "bg-white shadow-sm text-primary" : "text-on-surface-variant"}`}
        >
          {t("qaInbox.answered")}
        </button>
      </div>

      {loading ? null : questions.length === 0 ? (
        <p className="font-body-md text-body-md text-text-secondary text-center py-xl">
          {tab === "unanswered" ? t("qaInbox.emptyUnanswered") : t("qaInbox.emptyAnswered")}
        </p>
      ) : (
        <div className="flex flex-col gap-md">
          {questions.map((q) => (
            <div key={q.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md">
              <p className="font-label-lg text-label-lg text-primary mb-1">{q.title}</p>
              <p className="font-body-sm text-body-sm text-text-secondary mb-sm">{q.body}</p>
              {q.qa_answers && q.qa_answers.length > 0 ? (
                <div className="bg-surface-container-low rounded-lg p-sm border-l-4 border-excellence-blue">
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{q.qa_answers[0]?.body}</p>
                </div>
              ) : (
                <div className="flex gap-sm mt-sm">
                  <input
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    placeholder={t("qaInbox.answerPlaceholder")}
                    className="flex-1 px-md py-sm bg-surface-container rounded-xl border-none text-body-sm font-body-sm"
                  />
                  <button
                    type="button"
                    onClick={() => answer(q.id)}
                    className="px-md py-sm bg-excellence-blue text-white rounded-xl font-label-lg text-label-lg"
                  >
                    {t("qaInbox.submitAnswer")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
