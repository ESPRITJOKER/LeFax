import { useEffect, useState } from "react";
import { api, type AdminPaymentDto } from "../../lib/api-client";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-secondary-container text-on-secondary-container",
  confirmed: "bg-success-green/10 text-success-green",
  failed: "bg-error-red/10 text-error-red",
};

/** No matching Stitch design — built from tokens (WEB-A06 réconciliation paiements). */
export function PaymentsPage() {
  const [payments, setPayments] = useState<AdminPaymentDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.adminPayments().then((res) => {
      setPayments(res.payments);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-excellence-blue mb-lg">Paiements & Abonnements</h1>
      <div className="bg-surface-container-low border border-outline-variant rounded-xl p-md mb-lg flex items-start gap-md">
        <p className="font-body-sm text-body-sm text-text-secondary">
          Aucun compte CinetPay n'est encore connecté (comme pour les SMS via Africa's Talking, il faut un compte
          marchand réel). Ce journal est réel et se remplira dès que le flux de paiement (WEB-E13) sera branché sur
          un vrai fournisseur.
        </p>
      </div>
      {payments.length === 0 ? (
        <p className="font-body-md text-body-md text-text-secondary text-center py-xl">Aucun paiement enregistré.</p>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant">
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">Transaction</th>
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">Montant</th>
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">Statut</th>
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-md py-3 font-mono text-body-sm">{p.cinetpay_transaction_id}</td>
                  <td className="px-md py-3 font-body-md text-body-md">{p.amount_xaf} XAF</td>
                  <td className="px-md py-3">
                    <span className={`px-2 py-1 rounded-full text-label-md font-label-md ${STATUS_STYLES[p.status] ?? ""}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-md py-3 text-body-sm text-body-sm text-text-secondary">
                    {new Date(p.created_at).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
