// Ingest curated QCM banks parsed from the source .docx (scripts/qcm_source/*.json)
// into a target lesson's quiz on the live DB. The source docs are French-only, so
// the EN columns are mirrored from FR (the platform is FR-first; EN content is
// already sparse). Idempotent: a question is inserted only if its text_fr is not
// already present in that lesson's quiz.
//
//   node scripts/ingest_qcm_docs.mjs --check
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/ingest_qcm_docs.mjs --apply
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// doc bank file -> the lesson that will hold the chapter's QCM bank.
// (ChapterPractice aggregates every quiz across a chapter's published lessons,
// so which lesson holds them only affects that lesson's own "quiz after the
// lesson"; the chapter Niv. 1/2/3 sees all of them.)
const MAP = [
  { file: "qcm_source/cytologie_i.json", lid: "f7a27324-f720-4830-9472-5292fcaa705c", label: "Cytologie I → cytologie-i / introduction-organisation" },
];

function readEnv(key) {
  const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const m = env.match(new RegExp("^" + key + "=(.*)$", "m"));
  return m ? m[1].trim().replace(/^"|"$/g, "") : null;
}

function loadBank(file) {
  const arr = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", file.replace(/^scripts\//, "")), "utf8"));
  // normalise + mirror EN
  return arr.map((q) => ({
    difficulty: ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium",
    text_fr: q.text_fr,
    text_en: q.text_fr,
    explanation_fr: q.explanation_fr || "",
    explanation_en: q.explanation_fr || "",
    options: q.options.map((o) => ({ text_fr: o.text_fr, text_en: o.text_fr, is_correct: !!o.is_correct })),
  }));
}

function validate() {
  let total = 0;
  const errs = [];
  for (const m of MAP) {
    const bank = loadBank(m.file);
    for (const q of bank) {
      total++;
      const c = q.options.filter((o) => o.is_correct).length;
      if (q.options.length < 2) errs.push(`${m.file}: <2 options — ${q.text_fr.slice(0, 50)}`);
      if (c !== 1) errs.push(`${m.file}: ${c} correct — ${q.text_fr.slice(0, 50)}`);
    }
    console.log(`${m.label}: ${bank.length} questions`);
  }
  return { total, errs };
}

async function apply() {
  const BASE = readEnv("VITE_SUPABASE_URL") || readEnv("SUPABASE_URL");
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!BASE || !KEY) throw new Error("Need VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  const h = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", Prefer: "return=representation" };
  const rest = (p, init = {}) => fetch(`${BASE}/rest/v1/${p}`, { ...init, headers: { ...h, ...(init.headers || {}) } });

  for (const m of MAP) {
    const bank = loadBank(m.file);
    let quiz = await (await rest(`quizzes?select=id&lesson_id=eq.${m.lid}`)).json();
    let quizId = quiz[0]?.id;
    if (!quizId) {
      const les = await (await rest(`lessons?select=title_fr,title_en&id=eq.${m.lid}`)).json();
      if (!les[0]) { console.warn(`! lesson ${m.lid} not found — skipping ${m.label}`); continue; }
      const created = await (await rest(`quizzes`, { method: "POST", body: JSON.stringify({ lesson_id: m.lid, title_fr: `Test — ${les[0].title_fr}`, title_en: `Test — ${les[0].title_en || les[0].title_fr}` }) })).json();
      quizId = created[0].id;
    }
    const existing = await (await rest(`questions?select=text_fr,position&quiz_id=eq.${quizId}`)).json();
    const seen = new Set(existing.map((x) => x.text_fr));
    let pos = existing.reduce((mx, x) => Math.max(mx, x.position + 1), 0);
    let ins = 0, skip = 0;
    for (const q of bank) {
      if (seen.has(q.text_fr)) { skip++; continue; }
      const qrow = await (await rest(`questions`, { method: "POST", body: JSON.stringify({ quiz_id: quizId, text_fr: q.text_fr, text_en: q.text_en, explanation_fr: q.explanation_fr, explanation_en: q.explanation_en, difficulty: q.difficulty, ai_generated: false, position: pos++ }) })).json();
      const qid = qrow[0].id;
      await rest(`choices`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(q.options.map((o, i) => ({ question_id: qid, text_fr: o.text_fr, text_en: o.text_en, is_correct: o.is_correct, position: i }))) });
      ins++;
    }
    console.log(`${m.label}: inserted ${ins}, skipped ${skip}`);
  }
}

const mode = process.argv[2] || "--check";
const rep = validate();
console.log(`Total in banks: ${rep.total}`);
if (rep.errs.length) { console.error("ERRORS:\n  " + rep.errs.join("\n  ")); process.exit(1); }
if (mode === "--apply") await apply();
