import { useEffect, useState } from "react";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { api, type AdminExamDto, type AdminQcmOptionDto, type BranchDto } from "../../lib/api-client";

/** No matching Stitch design — built from tokens (WEB-A03 planification concours blancs). */
export function ExamsPage() {
  const [exams, setExams] = useState<AdminExamDto[]>([]);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [qcms, setQcms] = useState<AdminQcmOptionDto[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", branchId: "", opensAt: "", durationMinutes: "120" });
  const [selectedQcms, setSelectedQcms] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.adminExams().then((res) => setExams(res.exams));
  }

  useEffect(() => {
    refresh();
    api.branches().then((res) => setBranches(res.branches));
    api.adminQcms().then((res) => setQcms(res.qcms));
  }, []);

  function toggleQcm(id: string) {
    setSelectedQcms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createExam() {
    setError(null);
    if (!form.title || !form.branchId || !form.opensAt) {
      setError("Titre, filière et date d'ouverture sont requis.");
      return;
    }
    if (selectedQcms.size < 10) {
      setError(`Minimum 10 questions requises (${selectedQcms.size} sélectionnée(s)).`);
      return;
    }
    try {
      await api.createExam({
        title: form.title,
        branchId: form.branchId,
        opensAt: new Date(form.opensAt).toISOString(),
        durationSeconds: Number(form.durationMinutes) * 60,
        qcmIds: Array.from(selectedQcms),
      });
      setShowForm(false);
      setForm({ title: "", branchId: "", opensAt: "", durationMinutes: "120" });
      setSelectedQcms(new Set());
      refresh();
    } catch {
      setError("Erreur lors de la création du concours.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-lg">
        <h1 className="font-headline-lg text-headline-lg text-excellence-blue">Concours blancs</h1>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="bg-excellence-blue text-white px-md py-sm rounded-xl font-label-lg text-label-lg flex items-center gap-xs"
        >
          <MaterialIcon name="add" className="text-[16px]" />
          Planifier un concours
        </button>
      </div>

      {showForm && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md mb-lg space-y-sm">
          <input
            placeholder="Titre du concours"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
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
          <div className="flex gap-sm">
            <input
              type="datetime-local"
              value={form.opensAt}
              onChange={(e) => setForm({ ...form, opensAt: e.target.value })}
              className="flex-1 px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
            />
            <input
              type="number"
              placeholder="Durée (min)"
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
              className="w-40 px-md py-sm bg-surface-container rounded-xl border-none text-body-md font-body-md"
            />
          </div>

          <div>
            <p className="font-label-lg text-label-lg text-text-secondary mb-xs">
              Questions ({selectedQcms.size} sélectionnée(s), min. 10)
            </p>
            <div className="max-h-56 overflow-y-auto border border-outline-variant rounded-lg divide-y divide-outline-variant">
              {qcms.length === 0 && <p className="p-sm font-body-sm text-body-sm text-text-secondary">Aucun QCM publié disponible.</p>}
              {qcms.map((q) => (
                <label key={q.id} className="flex items-start gap-sm p-sm cursor-pointer hover:bg-surface-container-low">
                  <input type="checkbox" checked={selectedQcms.has(q.id)} onChange={() => toggleQcm(q.id)} className="mt-1" />
                  <span className="text-body-sm font-body-sm">
                    {q.question} <span className="text-text-secondary">({q.lessons?.title})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="font-label-md text-label-md text-error-red">{error}</p>}
          <button type="button" onClick={createExam} className="bg-excellence-blue text-white px-md py-sm rounded-xl font-label-lg text-label-lg">
            Planifier
          </button>
        </div>
      )}

      {exams.length === 0 ? (
        <p className="font-body-md text-body-md text-text-secondary text-center py-xl">Aucun concours planifié.</p>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant">
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">Titre</th>
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">Filière</th>
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">Ouverture</th>
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">Questions</th>
                <th className="px-md py-3 font-label-lg text-label-lg text-text-secondary">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {exams.map((e) => (
                <tr key={e.id}>
                  <td className="px-md py-3 font-body-md text-body-md">{e.title}</td>
                  <td className="px-md py-3 text-body-sm text-body-sm text-text-secondary">{e.branches?.name}</td>
                  <td className="px-md py-3 text-body-sm text-body-sm text-text-secondary">
                    {new Date(e.opens_at).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-md py-3 text-body-sm text-body-sm text-text-secondary">{e.questionCount}</td>
                  <td className="px-md py-3">
                    <span className="px-2 py-1 rounded-full bg-surface-container text-label-md font-label-md">{e.status}</span>
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
