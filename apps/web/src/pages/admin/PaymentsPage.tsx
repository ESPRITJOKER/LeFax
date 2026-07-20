import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type AdminPaymentDto } from "../../lib/api-client";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-secondary-container text-on-secondary-container",
  confirmed: "bg-success-green/10 text-success-green",
  failed: "bg-error-red/10 text-error-red",
};

/** No matching Stitch design — built from tokens (WEB-A06 réconciliation paiements). */
export function PaymentsPage() {
  const { t, i18n } = useTranslation();
  const statusLabels: Record<string, string> = {
    pending: t("paymentsAdmin.status.pending"),
    confirmed: t("paymentsAdmin.status.confirmed"),
    failed: t("paymentsAdmin.status.failed"),
  };
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
      <h1 className="font-headline-lg text-headline-lg text-excellence-blue mb-lg">{t("paymentsAdmin.title")}</h1>
      <div className="bg-surface-container-low border border-outline-variant rounded-xl p-md mb-lg flex items-start gap-md">
        <p className="font-body-sm text-body-sm text-text-secondary">
          {t("paymentsAdmin.notConnectedNote")}
        </p>
      </div>
      {payments.length === 0 ? (
        <p className="font-body-md text-body-md text-text-secondary text-center py-xl">{t("paymentsAdmin.empty")}</p>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant">
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">{t("paymentsAdmin.colTransaction")}</th>
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">{t("paymentsAdmin.colAmount")}</th>
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">{t("paymentsAdmin.colStatus")}</th>
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">{t("paymentsAdmin.colDate")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-md py-3 font-mono text-body-sm">{p.cinetpay_transaction_id}</td>
                  <td className="px-md py-3 font-body-md text-body-md">{p.amount_xaf} XAF</td>
                  <td className="px-md py-3">
                    <span className={`px-2 py-1 rounded-full text-label-md font-label-md ${STATUS_STYLES[p.status] ?? ""}`}>
                      {statusLabels[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-md py-3 text-body-sm text-body-sm text-text-secondary">
                    {new Date(p.created_at).toLocaleDateString(i18n.language.startsWith("fr") ? "fr-FR" : "en-US")}
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
