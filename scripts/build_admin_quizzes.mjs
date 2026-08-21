// Build quizzes for admin-created lessons from scripts/quiz_bank_admin_content.json.
//
//   node scripts/build_admin_quizzes.mjs --emit-migration   # write supabase/migrations/0016_*.sql only
//   node scripts/build_admin_quizzes.mjs --apply             # apply to the live DB via service_role REST (idempotent)
//   node scripts/build_admin_quizzes.mjs --check             # validate the JSON only
//
// Idempotent: per lesson it finds-or-creates the quiz, then inserts only the
// questions whose text_fr is not already present in that quiz (so re-runs and
// hand-edited quizzes are safe).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BANK = JSON.parse(fs.readFileSync(path.join(__dirname, "quiz_bank_admin_content.json"), "utf8"));

function readEnv(key) {
  const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const m = env.match(new RegExp("^" + key + "=(.*)$", "m"));
  return m ? m[1].trim().replace(/^"|"$/g, "") : null;
}

function validate() {
  let q = 0, c = 0;
  const errs = [];
  for (const l of BANK.lessons) {
    if (!l.lid) errs.push("lesson missing lid: " + l.source);
    for (const qn of l.questions) {
      q++;
      const correct = qn.options.filter((o) => o.is_correct).length;
      if (qn.options.length !== 4) errs.push(`${l.source} :: "${qn.text_fr}" has ${qn.options.length} options`);
      if (correct !== 1) errs.push(`${l.source} :: "${qn.text_fr}" has ${correct} correct`);
      if (!["easy", "medium", "hard"].includes(qn.difficulty)) errs.push(`${l.source} :: bad difficulty ${qn.difficulty}`);
      for (const o of qn.options) { c++; if (!o.text_fr || !o.text_en) errs.push(`${l.source} :: empty option`); }
      if (!qn.text_en || !qn.explanation_en) errs.push(`${l.source} :: "${qn.text_fr}" missing EN`);
    }
  }
  return { lessons: BANK.lessons.length, questions: q, choices: c, errs };
}

async function apply() {
  const BASE = readEnv("VITE_SUPABASE_URL") || readEnv("SUPABASE_URL");
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!BASE || !KEY) throw new Error("Need VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (env or .env.local)");
  const h = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", Prefer: "return=representation" };
  const rest = (p, init = {}) => fetch(`${BASE}/rest/v1/${p}`, { ...init, headers: { ...h, ...(init.headers || {}) } });

  let inserted = 0, skipped = 0;
  for (const l of BANK.lessons) {
    // find-or-create the lesson's quiz
    let quiz = await (await rest(`quizzes?select=id&lesson_id=eq.${l.lid}`)).json();
    let quizId = quiz[0]?.id;
    if (!quizId) {
      const les = await (await rest(`lessons?select=title_fr,title_en&id=eq.${l.lid}`)).json();
      if (!les[0]) { console.warn(`! lesson ${l.lid} not found (${l.source}) — skipping`); continue; }
      const created = await (await rest(`quizzes`, {
        method: "POST",
        body: JSON.stringify({ lesson_id: l.lid, title_fr: `Test — ${les[0].title_fr}`, title_en: `Test — ${les[0].title_en || les[0].title_fr}` }),
      })).json();
      quizId = created[0].id;
    }
    const existing = await (await rest(`questions?select=text_fr,position&quiz_id=eq.${quizId}`)).json();
    const seen = new Set(existing.map((x) => x.text_fr));
    let pos = existing.reduce((m, x) => Math.max(m, x.position + 1), 0);
    for (const qn of l.questions) {
      if (seen.has(qn.text_fr)) { skipped++; continue; }
      const qrow = await (await rest(`questions`, {
        method: "POST",
        body: JSON.stringify({
          quiz_id: quizId, text_fr: qn.text_fr, text_en: qn.text_en,
          explanation_fr: qn.explanation_fr || "", explanation_en: qn.explanation_en || "",
          difficulty: qn.difficulty, ai_generated: false, position: pos++,
        }),
      })).json();
      const qid = qrow[0].id;
      const choices = qn.options.map((o, i) => ({ question_id: qid, text_fr: o.text_fr, text_en: o.text_en, is_correct: !!o.is_correct, position: i }));
      await rest(`choices`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(choices) });
      inserted++;
    }
  }
  console.log(`Applied. Questions inserted: ${inserted}, skipped (already present): ${skipped}`);
}

function emitMigration() {
  const json = JSON.stringify(BANK.lessons);
  const sql = `-- 0016: Build QCM banks for the admin-authored Biologie lessons.
--
-- These lessons were created in-app by the admin and carry no questions yet.
-- This migration find-or-creates each lesson's quiz and appends the curated
-- bilingual MCQs (4 options, 1 correct) authored from the lesson cards, so the
-- questions surface in each chapter's Niv 1/2/3 practice (ChapterPractice
-- aggregates quizzes -> questions across a chapter's published lessons).
--
-- Source of truth: scripts/quiz_bank_admin_content.json (regenerate this file
-- with: node scripts/build_admin_quizzes.mjs --emit-migration). Keyed by lesson
-- id, so on a fresh db reset (where these in-app lessons do not exist) it
-- no-ops. Idempotent: a question is inserted only if its text_fr is not already
-- present in that lesson's quiz.

do $$
declare
  bank jsonb := $j$${json}$j$::jsonb;
  les jsonb;
  qn jsonb;
  opt jsonb;
  v_lesson_id uuid;
  v_quiz_id uuid;
  v_question_id uuid;
  v_pos int;
  c_pos int;
begin
  for les in select value from jsonb_array_elements(bank)
  loop
    v_lesson_id := (les->>'lid')::uuid;
    -- Skip lessons that do not exist in this database (e.g. fresh reset).
    if not exists (select 1 from public.lessons where id = v_lesson_id) then
      continue;
    end if;

    select q.id into v_quiz_id from public.quizzes q where q.lesson_id = v_lesson_id limit 1;
    if v_quiz_id is null then
      insert into public.quizzes (lesson_id, title_fr, title_en)
      select v_lesson_id, 'Test — ' || l.title_fr, 'Test — ' || coalesce(nullif(l.title_en, ''), l.title_fr)
      from public.lessons l where l.id = v_lesson_id
      returning id into v_quiz_id;
    end if;

    for qn in select value from jsonb_array_elements(les->'questions')
    loop
      -- Idempotency: don't duplicate a question already present in this quiz.
      if exists (select 1 from public.questions where quiz_id = v_quiz_id and text_fr = qn->>'text_fr') then
        continue;
      end if;
      select coalesce(max(position) + 1, 0) into v_pos from public.questions where quiz_id = v_quiz_id;

      insert into public.questions (quiz_id, text_fr, text_en, explanation_fr, explanation_en, difficulty, ai_generated, position)
      values (
        v_quiz_id,
        qn->>'text_fr', qn->>'text_en',
        coalesce(qn->>'explanation_fr', ''), coalesce(qn->>'explanation_en', ''),
        coalesce((qn->>'difficulty')::difficulty_level, 'medium'),
        false, v_pos
      )
      returning id into v_question_id;

      c_pos := 0;
      for opt in select value from jsonb_array_elements(qn->'options')
      loop
        insert into public.choices (question_id, text_fr, text_en, is_correct, position)
        values (v_question_id, opt->>'text_fr', opt->>'text_en', coalesce((opt->>'is_correct')::boolean, false), c_pos);
        c_pos := c_pos + 1;
      end loop;
    end loop;
  end loop;
end $$;
`;
  const out = path.join(ROOT, "supabase", "migrations", "0016_build_admin_quizzes.sql");
  fs.writeFileSync(out, sql);
  console.log("Wrote " + path.relative(ROOT, out));
}

const mode = process.argv[2] || "--check";
const report = validate();
console.log(`Bank: ${report.lessons} lessons, ${report.questions} questions, ${report.choices} choices.`);
if (report.errs.length) { console.error("VALIDATION ERRORS:\n  " + report.errs.join("\n  ")); process.exit(1); }
console.log("Validation OK.");
if (mode === "--emit-migration") emitMigration();
else if (mode === "--apply") await apply();
