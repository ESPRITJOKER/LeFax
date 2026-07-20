import { useEffect, useState } from "react";
import { Spinner, EmptyState, Select } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { REGIONS } from "../../lib/regions";
import type { ProfileRow } from "../../lib/database.types";

export default function AdminStudents() {
  const { t, lang } = useI18n();
  const [students, setStudents] = useState<ProfileRow[]>([]);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.from("profiles").select("*").eq("role", "student").order("created_at", { ascending: false }).limit(200);
    setStudents(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = students.filter(
    (s) =>
      (!search || `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase())) &&
      (!regionFilter || s.region === regionFilter)
  );

  async function toggleStatus(s: ProfileRow) {
    setBusyId(s.id);
    const nextStatus = s.status === "active" ? "suspended" : "active";
    try {
      const { error } = await supabase.functions.invoke("admin", { body: { action: "set_student_status", user_id: s.id, status: nextStatus } });
      if (error) throw error;
      await load();
    } catch {
      // Backend not reachable yet.
    }
    setBusyId(null);
  }

  async function resetPassword(s: ProfileRow) {
    setBusyId(s.id);
    try {
      await supabase.functions.invoke("admin", { body: { action: "reset_student_password", user_id: s.id } });
    } catch {
      // Backend not reachable yet.
    }
    setBusyId(null);
  }

  function exportCsv() {
    const header = "name,phone,region,town,faxcoins,status\n";
    const body = filtered.map((s) => `${s.first_name} ${s.last_name},${s.phone},${s.region ?? ""},${s.town ?? ""},${s.faxcoins},${s.status}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lefax-students.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("admin_searchStudents")}
          className="flex-1 min-w-[200px] px-3.5 py-2.5 rounded-xl border-[1.5px] border-border text-[13.5px] outline-none"
        />
        <Select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className="px-3.5 py-2.5 rounded-xl border-[1.5px] border-border text-[13px] bg-white">
          <option value="">{t("admin_allRegions")}</option>
          {REGIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {lang === "fr" ? r.fr : r.en}
            </option>
          ))}
        </Select>
        <button onClick={exportCsv} className="px-4 py-2.5 rounded-xl border border-border bg-white text-xs font-bold text-ink-900">
          {t("admin_exportCsv")}
        </button>
      </div>

      <div className="bg-white border border-border rounded-2xl overflow-x-auto">
        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState label={isSupabaseConfigured ? t("common_error") : t("backend_banner")} />
        ) : (
          <table className="w-full border-collapse min-w-[720px]">
            <thead>
              <tr className="text-left border-b border-border">
                <Th>{lang === "fr" ? "Nom" : "Name"}</Th>
                <Th>{lang === "fr" ? "Région" : "Region"}</Th>
                <Th>FaxCoins</Th>
                <Th>{lang === "fr" ? "Statut" : "Status"}</Th>
                <Th>{lang === "fr" ? "Actions" : "Actions"}</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-ink-50">
                  <td className="px-4 py-3.5">
                    <div className="text-[13px] font-bold text-ink-900">
                      {s.first_name} {s.last_name}
                    </div>
                    <div className="text-[11.5px] text-muted">{s.phone}</div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-ink-800">
                    {s.region} · {s.town}
                  </td>
                  <td className="px-4 py-3.5 text-xs font-bold text-ochre-700">{s.faxcoins}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-pill ${
                        s.status === "active" ? "bg-success-100 text-success-600" : "bg-ink-100 text-muted"
                      }`}
                    >
                      {s.status === "active" ? (lang === "fr" ? "Actif" : "Active") : lang === "fr" ? "Suspendu" : "Suspended"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 flex gap-2">
                    <button disabled={busyId === s.id} onClick={() => toggleStatus(s)} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-border">
                      {s.status === "active" ? t("admin_suspend") : t("admin_activate")}
                    </button>
                    <button disabled={busyId === s.id} onClick={() => resetPassword(s)} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-border">
                      {t("admin_resetPassword")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-[11.5px] text-muted font-bold">{children}</th>;
}
