import { useMemo } from "react";
import katex from "katex";
// Registers \ce{...} and \pu{...} (mhchem) as KaTeX macros — chemical formulas,
// ionic charges, reaction arrows and states of matter all come from this.
import "katex/contrib/mhchem";
// The stylesheet lives here rather than in main.tsx so it ships with whichever
// chunk actually typesets something, instead of blocking the first paint of
// every screen in the app, most of which contain no maths at all.
import "katex/dist/katex.min.css";

/**
 * Mathematical + chemical notation for lesson bodies, story cards, questions
 * and explanations (CDC: maths/physique/chimie need real typesetting, not
 * "H2SO4" in plain text).
 *
 * Authoring syntax — deliberately the same everywhere content is written:
 *   $ ... $      inline maths        e.g. $\lim_{x \to 0} \frac{\sin x}{x} = 1$
 *   $$ ... $$    display maths       (own line, centred, larger operators)
 *   \ce{ ... }   chemistry           e.g. \ce{2H2 + O2 -> 2H2O}, \ce{SO4^2-}
 *
 * Rendering is KaTeX's `output: "htmlAndMathml"`, so every expression carries a
 * real MathML tree for screen readers next to the visual HTML (the visual half
 * is aria-hidden by KaTeX itself) — that is what makes the equations accessible
 * without us hand-writing alt text.
 *
 * `trust: false` is what makes `dangerouslySetInnerHTML` safe here: KaTeX
 * generates the markup itself and, untrusted, refuses the commands that could
 * emit arbitrary URLs or HTML (\href, \url, \includegraphics, \htmlClass…).
 * Author text never reaches the DOM as HTML — only KaTeX's own output does.
 */

const OPTS = {
  throwOnError: false as const,
  errorColor: "#dc2626",
  strict: "ignore" as const,
  trust: false as const,
  output: "htmlAndMathml" as const,
};

/** Render TeX to KaTeX HTML. Never throws: bad input renders in red instead. */
export function texToHtml(tex: string, displayMode = false): string {
  try {
    return katex.renderToString(tex, { ...OPTS, displayMode });
  } catch (err) {
    // Only reachable for non-ParseError faults (e.g. an unsupported environment).
    return `<span style="color:#dc2626">${(err instanceof Error ? err.message : String(err)).replace(/[<>&]/g, "")}</span>`;
  }
}

/**
 * Compile-check an expression so an editor can show "what's wrong" instead of
 * silently rendering red text. Returns null when the expression is valid.
 */
export function texError(tex: string, displayMode = false): string | null {
  if (!tex.trim()) return null;
  try {
    katex.renderToString(tex, { ...OPTS, throwOnError: true, displayMode });
    return null;
  } catch (err) {
    return err instanceof Error ? err.message.replace(/^KaTeX parse error:\s*/, "") : String(err);
  }
}

/** One typeset expression. `display` centres it on its own line. */
export function Math({ tex, display = false, className }: { tex: string; display?: boolean; className?: string }) {
  const html = useMemo(() => texToHtml(tex, display), [tex, display]);
  if (display) {
    return (
      <span
        className={`block my-3 text-center overflow-x-auto overflow-y-hidden max-w-full ${className ?? ""}`}
        // Safe: the HTML is KaTeX's own output, generated with trust:false.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Splits a line into plain-text and notation segments. Kept as one exported
 * regex so the lesson renderer, the card renderer and the editor preview all
 * agree on what counts as notation.
 *
 * Order matters: `$$…$$` before `$…$`, and `\ce{…}` is matched with one level
 * of nested braces so `\ce{Ca(OH)2}` and `\ce{SO4^{2-}}` both survive.
 */
export const NOTATION_SPLIT = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\(?:ce|pu)\{(?:[^{}]|\{[^{}]*\})*\})/g;

export type NotationSegment = { kind: "text"; value: string } | { kind: "math"; tex: string; display: boolean };

/** Break a single line into text / notation segments (no React, so it is testable). */
export function splitNotation(line: string): NotationSegment[] {
  const out: NotationSegment[] = [];
  for (const part of line.split(NOTATION_SPLIT)) {
    if (!part) continue;
    if (part.startsWith("$$") && part.endsWith("$$") && part.length > 4) {
      out.push({ kind: "math", tex: part.slice(2, -2).trim(), display: true });
    } else if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
      out.push({ kind: "math", tex: part.slice(1, -1).trim(), display: false });
    } else if (/^\\(?:ce|pu)\{/.test(part)) {
      // Chemistry keeps its command, it *is* the expression.
      out.push({ kind: "math", tex: part, display: false });
    } else {
      out.push({ kind: "text", value: part });
    }
  }
  return out;
}

/** True when a string contains maths or chemistry — used to decide whether to typeset at all. */
export function hasNotation(text: string | null | undefined): boolean {
  if (!text) return false;
  NOTATION_SPLIT.lastIndex = 0;
  return NOTATION_SPLIT.test(text);
}

/**
 * The insert palette shared by the lesson editor and the question editor.
 * `snippet` is what gets dropped at the caret; `select` is the substring the
 * editor pre-selects so the author types straight over the placeholder.
 */
export interface FormulaSnippet {
  label: string;
  snippet: string;
  select?: string;
  preview: string;
}

/** Maths palette. `label` is a glyph, not prose, so it needs no translation. */
export const MATH_PALETTE: (FormulaSnippet & { key: string })[] = [
  { key: "fraction", label: "a/b", snippet: "$\\frac{a}{b}$", select: "a", preview: "\\frac{a}{b}" },
  { key: "power", label: "xⁿ", snippet: "$x^{n}$", select: "x", preview: "x^{n}" },
  { key: "subscript", label: "xₙ", snippet: "$x_{n}$", select: "x", preview: "x_{n}" },
  { key: "sqrt", label: "√", snippet: "$\\sqrt{x^2+y^2}$", select: "x^2+y^2", preview: "\\sqrt{x^2+y^2}" },
  { key: "limit", label: "lim", snippet: "$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$", preview: "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1" },
  { key: "limitInf", label: "lim ∞", snippet: "$\\lim_{x \\to \\infty} \\frac{1}{x} = 0$", preview: "\\lim_{x \\to \\infty} \\frac{1}{x} = 0" },
  { key: "integral", label: "∫", snippet: "$\\int_a^b f(x)\\,dx$", preview: "\\int_a^b f(x)\\,dx" },
  { key: "sum", label: "Σ", snippet: "$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$", preview: "\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}" },
  { key: "derivative", label: "dy/dx", snippet: "$\\frac{dy}{dx}$", preview: "\\frac{dy}{dx}" },
  { key: "partial", label: "∂", snippet: "$\\frac{\\partial f}{\\partial x}$", preview: "\\frac{\\partial f}{\\partial x}" },
  { key: "matrix", label: "matrix", snippet: "$$\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$$", preview: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}" },
  { key: "vector", label: "vector", snippet: "$\\vec{u} \\cdot \\vec{v}$", preview: "\\vec{u} \\cdot \\vec{v}" },
  { key: "piecewise", label: "piecewise", snippet: "$$f(x) = \\begin{cases} x & x \\ge 0 \\\\ -x & x < 0 \\end{cases}$$", preview: "f(x) = \\begin{cases} x & x \\ge 0 \\\\ -x & x < 0 \\end{cases}" },
  { key: "abs", label: "|x|", snippet: "$\\left| x \\right|$", preview: "\\left| x \\right|" },
  { key: "greek", label: "α β γ", snippet: "$\\alpha, \\beta, \\gamma, \\Delta, \\pi, \\theta, \\lambda, \\mu, \\Omega$", preview: "\\alpha, \\beta, \\gamma, \\Delta, \\pi, \\theta" },
  { key: "display", label: "$$…$$", snippet: "$$\n\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1\n$$", preview: "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1" },
];

/** Chemistry palette (mhchem). */
export const CHEM_PALETTE: (FormulaSnippet & { key: string })[] = [
  { key: "water", label: "H₂O", snippet: "\\ce{H2O}", preview: "\\ce{H2O}" },
  { key: "co2", label: "CO₂", snippet: "\\ce{CO2}", preview: "\\ce{CO2}" },
  { key: "acid", label: "H₂SO₄", snippet: "\\ce{H2SO4}", preview: "\\ce{H2SO4}" },
  { key: "cation", label: "NH₄⁺", snippet: "\\ce{NH4+}", preview: "\\ce{NH4+}" },
  { key: "anion", label: "SO₄²⁻", snippet: "\\ce{SO4^2-}", preview: "\\ce{SO4^2-}" },
  { key: "group", label: "Ca(OH)₂", snippet: "\\ce{Ca(OH)2}", preview: "\\ce{Ca(OH)2}" },
  { key: "reaction", label: "A → B", snippet: "\\ce{2H2 + O2 -> 2H2O}", preview: "\\ce{2H2 + O2 -> 2H2O}" },
  { key: "reversible", label: "A ⇌ B", snippet: "\\ce{N2 + 3H2 <=> 2NH3}", preview: "\\ce{N2 + 3H2 <=> 2NH3}" },
  { key: "decomposition", label: "CaCO₃ →", snippet: "\\ce{CaCO3 -> CaO + CO2}", preview: "\\ce{CaCO3 -> CaO + CO2}" },
  { key: "states", label: "(s) (l) (g) (aq)", snippet: "\\ce{NaCl(s) -> Na+(aq) + Cl-(aq)}", preview: "\\ce{NaCl(s) -> Na+(aq) + Cl-(aq)}" },
  { key: "units", label: "units", snippet: "\\pu{0.1 mol/L}", preview: "\\pu{0.1 mol/L}" },
];
