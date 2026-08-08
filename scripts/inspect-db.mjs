import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key);

async function count(table, q) {
  const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
  return error ? `ERR ${error.message}` : count;
}

const chapters = await sb.from("chapters").select("id,slug,name_fr,position");
console.log("=== chapters ===");
for (const c of chapters.data ?? []) {
  const lessons = await sb.from("lessons").select("id,slug,title_fr,position").eq("chapter_id", c.id).order("position");
  console.log(`\n# ${c.slug} (${c.name_fr})`);
  for (const l of lessons.data ?? []) {
    const cards = await count("lesson_cards", null);
    const { count: cardCount } = await sb.from("lesson_cards").select("*", { count: "exact", head: true }).eq("lesson_id", l.id);
    const { count: quizCount } = await sb.from("quizzes").select("*", { count: "exact", head: true }).eq("lesson_id", l.id);
    console.log(`  - ${l.slug} | cards=${cardCount} quizzes=${quizCount}`);
  }
}

console.log("\n=== global counts ===");
for (const t of ["lessons", "lesson_cards", "quizzes", "questions", "choices", "content_approval"]) {
  console.log(`${t}: ${await count(t)}`);
}

console.log("\n=== content_approval status ===");
const { data: ca } = await sb.from("content_approval").select("id,lesson_id,status");
const byStatus = {};
for (const r of ca ?? []) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
console.log(JSON.stringify(byStatus));

console.log("\n=== storage buckets ===");
const { data: buckets } = await sb.storage.listBuckets();
console.log((buckets ?? []).map((b) => `${b.name} (public:${b.public})`));
