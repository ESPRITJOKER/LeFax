#!/usr/bin/env node
// upload-images.mjs — uploads every image referenced by the content manifests
// to the Supabase Storage bucket "lesson-media" at
// lesson-media/biologie/<chapter>/<file> (the deterministic path that
// scripts/build-ingest.mjs embeds as public URLs in 0012).
//
// Usage (from repo root):
//   node scripts/upload-images.mjs            # reads SUPABASE_URL + SERVICE KEY from .env.local
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/upload-images.mjs
//
// Requires a service-role key (RLS on lesson-media is public-read / staff-write;
// the service role bypasses RLS). Prints a manifest of public URLs afterwards.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "content-source", "biologie");
const BUCKET = "lesson-media";
const OUT_MANIFEST = path.join(ROOT, "scripts", "tmp", "image-manifest.json");

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".jfif": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function loadEnvLocal() {
  const fp = path.join(ROOT, ".env.local");
  const out = {};
  if (fs.existsSync(fp)) {
    for (const line of fs.readFileSync(fp, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
    }
  }
  return out;
}

function collectImages() {
  const jobs = [];
  const dirs = fs
    .readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("chapitre-"))
    .map((d) => d.name)
    .sort();
  for (const d of dirs) {
    const fp = path.join(SOURCE_DIR, d, "manifest.json");
    if (!fs.existsSync(fp)) continue;
    const manifest = JSON.parse(fs.readFileSync(fp, "utf8"));
    const seen = new Set();
    for (const lesson of manifest.lessons) {
      for (const card of lesson.cards || []) {
        for (const [slot, langDir] of [
          ["image_fr", "fr"],
          ["image_en", "en"],
        ]) {
          const f = card[slot];
          // Dedupe by filename: the storage path (biologie/<chapter>/<file>) is
          // language-agnostic, so an FR and EN card pointing at the same file
          // upload to the same object and need be sent only once.
          if (!f || seen.has(f)) continue;
          seen.add(f);
          // Read each language's image from ITS OWN folder (the bug was always
          // reading from images/fr, which silently dropped EN-only images).
          // Fall back to the other folder when a file was staged only once
          // (common today, where every card uses the same image for FR and EN).
          const primary = path.join(SOURCE_DIR, d, "images", langDir, f);
          const fallback = path.join(SOURCE_DIR, d, "images", langDir === "fr" ? "en" : "fr", f);
          const staged = fs.existsSync(primary) ? primary : fs.existsSync(fallback) ? fallback : null;
          if (!staged) {
            console.warn(`WARN: staged image missing for ${d}: ${f} (looked in images/${langDir} and the other lang; skipping)`);
            continue;
          }
          jobs.push({ chapter: manifest.chapter_slug, file: f, local: staged });
        }
      }
    }
  }
  return jobs;
}

function encSeg(seg) {
  return encodeURIComponent(seg).replace(/%27/g, "'");
}

async function ensureBucket(baseUrl, key) {
  const res = await fetch(`${baseUrl}/storage/v1/bucket/${BUCKET}`, {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  });
  if (res.ok) return true;
  const create = await fetch(`${baseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (!create.ok) throw new Error(`bucket create failed: ${create.status} ${await create.text()}`);
  return true;
}

async function main() {
  const env = loadEnvLocal();
  const baseUrl = (env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl) throw new Error("VITE_SUPABASE_URL missing in .env.local");
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is empty. Add it to .env.local (or pass it as an env var).\n" +
        "Get it from Dashboard → Project Settings → API → service_role. This is required to write to the lesson-media bucket."
    );
  }

  const jobs = collectImages();
  console.log(`${jobs.length} images to upload → ${baseUrl}/storage/v1/object/public/${BUCKET}/biologie/<chapter>/<file>`);

  await ensureBucket(baseUrl, key);

  const publicUrls = {};
  let ok = 0;
  for (const job of jobs) {
    const objectName = `biologie/${job.chapter}/${job.file}`;
    const url = `${baseUrl}/storage/v1/object/${BUCKET}/${objectName.split("/").map(encSeg).join("/")}`;
    const buf = fs.readFileSync(job.local);
    const ext = path.extname(job.file).toLowerCase();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        "Content-Type": MIME[ext] || "application/octet-stream",
        "x-upsert": "true",
      },
      body: buf,
    });
    if (!res.ok) {
      console.error(`FAIL ${objectName}: ${res.status} ${await res.text()}`);
      continue;
    }
    publicUrls[job.file] = `${baseUrl}/storage/v1/object/public/${BUCKET}/${objectName.split("/").map(encSeg).join("/")}`;
    ok++;
  }

  fs.mkdirSync(path.dirname(OUT_MANIFEST), { recursive: true });
  fs.writeFileSync(OUT_MANIFEST, JSON.stringify(publicUrls, null, 2), "utf8");
  console.log(`uploaded ${ok}/${jobs.length} images; public-URL manifest → ${OUT_MANIFEST}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
