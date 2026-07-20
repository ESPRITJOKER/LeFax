import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type AdminReviewDto, type ContentDraftDto, type RagChunkDto } from "../../lib/api-client";

interface QueueItem {
  kind: "review" | "draft";
  id: string;
  title: string | null;
  type: string;
  submittedByName: string | null;
  submittedAt: string;
  status: string;
  raw: AdminReviewDto | ContentDraftDto;
}

/** Extended to show AI-generated drafts alongside teacher-submitted content (Step 4). */
export function ReviewQueuePage() {
  const { t, i18n } = useTranslation();
  const typeLabels: Record<string, string> = {
    lesson_card: t("reviewQueue.type.lessonCard"),
    qcm: t("reviewQueue.type.qcm"),
    past_paper: t("reviewQueue.type.pastPaper"),
  };
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Draft sources display
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [draftSources, setDraftSources] = useState<RagChunkDto[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [reviewRes, draftRes] = await Promise.all([
        api.adminReviews("in_review"),
        api.contentDrafts("pending"),
      ]);

      const reviewItems: QueueItem[] = reviewRes.reviews.map((r) => ({
        kind: "review" as const,
        id: r.id,
        title: null,
        type: r.content_type,
        submittedByName: r.profiles?.first_name ?? r.profiles?.email ?? null,
        submittedAt: r.submitted_at,
        status: r.status,
        raw: r,
      }));

      const draftItems: QueueItem[] = draftRes.drafts.map((d) => ({
        kind: "draft" as const,
        id: d.id,
        title: d.title,
        type: d.draft_type,
        submittedByName: null,
        submittedAt: d.created_at,
        status: d.status,
        raw: d,
      }));

      setItems([...reviewItems, ...draftItems]);
    } catch (err) {
      console.error("Failed to load review queue:", err);
    }
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  async function approve(id: string) {
    await api.approveReview(id);
    refresh();
  }

  async function reject(id: string) {
    setError(null);
    if (feedback.trim().length < 20) {
      setError(t("reviewQueue.feedbackTooShort"));
      return;
    }
    await api.rejectReview(id, feedback.trim());
    setRejectingId(null);
    setFeedback("");
    refresh();
  }

  async function toggleSources(draftId: string) {
    if (expandedDraftId === draftId) {
      setExpandedDraftId(null);
      setDraftSources([]);
      return;
    }

    setExpandedDraftId(draftId);
    setSourcesLoading(true);
    try {
      const { sources } = await api.contentDraftSources(draftId);
      setDraftSources(sources);
    } catch (err) {
      console.error("Failed to load sources:", err);
      setDraftSources([]);
    }
    setSourcesLoading(false);
  }

  if (loading) return null;

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-excellence-blue mb-lg">{t("reviewQueue.title")}</h1>
      {items.length === 0 ? (
        <p className="font-body-md text-body-md text-text-secondary text-center py-xl">
          {t("reviewQueue.empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-md">
          {items.map((item) => {
            const isOld = Date.now() - new Date(item.submittedAt).getTime() > 48 * 3600 * 1000;
            const isAI = item.kind === "draft";
            const draft = isAI ? (item.raw as ContentDraftDto) : null;

            return (
              <div
                key={`${item.kind}-${item.id}`}
                className={`bg-surface-container-lowest border rounded-xl p-md ${
                  isOld ? "border-secondary-container" : "border-outline-variant"
                }`}
              >
                <div className="flex items-center justify-between mb-sm">
                  <div className="flex items-center gap-sm">
                    <span className="bg-surface-container-high text-on-surface-variant text-label-md font-label-md px-2 py-0.5 rounded">
                      {typeLabels[item.type] ?? item.type}
                    </span>
                    {isAI && (
                      <span className="bg-primary-container text-white text-label-md font-label-md px-2 py-0.5 rounded flex items-center gap-1">
                        <MaterialIcon name="auto_awesome" className="text-[12px]" />
                        {t("reviewQueue.aiGenerated")}
                      </span>
                    )}
                    {isOld && (
                      <span className="text-label-md font-label-md text-on-secondary-fixed-variant flex items-center gap-1">
                        <MaterialIcon name="schedule" className="text-[14px]" />
                        {t("reviewQueue.overdue")}
                      </span>
                    )}
                  </div>
                  <span className="font-label-md text-label-md text-text-secondary">
                    {new Date(item.submittedAt).toLocaleDateString(i18n.language.startsWith("fr") ? "fr-FR" : "en-US")}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-md">
                  {isAI
                    ? t("reviewQueue.autoGenerated")
                    : t("reviewQueue.submittedBy", { name: item.submittedByName ?? t("reviewQueue.teacherFallback") })}
                </p>

                {/* Draft title */}
                <p className="font-body-md text-body-md text-primary font-semibold mb-sm">
                  {item.title ?? typeLabels[item.type] ?? item.type}
                </p>

                {/* AI draft: show source provenance button */}
                {isAI && draft && (
                  <div className="mb-md">
                    <button
                      type="button"
                      onClick={() => toggleSources(draft.id)}
                      className="flex items-center gap-2 text-action-blue text-label-lg font-label-lg hover:underline"
                    >
                      <MaterialIcon name="account_tree" className="text-[16px]" />
                      {expandedDraftId === draft.id
                        ? t("reviewQueue.hideSources")
                        : t("reviewQueue.viewSources", { count: draft.source_chunks.length })}
                    </button>

                    {expandedDraftId === draft.id && (
                      <div className="mt-sm space-y-sm">
                        {sourcesLoading ? (
                          <p className="text-body-sm text-on-surface-variant">{t("reviewQueue.loadingSources")}</p>
                        ) : draftSources.length === 0 ? (
                          <p className="text-body-sm text-on-surface-variant">{t("reviewQueue.noSources")}</p>
                        ) : (
                          draftSources.map((source) => (
                            <div
                              key={source.id}
                              className="bg-surface-container-low border border-outline-variant rounded-lg p-sm"
                            >
                              <span className="text-label-md font-label-md text-action-blue">
                                {source.source_type}
                              </span>
                              <p className="text-body-sm text-on-surface-variant mt-xs line-clamp-3">
                                {source.content}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Review actions */}
                {rejectingId === item.id ? (
                  <div className="space-y-sm">
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder={t("reviewQueue.rejectPlaceholder")}
                      className="w-full p-sm rounded-lg border border-outline-variant text-body-sm font-body-sm"
                      rows={3}
                    />
                    {error && <p className="font-label-md text-label-md text-error-red">{error}</p>}
                    <div className="flex gap-sm">
                      <button
                        type="button"
                        onClick={() => reject(item.id)}
                        className="px-md py-xs bg-error-red text-white rounded-lg font-label-lg text-label-lg"
                      >
                        {t("reviewQueue.confirmReject")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingId(null);
                          setError(null);
                        }}
                        className="px-md py-xs text-text-secondary font-label-lg text-label-lg"
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-sm">
                    <button
                      type="button"
                      onClick={() => approve(item.id)}
                      className="px-md py-xs bg-success-green text-white rounded-lg font-label-lg text-label-lg flex items-center gap-xs"
                    >
                      <MaterialIcon name="check" className="text-[16px]" />
                      {t("reviewQueue.approve")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectingId(item.id)}
                      className="px-md py-xs border border-error-red text-error-red rounded-lg font-label-lg text-label-lg"
                    >
                      {t("reviewQueue.reject")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
