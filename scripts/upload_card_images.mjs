#!/usr/bin/env node
/**
 * Bulk-upload lesson story-card images to the Supabase `lesson-media` bucket.
 *
 * The 0012 content ingest set each card's image_fr/image_en to a storage URL,
 * but the image files themselves were never uploaded — so those URLs 404/400
 * and students see no diagram. This script uploads the matching local files
 * from the artifacts folder to the EXACT storage paths the cards already point
 * at, so the existing URLs resolve with no DB change.
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_URL="https://kjlgrgdryimazczrcvgx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="<service_role JWT>"
 *   node scripts/upload_card_images.mjs [--dry]
 *
 * --dry only checks that every local file exists; it uploads nothing.
 */
import fs from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const ART_DIR = "C:/Users/AvenirTech/Desktop/lefax artifacts";
const MAP_FILE = new URL("./card_image_map.json", import.meta.url);
const BUCKET = "lesson-media";

const URL_BASE = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const map = JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".jfif": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };

async function main() {
  // Pre-flight: every referenced local file must exist.
  const missing = map.filter((m) => !fs.existsSync(path.join(ART_DIR, m.local)));
  if (missing.length) {
    console.error("Missing local files:", missing.map((m) => m.local));
    process.exit(1);
  }
  console.log(`${map.length} images, all local files present.`);
  if (DRY) return console.log("Dry run — nothing uploaded.");

  if (!URL_BASE || !SERVICE_KEY) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.");
    process.exit(1);
  }

  let ok = 0;
  for (const m of map) {
    const bytes = fs.readFileSync(path.join(ART_DIR, m.local));
    const ext = path.extname(m.local).toLowerCase();
    const res = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${m.storagePath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        "Content-Type": MIME[ext] || "application/octet-stream",
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (res.ok) { ok++; console.log("  ✓", m.storagePath); }
    else console.error("  ✗", m.storagePath, res.status, await res.text());
  }
  console.log(`Uploaded ${ok}/${map.length}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
