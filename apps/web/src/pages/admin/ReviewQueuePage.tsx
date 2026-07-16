import { useEffect, useState } from "react";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type AdminReviewDto } from "../../lib/api-client";

const TYPE_LABELS: Record<string, string> = { lesson_card: "Fiche de cours", qcm: "QCM", past_paper: "Ancien sujet" };

/** No matching Stitch design — built from tokens (WEB-A02 file de révision). */
export function ReviewQueuePage() {
  const [reviews, setReviews] = useState<AdminReviewDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.adminReviews("in_review").then((res) => {
      setReviews(res.reviews);
      setLoading(false);
    });
  }

  useEffect(refresh, []);

  async function approve(id: string) {
    await api.approveReview(id);
    refresh();
  }

  async function reject(id: string) {
    setError(null);
    if (feedback.trim().length < 20) {
      setError("Le feedback doit contenir au moins 20 caractères.");
      return;
    }
    await api.rejectReview(id, feedback.trim());
    setRejectingId(null);
    setFeedback("");
    refresh();
  }

  if (loading) return null;

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-excellence-blue mb-lg">File de révision</h1>
      {reviews.length === 0 ? (
        <p className="font-body-md text-body-md text-text-secondary text-center py-xl">
          Aucun contenu en attente de révision.
        </p>
      ) : (
        <div className="flex flex-col gap-md">
          {reviews.map((review) => {
            const isOld = Date.now() - new Date(review.submitted_at).getTime() > 48 * 3600 * 1000;
            return (
              <div
                key={review.id}
                className={`bg-surface-container-lowest border rounded-xl p-md ${
                  isOld ? "border-secondary-container" : "border-outline-variant"
                }`}
              >
                <div className="flex items-center justify-between mb-sm">
                  <div className="flex items-center gap-sm">
                    <span className="bg-surface-container-high text-on-surface-variant text-label-md font-label-md px-2 py-0.5 rounded">
                      {TYPE_LABELS[review.content_type] ?? review.content_type}
                    </span>
                    {isOld && (
                      <span className="text-label-md font-label-md text-on-secondary-fixed-variant flex items-center gap-1">
                        <MaterialIcon name="schedule" className="text-[14px]" />
                        En attente depuis plus de 48h
                      </span>
                    )}
                  </div>
                  <span className="font-label-md text-label-md text-text-secondary">
                    {new Date(review.submitted_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-text-secondary mb-md">
                  Soumis par {review.profiles?.first_name ?? review.profiles?.email ?? "un enseignant"}
                </p>

                {rejectingId === review.id ? (
                  <div className="space-y-sm">
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Expliquez pourquoi ce contenu est rejeté (min. 20 caractères)"
                      className="w-full p-sm rounded-lg border border-outline-variant text-body-sm font-body-sm"
                      rows={3}
                    />
                    {error && <p className="font-label-md text-label-md text-error-red">{error}</p>}
                    <div className="flex gap-sm">
                      <button
                        type="button"
                        onClick={() => reject(review.id)}
                        className="px-md py-xs bg-error-red text-white rounded-lg font-label-lg text-label-lg"
                      >
                        Confirmer le rejet
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingId(null);
                          setError(null);
                        }}
                        className="px-md py-xs text-text-secondary font-label-lg text-label-lg"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-sm">
                    <button
                      type="button"
                      onClick={() => approve(review.id)}
                      className="px-md py-xs bg-success-green text-white rounded-lg font-label-lg text-label-lg flex items-center gap-xs"
                    >
                      <MaterialIcon name="check" className="text-[16px]" />
                      Approuver
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectingId(review.id)}
                      className="px-md py-xs border border-error-red text-error-red rounded-lg font-label-lg text-label-lg"
                    >
                      Rejeter
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
