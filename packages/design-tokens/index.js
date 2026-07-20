/**
 * Tailwind preset for the "Lefax Academy System" design.
 * Values copied verbatim from the Stitch export's inline tailwind.config
 * script (see stitch_lefax_course_exam_prep/*\/code.html) so ported screens
 * stay pixel-parity with the original mockups / screen.png references.
 * Source of truth doc: stitch_lefax_course_exam_prep/lefax_academy_system/DESIGN.md
 */
const preset = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "tertiary-container": "#002468",
        "success-green": "#2E7D32",
        "inverse-primary": "#c3c3eb",
        "on-secondary-fixed": "#261a00",
        "surface-variant": "#e0e3e5",
        "on-secondary": "#ffffff",
        "surface-container-highest": "#e0e3e5",
        primary: "#101230",
        background: "#f7f9fb",
        "inverse-surface": "#2d3133",
        "inverse-on-surface": "#eff1f3",
        "secondary-fixed": "#ffdf9e",
        error: "#ba1a1a",
        "on-secondary-container": "#6c5000",
        "secondary-fixed-dim": "#fabd00",
        "on-tertiary-container": "#5f8bff",
        "excellence-blue": "#252746",
        "on-secondary-fixed-variant": "#5b4300",
        "on-primary-fixed": "#171937",
        "on-error": "#ffffff",
        "surface-dim": "#d8dadc",
        surface: "#f7f9fb",
        "text-secondary": "#64748B",
        "error-red": "#D32F2F",
        "error-container": "#ffdad6",
        "on-tertiary-fixed": "#00174a",
        "achievement-gold": "#FFC107",
        "surface-container-lowest": "#ffffff",
        "on-background": "#191c1e",
        "secondary-container": "#fdc003",
        "on-tertiary": "#ffffff",
        "surface-container-high": "#e6e8ea",
        "surface-container": "#eceef0",
        "surface-tint": "#5a5c7e",
        "primary-container": "#252746",
        "primary-fixed": "#e0e0ff",
        "surface-container-low": "#f2f4f6",
        "surface-gray": "#F3E9F7",
        "on-surface": "#191c1e",
        "on-error-container": "#93000a",
        "surface-bright": "#f7f9fb",
        "tertiary-fixed": "#dbe1ff",
        secondary: "#785900",
        "outline-variant": "#c8c5ce",
        "action-blue": "#0064FF",
        "on-primary": "#ffffff",
        "text-primary": "#1F3545",
        "tertiary-fixed-dim": "#b3c5ff",
        "primary-fixed-dim": "#c3c3eb",
        tertiary: "#00123c",
        "on-surface-variant": "#46464d",
        outline: "#77767e",
        "on-primary-fixed-variant": "#424465",
        "on-primary-container": "#8d8eb3",
        "on-tertiary-fixed-variant": "#003ea6",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
      spacing: {
        sm: "8px",
        base: "4px",
        xs: "4px",
        lg: "24px",
        xl: "32px",
        "margin-desktop": "32px",
        gutter: "16px",
        "margin-mobile": "16px",
        md: "16px",
      },
      fontFamily: {
        "label-md": ["Inter"],
        "body-lg": ["Inter"],
        "label-lg": ["Inter"],
        "body-sm": ["Inter"],
        "body-md": ["Inter"],
        "display-lg": ["Hanken Grotesk"],
        "headline-lg-mobile": ["Hanken Grotesk"],
        "headline-md": ["Hanken Grotesk"],
        "headline-lg": ["Hanken Grotesk"],
      },
      fontSize: {
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.04em", fontWeight: "500" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "label-lg": ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "600" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "display-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg-mobile": ["22px", { lineHeight: "28px", fontWeight: "600" }],
        "headline-md": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "headline-lg": ["24px", { lineHeight: "32px", fontWeight: "600" }],
      },
    },
  },
};

// Non-Tailwind constants shared by apps/web (font <link> tags, shell widths).
const fontLinks = [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Hanken+Grotesk:wght@600;700;800&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap",
  },
];

const layout = {
  studentMaxWidth: "720px",
  staffMaxWidth: "1200px",
};

module.exports = preset;
module.exports.preset = preset;
module.exports.fontLinks = fontLinks;
module.exports.layout = layout;
