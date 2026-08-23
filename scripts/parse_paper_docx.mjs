// Parse the "BIOLOGIE 2015" exam-paper .docx into a QCM bank and (optionally)
// emit a migration that seeds it as a standalone, purchasable "sujet".
//
// Source .docx format (one exam paper, no NIVEAU grouping):
//   <n> <question stem ...?>            <- paragraph starts with the question number
//   a. <opt> b. <opt> c. <opt> ...      <- the 5 options; the CORRECT one is BOLD
//   Explication : <text>
// The correct option is detected from bold runs (its letter prefix).
//
// Usage:
//   node scripts/parse_paper_docx.mjs "<abs path to .docx>"                 # parse + print review table
//   node scripts/parse_paper_docx.mjs "<path>" --out scripts/qcm_source/biologie_2015.json
//   node scripts/parse_paper_docx.mjs "<path>" --emit-migration            # write supabase/migrations/0017_*.sql
//
// A paper = a standalone quizzes row (lesson_id null, mock_exam_id null) that a
// past_paper shop_items row points at via reference_id. Idempotent + fail-loud.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── Paper identity (stable, so the migration is idempotent) ────────────────
const PAPER = {
  quizId: "b1015000-2015-4b15-a015-000000002015", // fixed uuid for the paper's quiz
  title_fr: "BIOLOGIE 2015",
  title_en: "BIOLOGIE 2015",
  shopKey: "past-paper-biologie-2015",
  priceCoins: 25,
};

const file = process.argv[2];
if (!file) {
  console.error("need a .docx path");
  process.exit(1);
}
const outIdx = process.argv.indexOf("--out");
const outFile = outIdx > -1 ? process.argv[outIdx + 1] : null;
const emit = process.argv.includes("--emit-migration");

const xml = execSync(`unzip -p "${file}" word/document.xml`, { maxBuffer: 1e8 }).toString();

function unesc(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

// Each paragraph -> { text, boldText } (boldText = concatenation of bold runs).
const paras = xml
  .split(/<\/w:p>/)
  .map((p) => {
    const runs = p.split(/<w:r[ >]/).slice(1);
    let text = "";
    let boldText = "";
    for (const r of runs) {
      const head = r.split("<w:t")[0];
      const isBold = /<w:b\/>|<w:b /.test(head) && !/<w:b w:val="(0|false)"/.test(head);
      const t = unesc((r.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || []).map((m) => m.replace(/<[^>]+>/g, "")).join(""));
      text += t;
      if (isBold) boldText += t;
    }
    return { text: text.replace(/\s+/g, " ").trim(), boldText: boldText.replace(/\s+/g, " ").trim() };
  })
  .filter((p) => p.text);

const LETTERS = ["a", "b", "c", "d", "e"];

// Split a "body" string (stem + options) into stem and per-letter option texts,
// enforcing the a→b→c→d→e marker order.
function splitOptions(body) {
  const markers = [];
  let pos = 0;
  for (const L of LETTERS) {
    const re = new RegExp(`(?:^|\\s)${L}\\.\\s`);
    const sub = body.slice(pos);
    const m = re.exec(sub);
    if (!m) break;
    const markerStart = pos + m.index + (m[0].startsWith(" ") ? 1 : 0);
    const textStart = pos + m.index + m[0].length;
    markers.push({ L, markerStart, textStart });
    pos = textStart;
  }
  if (markers.length < 2) return { stem: body.trim(), options: [] };
  const stem = body.slice(0, markers[0].markerStart).trim();
  const options = markers.map((mk, i) => {
    const end = i + 1 < markers.length ? markers[i + 1].markerStart : body.length;
    return { letter: mk.L, text_fr: body.slice(mk.textStart, end).trim() };
  });
  return { stem, options };
}

// ── Segment paragraphs into questions ──────────────────────────────────────
const questions = [];
let expected = 1;
let block = null; // { firstIdx, paras: [{i, text, boldText}], explIdx }

function flush() {
  if (!block) return;
  const b = block;
  block = null;

  // Explication paragraph(s): from explIdx to end of block.
  let explanation = "";
  let bodyParas = b.paras;
  if (b.explIdx != null) {
    const explSegs = b.paras.slice(b.explIdx).map((p) => p.text);
    explanation = explSegs.join(" ").replace(/^Explication\s*[:\-]\s*/i, "").trim();
    bodyParas = b.paras.slice(0, b.explIdx);
  }

  // Body = stem paragraph (number stripped) + option paragraphs.
  const body = bodyParas
    .map((p, i) => (i === 0 ? p.text.replace(/^\d+\s+/, "") : p.text))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const { stem, options } = splitOptions(body);

  // Correct letter from bold runs of the OPTION paragraphs (exclude stem &
  // explication paragraphs so a bold stem can't be mistaken for an option).
  const optBold = bodyParas
    .filter((_, i) => i !== 0)
    .map((p) => p.boldText)
    .join(" ");
  let correct = (optBold.match(/([a-e])\.\s/) || [])[1] || null;
  if (!correct) correct = (bodyParas[0]?.boldText.match(/([a-e])\.\s/) || [])[1] || null;

  const opts = options.map((o) => ({ text_fr: o.text_fr, is_correct: o.letter === correct }));
  const nCorrect = opts.filter((o) => o.is_correct).length;

  questions.push({
    n: b.number,
    difficulty: "medium",
    text_fr: stem,
    correctLetter: correct,
    options: opts,
    explanation_fr: explanation,
    ok: options.length >= 2 && nCorrect === 1 && !!stem && !!explanation,
  });
}

paras.forEach((p, i) => {
  const qm = p.text.match(/^(\d+)\s+(\S.*)$/);
  if (qm && Number(qm[1]) === expected) {
    flush();
    block = { number: expected, firstIdx: i, paras: [{ ...p }], explIdx: null };
    expected++;
    return;
  }
  if (!block) return;
  if (/^Explication\s*[:\-]/i.test(p.text) && block.explIdx == null) {
    block.explIdx = block.paras.length;
  }
  block.paras.push({ ...p });
});
flush();

// ── Review + validation ────────────────────────────────────────────────────
const good = questions.filter((q) => q.ok);
console.error(`${file}`);
console.error(`  parsed questions: ${questions.length}, valid: ${good.length}`);
console.error("  N -> correct : correct option text");
for (const q of questions) {
  const flag = q.ok ? " " : "!";
  const correctText = q.options.find((o) => o.is_correct)?.text_fr ?? "(none)";
  console.error(`  ${flag} ${String(q.n).padStart(2)} -> ${q.correctLetter ?? "?"} : ${correctText.slice(0, 70)}`);
}
const bad = questions.filter((q) => !q.ok);
if (bad.length) {
  console.error(`\n  INVALID (${bad.length}): ${bad.map((q) => q.n).join(", ")}`);
}

// Bank shape used by the migration (bilingual: EN mirrors FR).
const bank = good.map((q) => ({
  difficulty: q.difficulty,
  text_fr: q.text_fr,
  text_en: q.text_fr,
  explanation_fr: q.explanation_fr,
  explanation_en: q.explanation_fr,
  options: q.options.map((o) => ({ text_fr: o.text_fr, text_en: o.text_fr, is_correct: o.is_correct })),
}));

if (outFile) {
  const abs = path.isAbsolute(outFile) ? outFile : path.join(ROOT, outFile);
  fs.writeFileSync(abs, JSON.stringify(bank, null, 1));
  console.error(`  wrote ${bank.length} -> ${path.relative(ROOT, abs)}`);
}

function emitMigration() {
  if (bad.length) {
    console.error(`\nRefusing to emit migration: ${bad.length} invalid question(s). Fix parsing first.`);
    process.exit(1);
  }
  const payload = JSON.stringify({ paper: PAPER, questions: bank });
  const sql = `-- 0017: Seed the "BIOLOGIE 2015" exam paper (sujet) as a purchasable, playable quiz.
--
-- A "sujet" is a standalone quiz (no lesson, no mock exam) that a past_paper
-- shop_items row points at via reference_id. Students buy it in the Boutique
-- (faxcoins edge fn), then practise it freely (PaperQuiz -> /paper/:quizId).
--
-- Source of truth: the BIOLOGIE 2015 .docx, parsed by
-- scripts/parse_paper_docx.mjs (regenerate: node scripts/parse_paper_docx.mjs
-- "<docx>" --emit-migration). Idempotent: keyed by the fixed quiz id and the
-- shop item key, so re-runs and a fresh reset both converge.

-- 1) Allow a free-standing quiz (both FKs null) — papers belong to neither a
--    lesson nor a mock exam. Keep the mutual-exclusion guarantee.
alter table public.quizzes drop constraint if exists quizzes_target_check;
alter table public.quizzes add constraint quizzes_target_check
  check (not (lesson_id is not null and mock_exam_id is not null));

do $$
declare
  spec jsonb := $j$${payload}$j$::jsonb;
  paper jsonb := spec->'paper';
  v_quiz_id uuid := (paper->>'quizId')::uuid;
  qn jsonb;
  opt jsonb;
  v_question_id uuid;
  v_pos int;
  c_pos int;
begin
  -- 2) The paper's quiz (standalone).
  if not exists (select 1 from public.quizzes where id = v_quiz_id) then
    insert into public.quizzes (id, lesson_id, mock_exam_id, title_fr, title_en, difficulty, passing_score, session_size)
    values (v_quiz_id, null, null, paper->>'title_fr', paper->>'title_en', 'medium', 50,
            jsonb_array_length(spec->'questions'));
  end if;

  -- 3) Questions + choices (idempotent by text_fr within this quiz).
  v_pos := coalesce((select max(position) + 1 from public.questions where quiz_id = v_quiz_id), 0);
  for qn in select value from jsonb_array_elements(spec->'questions')
  loop
    if exists (select 1 from public.questions where quiz_id = v_quiz_id and text_fr = qn->>'text_fr') then
      continue;
    end if;
    insert into public.questions (quiz_id, text_fr, text_en, explanation_fr, explanation_en, difficulty, ai_generated, position)
    values (
      v_quiz_id, qn->>'text_fr', qn->>'text_en',
      coalesce(qn->>'explanation_fr', ''), coalesce(qn->>'explanation_en', ''),
      coalesce((qn->>'difficulty')::difficulty_level, 'medium'), false, v_pos
    )
    returning id into v_question_id;
    v_pos := v_pos + 1;

    c_pos := 0;
    for opt in select value from jsonb_array_elements(qn->'options')
    loop
      insert into public.choices (question_id, text_fr, text_en, is_correct, position)
      values (v_question_id, opt->>'text_fr', opt->>'text_en', coalesce((opt->>'is_correct')::boolean, false), c_pos);
      c_pos := c_pos + 1;
    end loop;
  end loop;

  -- 4) Shop item (past_paper) pointing at the paper's quiz via reference_id.
  if exists (select 1 from public.shop_items where key = paper->>'shopKey') then
    update public.shop_items
      set reference_id = v_quiz_id, active = true
      where key = paper->>'shopKey';
  else
    insert into public.shop_items (key, name_fr, name_en, price_coins, item_type, reference_id, is_limited, active)
    values (paper->>'shopKey', paper->>'title_fr', paper->>'title_en', (paper->>'priceCoins')::int,
            'past_paper', v_quiz_id, false, true);
  end if;
end $$;
`;
  const out = path.join(ROOT, "supabase", "migrations", "0017_seed_paper_biologie_2015.sql");
  fs.writeFileSync(out, sql);
  console.error(`\nWrote ${path.relative(ROOT, out)} (${bank.length} questions).`);
}

if (emit) emitMigration();
