// Compiles src/index.css (Tailwind + CSS-variable tokens) into a stable,
// non-content-hashed stylesheet for design-sync's cfg.cssEntry, and prepends
// the Google Fonts @import that index.html normally supplies via <link> (the
// fonts are never shipped as local files — see NOTES.md).
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

mkdirSync(".design-sync/.cache/build", { recursive: true });
execSync(
  "npx tailwindcss -i src/index.css -o .design-sync/.cache/build/tailwind.css --config tailwind.config.js",
  { stdio: "inherit" }
);

const fontImport =
  "@import url('https://fonts.googleapis.com/css2?family=Newsreader:wght@500;600;700&family=Public+Sans:wght@400;500;600;700&display=swap');\n";
const css = readFileSync(".design-sync/.cache/build/tailwind.css", "utf8");
writeFileSync(".design-sync/.cache/build/entry.css", fontImport + css);
