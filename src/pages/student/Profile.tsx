import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { Button } from "../../components/ui";
import { Icon } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { REGIONS, TOWNS } from "../../lib/regions";

export default function Profile() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const { profile, refreshProfile, signOut } = useAuth();

  const [region, setRegion] = useState(profile?.region ?? "");
  const [town, setTown] = useState(profile?.town ?? "");
  const [darkMode, setDarkMode] = useState(profile?.dark_mode ?? false);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setRegion(profile?.region ?? "");
    setTown(profile?.town ?? "");
    setDarkMode(profile?.dark_mode ?? false);
  }, [profile]);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);

  const regionEntry = REGIONS.find((r) => r.id === region || r.fr === region);
  const townOptions = regionEntry ? TOWNS[regionEntry.id] ?? [] : [];

  async function save() {
    if (!profile || !isSupabaseConfigured) return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from("profiles").update({ region, town, dark_mode: darkMode, language: lang }).eq("id", profile.id);
    if (newPassword) {
      await supabase.auth.updateUser({ password: newPassword });
    }
    setSaving(false);
    setMessage(error ? t("common_error") : t("profile_save"));
    await refreshProfile();
  }

  async function logout() {
    await signOut();
    navigate("/login");
  }

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="px-[22px] pt-4 font-serif font-bold text-xl text-ink-950">{t("profile_title")}</div>

        <div className="px-[22px] pt-5 flex flex-col items-center gap-2.5">
          <div className="w-20 h-20 rounded-full bg-ink-700 text-white flex items-center justify-center text-2xl font-bold overflow-hidden">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : <Icon name="user" size={32} />}
          </div>
          <button className="text-xs font-semibold text-ink-700">{t("profile_editPhoto")}</button>
          <div className="text-sm font-bold text-ink-900">
            {profile?.first_name} {profile?.last_name}
          </div>
          <div className="flex items-center gap-3 text-[11.5px] text-muted">
            <span>{t("profile_level")}: {profile?.level ?? "—"}</span>
            <span>·</span>
            <span>{t("profile_rank")}: {profile?.rank_label ?? "—"}</span>
          </div>
        </div>

        <div className="px-[22px] pt-6 flex flex-col gap-4">
          <Field label={t("profile_region")}>
            <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass}>
              <option value="">{t("reg_selectPlaceholder")}</option>
              {REGIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {lang === "fr" ? r.fr : r.en}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("profile_town")}>
            <input value={town} onChange={(e) => setTown(e.target.value)} list="profileTownList" className={inputClass} />
            <datalist id="profileTownList">
              {townOptions.map((tw) => (
                <option key={tw} value={tw} />
              ))}
            </datalist>
          </Field>
          <Field label={t("profile_password")}>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
          </Field>

          <div className="flex items-center justify-between py-2">
            <span className="text-[12.5px] font-semibold text-ink-800">{t("profile_language")}</span>
            <div className="flex bg-ink-100 rounded-pill p-[3px] gap-0.5">
              <button onClick={() => setLang("fr")} className={`rounded-pill px-2.5 py-1 text-[11px] font-bold ${lang === "fr" ? "bg-ink-700 text-white" : "text-muted"}`}>
                FR
              </button>
              <button onClick={() => setLang("en")} className={`rounded-pill px-2.5 py-1 text-[11px] font-bold ${lang === "en" ? "bg-ink-700 text-white" : "text-muted"}`}>
                EN
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-[12.5px] font-semibold text-ink-800 flex items-center gap-2">
              <Icon name={darkMode ? "moon" : "sun"} size={16} />
              {t("profile_darkMode")}
            </span>
            <button
              onClick={() => setDarkMode((v) => !v)}
              className={`w-11 h-6 rounded-pill relative transition-colors ${darkMode ? "bg-ink-700" : "bg-ink-100"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${darkMode ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
        </div>

        {message && <div className="px-[22px] text-xs font-semibold text-success-600 mt-2">{message}</div>}

        <div className="px-[22px] pt-5 pb-6 flex flex-col gap-2.5">
          <Button onClick={save} disabled={saving}>
            {t("profile_save")}
          </Button>
          <Button variant="secondary" onClick={logout}>
            {t("profile_logout")}
          </Button>
        </div>
        <BottomTabs />
      </div>
    </PhoneFrame>
  );
}

const inputClass = "px-3.5 py-3 rounded-xl border-[1.5px] border-border text-[14.5px] outline-none text-ink-950 bg-white w-full";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-ink-800">{label}</span>
      {children}
    </label>
  );
}
