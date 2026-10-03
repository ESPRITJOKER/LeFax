/**
 * Shrink the brand PNGs to the sizes they are actually rendered at.
 *
 * Correction N6, remark 5 — "le chargement d'une page prend 1 à 2 secondes".
 * `src/assets/lefax-mark.png` was a 740×740, 662 kB image displayed at 26–30 px
 * in the student sidebar, the admin rail, the landing page and both auth
 * screens: every single screen in the app paid for it. `lefax-logo.png` was
 * 1108×1088 / 1039 kB, and the favicon 256×256 / 100 kB.
 *
 * Deliberately no new npm dependency: Windows ships GDI+ via System.Drawing,
 * reached through PowerShell, which is enough for a high-quality downscale of
 * four files. Run it only when the source artwork changes:
 *
 *   node scripts/optimize-brand-assets.mjs            # resize in place
 *   node scripts/optimize-brand-assets.mjs --check    # report sizes only
 *
 * The originals are preserved as `src/assets/<name>.source.png` the first time
 * the script runs, so the artwork is never lost to a resize. They live under
 * `src/assets` even for the favicon, because Vite copies `public/` into `dist`
 * verbatim — a `.source.png` left there would ship to every visitor.
 */
import { execFileSync } from "node:child_process";
import { existsSync, copyFileSync, statSync, readFileSync } from "node:fs";
import { resolve, basename, join } from "node:path";

const TARGETS = [
  // The mark is rendered at 26–30 px; 2× that covers every DPR we support.
  { file: "src/assets/lefax-mark.png", max: 96 },
  // The lockup is only ever used at ~120 px tall.
  { file: "src/assets/lefax-logo.png", max: 360 },
  // Browser tab icon.
  { file: "public/lefax-icon.png", max: 64 },
];

const check = process.argv.includes("--check");

function pngSize(path) {
  const b = readFileSync(path);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length };
}

// `powershell -Command` does not bind named parameters to a `param()` block, so
// the three values are injected as literals instead. They come from TARGETS
// above, never from user input.
const ps = (inPath, outPath, max) => `
$In  = ${JSON.stringify(inPath)}
$Out = ${JSON.stringify(outPath)}
$Max = ${max}
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($In)
try {
  $scale = [Math]::Min(1.0, $Max / [Math]::Max($img.Width, $img.Height))
  $w = [int][Math]::Round($img.Width * $scale)
  $h = [int][Math]::Round($img.Height * $scale)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($img, 0, 0, $w, $h)
  $g.Dispose()
  $bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
} finally { $img.Dispose() }
`;

let saved = 0;
for (const { file, max } of TARGETS) {
  const path = resolve(file);
  if (!existsSync(path)) {
    console.log(`skip   ${file} (missing)`);
    continue;
  }
  const before = pngSize(path);
  if (check) {
    console.log(`${file}: ${before.w}×${before.h}, ${(before.bytes / 1024).toFixed(0)} kB (target ${max}px)`);
    continue;
  }
  if (Math.max(before.w, before.h) <= max) {
    console.log(`ok     ${file} already ${before.w}×${before.h}`);
    continue;
  }

  // Keep the untouched artwork once, so a later resize starts from the source.
  // Always under src/assets — never under public/, which Vite ships whole.
  const source = join(resolve("src/assets"), basename(path, ".png") + ".source.png");
  if (!existsSync(source)) copyFileSync(path, source);

  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps(source, path, max)], { stdio: "inherit" });

  const after = statSync(path).size;
  saved += before.bytes - after;
  const now = pngSize(path);
  console.log(`resize ${file}: ${before.w}×${before.h} ${(before.bytes / 1024).toFixed(0)} kB → ${now.w}×${now.h} ${(after / 1024).toFixed(0)} kB`);
}

if (!check) console.log(`\ntotal saved: ${(saved / 1024).toFixed(0)} kB`);
