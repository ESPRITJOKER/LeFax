import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../../lib/icons";
import { Spinner } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { parseImagePlaceholders } from "../../lib/lessonContent";
import { LessonCardsPanel } from "./LessonCardsPanel";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { LessonRow } from "../../lib/database.types";

const BUCKET = "lesson-media";

export default function AdminLessonEditor() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { lessonId } = useParams<{ lessonId: string }>();
  const { profile } = useAuth();

  const [lesson, setLesson] = useState<LessonRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  // editable fields
  const [titleFr, setTitleFr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [contentFr, setContentFr] = useState("");
  const [contentEn, setContentEn] = useState("");

  // slot -> image url
  const [images, setImages] = useState<Record<number, string>>({});
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  async function loadMedia(id: string) {
    const { data } = await supabase
      .from("media_library")
      .select("image_slot, storage_path")
      .eq("lesson_id", id)
      .not("image_slot", "is", null);
    const map: Record<number, string> = {};
    for (const m of data ?? []) if (m.image_slot != null) map[m.image_slot] = m.storage_path;
    setImages(map);
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !lessonId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle();
      if (data) {
        setLesson(data);
        setTitleFr(data.title_fr);
        setTitleEn(data.title_en);
        setContentFr(data.content_fr);
        setContentEn(data.content_en);
        setPublished(data.published);
        await loadMedia(lessonId);
      }
      setLoading(false);
    })();
  }, [lessonId]);

  async function save() {
    if (!lessonId) return;
    setSaving(true);
    setFlash(null);
    const { error } = await supabase
      .from("lessons")
      .update({ title_fr: titleFr, title_en: titleEn, content_fr: contentFr, content_en: contentEn })
      .eq("id", lessonId);
    setFlash(error ? { ok: false, msg: t("admin_saveError") } : { ok: true, msg: t("admin_lessonSaved") });
    setSaving(false);
  }

  async function togglePublish() {
    if (!lessonId) return;
    setPublishing(true);
    setFlash(null);
    const next = !published;
    const { error } = await supabase.from("lessons").update({ published: next }).eq("id", lessonId);
    if (error) {
      setFlash({ ok: false, msg: t("admin_saveError") });
    } else {
      setPublished(next);
      setFlash({ ok: true, msg: next ? t("admin_published") : t("admin_draft") });
    }
    setPublishing(false);
  }

  async function uploadForSlot(slot: number, file: File) {
    if (!lessonId || !profile || !file.type.startsWith("image/")) return;
    setUploadingSlot(slot);
    setFlash(null);
    try {
      const path = `${lessonId}/${slot}`; // fixed key per slot → replace overwrites
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`; // cache-bust: same key, new bytes
      const { error: dbErr } = await supabase.from("media_library").upsert(
        {
          lesson_id: lessonId,
          image_slot: slot,
          storage_path: url,
          file_name: file.name,
          mime_type: file.type,
          uploaded_by: profile.id,
        },
        { onConflict: "lesson_id,image_slot" }
      );
      if (dbErr) throw dbErr;
      setImages((prev) => ({ ...prev, [slot]: url }));
    } catch {
      setFlash({ ok: false, msg: t("admin_saveError") });
    }
    setUploadingSlot(null);
  }

  async function removeSlot(slot: number) {
    if (!lessonId) return;
    setUploadingSlot(slot);
    try {
      await supabase.storage.from(BUCKET).remove([`${lessonId}/${slot}`]);
      await supabase.from("media_library").delete().eq("lesson_id", lessonId).eq("image_slot", slot);
      setImages((prev) => {
        const next = { ...prev };
        delete next[slot];
        return next;
      });
    } catch {
      setFlash({ ok: false, msg: t("admin_saveError") });
    }
    setUploadingSlot(null);
  }

  if (loading) return <Spinner />;
  if (!lesson) return <div className="text-sm text-muted">{isSupabaseConfigured ? t("common_error") : t("backend_banner")}</div>;

  // Slots are language-independent; captions shown in the active language.
  const placeholders = parseImagePlaceholders(lang === "fr" ? contentFr : contentEn);

  return (
    <div className="max-w-[820px]">
      <button onClick={() => navigate("/admin/content")} className="flex items-center gap-1.5 text-[13px] font-semibold text-muted border-none bg-transparent p-0 mb-4">
        <Icon name="chevleft" size={16} />
        {t("admin_backToContent")}
      </button>

      <div className="font-serif font-bold text-xl text-ink-950 mb-4">{t("admin_editLesson")}</div>

      {/* Publish status + toggle */}
      <div className="flex items-center gap-3 mb-4 bg-white border border-border rounded-2xl px-4 py-3 flex-wrap">
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${published ? "bg-success-600/10 text-success-600" : "bg-ink-100 text-muted"}`}>
          {published ? t("admin_published") : t("admin_draft")}
        </span>
        <span className="text-[12px] text-muted flex-1 min-w-[120px]">{published ? t("admin_publishedHint") : t("admin_draftHint")}</span>
        <button
          onClick={togglePublish}
          disabled={publishing}
          className={`border-none px-4 py-2 rounded-xl text-[13px] font-bold text-white disabled:opacity-60 ${published ? "bg-ink-700" : "bg-success-600"}`}
        >
          {publishing ? t("admin_uploading") : published ? t("admin_unpublish") : t("admin_publish")}
        </button>
      </div>

      {flash && (
        <div className={`mb-4 rounded-xl px-4 py-2.5 text-[13px] font-semibold ${flash.ok ? "bg-success-600/10 text-success-600" : "bg-danger-600/10 text-danger-600"}`}>
          {flash.msg}
        </div>
      )}

      {/* Text fields */}
      <div className="bg-white border border-border rounded-2xl p-5 flex flex-col gap-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-bold text-muted">{t("admin_titleFr")}</span>
            <input value={titleFr} onChange={(e) => setTitleFr(e.target.value)} className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 text-[13px]" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-bold text-muted">{t("admin_titleEn")}</span>
            <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 text-[13px]" />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-bold text-muted">{t("admin_contentFr")}</span>
          <textarea value={contentFr} onChange={(e) => setContentFr(e.target.value)} rows={12} className="px-3 py-2.5 rounded-lg border-[1.5px] border-ink-300 text-[12.5px] font-mono leading-relaxed" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-bold text-muted">{t("admin_contentEn")}</span>
          <textarea value={contentEn} onChange={(e) => setContentEn(e.target.value)} rows={12} className="px-3 py-2.5 rounded-lg border-[1.5px] border-ink-300 text-[12.5px] font-mono leading-relaxed" />
        </label>
        <div className="text-[11px] text-muted leading-relaxed">{t("admin_markupHint")}</div>
        <div>
          <button onClick={save} disabled={saving} className="border-none px-5 py-2.5 rounded-xl text-[13px] font-bold bg-brand-600 text-white disabled:opacity-60">
            {saving ? t("admin_uploading") : t("admin_save")}
          </button>
        </div>
      </div>

      {/* Image placeholders */}
      <div className="font-bold text-[15px] text-ink-900 mb-3 flex items-center gap-2">
        <Icon name="upload" size={16} className="text-ink-700" />
        {t("admin_illustrations")}
      </div>

      {placeholders.length === 0 ? (
        <div className="bg-ink-50 border border-ink-100 rounded-2xl px-4 py-5 text-[13px] text-muted">{t("admin_noPlaceholders")}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {placeholders.map((p) => {
            const url = images[p.slot];
            const busy = uploadingSlot === p.slot;
            return (
              <div key={p.slot} className="bg-white border border-border rounded-2xl p-4 flex gap-4 items-start">
                <div className="w-[130px] flex-none">
                  {url ? (
                    <img src={url} alt={p.caption} className="w-full aspect-[16/10] object-cover rounded-lg border border-border bg-ink-50" />
                  ) : (
                    <div className="w-full aspect-[16/10] rounded-lg border-[1.5px] border-dashed border-ink-300 bg-ink-50 flex items-center justify-center text-ink-400">
                      <Icon name="upload" size={20} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1">
                    {t("admin_slot")} {p.slot}
                  </div>
                  <div className="text-[13px] text-ink-900 leading-snug mb-3">{p.caption}</div>
                  <div className="flex gap-2">
                    <input
                      ref={(el) => {
                        fileInputs.current[p.slot] = el;
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) uploadForSlot(p.slot, f);
                      }}
                    />
                    <button
                      onClick={() => fileInputs.current[p.slot]?.click()}
                      disabled={busy}
                      className="border-none px-3.5 py-1.5 rounded-lg text-[12px] font-bold bg-brand-600 text-white disabled:opacity-60"
                    >
                      {busy ? t("admin_uploading") : url ? t("admin_replace") : t("admin_upload")}
                    </button>
                    {url && (
                      <button
                        onClick={() => removeSlot(p.slot)}
                        disabled={busy}
                        className="border border-border bg-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold text-danger-600 disabled:opacity-60"
                      >
                        {t("admin_remove")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Story cards (new lesson viewer) */}
      <div className="h-px bg-border my-6" />
      <LessonCardsPanel lessonId={lessonId!} />
    </div>
  );
}
