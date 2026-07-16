import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type PaperDto } from "../../lib/api-client";

/** No matching Stitch design — built from tokens (WEB-E08 anciens sujets). */
export function PastPapersPage() {
  const navigate = useNavigate();
  const [papers, setPapers] = useState<PaperDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.papers().then((res) => {
      setPapers(res.papers);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-excellence-blue mb-lg">Anciens sujets</h1>
      {papers.length === 0 ? (
        <p className="font-body-md text-body-md text-text-secondary text-center py-xl">
          Aucun ancien sujet publié pour le moment.
        </p>
      ) : (
        <div className="flex flex-col gap-sm">
          {papers.map((paper) => (
            <div
              key={paper.id}
              className="flex items-center justify-between p-md bg-surface-container-lowest border border-outline-variant rounded-xl"
            >
              <div className="flex items-center gap-md">
                <div className="w-10 h-10 bg-surface-container-low rounded-lg flex items-center justify-center">
                  <MaterialIcon name="description" className="text-primary" />
                </div>
                <div>
                  <p className="font-label-lg text-label-lg text-primary">{paper.title}</p>
                  <p className="font-label-md text-label-md text-text-secondary">
                    {paper.school_name} • {paper.year}
                  </p>
                </div>
              </div>
              {paper.unlocked ? (
                <span className="font-label-md text-label-md text-success-green flex items-center gap-xs">
                  <MaterialIcon name="lock_open" className="text-[16px]" />
                  Débloqué
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate("/app/wallet")}
                  className="font-label-md text-label-md text-excellence-blue flex items-center gap-xs"
                >
                  <MaterialIcon name="lock" className="text-[16px]" />
                  {paper.unlock_price_coins} FC
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
