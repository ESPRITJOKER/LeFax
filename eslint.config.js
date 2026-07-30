import js from "@eslint/js";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

// Flat config built directly on the installed @typescript-eslint parser/plugin
// (the `typescript-eslint` meta-package is not a dependency of this project).
// Scoped to the app source; build output, design-sync tooling, and the Deno
// Edge Functions (different runtime/globals) are excluded.
export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".vite/**",
      ".ds-sync/**",
      ".design-sync/**",
      "ds-bundle/**",
      "stitch_lefax_course_exam_prep/**",
      "supabase/**",
      "*.config.js",
      "*.config.ts",
      "*.config.cjs",
    ],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // TypeScript itself checks for undefined identifiers and unused vars;
      // the core rules double-report (and no-undef misfires on type-only
      // references like React.ReactNode). Defer both to the TS-aware rules.
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
];
