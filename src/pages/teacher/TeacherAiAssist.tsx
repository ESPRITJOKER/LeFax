import { useEffect, useState } from "react";
import { Button, Spinner, EmptyState } from "../../components/ui";
import { Icon } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { LessonRow } from "../../lib/database.types";

interface GeneratedQuestion {
  text_fr: string;
  text_en: string;
  options: { text_fr: string; text_en: string; is_correct: boolean }[];
  explanation_fr?: string;
  explanation_en?: string;
}

export default function TeacherAiAssist() {
  const { t, lang } = useI18n();
  const { profile } = useAuth();

  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [lessonId, setLessonId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<GeneratedQuestion[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !profile) return;
    supabase
      .from("lessons")
      .select("*")
      .eq("author_id", profile.id)
      .then(({ data }) => {
        setLessons(data ?? []);
        if (data && data.length) setLessonId(data[0].id);
      });
  }, [profile]);

  async function generate() {
    if (!lessonId) return;
    setGenerating(true);
    setMessage(null);
    try {
      let mediaId: string | null = null;
      if (file && profile) {
        const path = `teacher/${profile.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from("lesson-sources").upload(path, file);
        if (uploadError) throw uploadError;
        const { data: mediaRow } = await supabase
          .from("media_library")
          .insert({ storage_path: path, file_name: file.name, mime_type: file.type, uploaded_by: profile.id, lesson_id: lessonId })
          .select()
          .single();
        mediaId = mediaRow?.id ?? null;
      }

      const { data, error } = await supabase.functions.invoke("ai-content", {
        body: { action: "generate", lesson_id: lessonId, media_id: mediaId },
      });
      if (error) throw error;
      setDraft((data?.questions as GeneratedQuestion[]) ?? []);
    } catch {
      setMessage(t("backend_banner"));
    }
    setGenerating(false);
  }

  async function submitForApproval() {
    if (!profile || draft.length === 0) return;
    const rows = draft.map((q) => ({
      submitted_by: profile.id,
      lesson_id: lessonId,
      generated_payload: q as unknown as Record<string, unknown>,
      status: "pending" as const,
    }));
    const { error } = await supabase.from("content_approval").insert(rows);
    if (error) {
      setMessage(t("common_error"));
      return;
    }
    setDraft([]);
    setMessage(lang === "fr" ? "Envoyé pour approbation admin." : "Submitted for admin approval.");
  }

  return (
    <div>
      <div className="bg-white border border-border rounded-2xl p-5 mb-5">
        <div className="text-[13.5px] font-bold text-ink-900 mb-3.5">{t("teacher_uploadSource")}</div>
        <div className="flex flex-col gap-3">
          <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} className="px-3 py-2.5 rounded-lg border-[1.5px] border-border text-[13px] bg-white">
            {lessons.length === 0 && <option value="">{lang === "fr" ? "Aucune leçon" : "No lesson"}</option>}
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {lang === "fr" ? l.title_fr : l.title_en}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2.5 px-3 py-3 rounded-lg border-[1.5px] border-dashed border-border cursor-pointer">
            <Icon name="upload" size={18} className="text-ink-700" />
            <span className="text-xs text-ink-800">{file ? file.name : t("teacher_uploadSource")}</span>
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} accept=".pdf,.doc,.docx,.md,.txt,.ppt,.pptx" />
          </label>
        </div>
        <Button onClick={generate} disabled={generating || !lessonId} className="mt-3.5">
          {t("teacher_generate")}
        </Button>
        {message && <div className="mt-2.5 text-xs font-semibold text-ink-800">{message}</div>}
      </div>

      {generating && <Spinner />}

      {draft.length > 0 && (
        <div className="flex flex-col gap-3 mb-4">
          {draft.map((q, qi) => (
            <div key={qi} className="bg-white border border-border rounded-2xl p-4.5 p-[18px]">
              <input
                value={lang === "fr" ? q.text_fr : q.text_en}
                onChange={(e) =>
                  setDraft((prev) => prev.map((p, i) => (i === qi ? { ...p, [lang === "fr" ? "text_fr" : "text_en"]: e.target.value } : p)))
                }
                className="w-full px-2.5 py-2 rounded-lg border-[1.5px] border-border text-[13px] font-bold mb-3"
              />
              <div className="flex flex-col gap-1.5">
                {q.options.map((o, oi) => (
                  <label key={oi} className={`flex items-center gap-2 text-xs ${o.is_correct ? "text-success-600 font-semibold" : "text-ink-800"}`}>
                    <input
                      type="radio"
                      checked={o.is_correct}
                      onChange={() =>
                        setDraft((prev) =>
                          prev.map((p, i) => (i === qi ? { ...p, options: p.options.map((op, j) => ({ ...op, is_correct: j === oi })) } : p))
                        )
                      }
                    />
                    <input
                      value={lang === "fr" ? o.text_fr : o.text_en}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev.map((p, i) =>
                            i === qi
                              ? { ...p, options: p.options.map((op, j) => (j === oi ? { ...op, [lang === "fr" ? "text_fr" : "text_en"]: e.target.value } : op)) }
                              : p
                          )
                        )
                      }
                      className="flex-1 px-2 py-1 rounded border border-border text-xs"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <Button onClick={submitForApproval}>{t("teacher_submitForApproval")}</Button>
        </div>
      )}

      {!generating && draft.length === 0 && <EmptyState label={lang === "fr" ? "Aucune question générée pour le moment" : "No generated questions yet"} />}
    </div>
  );
}
