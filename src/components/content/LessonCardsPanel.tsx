import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Icon } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabaseClient";
import type { LessonCardRow } from "../../lib/database.types";

const BUCKET = "lesson-media";

/** Imperative handle so the lesson editor's single top "Enregistrer" can flush
 *  every unsaved card in one click (Correction: users lost card edits because
 *  the top save only wrote title/body, not the separately-saved cards). */
export interface LessonCardsHandle {
  /** Persist every dirty card. Resolves false if any write fails. */
  saveAll: () => Promise<boolean>;
  hasDirty: () => boolean;
}

/**
 * Admin editor for a lesson's story cards (CDC Steps 4 & 5). One panel per
 * lesson: create/reorder/delete cards, edit the four back-face blocks, and —
 * per Step 4 — assign a SEPARATE image for FR vs EN students (image_fr /
 * image_en), not a single shared field.
 *
 * Layout restored to the original LeFax editor the feedback round asked to keep
 * ("the first design of lefax … I wanted to keep it"): a numbered card rail on
 * the left, one card's fields in the middle, and a live phone preview on the
 * right. The previous version stacked every card's full form vertically, which
 * lost both the deck overview and the student's-eye view of what was being
 * written — the two things that made the original screen work.
 *
 * The rail/editor/preview split is presentation only: create, reorder, delete,
 * per-card save, the dirty-tracking imperative handle and the dual-language
 * image uploads are unchanged.
 */
export const LessonCardsPanel = forwardRef<LessonCardsHandle, { lessonId: string }>(function LessonCardsPanel(
  { lessonId },
  ref
) {
  const { t } = useI18n();
  const { profile } = useAuth();
  const [cards, setCards] = useState<LessonCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  // Cards edited since their last successful save — used to flush them all from
  // the top button and to warn before leaving.
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  // Which card the middle pane is editing. Null until the first load resolves.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  // Latest cards, readable inside the imperative saveAll without stale closures.
  const cardsRef = useRef<LessonCardRow[]>([]);
  cardsRef.current = cards;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("lesson_cards").select("*").eq("lesson_id", lessonId).order("position");
      setCards(data ?? []);
      setSelectedId(data?.[0]?.id ?? null);
      setDirty(new Set());
      setLoading(false);
    })();
  }, [lessonId]);

  function markDirty(id: string) {
    setDirty((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }
  function clearDirty(id: string) {
    setDirty((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function setField<K extends keyof LessonCardRow>(id: string, key: K, value: LessonCardRow[K]) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)));
    markDirty(id);
  }

  async function addCard() {
    const nextPos = cards.length ? Math.max(...cards.map((c) => c.position)) + 1 : 0;
    const { data, error } = await supabase.from("lesson_cards").insert({ lesson_id: lessonId, position: nextPos }).select().single();
    if (error || !data) return setFlash({ ok: false, msg: error?.message || t("admin_saveError") });
    setCards((prev) => [...prev, data]);
    setSelectedId(data.id);
  }

  // Persist one card. Returns true only if a row actually came back — an RLS
  // 0-row "success" (no error, no data) is treated as a failure so we never
  // claim a save that didn't happen.
  async function persistCard(card: LessonCardRow): Promise<{ ok: boolean; error?: string }> {
    const { id, created_at, updated_at, lesson_id, ...fields } = card;
    void created_at;
    void updated_at;
    void lesson_id;
    const { data, error } = await supabase.from("lesson_cards").update(fields).eq("id", id).select("id");
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) return { ok: false, error: t("admin_saveBlocked") };
    return { ok: true };
  }

  async function saveCard(card: LessonCardRow) {
    setBusyId(card.id);
    setFlash(null);
    const res = await persistCard(card);
    if (res.ok) clearDirty(card.id);
    setFlash(res.ok ? { ok: true, msg: t("admin_cardSaved") } : { ok: false, msg: res.error || t("admin_saveError") });
    setBusyId(null);
  }

  useImperativeHandle(ref, () => ({
    hasDirty: () => cardsRef.current.some((c) => dirty.has(c.id)),
    saveAll: async () => {
      const toSave = cardsRef.current.filter((c) => dirty.has(c.id));
      if (toSave.length === 0) return true;
      const results = await Promise.all(toSave.map(persistCard));
      const savedIds = toSave.filter((_, i) => results[i].ok).map((c) => c.id);
      if (savedIds.length) setDirty((prev) => { const n = new Set(prev); savedIds.forEach((id) => n.delete(id)); return n; });
      const firstErr = results.find((r) => !r.ok)?.error;
      if (firstErr) setFlash({ ok: false, msg: firstErr });
      return results.every((r) => r.ok);
    },
    // persistCard only closes over stable refs (supabase, t); dirty/cardsRef are
    // read fresh, so re-deriving the handle on each dirty change is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [dirty]);

  async function deleteCard(card: LessonCardRow) {
    setBusyId(card.id);
    const { error } = await supabase.from("lesson_cards").delete().eq("id", card.id);
    if (!error) {
      setCards((prev) => {
        const next = prev.filter((c) => c.id !== card.id);
        if (card.id === selectedId) {
          const order = [...next].sort((a, b) => a.position - b.position);
          setSelectedId(order[0]?.id ?? null);
        }
        return next;
      });
    }
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

  // Update a field in local state WITHOUT marking the card dirty — used after an
  // image write that already persisted, so it doesn't look like an unsaved edit.
  function setFieldSaved<K extends keyof LessonCardRow>(id: string, key: K, value: LessonCardRow[K]) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)));
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
      const { data: rows, error: dbErr } = await supabase.from("lesson_cards").update(patch).eq("id", card.id).select("id");
      if (dbErr) throw dbErr;
      if (!rows || rows.length === 0) throw new Error(t("admin_saveBlocked"));
      setFieldSaved(card.id, variant === "fr" ? "image_fr" : "image_en", url);
      setFlash({ ok: true, msg: t("admin_cardSaved") });
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : t("admin_saveError") });
    }
    setBusyId(null);
  }

  async function removeImage(card: LessonCardRow, variant: "fr" | "en") {
    setBusyId(card.id);
    try {
      await supabase.storage.from(BUCKET).remove([`${lessonId}/card-${card.id}-${variant}`]);
      const patch: Partial<LessonCardRow> = variant === "fr" ? { image_fr: null } : { image_en: null };
      const { data: rows, error: dbErr } = await supabase.from("lesson_cards").update(patch).eq("id", card.id).select("id");
      if (dbErr) throw dbErr;
      if (!rows || rows.length === 0) throw new Error(t("admin_saveBlocked"));
      setFieldSaved(card.id, variant === "fr" ? "image_fr" : "image_en", null);
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : t("admin_saveError") });
    }
    setBusyId(null);
  }

  if (loading) return null;

  const sorted = [...cards].sort((a, b) => a.position - b.position);
  const selected = sorted.find((c) => c.id === selectedId) ?? sorted[0] ?? null;
  const selectedIndex = selected ? sorted.findIndex((c) => c.id === selected.id) : -1;
  const busy = selected ? busyId === selected.id : false;

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

      {sorted.length === 0 ? (
        <>
          <div className="bg-ink-50 border border-ink-100 rounded-2xl px-4 py-5 text-[13px] text-muted mb-3">{t("admin_noCards")}</div>
          <AddCardButton onClick={addCard} label={t("admin_addCard")} />
        </>
      ) : (
        <div className="flex flex-col xl:flex-row gap-4 items-start">
          {/* ---- left rail: the deck, numbered, in reading order ---------- */}
          <nav
            aria-label={t("admin_cards")}
            className="w-full xl:w-[188px] xl:flex-none flex xl:flex-col gap-2.5 overflow-x-auto xl:overflow-x-visible xl:max-h-[70vh] xl:overflow-y-auto pb-1 xl:pb-0"
          >
            {sorted.map((card, i) => (
              <CardThumb
                key={card.id}
                card={card}
                index={i}
                total={sorted.length}
                active={card.id === selected?.id}
                dirty={dirty.has(card.id)}
                onSelect={() => setSelectedId(card.id)}
              />
            ))}
            <div className="flex-none xl:mt-1">
              <AddCardButton onClick={addCard} label={t("admin_addCard")} />
            </div>
          </nav>

          {/* ---- middle: the selected card's fields ----------------------- */}
          {selected && (
            <div className="flex-1 min-w-0 w-full bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="text-[12px] font-bold uppercase tracking-wide text-muted">
                    {t("admin_card")} {selectedIndex + 1}
                  </div>
                  {dirty.has(selected.id) && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{t("admin_unsaved")}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => move(selected, -1)} disabled={busy || selectedIndex === 0} className="p-1.5 rounded-lg border border-border text-ink-700 disabled:opacity-40" title={t("admin_moveUp")}>
                    <Icon name="chevleft" size={14} className="rotate-90" />
                  </button>
                  <button onClick={() => move(selected, 1)} disabled={busy || selectedIndex === sorted.length - 1} className="p-1.5 rounded-lg border border-border text-ink-700 disabled:opacity-40" title={t("admin_moveDown")}>
                    <Icon name="chevleft" size={14} className="-rotate-90" />
                  </button>
                  <button onClick={() => deleteCard(selected)} disabled={busy} className="p-1.5 rounded-lg border border-border text-danger-600 disabled:opacity-40" title={t("admin_deleteCard")}>
                    <Icon name="close" size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={t("admin_cardPointFr")} value={selected.point_fr} onChange={(v) => setField(selected.id, "point_fr", v)} />
                <Field label={t("admin_cardPointEn")} value={selected.point_en} onChange={(v) => setField(selected.id, "point_en", v)} />
                <Field label={t("admin_cardSubFr")} value={selected.sub_fr} onChange={(v) => setField(selected.id, "sub_fr", v)} />
                <Field label={t("admin_cardSubEn")} value={selected.sub_en} onChange={(v) => setField(selected.id, "sub_en", v)} />
                <Field label={t("admin_cardExplanationFr")} value={selected.explanation_fr} onChange={(v) => setField(selected.id, "explanation_fr", v)} area />
                <Field label={t("admin_cardExplanationEn")} value={selected.explanation_en} onChange={(v) => setField(selected.id, "explanation_en", v)} area />
                <Field label={t("admin_cardStructQFr")} value={selected.structural_question_fr} onChange={(v) => setField(selected.id, "structural_question_fr", v)} area />
                <Field label={t("admin_cardStructQEn")} value={selected.structural_question_en} onChange={(v) => setField(selected.id, "structural_question_en", v)} area />
                <Field label={t("admin_cardStructAFr")} value={selected.structural_answer_fr} onChange={(v) => setField(selected.id, "structural_answer_fr", v)} />
                <Field label={t("admin_cardStructAEn")} value={selected.structural_answer_en} onChange={(v) => setField(selected.id, "structural_answer_en", v)} />
                <Field label={t("admin_cardTipsFr")} value={selected.tips_fr} onChange={(v) => setField(selected.id, "tips_fr", v)} area />
                <Field label={t("admin_cardTipsEn")} value={selected.tips_en} onChange={(v) => setField(selected.id, "tips_en", v)} area />
                <Field label={t("admin_cardTrapsFr")} value={selected.traps_fr} onChange={(v) => setField(selected.id, "traps_fr", v)} area />
                <Field label={t("admin_cardTrapsEn")} value={selected.traps_en} onChange={(v) => setField(selected.id, "traps_en", v)} area />
              </div>

              {/* Dual per-language image pickers (Step 4) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <ImagePicker
                  label={t("admin_cardImageFr")}
                  url={selected.image_fr}
                  busy={busy}
                  onPick={() => fileInputs.current[`${selected.id}-fr`]?.click()}
                  onRemove={() => removeImage(selected, "fr")}
                  uploadLabel={t(selected.image_fr ? "admin_replace" : "admin_upload")}
                  removeLabel={t("admin_remove")}
                  inputRef={(el) => (fileInputs.current[`${selected.id}-fr`] = el)}
                  onFile={(f) => uploadImage(selected, "fr", f)}
                />
                <ImagePicker
                  label={t("admin_cardImageEn")}
                  url={selected.image_en}
                  busy={busy}
                  onPick={() => fileInputs.current[`${selected.id}-en`]?.click()}
                  onRemove={() => removeImage(selected, "en")}
                  uploadLabel={t(selected.image_en ? "admin_replace" : "admin_upload")}
                  removeLabel={t("admin_remove")}
                  inputRef={(el) => (fileInputs.current[`${selected.id}-en`] = el)}
                  onFile={(f) => uploadImage(selected, "en", f)}
                />
              </div>

              <div className="mt-3">
                <button onClick={() => saveCard(selected)} disabled={busy} className="border-none px-5 py-2.5 rounded-xl text-[13px] font-bold bg-brand-600 text-white disabled:opacity-60">
                  {busy ? t("admin_uploading") : dirty.has(selected.id) ? `${t("admin_saveCard")} •` : t("admin_saveCard")}
                </button>
              </div>
            </div>
          )}

          {/* ---- right: what the student will actually see ---------------- */}
          {selected && <PhonePreview card={selected} index={selectedIndex} total={sorted.length} />}
        </div>
      )}
    </div>
  );
});

function AddCardButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold border-[1.5px] border-brand-600/40 text-brand-600 bg-card whitespace-nowrap"
    >
      <Icon name="plus" size={15} />
      {label}
    </button>
  );
}

/**
 * One entry in the left rail: position badge, the card's image if it has one,
 * and the first line of its text — enough to recognise a card without opening
 * it, which is the whole point of the rail.
 */
function CardThumb({
  card,
  index,
  total,
  active,
  dirty,
  onSelect,
}: {
  card: LessonCardRow;
  index: number;
  total: number;
  active: boolean;
  dirty: boolean;
  onSelect: () => void;
}) {
  const image = card.image_fr ?? card.image_en;
  const title = card.point_fr || card.point_en;
  const sub = card.sub_fr || card.sub_en;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active}
      className={`relative flex-none w-[150px] xl:w-full text-left rounded-2xl border-2 p-2.5 transition-colors ${
        active ? "border-brand-500 bg-brand-50" : "border-border bg-card hover:border-brand-500/40"
      }`}
    >
      <span className="absolute -top-2 -right-2 min-w-[34px] px-1.5 h-[22px] rounded-pill bg-brand-500 text-white text-[10.5px] font-bold flex items-center justify-center">
        {index + 1} / {total}
      </span>
      {image ? (
        <img src={image} alt="" className="w-full aspect-[4/3] object-cover rounded-lg bg-ink-50 mb-2" />
      ) : (
        <div className="w-full aspect-[4/3] rounded-lg border border-dashed border-ink-300 bg-ink-50 mb-2 flex items-center justify-center text-ink-300">
          <Icon name="book" size={16} />
        </div>
      )}
      <div className="text-[11px] font-bold uppercase tracking-wide text-ink-900 line-clamp-2">{title || "—"}</div>
      {sub && <div className="text-[10.5px] text-muted mt-0.5 line-clamp-3 leading-snug">{sub}</div>}
      {dirty && <div className="mt-1 text-[9.5px] font-bold text-amber-700">•</div>}
    </button>
  );
}

/**
 * Live phone preview. Renders the card the way the student deck shows its front
 * face, in the admin's current interface language, so the person writing the
 * card sees the real line lengths instead of guessing from a textarea.
 */
function PhonePreview({ card, index, total }: { card: LessonCardRow; index: number; total: number }) {
  const { t, lang } = useI18n();
  const image = lang === "fr" ? card.image_fr ?? card.image_en : card.image_en ?? card.image_fr;
  const point = lang === "fr" ? card.point_fr || card.point_en : card.point_en || card.point_fr;
  const sub = lang === "fr" ? card.sub_fr || card.sub_en : card.sub_en || card.sub_fr;
  const progress = total > 0 ? ((index + 1) / total) * 100 : 0;

  return (
    <aside className="hidden xl:block xl:w-[292px] xl:flex-none">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted mb-2">{t("te_preview")}</div>
      <div className="rounded-[34px] border-[10px] border-ink-900 bg-ink-900 shadow-[0_18px_40px_-18px_rgba(15,30,60,0.55)]">
        <div className="rounded-[24px] bg-surface overflow-hidden flex flex-col h-[520px]">
          <div className="px-4 pt-4">
            <div className="h-1.5 rounded-pill bg-ink-100 overflow-hidden">
              <div className="h-full rounded-pill bg-brand-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
            {image && <img src={image} alt="" className="w-full rounded-xl bg-card mb-3.5 object-cover" />}
            <div className="text-[15px] font-bold text-ink-900 uppercase tracking-wide">{point || "—"}</div>
            {sub && <p className="text-[13px] text-ink-800 leading-relaxed mt-2">{sub}</p>}
          </div>
          <div className="px-4 pb-4">
            <div className="w-full rounded-xl bg-brand-500 text-white text-[13px] font-bold py-2.5 text-center">{t("lang_continue")}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Field({ label, value, onChange, area }: { label: string; value: string; onChange: (v: string) => void; area?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold text-muted">{label}</span>
      {area ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={5} className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 text-[12.5px] leading-relaxed resize-y min-h-[120px]" />
      ) : (
        // Even the "short" fields are textareas now so long pasted text is
        // fully visible without scrolling one line at a time (corrections doc
        // note 4: "des carrés moyens à la place des rectangles").
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="px-3 py-2 rounded-lg border-[1.5px] border-ink-300 text-[12.5px] leading-relaxed resize-y min-h-[60px]" />
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
