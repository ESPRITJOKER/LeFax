import { useEffect, useState } from "react";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type AdminSchoolDto, type BranchDto } from "../../lib/api-client";

/** No matching Stitch design — built from tokens (WEB-A05 gestion B2B). */
export function SchoolsPage() {
  const [schools, setSchools] = useState<AdminSchoolDto[]>([]);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", branchId: "", seatQuota: "50", contractExpiresAt: "", directorEmail: "" });
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.adminSchools().then((res) => setSchools(res.schools));
  }

  useEffect(() => {
    refresh();
    api.branches().then((res) => setBranches(res.branches));
  }, []);

  async function createSchool() {
    setError(null);
    if (!form.name || !form.branchId || !form.contractExpiresAt) {
      setError("Nom, filière et date d'expiration sont requis.");
      return;
    }
    try {
      await api.createSchool({
        name: form.name,
        city: form.city || undefined,
        branchId: form.branchId,
        seatQuota: Number(form.seatQuota),
        contractExpiresAt: new Date(form.contractExpiresAt).toISOString(),
        directorEmail: form.directorEmail || undefined,
      });
      setShowForm(false);
      setForm({ name: "", city: "", branchId: "", seatQuota: "50", contractExpiresAt: "", directorEmail: "" });
      refresh();
    } catch {
      setError("Erreur lors de la création du contrat.");
    }
  }

  async function regenerate(id: string) {
    await api.regenerateSchoolCode(id);
    refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-lg">
        <h1 className="font-headline-lg text-headline-lg text-excellence-blue">Établissements</h1>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="bg-excellence-blue text-white px-md py-sm rounded-xl font-label-lg text-label-lg flex items-center gap-xs"
        >
          <MaterialIcon name="add" className="text-[16px]" />
          Nouveau contrat
        </button>
      </div>

      {showForm && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md mb-lg space-y-sm">
          <input
            placeholder="Nom de l'établissement"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
          />
          <input
            placeholder="Ville"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="w-full px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
          />
          <select
            value={form.branchId}
            onChange={(e) => setForm({ ...form, branchId: e.target.value })}
            className="w-full px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
          >
            <option value="">Sélectionner une filière</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Quota de places"
            value={form.seatQuota}
            onChange={(e) => setForm({ ...form, seatQuota: e.target.value })}
            className="w-full px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
          />
          <input
            type="date"
            value={form.contractExpiresAt}
            onChange={(e) => setForm({ ...form, contractExpiresAt: e.target.value })}
            className="w-full px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
          />
          <input
            placeholder="Email du directeur (optionnel)"
            value={form.directorEmail}
            onChange={(e) => setForm({ ...form, directorEmail: e.target.value })}
            className="w-full px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
          />
          {error && <p className="font-label-md text-label-md text-error-red">{error}</p>}
          <button type="button" onClick={createSchool} className="bg-excellence-blue text-white px-md py-sm rounded-xl font-label-lg text-label-lg">
            Créer le contrat
          </button>
        </div>
      )}

      {schools.length === 0 ? (
        <p className="font-body-md text-body-md text-text-secondary text-center py-xl">Aucun établissement partenaire.</p>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant">
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">École</th>
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">Code</th>
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">Places</th>
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">Expiration</th>
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {schools.map((s) => {
                const expiringSoon = new Date(s.contract_expires_at).getTime() - Date.now() < 30 * 24 * 3600 * 1000;
                return (
                  <tr key={s.id}>
                    <td className="px-md py-3 font-body-md text-body-md">
                      {s.name} <span className="text-text-secondary text-body-sm">({s.branches?.name})</span>
                    </td>
                    <td className="px-md py-3 font-mono text-body-sm">{s.access_code}</td>
                    <td className="px-md py-3 text-body-sm text-body-sm">
                      {s.seats_used} / {s.seat_quota}
                    </td>
                    <td className={`px-md py-3 text-body-sm ${expiringSoon ? "text-secondary" : "text-text-secondary"}`}>
                      {new Date(s.contract_expires_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-md py-3">
                      <button type="button" onClick={() => regenerate(s.id)} title="Régénérer le code">
                        <MaterialIcon name="refresh" className="text-text-secondary hover:text-excellence-blue transition-colors" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
