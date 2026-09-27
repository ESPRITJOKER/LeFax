import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../lib/icons";
import { Spinner } from "../../components/ui";
import { StateNotice } from "../../components/StateNotice";
import { ReviewStatusPill } from "../../components/content/ReviewStatusPill";
import { useI18n } from "../../lib/i18n";
import { supabase, isSupabaseConfigured, invokeFn } from "../../lib/supabaseClient";
import type { ReviewStatus } from "../../lib/database.types";

interface SubmittedLesson {
  id: string;
  title_fr: string;
  title_en: string;
  review_status: ReviewStatus;
  published: boolean;
  submitted_at: string | null;
  author_id: string | null;
  authorName: string;
}

/**
 * Lessons a teacher has submitted, waiting for a verdict.
 *
 * Without this the submission path was a dead end: `submit_lesson` flips the
 * status and notifies the reviewers, but there was nowhere to act on it. Sits
 * above the AI question queue on the same admin screen, because both are "things
 * teachers sent us".
 *
 * Every verdict goes through `admin` / `review_lesson` (audit + notification +
 * the only code allowed to set `published`).
 */
export function LessonReviewQueue() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [rows, setRows] = useState<SubmittedLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: qError } = await supabase
      .from("lessons")
      .select("id, title_fr, title_en, review_status, published, submitted_at, author_id")
      .in("review_status", ["submitted", "under_review"])
      .order("submitted_at", { ascending: true });

    const authorIds = [...new Set((data ?? []).map((l) => l.author_id).filter(Boolean))] as string[];
    const { data: authors } = authorIds.length
      ? await supabase.from("profiles").select("id, first_name, last_name").in("id", authorIds)
      : { data: [] };
    const nameById = new Map((authors ?? []).map((a) => [a.id, `${a.first_name} ${a.last_name}`]));

    setRows((data ?? []).map((l) => ({ ...l, authorName: l.author_id ? (nameById.get(l.author_id) ?? "—") : "—" })) as SubmittedLesson[]);
    setError(qError?.message ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, decision: "approve" | "reject" | "under_review", publish?: boolean) {
    const note = (feedback[id] ?? "").trim();
    if (decision === "reject" && !note) {
      setError(t("ar_feedback"));
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const { data, error: fnError } = await invokeFn("admin", {
        action: "review_lesson",
        lesson_id: id,
        decision,
        feedback: note || undefined,
        publish,
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(String(data.error));
      setFeedback((prev) => ({ ...prev, [id]: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusyId(null);
  }

  if (loading) return <Spinner />;

  return (
    <div className="mb-6">
      <div className="text-[13.5px] font-bold text-ink-900 mb-3 flex items-center gap-2">
        <Icon name="clipboard" size={16} className="text-ink-700" />
        {t("ar_reviewQueue")}
        <span className="text-[11px] font-semibold text-muted">({rows.length})</span>
      </div>

      {error && (
        <div role="alert" className="mb-3 rounded-xl bg-danger-600/10 px-4 py-2.5 text-[13px] font-semibold text-danger-600">
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <StateNotice emptyLabel={t("ar_empty")} errorLabel={t("common_error")} />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((l) => {
            const busy = busyId === l.id;
            return (
              <div key={l.id} className="bg-white border border-border rounded-2xl p-[18px]">
                <div className="flex items-center gap-3 flex-wrap mb-3">
                  <div className="flex-1 min-w-[160px]">
                    <button onClick={() => navigate(`/admin/content/lesson/${l.id}`)} className="text-[13.5px] font-bold text-ink-900 hover:text-brand-600 bg-transparent border-none p-0 text-left cursor-pointer">
                      {lang === "fr" ? l.title_fr : l.title_en || l.title_fr}
                    </button>
                    <div className="text-[11.5px] text-muted">
                      {t("ar_by")} {l.authorName}
                      {l.submitted_at ? ` · ${new Date(l.submitted_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")}` : ""}
                    </div>
                  </div>
                  <ReviewStatusPill status={l.review_status} published={l.published} size="sm" />
                  <button onClick={() => navigate(`/admin/content/lesson/${l.id}`)} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-border text-ink-900">
                    {t("admin_editLesson")}
                  </button>
                </div>

                <textarea
                  value={feedback[l.id] ?? ""}
                  onChange={(e) => setFeedback((prev) => ({ ...prev, [l.id]: e.target.value }))}
                  rows={2}
                  placeholder={t("ar_feedback")}
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-ink-300 text-[12.5px] resize-y mb-2.5"
                />

                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => decide(l.id, "approve", true)} disabled={busy} className="border-none px-3.5 py-2 rounded-xl text-[12.5px] font-bold bg-success-600 text-white disabled:opacity-60">
                    {t("ar_approveAndPublish")}
                  </button>
                  <button onClick={() => decide(l.id, "approve", false)} disabled={busy} className="border-none px-3.5 py-2 rounded-xl text-[12.5px] font-bold bg-brand-600 text-white disabled:opacity-60">
                    {t("ar_approve")}
                  </button>
                  <button onClick={() => decide(l.id, "reject")} disabled={busy} className="border-none px-3.5 py-2 rounded-xl text-[12.5px] font-bold bg-danger-600 text-white disabled:opacity-60">
                    {t("ar_requestChanges")}
                  </button>
                  {l.review_status === "submitted" && (
                    <button onClick={() => decide(l.id, "under_review")} disabled={busy} className="border border-border bg-white px-3.5 py-2 rounded-xl text-[12.5px] font-bold text-ink-900 disabled:opacity-60">
                      {t("ar_markUnderReview")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
