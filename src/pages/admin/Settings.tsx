import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Spinner, Select } from "../../components/ui";
import { StateNotice } from "../../components/StateNotice";
import { Icon, type IconName } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured, invokeFn } from "../../lib/supabaseClient";
import type { SettingsRow, AcademicTermRow } from "../../lib/database.types";

/**
 * Admin settings — the control centre.
 *
 * Before this round the page was a flat list of `settings` rows, each one a
 * raw-JSON <input> next to an "Enregistrer" button, and it rendered
 * `common_error` ("Une erreur est survenue") whenever the table came back
 * empty. The feedback was that it "is too minimalist … the admin should be
 * able to see more on settings, changing term, managing profile etc".
 *
 * Structure now: four tabs, separating platform-wide configuration from the
 * administrator's own account (they have different blast radii and different
 * authorisation rules).
 *
 *   General   — the `settings` key/value store, but typed: a known key gets the
 *               widget its value deserves (text / number / boolean / choice)
 *               and is validated before the write. Unknown keys keep the raw
 *               JSON editor so a key added server-side is still editable here
 *               rather than invisible.
 *   Terms     — `academic_terms` (0020). Create, edit, activate, archive.
 *               Exactly one term can be active; the switch is the atomic
 *               `set_active_academic_term()` RPC, not two client writes.
 *   Profile   — the admin's own row in `profiles`, through the ordinary
 *               `profiles_update_own` policy. `phone` is the login identifier
 *               and stays read-only here; `role` is never self-editable
 *               (0003_guard_role_column).
 *   Security  — session facts and sign-out, plus a password change that goes
 *               through `functions/profile` (it touches auth.users and writes
 *               an audit row; it cannot be a client-side update).
 *
 * Every write reports its outcome: a success line, or the real error. Nothing
 * here silently no-ops.
 */

type TabKey = "general" | "terms" | "profile" | "security";
type Flash = { ok: boolean; msg: string } | null;

const TABS: { key: TabKey; icon: IconName; labelKey: "as_general" | "as_terms" | "as_profile" | "as_security" }[] = [
  { key: "general", icon: "gear", labelKey: "as_general" },
  { key: "terms", icon: "calendar", labelKey: "as_terms" },
  { key: "profile", icon: "users", labelKey: "as_profile" },
  { key: "security", icon: "shield", labelKey: "as_security" },
];

/**
 * How each known setting key is edited. A key absent from this map falls back
 * to the raw JSON editor — the store is open-ended by design, and hiding an
 * unknown key would be worse than showing it untyped.
 */
const SETTING_KINDS: Record<string, { kind: "text" | "number" | "boolean" | "lang"; labelFr: string; labelEn: string }> = {
  platform_name: { kind: "text", labelFr: "Nom de la plateforme", labelEn: "Platform name" },
  default_language: { kind: "lang", labelFr: "Langue par défaut", labelEn: "Default language" },
  support_phone: { kind: "text", labelFr: "Téléphone du support", labelEn: "Support phone" },
  daily_tasks_rewarded_limit: { kind: "number", labelFr: "Tâches quotidiennes récompensées (max)", labelEn: "Rewarded daily tasks (max)" },
  otp_max_attempts: { kind: "number", labelFr: "Tentatives OTP autorisées", labelEn: "Allowed OTP attempts" },
  shop_unlock_rarity_enabled: { kind: "boolean", labelFr: "Rareté des déblocages boutique", labelEn: "Shop unlock rarity" },
};

const inputClass =
  "w-full box-border px-3.5 py-2.5 rounded-lg border border-border bg-card text-[13.5px] text-ink-900 outline-none focus:border-brand-500";
const labelClass = "text-[11.5px] font-bold uppercase tracking-wide text-muted";

export default function AdminSettings() {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabKey>("general");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-serif font-bold text-lg text-ink-950">{t("admin_settings")}</h2>
      </div>

      {/* Tabs: a horizontal rail that scrolls rather than wraps on a phone. */}
      <div role="tablist" aria-label={t("admin_settings")} className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {TABS.map((tb) => {
          const active = tab === tb.key;
          return (
            <button
              key={tb.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(tb.key)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[13px] font-bold whitespace-nowrap border transition-colors ${
                active ? "bg-brand-600 text-white border-brand-600" : "bg-card text-ink-800 border-border hover:bg-ink-50"
              }`}
            >
              <Icon name={tb.icon} size={15} />
              {t(tb.labelKey)}
            </button>
          );
        })}
      </div>

      {tab === "general" && <GeneralTab />}
      {tab === "terms" && <TermsTab />}
      {tab === "profile" && <ProfileTab />}
      {tab === "security" && <SecurityTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ shared */

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-2xl p-5">
      <h3 className="text-[14.5px] font-bold text-ink-950">{title}</h3>
      {hint && <p className="text-[12px] text-muted mt-1 mb-4 max-w-[70ch]">{hint}</p>}
      <div className={hint ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

function FlashLine({ flash }: { flash: Flash }) {
  if (!flash) return null;
  return (
    <div
      role={flash.ok ? "status" : "alert"}
      className={`rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold ${
        flash.ok ? "bg-success-700/10 text-success-700" : "bg-danger-700/10 text-danger-700"
      }`}
    >
      {flash.msg}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

/* ----------------------------------------------------------------- general */

function GeneralTab() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<SettingsRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.from("settings").select("*").order("key");
    if (err) setError(err.message);
    else {
      setRows(data ?? []);
      setDraft(Object.fromEntries((data ?? []).map((s) => [s.key, toDraft(s.value)])));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** jsonb -> editable string, per widget kind. */
  function toDraft(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value);
  }

  /** editable string -> jsonb, with the validation the old page never did. */
  function parse(key: string, raw: string): { ok: true; value: unknown } | { ok: false; msg: string } {
    const kind = SETTING_KINDS[key]?.kind;
    if (kind === "text" || kind === "lang") return { ok: true, value: raw };
    if (kind === "number") {
      const n = Number(raw);
      if (raw.trim() === "" || !Number.isFinite(n)) return { ok: false, msg: t("as_invalidNumber") };
      return { ok: true, value: n };
    }
    if (kind === "boolean") return { ok: true, value: raw === "true" };
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch {
      return { ok: false, msg: t("as_invalidJson") };
    }
  }

  async function save(key: string) {
    setFlash(null);
    const parsed = parse(key, draft[key] ?? "");
    if (!parsed.ok) {
      setFlash({ ok: false, msg: `${key}: ${parsed.msg}` });
      return;
    }
    setSavingKey(key);
    // `.select()` so a write silently dropped by RLS is reported as refused
    // rather than confirmed — the same honesty rule as the lesson editor.
    const { data, error: err } = await supabase
      .from("settings")
      .update({ value: parsed.value, updated_at: new Date().toISOString() })
      .eq("key", key)
      .select("key");
    setSavingKey(null);
    if (err) setFlash({ ok: false, msg: `${t("as_saveFailed")} — ${err.message}` });
    else if (!data || data.length === 0) setFlash({ ok: false, msg: t("admin_saveBlocked") });
    else {
      setFlash({ ok: true, msg: t("as_saved") });
      void load();
    }
  }

  if (loading) return <Spinner />;
  if (error || rows.length === 0)
    return (
      <Section title={t("as_platform")} hint={t("as_platformHint")}>
        <StateNotice error={error} errorLabel={t("as_settingsError")} emptyLabel={t("as_noSettings")} onRetry={() => void load()} />
      </Section>
    );

  return (
    <Section title={t("as_platform")} hint={t("as_platformHint")}>
      <div className="flex flex-col gap-3">
        <FlashLine flash={flash} />
        {rows.map((s) => {
          const meta = SETTING_KINDS[s.key];
          const label = meta ? (lang === "fr" ? meta.labelFr : meta.labelEn) : s.key;
          const value = draft[s.key] ?? "";
          const set = (v: string) => setDraft((d) => ({ ...d, [s.key]: v }));
          return (
            <div key={s.key} className="border border-border rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1 min-w-0">
                <Field label={label} hint={meta ? s.key : t("as_invalidJson").replace(/^./, (c) => c.toUpperCase()) + " — JSON"}>
                  {meta?.kind === "boolean" ? (
                    <Select value={value} onChange={(e) => set(e.target.value)} className={inputClass}>
                      <option value="true">{lang === "fr" ? "Activé" : "Enabled"}</option>
                      <option value="false">{lang === "fr" ? "Désactivé" : "Disabled"}</option>
                    </Select>
                  ) : meta?.kind === "lang" ? (
                    <Select value={value} onChange={(e) => set(e.target.value)} className={inputClass}>
                      <option value="fr">Français</option>
                      <option value="en">English</option>
                    </Select>
                  ) : (
                    <input
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      inputMode={meta?.kind === "number" ? "numeric" : undefined}
                      className={inputClass}
                    />
                  )}
                </Field>
              </div>
              <Button onClick={() => save(s.key)} disabled={savingKey === s.key} className="sm:w-auto w-full">
                {savingKey === s.key ? t("common_loading") : t("admin_save")}
              </Button>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------- terms */

const emptyTerm = { name: "", academic_year: "", starts_on: "", ends_on: "" };

function TermsTab() {
  const { t, lang } = useI18n();
  const { profile } = useAuth();
  const [terms, setTerms] = useState<AcademicTermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyTerm);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("academic_terms")
      .select("*")
      .order("is_active", { ascending: false })
      .order("starts_on", { ascending: false });
    if (err) setError(err.message);
    else setTerms(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium" }),
    [lang]
  );

  function validate(): string | null {
    if (!form.name.trim() || !form.academic_year.trim()) return t("as_termNameRequired");
    if (!form.starts_on || !form.ends_on) return t("as_required");
    if (new Date(form.ends_on) <= new Date(form.starts_on)) return t("as_termDatesInvalid");
    return null;
  }

  async function submit() {
    setFlash(null);
    const invalid = validate();
    if (invalid) {
      setFlash({ ok: false, msg: invalid });
      return;
    }
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      academic_year: form.academic_year.trim(),
      starts_on: form.starts_on,
      ends_on: form.ends_on,
    };
    const q = editing
      ? supabase.from("academic_terms").update(payload).eq("id", editing).select("id")
      : supabase.from("academic_terms").insert({ ...payload, created_by: profile?.id ?? null }).select("id");
    const { data, error: err } = await q;
    setBusy(false);
    if (err) setFlash({ ok: false, msg: `${t("as_saveFailed")} — ${err.message}` });
    else if (!data || data.length === 0) setFlash({ ok: false, msg: t("admin_saveBlocked") });
    else {
      setFlash({ ok: true, msg: editing ? t("as_termUpdated") : t("as_termCreated") });
      setForm(emptyTerm);
      setEditing(null);
      void load();
    }
  }

  async function activate(term: AcademicTermRow) {
    if (!window.confirm(t("as_confirmActivate"))) return;
    setFlash(null);
    setBusy(true);
    // One RPC, one transaction: deactivate the previous term and activate this
    // one. Two client writes would trip the single-active unique index.
    const { error: err } = await supabase.rpc("set_active_academic_term", { term_id: term.id });
    setBusy(false);
    if (err) setFlash({ ok: false, msg: `${t("as_saveFailed")} — ${err.message}` });
    else {
      setFlash({ ok: true, msg: t("as_termActivated") });
      void load();
    }
  }

  async function toggleArchive(term: AcademicTermRow) {
    const archiving = term.archived_at === null;
    if (archiving && !window.confirm(t("as_confirmArchive"))) return;
    setFlash(null);
    setBusy(true);
    const { data, error: err } = await supabase
      .from("academic_terms")
      .update(archiving ? { archived_at: new Date().toISOString(), is_active: false } : { archived_at: null })
      .eq("id", term.id)
      .select("id");
    setBusy(false);
    if (err) setFlash({ ok: false, msg: `${t("as_saveFailed")} — ${err.message}` });
    else if (!data || data.length === 0) setFlash({ ok: false, msg: t("admin_saveBlocked") });
    else {
      setFlash({ ok: true, msg: t("as_termUpdated") });
      void load();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Section title={t("as_terms")} hint={t("as_termsHint")}>
        <div className="flex flex-col gap-3">
          <FlashLine flash={flash} />
          {loading ? (
            <Spinner />
          ) : error || terms.length === 0 ? (
            <StateNotice error={error} errorLabel={t("common_error")} emptyLabel={t("as_termEmpty")} onRetry={() => void load()} />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {terms.map((term) => (
                <li
                  key={term.id}
                  className={`border rounded-xl p-3.5 flex flex-wrap items-center gap-3 ${
                    term.is_active ? "border-brand-600 bg-brand-50" : "border-border"
                  } ${term.archived_at ? "opacity-60" : ""}`}
                >
                  <div className="flex-1 min-w-[180px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-bold text-ink-900">{term.name}</span>
                      {term.is_active && (
                        <span className="rounded-pill bg-brand-600 text-white px-2.5 py-0.5 text-[10.5px] font-bold">{t("as_termActive")}</span>
                      )}
                      {term.archived_at && (
                        <span className="rounded-pill bg-ink-100 text-ink-700 px-2.5 py-0.5 text-[10.5px] font-bold">{t("as_termArchived")}</span>
                      )}
                    </div>
                    <div className="text-[12px] text-muted mt-0.5">
                      {term.academic_year} · {dateFormat.format(new Date(term.starts_on))} → {dateFormat.format(new Date(term.ends_on))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {!term.is_active && !term.archived_at && (
                      <button
                        onClick={() => void activate(term)}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-[12px] font-bold disabled:opacity-50"
                      >
                        {t("as_termActivate")}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditing(term.id);
                        setForm({
                          name: term.name,
                          academic_year: term.academic_year,
                          starts_on: term.starts_on,
                          ends_on: term.ends_on,
                        });
                      }}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg border border-border bg-card text-[12px] font-bold text-ink-900 disabled:opacity-50"
                    >
                      {t("as_termEdit")}
                    </button>
                    <button
                      onClick={() => void toggleArchive(term)}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg border border-border bg-card text-[12px] font-bold text-ink-800 disabled:opacity-50"
                    >
                      {term.archived_at ? t("as_termRestore") : t("as_termArchive")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section title={editing ? t("as_termEdit") : t("as_termAdd")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t("as_termName")}>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={lang === "fr" ? "Trimestre 1" : "Term 1"}
              className={inputClass}
            />
          </Field>
          <Field label={t("as_termYear")}>
            <input
              value={form.academic_year}
              onChange={(e) => setForm((f) => ({ ...f, academic_year: e.target.value }))}
              placeholder="2026-2027"
              className={inputClass}
            />
          </Field>
          <Field label={t("as_termStart")}>
            <input type="date" value={form.starts_on} onChange={(e) => setForm((f) => ({ ...f, starts_on: e.target.value }))} className={inputClass} />
          </Field>
          <Field label={t("as_termEnd")}>
            <input type="date" value={form.ends_on} onChange={(e) => setForm((f) => ({ ...f, ends_on: e.target.value }))} className={inputClass} />
          </Field>
        </div>
        <div className="flex items-center gap-2.5 mt-4">
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? t("common_loading") : editing ? t("admin_save") : t("as_termAdd")}
          </Button>
          {editing && (
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(null);
                setForm(emptyTerm);
              }}
            >
              {t("admin_cancel")}
            </Button>
          )}
        </div>
      </Section>
    </div>
  );
}

/* ----------------------------------------------------------------- profile */

function ProfileTab() {
  const { t } = useI18n();
  const { profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({ first_name: "", last_name: "" });
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  useEffect(() => {
    setForm({ first_name: profile?.first_name ?? "", last_name: profile?.last_name ?? "" });
  }, [profile]);

  async function save() {
    setFlash(null);
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setFlash({ ok: false, msg: t("as_required") });
      return;
    }
    if (!profile) return;
    setBusy(true);
    const { data, error: err } = await supabase
      .from("profiles")
      .update({ first_name: form.first_name.trim(), last_name: form.last_name.trim(), updated_at: new Date().toISOString() })
      .eq("id", profile.id)
      .select("id");
    setBusy(false);
    if (err) setFlash({ ok: false, msg: `${t("as_saveFailed")} — ${err.message}` });
    else if (!data || data.length === 0) setFlash({ ok: false, msg: t("admin_saveBlocked") });
    else {
      setFlash({ ok: true, msg: t("as_profileSaved") });
      await refreshProfile();
    }
  }

  return (
    <Section title={t("as_profile")}>
      <div className="flex flex-col gap-3">
        <FlashLine flash={flash} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t("as_firstName")}>
            <input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} className={inputClass} />
          </Field>
          <Field label={t("as_lastName")}>
            <input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} className={inputClass} />
          </Field>
          {/* Read-only: the phone is the login identifier (auth.users), and the
              role can only be changed by a super_admin through functions/admin
              — 0003_guard_role_column refuses a self-escalation outright. */}
          <Field label={t("as_phone")}>
            <input value={profile?.phone ?? ""} readOnly disabled className={`${inputClass} opacity-70`} />
          </Field>
          <Field label={t("as_role")}>
            <input value={profile?.role ?? ""} readOnly disabled className={`${inputClass} opacity-70`} />
          </Field>
        </div>
        <div>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? t("common_loading") : t("admin_save")}
          </Button>
        </div>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- security */

function SecurityTab() {
  const { t, lang } = useI18n();
  const { profile, session, signOut } = useAuth();
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  const created = profile?.created_at ? new Date(profile.created_at) : null;

  async function changePassword() {
    setFlash(null);
    if (pw.next.length < 8) {
      setFlash({ ok: false, msg: t("as_passwordShort") });
      return;
    }
    if (pw.next !== pw.confirm) {
      setFlash({ ok: false, msg: t("as_passwordMismatch") });
      return;
    }
    setBusy(true);
    const { data, error: err } = await invokeFn("profile", { action: "change_password", new_password: pw.next });
    setBusy(false);
    if (err || data?.error) setFlash({ ok: false, msg: `${t("as_saveFailed")} — ${data?.error ?? err?.message ?? ""}` });
    else {
      setFlash({ ok: true, msg: t("as_passwordChanged") });
      setPw({ next: "", confirm: "" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Section title={t("as_session")}>
        <dl className="flex flex-col gap-2 text-[13px]">
          <div className="flex justify-between gap-3 flex-wrap">
            <dt className="text-muted">{t("as_signedInAs")}</dt>
            <dd className="font-semibold text-ink-900">
              {profile ? `${profile.first_name} ${profile.last_name}` : "—"} {profile?.role ? `· ${profile.role}` : ""}
            </dd>
          </div>
          <div className="flex justify-between gap-3 flex-wrap">
            <dt className="text-muted">{t("as_phone")}</dt>
            <dd className="font-semibold text-ink-900">{profile?.phone ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3 flex-wrap">
            <dt className="text-muted">{t("as_memberSince")}</dt>
            <dd className="font-semibold text-ink-900">
              {created ? new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long" }).format(created) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3 flex-wrap">
            <dt className="text-muted">ID</dt>
            <dd className="font-mono text-[11px] text-ink-800 break-all">{session?.user?.id ?? "—"}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm(t("as_confirmSignOut"))) void signOut();
            }}
          >
            {t("as_signOut")}
          </Button>
        </div>
      </Section>

      <Section title={t("as_passwordChange")}>
        <div className="flex flex-col gap-3">
          <FlashLine flash={flash} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t("as_password")} hint={t("as_passwordShort")}>
              <input
                type="password"
                autoComplete="new-password"
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label={t("as_passwordConfirm")}>
              <input
                type="password"
                autoComplete="new-password"
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                className={inputClass}
              />
            </Field>
          </div>
          <div>
            <Button onClick={() => void changePassword()} disabled={busy}>
              {busy ? t("common_loading") : t("as_passwordChange")}
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}
