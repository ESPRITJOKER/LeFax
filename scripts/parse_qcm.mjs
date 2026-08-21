// Parse "Set A" QCM out of the Lefax source .docx files in
// `Desktop/lefax artifacts`. Set A format (curated, exam-ready):
//   [bold] QCM N : <question>
//   A) <opt>   B) <opt>   C) <opt>   D) <opt>     <- the CORRECT option is bold
//   Explication : <text>
// grouped under "NIVEAU 1/2/3" headers → difficulty easy/medium/hard.
//
// Usage:
//   node scripts/parse_qcm.mjs "<abs path to .docx>"            # print JSON + stats
//   node scripts/parse_qcm.mjs "<path>" --out <file.json>        # write JSON
import { execSync } from "node:child_process";
import fs from "node:fs";

const file = process.argv[2];
if (!file) { console.error("need a .docx path"); process.exit(1); }
const outIdx = process.argv.indexOf("--out");
const outFile = outIdx > -1 ? process.argv[outIdx + 1] : null;

const xml = execSync(`unzip -p "${file}" word/document.xml`, { maxBuffer: 1e8 }).toString();

function unesc(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;/g, "'").replace(/&quot;/g, '"');
}

// Each paragraph -> { text, bold } where bold=true if ANY run in it is bold.
// For options we need per-run bold, so also keep the bolded substring.
const paras = xml.split(/<\/w:p>/).map((p) => {
  const runs = p.split(/<w:r[ >]/).slice(1);
  let text = "", boldText = "";
  for (const r of runs) {
    const head = r.split("<w:t")[0];
    const isBold = /<w:b\/>|<w:b /.test(head) && !/<w:b w:val="(0|false)"/.test(head);
    const t = unesc((r.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || []).map((m) => m.replace(/<[^>]+>/g, "")).join(""));
    text += t;
    if (isBold) boldText += t;
  }
  return { text: text.replace(/\s+/g, " ").trim(), boldText: boldText.replace(/\s+/g, " ").trim() };
}).filter((p) => p.text);

const DIFF_BY_LEVEL = { "1": "easy", "2": "medium", "3": "hard" };
const OPT_RE = /^([A-Da-d])[).\-]\s*(.+)$/;

const questions = [];
let curDiff = "medium";
let cur = null;
function flush() {
  if (cur && cur.options.length >= 2) {
    const correct = cur.options.filter((o) => o.is_correct).length;
    questions.push({ ...cur, ok: correct === 1 });
  }
  cur = null;
}
for (const p of paras) {
  const t = p.text;
  const lvl = t.match(/NIVEAU\s*([123])/i);
  if (lvl) { flush(); curDiff = DIFF_BY_LEVEL[lvl[1]]; continue; }
  const qm = t.match(/^QCM\s*\d+\s*[:\-]\s*(.+)$/i);
  if (qm) { flush(); cur = { difficulty: curDiff, text_fr: qm[1].trim(), options: [], explanation_fr: "" }; continue; }
  if (!cur) continue;
  const ex = t.match(/^(?:💡\s*)?Explication\s*[:\-]\s*(.+)$/i);
  if (ex) { cur.explanation_fr = ex[1].trim(); continue; }
  const om = t.match(OPT_RE);
  if (om) {
    // Correct if the whole option line (letter+text) was bold, or its text is bold.
    const isBold = p.boldText && (p.boldText.includes(om[2].slice(0, Math.min(12, om[2].length))) || p.boldText === t);
    cur.options.push({ text_fr: om[2].trim(), is_correct: !!isBold });
  }
}
flush();

const good = questions.filter((q) => q.ok);
const byDiff = { easy: 0, medium: 0, hard: 0 };
good.forEach((q) => byDiff[q.difficulty]++);
console.error(`${file}`);
console.error(`  parsed questions: ${questions.length}, valid (exactly 1 correct + >=2 opts): ${good.length}`);
console.error(`  difficulty: easy ${byDiff.easy} / medium ${byDiff.medium} / hard ${byDiff.hard}`);
const bad = questions.filter((q) => !q.ok);
if (bad.length) console.error(`  DROPPED ${bad.length} (no single bold answer). First: "${bad[0]?.text_fr?.slice(0, 70)}"`);

if (outFile) { fs.writeFileSync(outFile, JSON.stringify(good, null, 1)); console.error(`  wrote ${good.length} -> ${outFile}`); }
else console.log(JSON.stringify(good.slice(0, 2), null, 1));
