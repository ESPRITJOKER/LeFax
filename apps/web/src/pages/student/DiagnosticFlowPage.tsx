import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type DiagnosticQuestionDto, type MasteryProfileDto } from "../../lib/api-client";
import { useSessionStore } from "../../stores/session.store";

type Step = "intro" | "question" | "results";

/**
 * Skill-diagnostic flow ported from stitch_lefax_course_exam_prep/
 * diagnostic_test_intro, diagnostic_question, mastery_profile_results.
 * Not a CDC v1.0 module — added alongside its Stitch design + DB schema.
 * A single component manages all three steps since the session is short-lived
 * and doesn't need its own URL per question.
 */
export function DiagnosticFlowPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const [step, setStep] = useState<Step>("intro");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<DiagnosticQuestionDto[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<MasteryProfileDto[]>([]);
  const [loading, setLoading] = useState(false);

  async function start() {
    // Diagnostic scope is branch-wide; use the student's first selected branch.
    const branchSlug = user?.branchPreferences[0];
    if (!branchSlug) return;
    setLoading(true);
    const { branches } = await api.branches();
    const branch = branches.find((b) => b.slug === branchSlug);
    if (!branch) {
      setLoading(false);
      return;
    }
    const res = await api.startDiagnostic(branch.id);
    setSessionId(res.session.id);
    setQuestions(res.questions);
    setIndex(0);
    setSelected(null);
    setLoading(false);
    setStep(res.questions.length > 0 ? "question" : "results");
  }

  async function next() {
    if (!sessionId) return;
    const current = questions[index];
    if (current && selected) {
      await api.answerDiagnostic(sessionId, current.id, selected);
    }
    if (index < questions.length - 1) {
      setIndex(index + 1);
      setSelected(null);
    } else {
      setLoading(true);
      const res = await api.completeDiagnostic(sessionId);
      setProfiles(res.profiles);
      setLoading(false);
      setStep("results");
    }
  }

  if (step === "intro") {
    return (
      <div className="flex flex-col items-center text-center space-y-lg max-w-[560px] mx-auto py-lg">
        <div className="w-full relative rounded-xl overflow-hidden aspect-video shadow-sm border border-outline-variant bg-primary-container flex items-center justify-center">
          <MaterialIcon name="psychology" filled className="text-white text-[64px]" />
        </div>
        <div className="space-y-md">
          <h1 className="font-display-lg text-display-lg text-primary tracking-tight">{t("diagnostic.intro.title")}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant px-md">{t("diagnostic.intro.body")}</p>
        </div>
        <div className="grid grid-cols-2 gap-md w-full pt-md">
          <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-xl flex flex-col items-center justify-center text-center">
            <MaterialIcon name="timer" className="text-excellence-blue text-[24px] mb-xs" />
            <span className="font-label-lg text-label-lg text-primary">{t("diagnostic.intro.durationLabel")}</span>
            <span className="font-label-md text-label-md text-on-surface-variant">{t("diagnostic.intro.durationCaption")}</span>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-xl flex flex-col items-center justify-center text-center border-l-4 border-l-achievement-gold">
            <MaterialIcon name="psychology" filled className="text-achievement-gold text-[24px] mb-xs" />
            <span className="font-label-lg text-label-lg text-primary">{t("diagnostic.intro.analysisLabel")}</span>
            <span className="font-label-md text-label-md text-on-surface-variant">{t("diagnostic.intro.analysisCaption")}</span>
          </div>
        </div>
        <div className="w-full pt-xl space-y-md">
          <button
            type="button"
            onClick={start}
            disabled={loading}
            className="w-full bg-excellence-blue text-white font-label-lg text-label-lg py-4 rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-sm disabled:opacity-60"
          >
            {loading ? t("common.loading") : t("diagnostic.intro.start")}
            <MaterialIcon name="arrow_forward" />
          </button>
          <button
            type="button"
            onClick={() => navigate("/app")}
            className="w-full text-excellence-blue font-label-lg text-label-lg py-3 rounded-xl hover:bg-surface-container-low transition-colors"
          >
            {t("diagnostic.intro.later")}
          </button>
        </div>
        <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-md text-left">
          <div className="flex items-start gap-md">
            <MaterialIcon name="info" className="text-action-blue mt-0.5" />
            <div className="space-y-xs">
              <p className="font-label-lg text-label-lg text-primary">{t("diagnostic.intro.noPressureTitle")}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                {t("diagnostic.intro.noPressureBody")}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "question") {
    const current = questions[index];
    if (!current) return null;
    const percent = Math.round(((index + 1) / questions.length) * 100);
    return (
      <div className="max-w-[720px] mx-auto">
        <section className="mb-lg">
          <div className="flex justify-between items-end mb-sm">
            <div>
              <span className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">
                {t("diagnostic.question.modeLabel")}
              </span>
              <h1 className="text-headline-md font-headline-md text-excellence-blue">
                {t("diagnostic.question.counter", { current: index + 1, total: questions.length })}
              </h1>
            </div>
            <span className="text-label-lg font-label-lg text-excellence-blue">
              {t("diagnostic.question.percentComplete", { percent })}
            </span>
          </div>
          <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-excellence-blue transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>
        </section>

        <article className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md mb-lg shadow-sm">
          <p className="text-body-lg font-body-lg text-primary leading-relaxed">{current.question}</p>
        </article>

        <section className="grid grid-cols-1 gap-md">
          {current.options.map((option, i) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelected(option.id)}
              className={`flex items-center p-md rounded-xl text-left transition-all active:scale-[0.98] border ${
                selected === option.id ? "border-excellence-blue bg-primary-container/5" : "border-outline-variant"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center mr-md shrink-0 ${
                  selected === option.id ? "bg-excellence-blue text-white" : "bg-surface-container text-primary"
                }`}
              >
                <span className="text-label-lg font-label-lg">{String.fromCharCode(65 + i)}</span>
              </div>
              <span className="text-body-md font-body-md text-on-surface">{option.text}</span>
            </button>
          ))}
        </section>

        <section className="mt-xl flex gap-md">
          <button
            type="button"
            onClick={next}
            disabled={loading}
            className="flex-1 py-4 bg-surface-container-high text-primary font-bold rounded-xl active:scale-95 transition-transform"
          >
            {t("diagnostic.question.skip")}
          </button>
          <button
            type="button"
            onClick={next}
            disabled={!selected || loading}
            className="flex-[2] py-4 bg-excellence-blue text-white font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50"
          >
            {index < questions.length - 1 ? t("diagnostic.question.next") : t("diagnostic.question.viewResults")}
          </button>
        </section>
      </div>
    );
  }

  // step === "results"
  return (
    <div className="max-w-[720px] mx-auto">
      <section className="mb-lg">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-headline-lg-mobile font-headline-lg-mobile text-excellence-blue">{t("diagnostic.results.title")}</h2>
          <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-label-md font-label-md">
            {t("diagnostic.results.badge")}
          </span>
        </div>
        <p className="text-body-md text-on-surface-variant">{t("diagnostic.results.subtitle")}</p>
      </section>

      {profiles.length === 0 ? (
        <p className="font-body-md text-body-md text-text-secondary text-center py-xl">
          {t("diagnostic.results.notEnoughData")}
        </p>
      ) : (
        <div className="space-y-md mb-xl">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm">
            <h3 className="text-label-lg font-label-lg text-on-surface-variant mb-md uppercase tracking-wider">
              {t("diagnostic.results.bySubject")}
            </h3>
            <div className="space-y-4">
              {profiles.map((p) => (
                <div key={p.subject_id}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-body-md font-semibold text-excellence-blue">{p.subjects?.name ?? t("diagnostic.results.subjectFallback")}</span>
                    <span
                      className={`text-label-lg font-label-lg ${
                        p.mastery_score >= 70 ? "text-success-green" : p.is_weak_zone ? "text-error-red" : "text-on-surface-variant"
                      }`}
                    >
                      {p.mastery_score}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.is_weak_zone ? "bg-error-red opacity-60" : "bg-excellence-blue"}`}
                      style={{ width: `${p.mastery_score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {profiles.some((p) => p.is_weak_zone) && (
            <div className="bg-error-container/20 border border-error-red/20 rounded-xl p-md">
              <div className="flex items-center gap-2 mb-2">
                <MaterialIcon name="warning" className="text-error-red text-[20px]" />
                <h3 className="text-label-lg font-label-lg text-error-red uppercase tracking-wider">{t("diagnostic.results.weakZoneTitle")}</h3>
              </div>
              <p className="text-body-sm text-on-surface-variant">
                {profiles
                  .filter((p) => p.is_weak_zone)
                  .map((p) => p.subjects?.name ?? t("diagnostic.results.subjectFallback"))
                  .join(", ")}{" "}
                {t("diagnostic.results.weakZoneHint")}
              </p>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate("/app/mastery")}
        className="w-full bg-excellence-blue text-white font-label-lg text-label-lg py-4 rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-sm mb-md"
      >
        {t("diagnostic.results.viewMastery")}
        <MaterialIcon name="insights" />
      </button>
      <button
        type="button"
        onClick={() => navigate("/app")}
        className="w-full text-excellence-blue font-label-lg text-label-lg py-3 rounded-xl hover:bg-surface-container-low transition-colors mb-xl"
      >
        {t("common.backToDashboard")}
      </button>
    </div>
  );
}
