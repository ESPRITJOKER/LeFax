import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Correction N6, remark 5 — "le chargement d'une page prend 1 à 2 secondes".
 *
 * Route-level `React.lazy` (src/App.tsx) is what removes the admin and teacher
 * panels from a student's download. `manualChunks` does the other half: it
 * pins the three dependencies that never change between releases into their own
 * files, so a content deploy does not invalidate 250 kB of vendor code in every
 * student's browser cache.
 *
 * KaTeX is deliberately its own chunk AND is no longer imported from main.tsx:
 * only the screens that typeset maths or chemistry pull it in.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          katex: ["katex"],
        },
      },
    },
  },
});
