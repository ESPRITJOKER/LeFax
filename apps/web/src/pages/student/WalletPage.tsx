import { useEffect, useState } from "react";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type CoinHistoryEntryDto, type PaperDto } from "../../lib/api-client";

/** Ported from stitch_lefax_course_exam_prep/faxcoins_premium_store (WEB-E11). */
export function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<CoinHistoryEntryDto[]>([]);
  const [lockedPapers, setLockedPapers] = useState<PaperDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [upgradeNotice, setUpgradeNotice] = useState(false);

  function refresh() {
    Promise.all([api.coinsBalance(), api.coinsHistory(), api.papers()]).then(([b, h, p]) => {
      setBalance(b.balance);
      setHistory(h.history);
      setLockedPapers(p.papers.filter((paper) => !paper.unlocked));
      setLoading(false);
    });
  }

  useEffect(refresh, []);

  async function unlock(paper: PaperDto) {
    setUnlockError(null);
    try {
      await api.unlockPaper(paper.id);
      refresh();
    } catch {
      setUnlockError("Solde FaxCoins insuffisant pour débloquer ce sujet.");
    }
  }

  if (loading) return null;

  return (
    <div>
      <section className="relative mb-xl overflow-hidden rounded-xl bg-excellence-blue p-lg text-white shadow-lg">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-achievement-gold/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col items-center">
          <span className="text-label-lg font-label-lg text-on-primary-container opacity-80 uppercase tracking-widest mb-xs">
            Solde disponible
          </span>
          <div className="flex items-center gap-sm mb-lg">
            <MaterialIcon name="payments" filled className="text-achievement-gold text-[32px]" />
            <span className="text-display-lg font-display-lg">{balance} FaxCoins</span>
          </div>
          <div className="w-full bg-white/10 border border-white/20 p-md rounded-lg flex items-center justify-between gap-md">
            <div>
              <p className="text-label-lg font-label-lg">Abonnement Premium</p>
              <p className="text-body-sm font-body-sm text-on-primary-container">Passez au tier Standard pour un accès complet</p>
            </div>
            <button
              type="button"
              onClick={() => setUpgradeNotice(true)}
              className="bg-achievement-gold text-primary font-label-lg px-md py-sm rounded-lg hover:scale-105 transition-transform active:scale-95 shrink-0"
            >
              Passer au tier supérieur
            </button>
          </div>
          {upgradeNotice && (
            <p className="text-label-md font-label-md text-on-primary-container mt-sm">
              Les abonnements payants arrivent bientôt (CinetPay non encore connecté).
            </p>
          )}
        </div>
      </section>

      <section className="mb-xl">
        <h2 className="text-headline-md font-headline-md text-excellence-blue mb-md">Débloquer avec vos coins</h2>
        {lockedPapers.length === 0 ? (
          <p className="font-body-sm text-body-sm text-text-secondary">Aucun sujet à débloquer pour le moment.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            {lockedPapers.map((paper) => (
              <button
                key={paper.id}
                type="button"
                onClick={() => unlock(paper)}
                className="text-left bg-white border border-outline-variant p-md rounded-xl hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-surface-container-low rounded-lg flex items-center justify-center mb-md">
                  <MaterialIcon name="library_books" />
                </div>
                <h3 className="text-label-lg font-label-lg mb-xs">{paper.title}</h3>
                <p className="text-body-sm font-body-sm text-text-secondary mb-md">
                  {paper.school_name} • {paper.year}
                </p>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-excellence-blue font-bold">{paper.unlock_price_coins} FC</span>
                  <MaterialIcon name="arrow_forward" className="text-primary" />
                </div>
              </button>
            ))}
          </div>
        )}
        {unlockError && <p className="mt-sm font-label-md text-label-md text-error-red">{unlockError}</p>}
      </section>

      <section className="mb-lg">
        <h2 className="text-headline-md font-headline-md text-excellence-blue mb-md">Activité récente</h2>
        {history.length === 0 ? (
          <p className="font-body-sm text-body-sm text-text-secondary">Aucune transaction pour le moment.</p>
        ) : (
          <div className="space-y-sm">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-md bg-white border border-outline-variant rounded-xl">
                <div className="flex items-center gap-md">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      entry.amount >= 0 ? "bg-success-green/10" : "bg-tertiary-container/10"
                    }`}
                  >
                    <MaterialIcon
                      name={entry.amount >= 0 ? "check_circle" : "shopping_bag"}
                      filled={entry.amount >= 0}
                      className={entry.amount >= 0 ? "text-success-green" : "text-excellence-blue"}
                    />
                  </div>
                  <div>
                    <p className="text-label-lg font-label-lg">{entry.label}</p>
                    <p className="text-body-sm font-body-sm text-text-secondary">
                      {new Date(entry.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>
                <span className={`font-bold ${entry.amount >= 0 ? "text-success-green" : "text-error-red"}`}>
                  {entry.amount >= 0 ? "+" : ""}
                  {entry.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl overflow-hidden border border-outline-variant h-40 relative bg-gradient-to-br from-excellence-blue to-primary-container flex items-end p-md">
        <div>
          <p className="text-white text-headline-md font-headline-md">Boostez votre préparation</p>
          <p className="text-white/80 text-body-sm font-body-sm">Ressources premium sélectionnées par nos meilleurs enseignants.</p>
        </div>
      </section>
    </div>
  );
}
