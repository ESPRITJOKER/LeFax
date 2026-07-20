import { useEffect, useState } from "react";
import { Icon } from "../../lib/icons";
import { Spinner, EmptyState } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { ContentApprovalRow } from "../../lib/database.types";

interface GeneratedQuestion {
  text_fr: string;
  text_en: string;
  options: { text_fr: string; text_en: string; is_correct: boolean }[];
  source?: string;
}

export default function AdminAiReview() {
  const { t, lang } = useI18n();
  const [queue, setQueue] = useState<ContentApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.from("content_approval").select("*").eq("status", "pending").order("created_at");
    setQueue(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(row: ContentApprovalRow) {
    setBusyId(row.id);
    try {
      const { error } = await supabase.functions.invoke("ai-content", { body: { action: "approve", content_approval_id: row.id } });
      if (error) throw error;
      await load();
    } catch {
      // Backend not reachable yet.
    }
    setBusyId(null);
  }

  async function reject(row: ContentApprovalRow) {
    setBusyId(row.id);
    await supabase.from("content_approval").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", row.id);
    await load();
    setBusyId(null);
  }

  function startModify(row: ContentApprovalRow) {
    const q = row.generated_payload as unknown as GeneratedQuestion;
    setEditingId(row.id);
    setDraft(lang === "fr" ? q.text_fr : q.text_en);
  }

  async function saveModify(row: ContentApprovalRow) {
    const q = row.generated_payload as unknown as GeneratedQuestion;
    const field = lang === "fr" ? "text_fr" : "text_en";
    const nextPayload = { ...q, [field]: draft };
    await supabase.from("content_approval").update({ generated_payload: nextPayload, status: "modified" }).eq("id", row.id);
    setEditingId(null);
    await load();
  }

  return (
    <div>
      <div className="bg-ink-50 border border-ink-100 rounded-2xl px-4.5 px-[18px] py-4 mb-4.5 mb-[18px] flex items-center gap-3">
        <Icon name="wand" size={22} className="text-ink-700" />
        <div className="text-xs text-ink-800 leading-relaxed">{t("admin_aiExplain")}</div>
      </div>

      <div className="flex flex-col gap-3">
        {loading ? (
          <Spinner />
        ) : queue.length === 0 ? (
          <EmptyState label={isSupabaseConfigured ? t("admin_queueEmpty") : t("backend_banner")} />
        ) : (
          queue.map((row) => {
            const q = row.generated_payload as unknown as GeneratedQuestion;
            const editing = editingId === row.id;
            return (
              <div key={row.id} className="bg-white border border-border rounded-2xl p-4.5 p-[18px]">
                <div className="text-[11.5px] font-bold text-muted mb-1.5">{q.source ?? row.lesson_id}</div>
                {editing ? (
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="w-full box-border p-2.5 rounded-lg border-[1.5px] border-ink-300 text-[13px] mb-3 min-h-[60px]" />
                ) : (
                  <div className="text-sm font-bold text-ink-900 mb-3">{lang === "fr" ? q.text_fr : q.text_en}</div>
                )}
                <div className="flex flex-col gap-1.5 mb-3.5">
                  {(q.options ?? []).map((o, i) => (
                    <div key={i} className={`flex items-center gap-2 text-xs ${o.is_correct ? "text-success-600 font-semibold" : "text-ink-800"}`}>
                      <span className={`w-4 h-4 rounded-full border-[1.5px] flex-none ${o.is_correct ? "bg-success-600 border-success-600" : "border-border bg-white"}`} />
                      {lang === "fr" ? o.text_fr : o.text_en}
                    </div>
                  ))}
                </div>
                {editing ? (
                  <div className="flex gap-2">
                    <button onClick={() => saveModify(row)} className="flex-1 py-2 rounded-lg border-none bg-ink-700 text-white text-xs font-bold">
                      {t("admin_save")}
                    </button>
                    <button onClick={() => setEditingId(null)} className="flex-1 py-2 rounded-lg border border-border bg-white text-xs font-bold text-ink-900">
                      {t("admin_cancel")}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button disabled={busyId === row.id} onClick={() => approve(row)} className="flex-1 py-2 rounded-lg border-none bg-success-600 text-white text-xs font-bold">
                      {t("admin_approve")}
                    </button>
                    <button disabled={busyId === row.id} onClick={() => startModify(row)} className="flex-1 py-2 rounded-lg border border-border bg-white text-xs font-bold text-ink-900">
                      {t("admin_modify")}
                    </button>
                    <button disabled={busyId === row.id} onClick={() => reject(row)} className="flex-1 py-2 rounded-lg border-none bg-danger-600 text-white text-xs font-bold">
                      {t("admin_reject")}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
