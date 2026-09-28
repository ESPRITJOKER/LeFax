import { useCallback, useEffect, useMemo, useState } from "react";
import { Spinner, Select } from "../../components/ui";
import { StateNotice } from "../../components/StateNotice";
import { Icon } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import type { AdminLogRow } from "../../lib/database.types";

/**
 * Journal d'audit (CDC 6.9).
 *
 * What was wrong before (reported as "the audit should be fixed", with a
 * screenshot showing "Une erreur est survenue"): the page ran
 * `const { data } = await supabase.from("admin_logs")…`, threw the `error`
 * away, and then rendered the *error* string whenever the list came back
 * empty. So "nothing has happened yet", "the request failed" and "RLS refused
 * you" were one indistinguishable message — and the most likely of the three
 * (an empty journal) was reported as a failure.
 *
 * This version keeps the three apart: `StateNotice` shows the real Postgres
 * message on failure, a distinct line when the journal is genuinely empty, and
 * another when filters exclude everything. A 42501 / permission error is named
 * as a permission problem rather than a generic crash.
 *
 * The journal stays strictly read-only here. Rows are written server-side only
 * — `functions/admin`, `functions/teacher`, `functions/ai-content`,
 * `functions/profile` and the `teacher_subjects` / `academic_terms` audit
 * triggers — and no policy grants update or delete to anyone, so there is
 * deliberately no edit affordance in this UI.
 */

const PAGE_SIZE = 25;
/** How far back the "since" filter looks, in days. 0 = no lower bound. */
const RANGES = [0, 1, 7, 30] as const;

type ActorRef = { first_name: string | null; last_name: string | null; role: string | null };
type LogRow = AdminLogRow & { actor: ActorRef | null };

export default function AdminLogs() {
  const { t, lang } = useI18n();

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [table, setTable] = useState("");
  const [days, setDays] = useState<number>(0);

  // Option lists for the two dropdowns. Derived from a bounded recent slice
  // rather than a DISTINCT over the whole journal: the point is to make the
  // common values one click away, not to enumerate history exhaustively.
  const [options, setOptions] = useState<{ actions: string[]; tables: string[] }>({ actions: [], tables: [] });

  const filtered = search.trim() !== "" || action !== "" || table !== "" || days !== 0;

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setForbidden(false);

    let query = supabase
      .from("admin_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (action) query = query.eq("action", action);
    if (table) query = query.eq("target_table", table);
    if (days > 0) query = query.gte("created_at", new Date(Date.now() - days * 86_400_000).toISOString());
    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`action.ilike.${term},target_table.ilike.${term}`);
    }

    const { data, error: err, count } = await query;

    if (err) {
      // 42501 is Postgres' insufficient_privilege; PostgREST also answers PGRST301
      // when no policy admits the row. Either way this is "not allowed", not "broken".
      const denied = err.code === "42501" || err.code === "PGRST301" || /permission|policy/i.test(err.message);
      setForbidden(denied);
      setError(denied ? t("au_forbidden") : err.message);
      setLogs([]);
      setTotal(0);
    } else {
      // Actors are resolved in a second query rather than as a PostgREST embed:
      // the hand-written Database types carry no relationship metadata, and one
      // extra round-trip per page of 25 is cheaper than a cast that would lie
      // about the shape. `profiles_select_own` lets an admin read every row, so
      // a missing profile here means the account was genuinely deleted.
      const rows = data ?? [];
      const ids = [...new Set(rows.map((r) => r.actor_id).filter((v): v is string => !!v))];
      let actors: Record<string, ActorRef> = {};
      if (ids.length > 0) {
        const { data: people } = await supabase.from("profiles").select("id, first_name, last_name, role").in("id", ids);
        actors = Object.fromEntries((people ?? []).map((pr) => [pr.id, { first_name: pr.first_name, last_name: pr.last_name, role: pr.role }]));
      }
      setLogs(rows.map((r) => ({ ...r, actor: r.actor_id ? actors[r.actor_id] ?? null : null })));
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [page, action, table, days, search, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Filter vocabulary, loaded once.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    (async () => {
      const { data } = await supabase
        .from("admin_logs")
        .select("action, target_table")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!data) return;
      setOptions({
        actions: [...new Set(data.map((d) => d.action).filter(Boolean))].sort(),
        tables: [...new Set(data.map((d) => d.target_table).filter((v): v is string => !!v))].sort(),
      });
    })();
  }, []);

  // Any filter change restarts at the first page — otherwise a narrower result
  // set leaves you stranded on a page that no longer exists.
  useEffect(() => {
    setPage(0);
  }, [search, action, table, days]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [lang]
  );

  function actorName(row: LogRow) {
    if (!row.actor_id) return t("au_system");
    if (!row.actor) return t("au_deletedUser");
    return [row.actor.first_name, row.actor.last_name].filter(Boolean).join(" ") || t("au_deletedUser");
  }

  function clearFilters() {
    setSearch("");
    setAction("");
    setTable("");
    setDays(0);
  }

  const inputClass =
    "px-3 py-2 rounded-lg border border-border bg-card text-[13px] text-ink-900 outline-none focus:border-brand-500";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif font-bold text-lg text-ink-950">{t("au_title")}</h2>
          <p className="text-[12.5px] text-muted mt-1 max-w-[62ch]">{t("au_hint")}</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-pill bg-ink-100 px-3 py-1.5 text-[11px] font-bold text-ink-700">
          <Icon name="shield" size={13} />
          {t("au_readonly")}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex-1 min-w-[200px] relative">
          <span className="sr-only">{t("au_search")}</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("au_search")}
            className={`${inputClass} w-full`}
          />
        </label>
        <Select value={action} onChange={(e) => setAction(e.target.value)} className={inputClass} aria-label={t("au_action")}>
          <option value="">{t("au_allActions")}</option>
          {options.actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <Select value={table} onChange={(e) => setTable(e.target.value)} className={inputClass} aria-label={t("au_target")}>
          <option value="">{t("au_allTables")}</option>
          {options.tables.map((tb) => (
            <option key={tb} value={tb}>
              {tb}
            </option>
          ))}
        </Select>
        <Select
          value={String(days)}
          onChange={(e) => setDays(Number(e.target.value))}
          className={inputClass}
          aria-label={t("au_date")}
        >
          {RANGES.map((d) => (
            <option key={d} value={d}>
              {d === 0 ? (lang === "fr" ? "Tout" : "All time") : lang === "fr" ? `${d} derniers jours` : `Last ${d} days`}
            </option>
          ))}
        </Select>
        {filtered && (
          <button onClick={clearFilters} className="px-3 py-2 rounded-lg border border-border bg-card text-[12.5px] font-bold text-ink-900">
            {t("au_clearFilters")}
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <Spinner />
        ) : error || logs.length === 0 ? (
          <div className="p-4">
            <StateNotice
              error={error}
              errorLabel={forbidden ? t("au_forbidden") : t("au_error")}
              emptyLabel={filtered ? t("au_emptyFiltered") : t("au_empty")}
              onRetry={forbidden ? undefined : () => void load()}
            />
          </div>
        ) : (
          <>
            {/* Desktop: a real table. */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse min-w-[720px]">
                <thead>
                  <tr className="text-left border-b border-border bg-ink-50">
                    <th className="px-4 py-3 text-[11.5px] text-muted font-bold">{t("au_date")}</th>
                    <th className="px-4 py-3 text-[11.5px] text-muted font-bold">{t("au_actor")}</th>
                    <th className="px-4 py-3 text-[11.5px] text-muted font-bold">{t("au_action")}</th>
                    <th className="px-4 py-3 text-[11.5px] text-muted font-bold">{t("au_target")}</th>
                    <th className="px-4 py-3 text-[11.5px] text-muted font-bold">{t("au_details")}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b border-ink-100 last:border-b-0 align-top">
                      <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                        <time dateTime={l.created_at}>{dateFormat.format(new Date(l.created_at))}</time>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-800">
                        <div className="font-semibold text-ink-900">{actorName(l)}</div>
                        {l.actor?.role && <div className="text-[11px] text-muted">{l.actor.role}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12.5px] font-semibold text-ink-900 break-words">{l.action}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-800">
                        <div>{l.target_table ?? "—"}</div>
                        {l.target_id && <div className="text-[10.5px] text-muted font-mono break-all">{l.target_id}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <MetadataCell metadata={l.metadata} label={t("au_details")} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: the same records as stacked cards — a 5-column table on a
                phone is either unreadable or a horizontal-scroll trap. */}
            <ul className="md:hidden divide-y divide-ink-100">
              {logs.map((l) => (
                <li key={l.id} className="p-4 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-bold text-ink-900 break-words">{l.action}</span>
                    <time dateTime={l.created_at} className="text-[11px] text-muted whitespace-nowrap">
                      {dateFormat.format(new Date(l.created_at))}
                    </time>
                  </div>
                  <div className="text-[12px] text-ink-800">
                    {actorName(l)}
                    {l.actor?.role ? ` · ${l.actor.role}` : ""}
                  </div>
                  {l.target_table && (
                    <div className="text-[11.5px] text-muted">
                      {l.target_table}
                      {l.target_id ? ` · ${l.target_id.slice(0, 8)}…` : ""}
                    </div>
                  )}
                  <MetadataCell metadata={l.metadata} label={t("au_details")} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {!loading && !error && total > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[12px] text-muted">
            {total} {t("au_count")} · {t("au_page")} {page + 1}/{pageCount}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3.5 py-2 rounded-lg border border-border bg-card text-[12.5px] font-bold text-ink-900 disabled:opacity-40"
            >
              {t("au_prev")}
            </button>
            <button
              onClick={() => setPage((p) => (p + 1 < pageCount ? p + 1 : p))}
              disabled={page + 1 >= pageCount}
              className="px-3.5 py-2 rounded-lg border border-border bg-card text-[12.5px] font-bold text-ink-900 disabled:opacity-40"
            >
              {t("au_next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** `metadata` is free-form jsonb; show nothing rather than an empty `{}`. */
function MetadataCell({ metadata, label }: { metadata: Record<string, unknown>; label: string }) {
  const entries = Object.entries(metadata ?? {});
  if (entries.length === 0) return <span className="text-muted">—</span>;
  return (
    <details className="group">
      <summary className="cursor-pointer text-[11.5px] font-semibold text-brand-600 list-none">{label}</summary>
      <dl className="mt-1.5 flex flex-col gap-0.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-1.5 text-[11px]">
            <dt className="text-muted">{k}</dt>
            <dd className="text-ink-800 font-medium break-all">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
