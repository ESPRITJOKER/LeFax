import { useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

/**
 * Profile-picture picker, shared by the student profile screen and the admin
 * settings panel.
 *
 * The upload path is the one `avatars` was built for in 0005: the object key is
 * `<user id>/avatar.<ext>`, and the bucket's RLS keys every write on
 * `(storage.foldername(name))[1] = auth.uid()::text`. That predicate is
 * role-agnostic, so an admin uploading their own picture needs no new policy —
 * only a control to do it with, which the admin panel never had.
 *
 * A fixed key (rather than a per-upload name) with `upsert: true` means
 * replacing a picture overwrites the old object instead of orphaning it; the
 * `?t=` suffix on the public URL is what makes the browser drop the cached
 * copy of the previous image at the same address.
 */
export function AvatarUpload({
  size = 78,
  className = "",
}: {
  /** Diameter in px. The fallback initial scales with it. */
  size?: number;
  className?: string;
}) {
  const { t } = useI18n();
  const { profile, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initial = (profile?.first_name?.[0] ?? "?").toUpperCase();

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile || !isSupabaseConfigured) return;
    if (!file.type.startsWith("image/")) {
      setError(t("profile_photoError"));
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${profile.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;
      // `.select()` so an RLS-refused write is reported rather than confirmed.
      const { data: rows, error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", profile.id)
        .select("id");
      if (updateError) throw updateError;
      if (!rows || rows.length === 0) throw new Error(t("admin_saveBlocked"));
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("profile_photoError"));
    }
    setUploading(false);
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        aria-label={t("as_photoChange")}
        className="relative rounded-full bg-brand-500 text-white font-serif font-extrabold flex items-center justify-center overflow-hidden disabled:opacity-70"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          initial
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>
      {uploading && <div className="text-[11px] text-muted mt-1.5">{t("profile_photoUploading")}</div>}
      {error && (
        <div role="alert" className="text-[11px] font-semibold text-danger-700 mt-1.5 text-center max-w-[220px] break-words">
          {error}
        </div>
      )}
    </div>
  );
}
