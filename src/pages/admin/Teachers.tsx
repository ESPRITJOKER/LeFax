import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../../lib/icons";
import { SubjectGlyph } from "../../components/SubjectBadge";
import { Spinner, Select } from "../../components/ui";
import { StateNotice } from "../../components/StateNotice";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { invokeFn, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { ProfileRow, SubjectRow, TeacherSubjectRow, UserRole } from "../../lib/database.types";

interface TeacherRow extends Pick<ProfileRow, "id" | "first_name" | "last_name" | "phone" | "role" | "status" | "created_at" | "last_active_on"> {
  assignments: TeacherSubjectRow[];
  content: { lessons: number; drafts: number; submitted: number; approved: number; published: number };
  approvals: { pending: number; total: number };
}

/**
 * Super-admin teacher management (Phase 2): who teaches, what they may teach,
 * and whether their account is active.
 *
 * Reading the roster is open to any admin; every mutation here is super_admin
 * only and goes through the `admin` Edge Function, which re-checks the caller's
 * role server-side. The `teacher_subjects` RLS policy enforces the same rule at
 * the database, and an audit trigger writes every grant change to admin_logs —
 * so this page is a convenience, not the security boundary.
 */
export default function AdminTeachers() {
  const { t, lang } = useI18n();
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === "super_admin";

  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error: fnError } = await invokeFn<{ teachers: TeacherRow[]; subjects: SubjectRow[]; error?: string }>("admin", {
        action: "list_teachers",
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(String(data.error));
      setTeachers(data?.teachers ?? []);
      setSubjects(data?.subjects ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function call(action: string, body: Record<string, unknown>, id: string) {
    setBusyId(id);
    setFlash(null);
    try {
      const { data, error: fnError } = await invokeFn<{ ok?: boolean; error?: string }>("admin", { action, ...body });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(String(data.error));
      await load();
      setFlash({ ok: true, msg: t("admin_lessonSaved") });
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    }
    setBusyId(null);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers.filter((row) => {
      if (q) {
        const hay = `${row.first_name} ${row.last_name} ${row.phone} ${row.role}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter && row.status !== statusFilter) return false;
      if (subjectFilter) {
        const active = row.assignments.some((a) => a.subject_id === subjectFilter && a.status === "active");
        if (!active) return false;
      }
      return true;
    });
  }, [teachers, search, statusFilter, subjectFilter]);

  const subjectName = (id: string) => {
    const s = subjects.find((x) => x.id === id);
    return s ? (lang === "fr" ? s.name_fr : s.name_en) : id;
  };

  if (loading) return <Spinner />;
  if (error) return <StateNotice error={error} emptyLabel={t("at_noTeachers")} errorLabel={t("common_error")} onRetry={load} />;

  return (
    <div className="max-w-[1000px]">
      {!isSuperAdmin && (
        <div className="mb-4 rounded-2xl border border-ink-100 bg-ink-50 px-4 py-3 text-[12.5px] text-ink-800 flex items-center gap-2">
          <Icon name="shield" size={15} className="text-ink-700 flex-none" />
          {t("at_onlySuperAdmin")}
        </div>
      )}

      {/* Search + filters */}
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold text-muted">{t("common_search")}</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("at_search")} className="px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[13px]" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold text-muted">{t("at_assignments")}</span>
          <Select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[13px] bg-white w-full" wrapperClassName="w-full">
            <option value="">{t("at_filterSubject")}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {lang === "fr" ? s.name_fr : s.name_en}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold text-muted">Status</span>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[13px] bg-white w-full" wrapperClassName="w-full">
            <option value="">{t("at_filterStatus")}</option>
            <option value="active">{t("at_active")}</option>
            <option value="suspended">{t("at_suspended")}</option>
          </Select>
        </label>
      </div>

      {flash && (
        <div role="status" aria-live="polite" className={`mb-4 rounded-xl px-4 py-2.5 text-[13px] font-semibold ${flash.ok ? "bg-success-600/10 text-success-600" : "bg-danger-600/10 text-danger-600"}`}>
          {flash.msg}
        </div>
      )}

      {filtered.length === 0 ? (
        <StateNotice emptyLabel={t("at_noTeachers")} errorLabel={t("common_error")} />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((row) => {
            const active = row.assignments.filter((a) => a.status === "active");
            const revoked = row.assignments.filter((a) => a.status === "revoked");
            const unassigned = subjects.filter((s) => !active.some((a) => a.subject_id === s.id));
            const busy = busyId === row.id;

            return (
              <div key={row.id} className="bg-white border border-border rounded-2xl p-[18px]">
                <div className="flex items-start gap-3 flex-wrap mb-3">
                  <div className="w-10 h-10 rounded-full bg-ink-100 text-ink-700 flex items-center justify-center text-[13px] font-bold flex-none">
                    {`${row.first_name?.[0] ?? ""}${row.last_name?.[0] ?? ""}`.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <div className="text-[13.5px] font-bold text-ink-900">
                      {row.first_name} {row.last_name}
                    </div>
                    <div className="text-[11.5px] text-muted">
                      {row.phone} · {row.role}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${row.status === "active" ? "bg-success-600/10 text-success-600" : "bg-danger-600/10 text-danger-600"}`}>
                    {row.status === "active" ? t("at_active") : t("at_suspended")}
                  </span>
                  <button
                    onClick={() => call("set_student_status", { user_id: row.id, status: row.status === "active" ? "suspended" : "active" }, row.id)}
                    disabled={busy}
                    className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-border text-ink-900 disabled:opacity-50"
                  >
                    {row.status === "active" ? t("admin_suspend") : t("admin_activate")}
                  </button>
                  {isSuperAdmin && row.role !== "super_admin" && (
                    <button
                      onClick={() => call("set_role", { user_id: row.id, role: (row.role === "teacher" ? "student" : "teacher") as UserRole }, row.id)}
                      disabled={busy}
                      className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-border text-ink-900 disabled:opacity-50"
                    >
                      {row.role === "teacher" ? t("at_removeTeacher") : t("at_makeTeacher")}
                    </button>
                  )}
                </div>

                {/* Content footprint */}
                <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))" }}>
                  <Metric label={t("td_lessons")} value={row.content.lessons} />
                  <Metric label={t("td_drafts")} value={row.content.drafts} />
                  <Metric label={t("td_awaitingReview")} value={row.content.submitted} />
                  <Metric label={t("td_approved")} value={row.content.approved} />
                  <Metric label={t("td_published")} value={row.content.published} />
                  <Metric label={t("at_pendingApprovals")} value={row.approvals.pending} />
                </div>

                {/* Assignments */}
                <div className="text-[11px] font-bold text-muted mb-1.5">{t("at_assignments")}</div>
                {active.length === 0 ? (
                  <div className="text-[12px] text-muted mb-2">{t("at_noAssignments")}</div>
                ) : (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {active.map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1.5 rounded-pill border border-border px-2.5 py-1 text-[11.5px] font-bold text-ink-900">
                        <SubjectGlyph slug={subjects.find((s) => s.id === a.subject_id)?.slug ?? ""} size={13} />
                        {subjectName(a.subject_id)}
                        <span className="text-[10px] font-normal text-muted">
                          {new Date(a.created_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB")}
                        </span>
                        {isSuperAdmin && (
                          <button
                            onClick={() => {
                              if (window.confirm(t("at_confirmRevoke"))) call("revoke_subject", { teacher_id: row.id, subject_id: a.subject_id }, row.id);
                            }}
                            disabled={busy}
                            aria-label={t("at_revoke")}
                            title={t("at_revoke")}
                            className="text-danger-600 disabled:opacity-50"
                          >
                            <Icon name="close" size={12} />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {revoked.length > 0 && (
                  <div className="text-[11px] text-muted mb-2">
                    {t("at_revokedOn")}:{" "}
                    {revoked.map((a) => `${subjectName(a.subject_id)}${a.revoked_at ? ` (${new Date(a.revoked_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB")})` : ""}`).join(", ")}
                  </div>
                )}

                {isSuperAdmin && unassigned.length > 0 && (
                  <AssignControl
                    subjects={unassigned}
                    disabled={busy}
                    onAssign={(subjectId) => call("assign_subject", { teacher_id: row.id, subject_id: subjectId }, row.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AssignControl({ subjects, disabled, onAssign }: { subjects: SubjectRow[]; disabled: boolean; onAssign: (subjectId: string) => void }) {
  const { t, lang } = useI18n();
  const [value, setValue] = useState(subjects[0]?.id ?? "");

  return (
    <div className="flex items-center gap-2 flex-wrap border-t border-border pt-3 mt-1">
      <Select value={value} onChange={(e) => setValue(e.target.value)} className="px-3 py-2 rounded-lg border-[1.5px] border-border text-[12.5px] bg-white" wrapperClassName="min-w-[180px]">
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {lang === "fr" ? s.name_fr : s.name_en}
          </option>
        ))}
      </Select>
      <button
        onClick={() => value && onAssign(value)}
        disabled={disabled || !value}
        className="border-none px-3.5 py-2 rounded-xl text-[12.5px] font-bold bg-brand-600 text-white disabled:opacity-60 flex items-center gap-1.5"
      >
        <Icon name="plus" size={13} />
        {t("at_assign")}
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-ink-50 border border-ink-100 px-2.5 py-1.5">
      <div className="text-[10px] font-semibold text-muted leading-tight truncate">{label}</div>
      <div className="text-[15px] font-extrabold text-ink-900">{value}</div>
    </div>
  );
}

