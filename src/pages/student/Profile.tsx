import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { TopBar } from "../../components/TopBar";
import { Select, Spinner } from "../../components/ui";
import { Icon } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { REGIONS, TOWNS } from "../../lib/regions";

const inputClass = "w-full box-border border border-[#e2e8f0] rounded-[8px] px-3.5 py-3 text-[14px] outline-none focus:border-brand-500";

export default function Profile() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const { profile, loading: authLoading, refreshProfile, signOut } = useAuth();

  const [region, setRegion] = useState(profile?.region ?? "");
  const [town, setTown] = useState(profile?.town ?? "");
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [darkMode, setDarkMode] = useState(profile?.dark_mode ?? false);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [lessonsDone, setLessonsDone] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRegion(profile?.region ?? "");
    setTown(profile?.town ?? "");
    setNickname(profile?.nickname ?? "");
    setDarkMode(profile?.dark_mode ?? false);
  }, [profile]);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);

  useEffect(() => {
    if (!isSupabaseConfigured || !profile) return;
    (async () => {
      const { count } = await supabase
        .from("lesson_progress")
        .select("lesson_id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("status", "done");
      setLessonsDone(count ?? 0);
    })();
  }, [profile]);

  const regionEntry = REGIONS.find((r) => r.id === region || r.fr === region);
  const townOptions = regionEntry ? TOWNS[regionEntry.id] ?? [] : [];

  async function save() {
    if (!profile || !isSupabaseConfigured) return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from("profiles")
      .update({ region, town, nickname: nickname.trim() || null, dark_mode: darkMode, language: lang })
      .eq("id", profile.id);
    if (newPassword) {
      await supabase.auth.updateUser({ password: newPassword });
    }
    setSaving(false);
    setMessage(error ? t("common_error") : t("profile_save"));
    await refreshProfile();
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile || !isSupabaseConfigured) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError(true);
      return;
    }
    setPhotoUploading(true);
    setPhotoError(false);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${profile.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", profile.id);
      if (updateError) throw updateError;
      await refreshProfile();
    } catch {
      setPhotoError(true);
    }
    setPhotoUploading(false);
  }

  async function logout() {
    await signOut();
    navigate("/login");
  }

  if (authLoading)
    return (
      <PhoneFrame>
        <Spinner />
      </PhoneFrame>
    );

  const initial = (profile?.first_name?.[0] ?? "?").toUpperCase();

  return (
    <PhoneFrame>
      <div className="flex-1 min-h-0 flex flex-col">
        <TopBar variant="back" coins={profile?.faxcoins ?? 0} onBack={() => navigate("/dashboard")} />

        <div className="flex-1 min-h-0 overflow-auto px-5 pt-4 pb-[90px]">
          <div className="flex flex-col items-center pb-5">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoUploading}
              className="relative w-[78px] h-[78px] rounded-full bg-brand-500 text-white font-serif font-extrabold text-[28px] flex items-center justify-center mb-3 overflow-hidden disabled:opacity-70"
            >
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : initial}
              {photoUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </button>
            <div className="font-serif font-bold text-[16px] text-ink-900">
              {profile?.first_name} {profile?.last_name}
            </div>
            <div className="text-[12px] text-muted mt-0.5">{lang === "fr" ? "Filière Médecine" : "Medicine Track"}</div>
            {photoError && <div className="text-[11px] font-semibold text-danger-600 mt-1">{t("profile_photoError")}</div>}
          </div>

          <div className="flex gap-2.5 mb-5">
            <StatCard value={String(lessonsDone)} label={lang === "fr" ? "Leçons" : "Lessons"} />
            <StatCard value={String(profile?.faxcoins ?? 0)} label="FaxCoins" />
            <StatCard value={profile?.rank_label ?? "—"} label={t("profile_rank")} />
          </div>

          <div className="flex flex-col gap-4">
            <Field label={t("profile_nickname")}>
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t("profile_nicknamePlaceholder")} maxLength={30} className={inputClass} />
            </Field>
            <Field label={t("profile_region")}>
              <Select value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass} wrapperClassName="w-full">
                <option value="">{t("reg_selectPlaceholder")}</option>
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {lang === "fr" ? r.fr : r.en}
                  </option>
                ))}
              </Select>
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

            <div className="flex items-center justify-between py-1">
              <span className="text-[12.5px] font-semibold text-ink-900">{t("profile_language")}</span>
              <div className="flex bg-ink-100 rounded-pill p-[3px] gap-0.5">
                <button onClick={() => setLang("fr")} className={`rounded-pill px-2.5 py-1 text-[11px] font-bold ${lang === "fr" ? "bg-brand-800 text-white" : "text-muted"}`}>
                  FR
                </button>
                <button onClick={() => setLang("en")} className={`rounded-pill px-2.5 py-1 text-[11px] font-bold ${lang === "en" ? "bg-brand-800 text-white" : "text-muted"}`}>
                  EN
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-[12.5px] font-semibold text-ink-900 flex items-center gap-2">
                <Icon name={darkMode ? "moon" : "sun"} size={16} />
                {t("profile_darkMode")}
              </span>
              <button
                onClick={() => setDarkMode((v) => !v)}
                className={`w-11 h-6 rounded-pill relative transition-colors ${darkMode ? "bg-brand-600" : "bg-ink-100"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${darkMode ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
          </div>

          {message && <div className="text-xs font-semibold text-success-600 mt-3">{message}</div>}

          <div className="flex flex-col gap-2.5 pt-5">
            <button onClick={save} disabled={saving} className="w-full bg-brand-500 text-white rounded-[10px] py-3.5 font-serif font-bold text-[14px] disabled:opacity-50">
              {t("profile_save")}
            </button>
            <button onClick={logout} className="w-full bg-white border-2 border-danger-600 text-danger-600 rounded-[10px] py-3.5 font-serif font-bold text-[14px]">
              {t("profile_logout")}
            </button>
          </div>
        </div>

        <BottomTabs />
      </div>
    </PhoneFrame>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 bg-card rounded-[12px] py-3.5 text-center shadow-[0_2px_8px_rgba(20,30,60,0.05)]">
      <div className="font-serif font-extrabold text-[18px] text-ink-900">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-ink-900">{label}</span>
      {children}
    </label>
  );
}
