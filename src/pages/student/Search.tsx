import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Icon } from "../../lib/icons";
import { EmptyState, Spinner } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";

interface Result {
  type: "subject" | "chapter" | "lesson";
  id: string;
  label: string;
  navigateTo: string;
}

export default function Search() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  async function runSearch(q: string) {
    setQuery(q);
    if (!q.trim() || !isSupabaseConfigured) {
      setResults([]);
      return;
    }
    setLoading(true);
    const nameField = lang === "fr" ? "name_fr" : "name_en";
    const titleField = lang === "fr" ? "title_fr" : "title_en";

    const [{ data: subjects }, { data: chapters }, { data: lessons }] = await Promise.all([
      supabase.from("subjects").select("id, slug, name_fr, name_en").ilike(nameField, `%${q}%`),
      supabase.from("chapters").select("id, name_fr, name_en").ilike(nameField, `%${q}%`),
      supabase.from("lessons").select("id, title_fr, title_en").ilike(titleField, `%${q}%`),
    ]);

    const built: Result[] = [
      ...(subjects ?? []).map((s) => ({ type: "subject" as const, id: s.id, label: lang === "fr" ? s.name_fr : s.name_en, navigateTo: `/subjects/${s.slug}` })),
      ...(chapters ?? []).map((c) => ({ type: "chapter" as const, id: c.id, label: lang === "fr" ? c.name_fr : c.name_en, navigateTo: `/lessons/${c.id}` })),
      ...(lessons ?? []).map((l) => ({ type: "lesson" as const, id: l.id, label: lang === "fr" ? l.title_fr : l.title_en, navigateTo: `/lesson/${l.id}` })),
    ];
    setResults(built);
    setLoading(false);
  }

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col overflow-y-auto">
        <ScreenHeader title={t("search_title")} />
        <div className="px-[22px] pt-3.5 pb-2">
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border-[1.5px] border-border">
            <Icon name="search" size={16} className="text-muted" />
            <input
              value={query}
              onChange={(e) => runSearch(e.target.value)}
              placeholder={t("search_placeholder")}
              className="flex-1 outline-none border-none text-sm text-ink-950"
            />
          </div>
        </div>
        <div className="px-[22px] pt-2 pb-6 flex flex-col gap-2">
          {loading ? (
            <Spinner />
          ) : !query ? null : results.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? t("search_empty") : t("backend_banner")} />
          ) : (
            results.map((r) => (
              <div
                key={`${r.type}-${r.id}`}
                onClick={() => navigate(r.navigateTo)}
                className="cursor-pointer flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-ink-50"
              >
                <Icon name={r.type === "subject" ? "book" : r.type === "chapter" ? "clipboard" : "check"} size={16} className="text-ink-700" />
                <span className="text-sm font-semibold text-ink-900">{r.label}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}
