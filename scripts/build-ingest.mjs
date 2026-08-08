#!/usr/bin/env node
// build-ingest.mjs — reads content-source/biologie/*/manifest.json and emits
// supabase/migrations/0012_ingest_content.sql (idempotent, reviewable SQL).
//
// Usage (from repo root):  node scripts/build-ingest.mjs
//
// Deterministic UUIDs (SHA-1 name-based) are used for lesson_cards, questions
// and choices so re-running the generator yields stable SQL. Lessons/chapters
// are keyed by their natural unique constraints (chapter slug / lesson slug).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "content-source", "biologie");
const OUT = path.join(ROOT, "supabase", "migrations", "0012_ingest_content.sql");
const BUCKET = "lesson-media";

const PROJECT_URL = (process.env.VITE_SUPABASE_URL || "https://kjlgrgdryimazczrcvgx.supabase.co").replace(/\/$/, "");
const storageBase = `${PROJECT_URL}/storage/v1/object/public/${BUCKET}`;

const NS = "9a5c9d3e-0000-4000-8000-000000000001";

function parseUuid(s) {
  return Buffer.from(s.replace(/-/g, ""), "hex");
}
function formatUuid(b) {
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function uuid5(name) {
  const h = crypto.createHash("sha1").update(parseUuid(NS)).update(name, "utf8").digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  return formatUuid(h.subarray(0, 16));
}

function sqlStr(v) {
  if (v === null || v === undefined) return "null";
  return `'${String(v).replace(/'/g, "''")}'`;
}
function sqlStrArr(arr) {
  if (!arr || !arr.length) return "array[]::text[]";
  return `array[${arr.map((x) => sqlStr(x)).join(", ")}]`;
}
function encSeg(seg) {
  return encodeURIComponent(seg).replace(/%27/g, "'");
}
function imageUrl(chapterSlug, filename) {
  const p = `biologie/${chapterSlug}/${filename}`.split("/").map(encSeg).join("/");
  return `${storageBase}/${p}`;
}

function loadManifests() {
  const dirs = fs
    .readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("chapitre-"))
    .map((d) => d.name)
    .sort();
  const manifests = [];
  for (const d of dirs) {
    const fp = path.join(SOURCE_DIR, d, "manifest.json");
    if (!fs.existsSync(fp)) continue;
    manifests.push(JSON.parse(fs.readFileSync(fp, "utf8")));
  }
  return manifests;
}

function newChapters(manifests) {
  return manifests
    .filter((m) => m.chapter_new)
    .map((m) => ({
      slug: m.chapter_slug,
      name_fr: m.chapter_name_fr,
      name_en: m.chapter_name_en,
      position: m.chapter_position,
    }));
}

function newLessons(manifests) {
  const out = [];
  for (const m of manifests) {
    if (!m.chapter_new) continue;
    for (const l of m.lessons) out.push({ chapter: m.chapter_slug, lesson: l });
  }
  return out.sort((a, b) => a.lesson.position - b.lesson.position);
}

function allCards(manifests) {
  const out = [];
  for (const m of manifests) {
    for (const l of m.lessons) {
      for (const c of l.cards || []) {
        out.push({ chapter: m.chapter_slug, lesson: l.slug, card: c });
      }
    }
  }
  return out;
}

function allQuizzes(manifests) {
  const out = [];
  for (const m of manifests) {
    for (const l of m.lessons) {
      if (!l.quiz || !l.quiz.questions || !l.quiz.questions.length) continue;
      out.push({ chapter: m.chapter_slug, lesson: l.slug, quiz: l.quiz });
    }
  }
  return out;
}

function sqlCardInsert(item) {
  const c = item.card;
  const imgFr = c.image_fr ? sqlStr(imageUrl(item.chapter, c.image_fr)) : "null";
  const imgEn = c.image_en ? sqlStr(imageUrl(item.chapter, c.image_en)) : "null";
  const id = uuid5(`card:${item.chapter}/${item.lesson}/${c.position}`);
  return [
    `insert into public.lesson_cards (id, lesson_id, position, point_fr, point_en, sub_fr, sub_en, image_fr, image_en, explanation_fr, explanation_en, structural_question_fr, structural_question_en, structural_answer_fr, structural_answer_en, tips_fr, tips_en, traps_fr, traps_en)`,
    `select ${sqlStr(id)}, l.id, ${c.position},`,
    `  ${sqlStr(c.point_fr)}, ${sqlStr(c.point_en)}, ${sqlStr(c.sub_fr)}, ${sqlStr(c.sub_en)}, ${imgFr}, ${imgEn},`,
    `  ${sqlStr(c.explanation_fr)}, ${sqlStr(c.explanation_en)}, ${sqlStr(c.structural_question_fr)}, ${sqlStr(c.structural_question_en)},`,
    `  ${sqlStr(c.structural_answer_fr)}, ${sqlStr(c.structural_answer_en)}, ${sqlStr(c.tips_fr)}, ${sqlStr(c.tips_en)}, ${sqlStr(c.traps_fr)}, ${sqlStr(c.traps_en)}`,
    `from public.lessons l join public.chapters ch on ch.id = l.chapter_id join public.subjects s on s.id = ch.subject_id`,
    `where s.slug = 'biologie' and ch.slug = ${sqlStr(item.chapter)} and l.slug = ${sqlStr(item.lesson)}`,
    `on conflict (id) do update set`,
    `  point_fr = excluded.point_fr, point_en = excluded.point_en, sub_fr = excluded.sub_fr, sub_en = excluded.sub_en,`,
    `  image_fr = excluded.image_fr, image_en = excluded.image_en, explanation_fr = excluded.explanation_fr, explanation_en = excluded.explanation_en,`,
    `  structural_question_fr = excluded.structural_question_fr, structural_question_en = excluded.structural_question_en,`,
    `  structural_answer_fr = excluded.structural_answer_fr, structural_answer_en = excluded.structural_answer_en,`,
    `  tips_fr = excluded.tips_fr, tips_en = excluded.tips_en, traps_fr = excluded.traps_fr, traps_en = excluded.traps_en;`,
  ].join("\n");
}

function sqlQuizBlock(item) {
  const { quiz, chapter, lesson } = item;
  const quizId = uuid5(`quiz:${chapter}/${lesson}`);
  const lines = [];
  lines.push(`-- quiz for ${chapter}/${lesson}`);
  lines.push(
    `insert into public.quizzes (id, lesson_id, title_fr, title_en, difficulty, passing_score, session_size)`,
    `select ${sqlStr(quizId)}, l.id, ${sqlStr(quiz.title_fr)}, ${sqlStr(quiz.title_en)}, ${sqlStr(quiz.difficulty || "medium")}, ${sqlStr(quiz.passing_score ?? 50)}, ${sqlStr(quiz.session_size ?? null)}`,
    `from public.lessons l join public.chapters ch on ch.id = l.chapter_id join public.subjects s on s.id = ch.subject_id`,
    `where s.slug = 'biologie' and ch.slug = ${sqlStr(chapter)} and l.slug = ${sqlStr(lesson)}`,
    `and not exists (select 1 from public.quizzes q where q.lesson_id = l.id);`,
  );
  quiz.questions.forEach((q, i) => {
    const qid = uuid5(`question:${chapter}/${lesson}/${i}`);
    lines.push(
      `insert into public.questions (id, quiz_id, text_fr, text_en, explanation_fr, explanation_en, difficulty, position)`,
      `select ${sqlStr(qid)}, q.id, ${sqlStr(q.text_fr)}, ${sqlStr(q.text_en)}, ${sqlStr(q.explanation_fr ?? "")}, ${sqlStr(q.explanation_en ?? "")}, ${sqlStr(q.difficulty || "medium")}, ${i + 1}`,
      `from public.lessons l join public.chapters ch on ch.id = l.chapter_id join public.subjects s on s.id = ch.subject_id join public.quizzes q on q.lesson_id = l.id`,
      `where s.slug = 'biologie' and ch.slug = ${sqlStr(chapter)} and l.slug = ${sqlStr(lesson)}`,
      `on conflict (id) do nothing;`,
    );
    q.choices.forEach((chc, j) => {
      const cid = uuid5(`choice:${chapter}/${lesson}/${i}/${j}`);
      lines.push(
        `insert into public.choices (id, question_id, text_fr, text_en, is_correct, position)`,
        `values (${sqlStr(cid)}, ${sqlStr(qid)}, ${sqlStr(chc.text_fr)}, ${sqlStr(chc.text_en)}, ${chc.is_correct}, ${j + 1})`,
        `on conflict (id) do nothing;`,
      );
    });
  });
  return lines.join("\n");
}

function build() {
  const manifests = loadManifests();
  if (!manifests.length) throw new Error(`no manifests found in ${SOURCE_DIR}`);

  const sections = [];
  sections.push(
    `-- 0012: Ingest content-source/biologie manifests (bilingual lessons, story-cards,`,
    `-- and MCQ banks). Generated by scripts/build-ingest.mjs — DO NOT EDIT BY HAND.`,
    `-- Regenerate with:  node scripts/build-ingest.mjs`,
    ``,
    `-- Images are referenced by public Storage URL in the "lesson-media" bucket`,
    `-- (path: lesson-media/biologie/<chapter>/<file>). Run scripts/upload-images.mjs`,
    `-- first so the files exist; the URLs are deterministic so they need not be.`,
    ``,
    `begin;`,
    ``,
  );

  // 1. new chapters
  const chs = newChapters(manifests);
  if (chs.length) {
    sections.push(`-- 1. New chapters`);
    sections.push(
      `insert into public.chapters (subject_id, slug, name_fr, name_en, position)`,
      `select s.id, v.slug, v.name_fr, v.name_en, v.position`,
      `from public.subjects s`,
      `cross join (values`,
    );
    chs.forEach((c, i) => {
      sections.push(`  (${sqlStr(c.slug)}, ${sqlStr(c.name_fr)}, ${sqlStr(c.name_en)}, ${c.position})${i < chs.length - 1 ? "," : ""}`);
    });
    sections.push(`) as v(slug, name_fr, name_en, position)`, `where s.slug = 'biologie'`, `on conflict (subject_id, slug) do nothing;`, ``);
  }

  // 2. new lessons
  const lessons = newLessons(manifests);
  if (lessons.length) {
    sections.push(`-- 2. New lessons`);
    for (const { chapter, lesson: l } of lessons) {
      sections.push(
        `insert into public.lessons (chapter_id, slug, title_fr, title_en, objectives_fr, objectives_en, content_fr, content_en, summary_fr, summary_en, key_points_fr, key_points_en, duration_minutes, difficulty, position, published)`,
        `select ch.id, ${sqlStr(l.slug)}, ${sqlStr(l.title_fr)}, ${sqlStr(l.title_en)},`,
        `  ${sqlStrArr(l.objectives_fr)}, ${sqlStrArr(l.objectives_en)},`,
        `  ${sqlStr(l.content_fr)}, ${sqlStr(l.content_en)}, ${sqlStr(l.summary_fr)}, ${sqlStr(l.summary_en)},`,
        `  ${sqlStrArr(l.key_points_fr)}, ${sqlStrArr(l.key_points_en)},`,
        `  ${l.duration_minutes}, ${sqlStr(l.difficulty)}, ${l.position}, ${l.published}`,
        `from public.chapters ch join public.subjects s on s.id = ch.subject_id`,
        `where s.slug = 'biologie' and ch.slug = ${sqlStr(chapter)}`,
        `on conflict (chapter_id, slug) do nothing;`,
      );
    }
    sections.push(``);
  }

  // 3. cards (all chapters)
  const cards = allCards(manifests);
  if (cards.length) {
    sections.push(`-- 3. Lesson story-cards (front face + 4 back blocks, bilingual images)`);
    for (const item of cards) sections.push(sqlCardInsert(item));
    sections.push(``);
  }

  // 4. quizzes + questions + choices
  const quizzes = allQuizzes(manifests);
  if (quizzes.length) {
    sections.push(`-- 4. Quizzes, questions and choices (MCQ banks)`);
    for (const item of quizzes) sections.push(sqlQuizBlock(item));
    sections.push(``);
  }

  sections.push(`commit;`, ``);

  const sql = sections.join("\n");
  fs.writeFileSync(OUT, sql, "utf8");
  console.log(`wrote ${OUT} (${sql.length} bytes, ${cards.length} cards, ${quizzes.reduce((n, q) => n + q.quiz.questions.length, 0)} questions)`);
}

build();
