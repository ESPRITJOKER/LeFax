import { useEffect, useState } from "react";
import { Spinner, EmptyState, Button } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { ProfileRow, UserRole } from "../../lib/database.types";

export default function AdminAdmins() {
  const { t, lang } = useI18n();
  const [admins, setAdmins] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("admin");
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.from("profiles").select("*").in("role", ["teacher", "admin", "super_admin"]).order("created_at", { ascending: false });
    setAdmins(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function invite() {
    setMessage(null);
    try {
      const { error } = await supabase.functions.invoke("admin", {
        body: { action: "invite_admin", first_name: firstName, last_name: lastName, phone, role },
      });
      if (error) throw error;
      setMessage(lang === "fr" ? "Invitation envoyée." : "Invitation sent.");
      setFirstName("");
      setLastName("");
      setPhone("");
      await load();
    } catch {
      setMessage(t("backend_banner"));
    }
  }

  async function toggleActive(a: ProfileRow) {
    const nextStatus = a.status === "active" ? "suspended" : "active";
    try {
      await supabase.functions.invoke("admin", { body: { action: "set_student_status", user_id: a.id, status: nextStatus } });
      await load();
    } catch {
      // Backend not reachable yet.
    }
  }

  return (
    <div>
      <div className="bg-white border border-border rounded-2xl p-5 mb-5">
        <div className="text-[13.5px] font-bold text-ink-900 mb-3.5">{t("admin_inviteAdmin")}</div>
        <div className="grid gap-3 mb-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t("reg_firstname")} className="px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[13px]" />
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t("reg_lastname")} className="px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[13px]" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("reg_phone")} className="px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[13px]" />
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[13px] bg-white">
            <option value="teacher">{lang === "fr" ? "Enseignant" : "Teacher"}</option>
            <option value="admin">{lang === "fr" ? "Administrateur" : "Admin"}</option>
            <option value="super_admin">{lang === "fr" ? "Super Administrateur" : "Super Admin"}</option>
          </select>
        </div>
        <Button onClick={invite}>{t("admin_inviteAdmin")}</Button>
        {message && <div className="mt-2.5 text-xs font-semibold text-ink-800">{message}</div>}
      </div>

      <div className="flex flex-col gap-2.5">
        {loading ? (
          <Spinner />
        ) : admins.length === 0 ? (
          <EmptyState label={isSupabaseConfigured ? t("common_error") : t("backend_banner")} />
        ) : (
          admins.map((a) => (
            <div key={a.id} className="bg-white border border-border rounded-2xl px-4.5 px-[18px] py-3.5 flex items-center gap-3.5">
              <div className="flex-1">
                <div className="text-[13px] font-bold text-ink-900">
                  {a.first_name} {a.last_name}
                </div>
                <div className="text-[11.5px] text-muted">
                  {a.phone} · {a.role}
                </div>
              </div>
              <button onClick={() => toggleActive(a)} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-border">
                {a.status === "active" ? t("admin_suspend") : t("admin_activate")}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
