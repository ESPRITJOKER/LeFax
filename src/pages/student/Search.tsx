import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BottomTabs } from "../../components/BottomTabs";
import { TopBar } from "../../components/TopBar";
import { Drawer } from "../../components/Drawer";
import { EmptyState, Spinner } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";

type ResultType = "subject" | "chapter" | "lesson";
type FilterKey = "all" | ResultType;

interface Result {
  type: ResultType;
  id: string;
  label: string;
  navigateTo: string;
}

export default function Search() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(false);
  const [drawer, setDrawer] = useState(false);

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
      supabase.from("lessons").select("id, title_fr, title_en").eq("published", true).ilike(titleField, `%${q}%`),
    ]);

    const built: Result[] = [
      ...(subjects ?? []).map((s) => ({ type: "subject" as const, id: s.id, label: lang === "fr" ? s.name_fr : s.name_en, navigateTo: `/subjects/${s.slug}` })),
      ...(chapters ?? []).map((c) => ({ type: "chapter" as const, id: c.id, label: lang === "fr" ? c.name_fr : c.name_en, navigateTo: `/lessons/${c.id}` })),
      ...(lessons ?? []).map((l) => ({ type: "lesson" as const, id: l.id, label: lang === "fr" ? l.title_fr : l.title_en, navigateTo: `/lesson/${l.id}` })),
    ];
    setResults(built);
    setLoading(false);
  }

  const FILTERS: { key: FilterKey; fr: string; en: string }[] = [
    { key: "all", fr: "Tout", en: "All" },
    { key: "subject", fr: "Matières", en: "Subjects" },
    { key: "chapter", fr: "Chapitres", en: "Chapters" },
    { key: "lesson", fr: "Leçons", en: "Lessons" },
  ];
  const TYPE_LABEL: Record<ResultType, { fr: string; en: string }> = {
    subject: { fr: "Matière", en: "Subject" },
    chapter: { fr: "Chapitre", en: "Chapter" },
    lesson: { fr: "Leçon", en: "Lesson" },
  };
  const shown = results.filter((r) => filter === "all" || r.type === filter);
  const initial = (profile?.first_name?.[0] ?? "?").toUpperCase();

  return (
    <PhoneFrame>
      <div className="flex-1 min-h-0 flex flex-col">
        <TopBar
          variant="menu"
          coins={profile?.faxcoins ?? 0}
          initial={initial}
          onMenu={() => setDrawer(true)}
          onCoins={() => navigate("/shop")}
          onAvatar={() => navigate("/profile")}
        />

        <div className="flex-1 min-h-0 overflow-auto px-5 pt-4 pb-[90px]">
          <h2 className="font-serif font-bold text-[18px] text-ink-900 mb-3.5">
            {lang === "fr" ? "Que souhaites-tu apprendre aujourd'hui ?" : "What would you like to learn today?"}
          </h2>
          <div className="flex items-center gap-2.5 bg-card rounded-[10px] px-3.5 py-3 mb-3.5 shadow-[0_2px_8px_rgba(20,30,60,0.05)]">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="#94a3b8" strokeWidth="1.8" />
              <path d="M21 21l-4-4" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => runSearch(e.target.value)}
              placeholder={lang === "fr" ? "Rechercher une leçon, un chapitre..." : "Search a lesson, chapter..."}
              className="border-none outline-none flex-1 text-[13.5px] bg-transparent"
            />
          </div>

          <div className="flex gap-2 overflow-auto mb-4">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="px-3.5 py-2 rounded-pill text-[12.5px] font-semibold whitespace-nowrap border"
                  style={{
                    background: active ? "#2f9bf0" : "#fff",
                    color: active ? "#fff" : "#334155",
                    borderColor: active ? "#2f9bf0" : "#e2e8f0",
                  }}
                >
                  {lang === "fr" ? f.fr : f.en}
                </button>
              );
            })}
          </div>

          {loading ? (
            <Spinner />
          ) : !query ? (
            <div className="text-center text-muted text-[13px] py-10">
              {lang === "fr" ? "Recherche une leçon, un chapitre ou une matière" : "Search a lesson, chapter or subject"}
            </div>
          ) : shown.length === 0 ? (
            <EmptyState label={isSupabaseConfigured ? (lang === "fr" ? "Aucun résultat" : "No results") : "Backend not configured"} />
          ) : (
            shown.map((r) => (
              <div
                key={`${r.type}-${r.id}`}
                onClick={() => navigate(r.navigateTo)}
                className="bg-card rounded-[12px] px-4 py-3.5 mb-2.5 shadow-[0_2px_8px_rgba(20,30,60,0.05)] cursor-pointer"
              >
                <div className="inline-block bg-brand-100 text-brand-700 text-[10.5px] font-bold px-2.5 py-[3px] rounded-md mb-2">
                  {lang === "fr" ? TYPE_LABEL[r.type].fr : TYPE_LABEL[r.type].en}
                </div>
                <div className="text-[13.5px] text-ink-900 leading-[1.5]">{r.label}</div>
              </div>
            ))
          )}
        </div>

        <BottomTabs active="questions" />
        <Drawer open={drawer} onClose={() => setDrawer(false)} />
      </div>
    </PhoneFrame>
  );
}
