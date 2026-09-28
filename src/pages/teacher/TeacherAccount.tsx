import { Icon } from "../../lib/icons";
import { SubjectGlyph } from "../../components/SubjectBadge";
import { Spinner } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { useMySubjects } from "../../lib/teacher";

/**
 * Account & settings: who the teacher is, what they're allowed to teach, the
 * interface language, and a sign-out that actually exists (audited Defect 3 —
 * the teacher shell had no session control anywhere).
 *
 * Subject assignments are shown read-only on purpose: only a super_admin can
 * change them, in the admin panel, and the database agrees (0018).
 */
export default function TeacherAccount() {
  const { t, lang, setLang } = useI18n();
  const { profile, signOut } = useAuth();
  const { subjects, loading } = useMySubjects();

  if (!profile) return <Spinner />;

  return (
    <div className="max-w-[640px] flex flex-col gap-4">
      <div className="bg-white border border-border rounded-2xl p-5">
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-full bg-brand-600 text-white flex items-center justify-center text-[16px] font-bold flex-none">
            {`${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-ink-900 truncate">
              {profile.first_name} {profile.last_name}
            </div>
            <div className="text-[12px] text-muted">{profile.phone}</div>
          </div>
        </div>
        <Row label={t("reg_phone")} value={profile.phone} />
        <Row label="Role" value={profile.role} />
        <Row label="Status" value={profile.status} />
      </div>

      <div className="bg-white border border-border rounded-2xl p-5">
        <div className="text-[13.5px] font-bold text-ink-900 mb-3">{t("at_assignments")}</div>
        {loading ? (
          <Spinner />
        ) : subjects.length === 0 ? (
          <div className="text-[12.5px] text-muted leading-relaxed">{t("td_noSubjectsHint")}</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 text-[12px] font-bold text-ink-900">
                <SubjectGlyph slug={s.slug} size={13} />
                {lang === "fr" ? s.name_fr : s.name_en}
              </span>
            ))}
          </div>
        )}
        <div className="text-[11px] text-muted mt-3">{t("at_onlySuperAdmin")}</div>
      </div>

      <div className="bg-white border border-border rounded-2xl p-5">
        <div className="text-[13.5px] font-bold text-ink-900 mb-3">{t("lang_heading")}</div>
        <div className="flex gap-2">
          {(["fr", "en"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-4 py-2 rounded-xl text-[12.5px] font-bold border ${lang === l ? "border-brand-600 bg-brand-600 text-white" : "border-border bg-white text-ink-900"}`}
            >
              {l === "fr" ? "Français" : "English"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-border rounded-2xl p-5">
        <div className="text-[13.5px] font-bold text-ink-900 mb-1.5">{t("teacher_signOut")}</div>
        <div className="text-[12px] text-muted mb-3">{t("teacher_signOutHint")}</div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-2 border-none px-4 py-2.5 rounded-xl text-[13px] font-bold bg-danger-600 text-white"
        >
          <Icon name="logout" size={16} />
          {t("teacher_signOut")}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-t border-border first:border-0">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="text-[12.5px] font-semibold text-ink-900 truncate">{value}</span>
    </div>
  );
}
