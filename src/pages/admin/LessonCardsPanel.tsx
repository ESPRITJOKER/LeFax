import { useEffect, useRef, useState } from "react";
import { Icon } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabaseClient";
import type { LessonCardRow } from "../../lib/database.types";

const BUCKET = "lesson-media";

/**
 * Admin editor for a lesson's story cards (CDC Steps 4 & 5). One panel per
 * lesson: create/reorder/delete cards, edit the four back-face blocks, and —
 * per Step 4 — assign a SEPARATE image for FR vs EN students (image_fr /
 * image_en), not a single shared field.
 */
export function LessonCardsPanel({ lessonId }: { lessonId: string }) {
  const { t } = useI18n();
  const { profile } = useAuth();
  const [cards, setCards] = useState<LessonCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("lesson_cards").select("*").eq("lesson_id", lessonId).order("position");
      setCards(data ?? []);
      setLoading(false);
    })();
  }, [lessonId]);

  function setField<K extends keyof LessonCardRow>(id: string, key: K, value: LessonCardRow[K]) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)));
  }

  async function addCard() {
    const nextPos = cards.length ? Math.max(...cards.map((c) => c.position)) + 1 : 0;
    const { data, error } = await supabase.from("lesson_cards").insert({ lesson_id: lessonId, position: nextPos }).select().single();
    if (error || !data) return setFlash({ ok: false, msg: t("admin_saveError") });
    setCards((prev) => [...prev, data]);
  }

  async function saveCard(card: LessonCardRow) {
    setBusyId(card.id);
    setFlash(null);
    const { id, created_at, updated_at, lesson_id, ...fields } = card;
    void created_at;
    void updated_at;
    void lesson_id;
    const { error } = await supabase.from("lesson_cards").update(fields).eq("id", id);
    setFlash(error ? { ok: false, msg: t("admin_saveError") } : { ok: true, msg: t("admin_cardSaved") });
    setBusyId(null);
  }

  async function deleteCard(card: LessonCardRow) {
    setBusyId(card.id);
    const { error } = await supabase.from("lesson_cards").delete().eq("id", card.id);
    if (!error) setCards((prev) => prev.filter((c) => c.id !== card.id));
    else setFlash({ ok: false, msg: t("admin_saveError") });
    setBusyId(null);
  }

  async function move(card: LessonCardRow, dir: -1 | 1) {
    const sorted = [...cards].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((c) => c.id === card.id);
    const swapWith = sorted[idx + dir];
    if (!swapWith) return;
    setBusyId(card.id);
    // Swap positions (two-step via a temp value to avoid the unique(lesson,pos) clash).
    const tmp = -1 - idx;
    await supabase.from("lesson_cards").update({ position: tmp }).eq("id", card.id);
    await supabase.from("lesson_cards").update({ position: card.position }).eq("id", swapWith.id);
    await supabase.from("lesson_cards").update({ position: swapWith.position }).eq("id", card.id);
    const { data } = await supabase.from("lesson_cards").select("*").eq("lesson_id", lessonId).order("position");
    setCards(data ?? []);
    setBusyId(null);
  }

  async function uploadImage(card: LessonCardRow, variant: "fr" | "en", file: File) {
    if (!profile || !file.type.startsWith("image/")) return;
    setBusyId(card.id);
    setFlash(null);
    try {
      const path = `${lessonId}/card-${card.id}-${variant}`; // fixed key → replace overwrites
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      const patch: Partial<LessonCardRow> = variant === "fr" ? { image_fr: url } : { image_en: url };
      const { error: dbErr } = await supabase.from("lesson_cards").update(patch).eq("id", card.id);
      if (dbErr) throw dbErr;
      setField(card.id, variant === "fr" ? "image_fr" : "image_en", url);
    } catch {
      setFlash({ ok: false, msg: t("admin_saveError") });
    }
    setBusyId(null);
  }

  async function removeImage(card: LessonCardRow, variant: "fr" | "en") {
    setBusyId(card.id);
    try {
      await supabase.storage.from(BUCKET).remove([`${lessonId}/card-${card.id}-${variant}`]);
      const patch: Partial<LessonCardRow> = variant === "fr" ? { image_fr: null } : { image_en: null };
      await supabase.from("lesson_cards").update(patch).eq("id", card.id);
      setField(card.id, variant === "fr" ? "image_fr" : "image_en", null);
    } catch {
      setFlash({ ok: false, msg: t("admin_saveError") });
    }
    setBusyId(null);
  }

  if (loading) return null;

  const sorted = [...cards].sort((a, b) => a.position - b.position);

  return (
    <div>
      <div className="font-bold text-[15px] text-ink-900 mb-1 flex items-center gap-2">
        <Icon name="book" size={16} className="text-ink-700" />
        {t("admin_cards")}
      </div>
      <div className="text-[11.5px] text-muted leading-relaxed mb-3">{t("admin_cardsHint")}</div>

      {flash && (
        <div className={`mb-3 rounded-xl px-4 py-2.5 text-[13px] font-semibold ${flash.ok ? "bg-success-600/10 text-success-600" : "bg-danger-600/10 text-danger-600"}`}>
          {flash.msg}
        </div>
      )}

      {sorted.length === 0 && <div className="bg-ink-50 border border-ink-100 rounded-2xl px-4 py-5 text-[13px] text-muted mb-3">{t("admin_noCards")}</div>}

      <div className="flex flex-col gap-4">
        {sorted.map((card, i) => {
          const busy = busyId === card.id;
          return (
            <div key={card.id} className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[12px] font-bold uppercase tracking-wide text-muted">
                  {t("admin_card")} {i + 1}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => move(card, -1)} disabled={busy || i === 0} className="p-1.5 rounded-lg border border-border text-ink-700 disabled:opacity-40" title={t("admin_moveUp")}>
                    <Icon name="chevleft" size={14} className="rotate-90" />
                  </button>
                  <button onClick={() => move(card, 1)} disabled={busy || i === sorted.length - 1} className="p-1.5 rounded-lg border border-border text-ink-700 disabled:opacity-40" title={t("admin_moveDown")}>
                    <Icon name="chevleft" size={14} className="-rotate-90" />
                  </button>
                  <button onClick={() => deleteCard(card)} disabled={busy} className="p-1.5 rounded-lg border border-border text-danger-600 disabled:opacity-40" title={t("admin_deleteCard")}>
                    <Icon name="close" size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={t("admin_cardPointFr")} value={card.point_fr} onChange={(v) => setField(card.id, "point_fr", v)} />
                <Field label={t("admin_cardPointEn")} value={card.point_en} onChange={(v) => setField(card.id, "point_en", v)} />
                <Field label={t("admin_cardSubFr")} value={card.sub_fr} onChange={(v) => setField(card.id, "sub_fr", v)} />
                <Field label={t("admin_cardSubEn")} value={card.sub_en} onChange={(v) => setField(card.id, "sub_en", v)} />
                <Field label={t("admin_cardExplanationFr")} value={card.explanation_fr} onChange={(v) => setField(card.id, "explanation_fr", v)} area />
                <Field label={t("admin_cardExplanationEn")} value={card.explanation_en} onChange={(v) => setField(card.id, "explanation_en", v)} area />
                <Field label={t("admin_cardStructQFr")} value={card.structural_question_fr} onChange={(v) => setField(card.id, "structural_question_fr", v)} area />
                <Field label={t("admin_cardStructQEn")} value={card.structural_question_en} onChange={(v) => setField(card.id, "structural_question_en", v)} area />
                <Field label={t("admin_cardStructAFr")} value={card.structural_answer_fr} onChange={(v) => setField(card.id, "structural_answer_fr", v)} />
                <Field label={t("admin_cardStructAEn")} value={card.structural_answer_en} onChange={(v) => setField(card.id, "structural_answer_en", v)} />
                <Field label={t("admin_cardTipsFr")} value={card.tips_fr} onChange={(v) => setField(card.id, "tips_fr", v)} area />
                <Field label={t("admin_cardTipsEn")} value={card.tips_en} onChange={(v) => setField(card.id, "tips_en", v)} area />
                <Field label={t("admin_cardTrapsFr")} value={card.traps_fr} onChange={(v) => setField(card.id, "traps_fr", v)} area />
                <Field label={t("admin_cardTrapsEn")} value={card.traps_en} onChange={(v) => setField(card.id, "traps_en", v)} area />
              </div>

              {/* Dual per-language image pickers (Step 4) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <ImagePicker
                  label={t("admin_cardImageFr")}
                  url={card.image_fr}
                  busy={busy}
                  onPick={() => fileInputs.current[`${card.id}-fr`]?.click()}
                  onRemove={() => removeImage(card, "fr")}
                  uploadLabel={t(card.image_fr ? "admin_replace" : "admin_upload")}
                  removeLabel={t("admin_remove")}
                  inputRef={(el) => (fileInputs.current[`${card.id}-fr`] = el)}
                  onFile={(f) => uploadImage(card, "fr", f)}
                />
                <ImagePicker
                  label={t("admin_cardImageEn")}
                  url={card.image_en}
                  busy={busy}
                  onPick={() => fileInputs.current[`${card.id}-en`]?.click()}
                  onRemove={() => removeImage(card, "en")}
                  uploadLabel={t(card.image_en ? "admin_replace" : "admin_upload")}
                  removeLabel={t("admin_remove")}
                  inputRef={(el) => (fileInputs.current[`${card.id}-en`] = el)}
                  onFile={(f) => uploadImage(card, "en", f)}
                />
              </div>

              <div className="mt-3">
                <button onClick={() => saveCard(card)} disabled={busy} className="border-none px-5 py-2.5 rounded-xl text-[13px] font-bold bg-brand-600 text-white disabled:opacity-60">
                  {busy ? t("admin_uploading") : t("admin_saveCard")}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={addCard} className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold border-[1.5px] border-brand-600/40 text-brand-600 bg-white">
        <Icon name="plus" size={15} />
        {t("admin_addCard")}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, area }: { label: string; value: string; onChange: (v: string) => void; area?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold text-muted">{label}</span>
      {area ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 text-[12.5px] leading-relaxed resize-y" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 text-[12.5px]" />
      )}
    </label>
  );
}

function ImagePicker({
  label,
  url,
  busy,
  onPick,
  onRemove,
  uploadLabel,
  removeLabel,
  inputRef,
  onFile,
}: {
  label: string;
  url: string | null;
  busy: boolean;
  onPick: () => void;
  onRemove: () => void;
  uploadLabel: string;
  removeLabel: string;
  inputRef: (el: HTMLInputElement | null) => void;
  onFile: (f: File) => void;
}) {
  return (
    <div className="border border-border rounded-xl p-3">
      <div className="text-[11px] font-bold text-muted mb-2">{label}</div>
      <div className="flex gap-3 items-start">
        <div className="w-[110px] flex-none">
          {url ? (
            <img src={url} alt="" className="w-full aspect-[16/10] object-cover rounded-lg border border-border bg-ink-50" />
          ) : (
            <div className="w-full aspect-[16/10] rounded-lg border-[1.5px] border-dashed border-ink-300 bg-ink-50 flex items-center justify-center text-ink-300">
              <Icon name="upload" size={18} />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
          <button onClick={onPick} disabled={busy} className="border-none px-3.5 py-1.5 rounded-lg text-[12px] font-bold bg-brand-600 text-white disabled:opacity-60">
            {uploadLabel}
          </button>
          {url && (
            <button onClick={onRemove} disabled={busy} className="border border-border bg-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold text-danger-600 disabled:opacity-60">
              {removeLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
