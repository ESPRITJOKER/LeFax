import { useMemo } from "react";
import katex from "katex";
// Registers \ce{...} and \pu{...} (mhchem) as KaTeX macros — chemical formulas,
// ionic charges, reaction arrows and states of matter all come from this.
import "katex/contrib/mhchem";
// The stylesheet lives here rather than in main.tsx so it ships with whichever
// chunk actually typesets something, instead of blocking the first paint of
// every screen in the app, most of which contain no maths at all.
import "katex/dist/katex.min.css";
import { NOTATION_SOURCE } from "./markupSyntax";
import type { DictKey } from "./i18n";

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
 * The pattern itself lives in `./markupSyntax` (which imports neither React nor
 * KaTeX) so that the table-cell splitter can reuse it to protect a `|` that
 * belongs to TeX — `$\|v\| = 1$` in a table cell — without dragging KaTeX into
 * the pure parser. One definition, three consumers.
 */
export const NOTATION_SPLIT = new RegExp(`(${NOTATION_SOURCE})`, "g");

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


/**
 * The Ω palette. These insert BARE UNICODE, not TeX — a degree sign or an arrow
 * in a sentence should stay searchable, selectable text, not become a KaTeX
 * span. The ribbon offers a toggle for authors who do want `$…$` around it.
 *
 * `chars` are the characters themselves, so none of this needs translating; only
 * the group names do, and they are `DictKey`s resolved by the caller.
 */
export const SYMBOL_GROUPS: { key: string; titleKey: DictKey; chars: string[] }[] = [
  {
    key: "greek",
    titleKey: "ed_symGreek",
    chars: ["α", "β", "γ", "δ", "ε", "θ", "λ", "μ", "π", "ρ", "σ", "τ", "φ", "χ", "ψ", "ω", "Δ", "Σ", "Ω", "Φ", "Λ", "Γ"],
  },
  {
    key: "math",
    titleKey: "ed_symMath",
    chars: ["±", "×", "÷", "≠", "≈", "≤", "≥", "∞", "√", "∑", "∏", "∫", "∂", "∆", "%", "‰", "°", "′", "″", "·", "…", "∝"],
  },
  {
    key: "arrows",
    titleKey: "ed_symArrows",
    chars: ["→", "←", "↑", "↓", "↔", "⇒", "⇐", "⇔", "⇌", "⟶", "↗", "↘"],
  },
  {
    key: "units",
    titleKey: "ed_symUnits",
    chars: ["µ", "Å", "Ω", "℃", "℉", "ⁿ", "⁰", "¹", "²", "³", "⁴", "₀", "₁", "₂", "₃", "₄", "⁺", "⁻"],
  },
  {
    key: "bio",
    titleKey: "ed_symBio",
    chars: ["♀", "♂", "✓", "✗", "•", "‣", "★", "☆", "⚠", "†", "‡", "§", "¶", "«", "»", "“", "”", "’", "–", "—"],
  },
];

/**
 * A named group of templates. The palettes used to be two flat rows of ~16
 * items with tiny previews, which is why the client reported being unable to
 * "input equations as they are" — a limit to infinity, a derivative or an ion
 * charge was all in there somewhere, but unfindable, and anything not in the row
 * had to be typed as raw LaTeX. Grouping them by what an author is trying to
 * write turns the palette into something you can look things up in.
 *
 * `titleKey` is a `DictKey`; the item labels are glyphs, so they need no
 * translation.
 */
export interface FormulaGroup {
  key: string;
  titleKey: DictKey;
  items: (FormulaSnippet & { key: string })[];
}

/**
 * Maths templates. `snippet` carries the `$…$` an expression needs when it goes
 * straight into a lesson; the formula panel strips the wrapper while editing and
 * puts it back on insert. `select` is the placeholder the editor pre-selects, so
 * the author types straight over it.
 */
export const MATH_GROUPS: FormulaGroup[] = [
  {
    key: "base",
    titleKey: "fx_grpBase",
    items: [
      { key: "fraction", label: "a/b", snippet: "$\\frac{a}{b}$", select: "a", preview: "\\frac{a}{b}" },
      { key: "mixed", label: "a b/c", snippet: "$a\\frac{b}{c}$", select: "a", preview: "a\\frac{b}{c}" },
      { key: "sqrt", label: "√", snippet: "$\\sqrt{x}$", select: "x", preview: "\\sqrt{x}" },
      { key: "nthroot", label: "ⁿ√", snippet: "$\\sqrt[n]{x}$", select: "x", preview: "\\sqrt[n]{x}" },
      { key: "abs", label: "|x|", snippet: "$\\left| x \\right|$", select: "x", preview: "\\left| x \\right|" },
      { key: "paren", label: "( )", snippet: "$\\left( x \\right)$", select: "x", preview: "\\left( x \\right)" },
      { key: "brace", label: "{ }", snippet: "$\\left\\{ x \\right\\}$", select: "x", preview: "\\left\\{ x \\right\\}" },
      { key: "times", label: "×", snippet: "$a \\times b$", select: "a", preview: "a \\times b" },
      { key: "div", label: "÷", snippet: "$a \\div b$", select: "a", preview: "a \\div b" },
      { key: "pm", label: "±", snippet: "$a \\pm b$", select: "a", preview: "a \\pm b" },
    ],
  },
  {
    key: "powers",
    titleKey: "fx_grpPowers",
    items: [
      { key: "power", label: "xⁿ", snippet: "$x^{n}$", select: "n", preview: "x^{n}" },
      { key: "square", label: "x²", snippet: "$x^{2}$", select: "x", preview: "x^{2}" },
      { key: "cube", label: "x³", snippet: "$x^{3}$", select: "x", preview: "x^{3}" },
      { key: "subscript", label: "xₙ", snippet: "$x_{n}$", select: "n", preview: "x_{n}" },
      { key: "subsup", label: "xᵢⁿ", snippet: "$x_{i}^{n}$", select: "i", preview: "x_{i}^{n}" },
      { key: "exp", label: "eˣ", snippet: "$e^{x}$", select: "x", preview: "e^{x}" },
      { key: "ten", label: "10⁻³", snippet: "$10^{-3}$", select: "-3", preview: "10^{-3}" },
      { key: "ln", label: "ln", snippet: "$\\ln x$", select: "x", preview: "\\ln x" },
      { key: "log", label: "log", snippet: "$\\log_{10} x$", select: "x", preview: "\\log_{10} x" },
    ],
  },
  {
    key: "limits",
    titleKey: "fx_grpLimits",
    items: [
      { key: "lim0", label: "lim x→0", snippet: "$\\lim_{x \\to 0} f(x)$", select: "f(x)", preview: "\\lim_{x \\to 0} f(x)" },
      { key: "limInf", label: "lim x→∞", snippet: "$\\lim_{x \\to +\\infty} f(x)$", select: "f(x)", preview: "\\lim_{x \\to +\\infty} f(x)" },
      { key: "limMinusInf", label: "lim x→−∞", snippet: "$\\lim_{x \\to -\\infty} f(x)$", select: "f(x)", preview: "\\lim_{x \\to -\\infty} f(x)" },
      { key: "limRight", label: "lim x→a⁺", snippet: "$\\lim_{x \\to a^{+}} f(x)$", select: "f(x)", preview: "\\lim_{x \\to a^{+}} f(x)" },
      { key: "limLeft", label: "lim x→a⁻", snippet: "$\\lim_{x \\to a^{-}} f(x)$", select: "f(x)", preview: "\\lim_{x \\to a^{-}} f(x)" },
      { key: "limClassic", label: "sin x / x", snippet: "$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$", preview: "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1" },
      { key: "infinity", label: "∞", snippet: "$\\infty$", preview: "\\infty" },
      { key: "to", label: "→", snippet: "$x \\to a$", select: "a", preview: "x \\to a" },
    ],
  },
  {
    key: "calculus",
    titleKey: "fx_grpCalculus",
    items: [
      { key: "dydx", label: "dy/dx", snippet: "$\\frac{dy}{dx}$", preview: "\\frac{dy}{dx}" },
      { key: "ddx", label: "d/dx", snippet: "$\\frac{d}{dx}\\left( f(x) \\right)$", select: "f(x)", preview: "\\frac{d}{dx}\\left( f(x) \\right)" },
      { key: "d2ydx2", label: "d²y/dx²", snippet: "$\\frac{d^{2}y}{dx^{2}}$", preview: "\\frac{d^{2}y}{dx^{2}}" },
      { key: "partial", label: "∂f/∂x", snippet: "$\\frac{\\partial f}{\\partial x}$", preview: "\\frac{\\partial f}{\\partial x}" },
      { key: "prime", label: "f′(x)", snippet: "$f'(x)$", preview: "f'(x)" },
      { key: "integral", label: "∫", snippet: "$\\int f(x)\\,dx$", select: "f(x)", preview: "\\int f(x)\\,dx" },
      { key: "integralAB", label: "∫ₐᵇ", snippet: "$\\int_{a}^{b} f(x)\\,dx$", select: "f(x)", preview: "\\int_{a}^{b} f(x)\\,dx" },
      { key: "doubleIntegral", label: "∬", snippet: "$\\iint_{D} f(x,y)\\,dx\\,dy$", select: "f(x,y)", preview: "\\iint_{D} f(x,y)\\,dx\\,dy" },
      { key: "sum", label: "Σ", snippet: "$\\sum_{i=1}^{n} u_{i}$", select: "u_{i}", preview: "\\sum_{i=1}^{n} u_{i}" },
      { key: "prod", label: "Π", snippet: "$\\prod_{i=1}^{n} u_{i}$", select: "u_{i}", preview: "\\prod_{i=1}^{n} u_{i}" },
    ],
  },
  {
    key: "trig",
    titleKey: "fx_grpTrig",
    items: [
      { key: "sin", label: "sin", snippet: "$\\sin x$", select: "x", preview: "\\sin x" },
      { key: "cos", label: "cos", snippet: "$\\cos x$", select: "x", preview: "\\cos x" },
      { key: "tan", label: "tan", snippet: "$\\tan x$", select: "x", preview: "\\tan x" },
      { key: "arcsin", label: "arcsin", snippet: "$\\arcsin x$", select: "x", preview: "\\arcsin x" },
      { key: "pythag", label: "sin²+cos²", snippet: "$\\sin^{2} x + \\cos^{2} x = 1$", preview: "\\sin^{2} x + \\cos^{2} x = 1" },
      { key: "degree", label: "°", snippet: "$30^{\\circ}$", select: "30", preview: "30^{\\circ}" },
      { key: "pi", label: "π", snippet: "$\\pi$", preview: "\\pi" },
      { key: "piOver", label: "π/2", snippet: "$\\frac{\\pi}{2}$", preview: "\\frac{\\pi}{2}" },
    ],
  },
  {
    key: "matrices",
    titleKey: "fx_grpMatrices",
    items: [
      { key: "matrix2", label: "[2×2]", snippet: "$$\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$$", select: "a", preview: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}" },
      { key: "matrix3", label: "[3×3]", snippet: "$$\\begin{bmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{bmatrix}$$", select: "a", preview: "\\begin{bmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{bmatrix}" },
      { key: "paren2", label: "(2×2)", snippet: "$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$", select: "a", preview: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
      { key: "det", label: "det", snippet: "$$\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}$$", select: "a", preview: "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}" },
      { key: "cases", label: "système", snippet: "$$\\begin{cases} x + y = 1 \\\\ x - y = 0 \\end{cases}$$", select: "x + y = 1", preview: "\\begin{cases} x + y = 1 \\\\ x - y = 0 \\end{cases}" },
      { key: "piecewise", label: "par morceaux", snippet: "$$f(x) = \\begin{cases} x & \\text{si } x \\ge 0 \\\\ -x & \\text{sinon} \\end{cases}$$", preview: "f(x) = \\begin{cases} x & x \\ge 0 \\\\ -x & x < 0 \\end{cases}" },
      { key: "vector", label: "u⃗·v⃗", snippet: "$\\vec{u} \\cdot \\vec{v}$", preview: "\\vec{u} \\cdot \\vec{v}" },
      { key: "norm", label: "‖u⃗‖", snippet: "$\\left\\| \\vec{u} \\right\\|$", preview: "\\left\\| \\vec{u} \\right\\|" },
    ],
  },
  {
    key: "relations",
    titleKey: "fx_grpRelations",
    items: [
      { key: "le", label: "≤", snippet: "$a \\le b$", select: "a", preview: "a \\le b" },
      { key: "ge", label: "≥", snippet: "$a \\ge b$", select: "a", preview: "a \\ge b" },
      { key: "ne", label: "≠", snippet: "$a \\ne b$", select: "a", preview: "a \\ne b" },
      { key: "approx", label: "≈", snippet: "$a \\approx b$", select: "a", preview: "a \\approx b" },
      { key: "equiv", label: "≡", snippet: "$a \\equiv b$", select: "a", preview: "a \\equiv b" },
      { key: "in", label: "∈", snippet: "$x \\in \\mathbb{R}$", select: "x", preview: "x \\in \\mathbb{R}" },
      { key: "subset", label: "⊂", snippet: "$A \\subset B$", select: "A", preview: "A \\subset B" },
      { key: "implies", label: "⇒", snippet: "$P \\Rightarrow Q$", select: "P", preview: "P \\Rightarrow Q" },
      { key: "iff", label: "⇔", snippet: "$P \\Leftrightarrow Q$", select: "P", preview: "P \\Leftrightarrow Q" },
      { key: "forall", label: "∀", snippet: "$\\forall x \\in \\mathbb{R}$", preview: "\\forall x \\in \\mathbb{R}" },
      { key: "exists", label: "∃", snippet: "$\\exists x$", preview: "\\exists x" },
      { key: "interval", label: "[a;b]", snippet: "$\\left[ a\\,;\\, b \\right]$", select: "a", preview: "\\left[ a\\,;\\, b \\right]" },
    ],
  },
  {
    key: "greek",
    titleKey: "ed_symGreek",
    items: [
      { key: "alpha", label: "α", snippet: "$\\alpha$", preview: "\\alpha" },
      { key: "beta", label: "β", snippet: "$\\beta$", preview: "\\beta" },
      { key: "gamma", label: "γ", snippet: "$\\gamma$", preview: "\\gamma" },
      { key: "delta", label: "δ", snippet: "$\\delta$", preview: "\\delta" },
      { key: "Delta", label: "Δ", snippet: "$\\Delta$", preview: "\\Delta" },
      { key: "theta", label: "θ", snippet: "$\\theta$", preview: "\\theta" },
      { key: "lambda", label: "λ", snippet: "$\\lambda$", preview: "\\lambda" },
      { key: "mu", label: "μ", snippet: "$\\mu$", preview: "\\mu" },
      { key: "rho", label: "ρ", snippet: "$\\rho$", preview: "\\rho" },
      { key: "sigma", label: "σ", snippet: "$\\sigma$", preview: "\\sigma" },
      { key: "Sigma", label: "Σ", snippet: "$\\Sigma$", preview: "\\Sigma" },
      { key: "phi", label: "φ", snippet: "$\\varphi$", preview: "\\varphi" },
      { key: "omega", label: "ω", snippet: "$\\omega$", preview: "\\omega" },
      { key: "Omega", label: "Ω", snippet: "$\\Omega$", preview: "\\Omega" },
    ],
  },
];

/**
 * Chemistry templates (mhchem). Everything here is a `\ce{…}` expression, which
 * is already complete notation and needs no `$` wrapper.
 *
 * The groups answer the client's "chemical formulas with bases and powers"
 * directly: mhchem writes a subscript from a bare digit (`H2O` → H₂O) and a
 * charge from a trailing sign (`SO4^2-` → SO₄²⁻), which is not guessable, so the
 * templates show the shape and the author edits the symbols.
 */
export const CHEM_GROUPS: FormulaGroup[] = [
  {
    key: "formulas",
    titleKey: "fx_grpFormulas",
    items: [
      { key: "water", label: "H₂O", snippet: "\\ce{H2O}", preview: "\\ce{H2O}" },
      { key: "co2", label: "CO₂", snippet: "\\ce{CO2}", preview: "\\ce{CO2}" },
      { key: "acid", label: "H₂SO₄", snippet: "\\ce{H2SO4}", preview: "\\ce{H2SO4}" },
      { key: "glucose", label: "C₆H₁₂O₆", snippet: "\\ce{C6H12O6}", preview: "\\ce{C6H12O6}" },
      { key: "group", label: "Ca(OH)₂", snippet: "\\ce{Ca(OH)2}", preview: "\\ce{Ca(OH)2}" },
      { key: "hydrate", label: "CuSO₄·5H₂O", snippet: "\\ce{CuSO4 * 5H2O}", preview: "\\ce{CuSO4 * 5H2O}" },
      { key: "sub", label: "indice", snippet: "\\ce{X2}", select: "X", preview: "\\ce{X2}" },
      { key: "coefficient", label: "2 X", snippet: "\\ce{2X}", select: "X", preview: "\\ce{2X}" },
    ],
  },
  {
    key: "ions",
    titleKey: "fx_grpIons",
    items: [
      { key: "cation", label: "NH₄⁺", snippet: "\\ce{NH4+}", preview: "\\ce{NH4+}" },
      { key: "anion", label: "SO₄²⁻", snippet: "\\ce{SO4^2-}", preview: "\\ce{SO4^2-}" },
      { key: "fe3", label: "Fe³⁺", snippet: "\\ce{Fe^3+}", preview: "\\ce{Fe^3+}" },
      { key: "chloride", label: "Cl⁻", snippet: "\\ce{Cl-}", preview: "\\ce{Cl-}" },
      { key: "oxide", label: "O²⁻", snippet: "\\ce{O^2-}", preview: "\\ce{O^2-}" },
      { key: "chargeTpl", label: "charge", snippet: "\\ce{X^n+}", select: "X", preview: "\\ce{X^n+}" },
      { key: "isotope", label: "¹⁴₆C", snippet: "\\ce{^14_6C}", preview: "\\ce{^14_6C}" },
      { key: "electron", label: "e⁻", snippet: "\\ce{e-}", preview: "\\ce{e-}" },
    ],
  },
  {
    key: "reactions",
    titleKey: "fx_grpReactions",
    items: [
      { key: "forward", label: "A → B", snippet: "\\ce{2H2 + O2 -> 2H2O}", preview: "\\ce{2H2 + O2 -> 2H2O}" },
      { key: "reversible", label: "A ⇌ B", snippet: "\\ce{N2 + 3H2 <=> 2NH3}", preview: "\\ce{N2 + 3H2 <=> 2NH3}" },
      { key: "backward", label: "A ← B", snippet: "\\ce{A <- B}", select: "A", preview: "\\ce{A <- B}" },
      { key: "decomposition", label: "décomposition", snippet: "\\ce{CaCO3 -> CaO + CO2}", preview: "\\ce{CaCO3 -> CaO + CO2}" },
      { key: "conditions", label: "→ (Δ)", snippet: "\\ce{A ->[\\Delta] B}", select: "A", preview: "\\ce{A ->[\\Delta] B}" },
      { key: "catalyst", label: "→ (cat.)", snippet: "\\ce{A ->[catalyseur] B}", select: "A", preview: "\\ce{A ->[cat.] B}" },
      { key: "dissociation", label: "dissociation", snippet: "\\ce{NaCl(s) -> Na+(aq) + Cl-(aq)}", preview: "\\ce{NaCl(s) -> Na+(aq) + Cl-(aq)}" },
      { key: "acidbase", label: "acide/base", snippet: "\\ce{HA + H2O <=> A- + H3O+}", preview: "\\ce{HA + H2O <=> A- + H3O+}" },
    ],
  },
  {
    key: "states",
    titleKey: "fx_grpStates",
    items: [
      { key: "solid", label: "(s)", snippet: "\\ce{X(s)}", select: "X", preview: "\\ce{X(s)}" },
      { key: "liquid", label: "(l)", snippet: "\\ce{X(l)}", select: "X", preview: "\\ce{X(l)}" },
      { key: "gas", label: "(g)", snippet: "\\ce{X(g)}", select: "X", preview: "\\ce{X(g)}" },
      { key: "aqueous", label: "(aq)", snippet: "\\ce{X(aq)}", select: "X", preview: "\\ce{X(aq)}" },
      { key: "precipitate", label: "↓", snippet: "\\ce{X v}", select: "X", preview: "\\ce{X v}" },
      { key: "gasUp", label: "↑", snippet: "\\ce{X ^}", select: "X", preview: "\\ce{X ^}" },
      { key: "units", label: "0,1 mol/L", snippet: "\\pu{0.1 mol/L}", preview: "\\pu{0.1 mol/L}" },
      { key: "unitsTpl", label: "unité", snippet: "\\pu{1 g//mol}", select: "1", preview: "\\pu{1 g//mol}" },
    ],
  },
];
