/**
 * WCAG contrast audit of the light and dark palettes.
 *
 * Reads the tokens straight out of src/index.css, so it audits what actually
 * ships rather than a copy that can drift. Run it after touching any colour:
 *
 *   node scripts/check_contrast.mjs
 *
 * Exits non-zero when a pair is below its target. The light theme currently
 * reports known failures on the LeFax brand blue and green — those are the
 * original identity colours and are deliberately left as they are; see
 * docs/SESSION_HISTORY.md.
 */
import fs from "node:fs";

const css = fs.readFileSync("src/index.css", "utf8");

function block(selector) {
  const i = css.indexOf(selector);
  if (i === -1) throw new Error("selector not found: " + selector);
  const open = css.indexOf("{", i);
  const close = css.indexOf("\n}", open);
  const body = css.slice(open, close);
  const vars = {};
  for (const m of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) vars[m[1].trim()] = m[2].trim();
  return vars;
}

const light = block(":root {");
const darkOverrides = block(':root[data-theme="dark"]');
const dark = { ...light, ...darkOverrides };

function toRgb(value) {
  const v = value.replace(/\/\*.*?\*\//g, "").trim();
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const ok = v.match(/^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/i);
  if (ok) return oklchToRgb(Number(ok[1]) / 100, Number(ok[2]), Number(ok[3]));
  return null;
}

function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lin = [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lin.map((c) => {
    const srgb = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(srgb * 255)));
  });
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg, bg) {
  const a = luminance(fg), b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground token, background token, what it is, minimum required]
// 4.5 = WCAG AA body text; 3.0 = AA large/bold text and UI boundaries.
const PAIRS = [
  ["color-ink-950", "color-card", "headings on a card", 4.5],
  ["color-ink-900", "color-card", "body text on a card", 4.5],
  ["color-ink-800", "color-card", "secondary text on a card", 4.5],
  ["color-ink-700", "color-card", "icon/label text on a card", 4.5],
  ["color-ink-600", "color-card", "muted text on a card", 4.5],
  ["color-muted", "color-card", "muted token on a card", 4.5],
  ["color-ink-950", "color-surface", "headings on the page", 4.5],
  ["color-ink-900", "color-surface", "body text on the page", 4.5],
  ["color-muted", "color-surface", "muted text on the page", 4.5],
  ["color-text", "color-card", "text token on a card", 4.5],
  ["color-ink-900", "color-ink-100", "input text on its field", 4.5],
  ["color-ink-300", "color-ink-100", "placeholder in a field", 3.0],
  ["color-brand-600", "color-card", "link / accent text on a card", 4.5],
  ["color-brand-700", "color-card", "hover accent on a card", 4.5],
  ["color-danger-700", "color-card", "error text on a card", 4.5],
  ["color-success-700", "color-card", "success text on a card", 4.5],
  ["color-ochre-700", "color-card", "warning text on a card", 4.5],
  ["color-border", "color-card", "hairline against a card", 1.2],
  ["color-card", "color-surface", "card against the page", 1.05],
];

const WHITE = [255, 255, 255];
// In dark mode the primary BUTTON surface is overridden by a class rule
// (.bg-brand-600), because the token itself has to stay light enough to work as
// accent TEXT. Read that override when auditing the dark theme.
const darkButton = (css.match(/:root\[data-theme="dark"\] \.bg-brand-600 \{\s*background-color:\s*([^;]+);/) || [])[1];
if (darkButton) dark["color-button-surface"] = darkButton.trim();
light["color-button-surface"] = light["color-brand-600"];

const WHITE_PAIRS = [
  ["color-button-surface", "white on a primary button", 4.5],
  ["color-brand-800", "white on the admin rail / coin pill", 4.5],
  ["color-danger-600", "white on a danger button", 3.0],
];

let failures = 0;
for (const [themeName, vars] of [["LIGHT", light], ["DARK", dark]]) {
  console.log("\n=== " + themeName + " ===");
  for (const [fgK, bgK, label, min] of PAIRS) {
    const fg = toRgb(vars[fgK] ?? ""), bg = toRgb(vars[bgK] ?? "");
    if (!fg || !bg) { console.log("  ??  " + label + " (unparsed: " + fgK + " / " + bgK + ")"); failures++; continue; }
    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok) failures++;
    console.log(`  ${ok ? "ok  " : "FAIL"} ${r.toFixed(2).padStart(6)} (min ${min})  ${label}`);
  }
  for (const [bgK, label, min] of WHITE_PAIRS) {
    const bg = toRgb(vars[bgK] ?? "");
    if (!bg) { console.log("  ??  " + label); failures++; continue; }
    const r = ratio(WHITE, bg);
    const ok = r >= min;
    if (!ok) failures++;
    console.log(`  ${ok ? "ok  " : "FAIL"} ${r.toFixed(2).padStart(6)} (min ${min})  ${label}`);
  }
}

console.log("\n" + (failures === 0 ? "All pairs pass." : failures + " pair(s) below target."));
process.exit(failures === 0 ? 0 : 1);
