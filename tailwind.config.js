/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // LeFax design system: Poppins for headings/display/bold, Inter for body.
        // `serif` is kept as an alias to the display font so existing
        // `font-serif` headings across the app pick up Poppins with no churn.
        serif: ["'Poppins'", "sans-serif"],
        display: ["'Poppins'", "sans-serif"],
        sans: ["'Inter'", "sans-serif"],
      },
      colors: {
        // Deep ink blue — dominant brand color (section 11 of the CDC)
        ink: {
          950: "var(--color-ink-950)",
          900: "var(--color-ink-900)",
          800: "var(--color-ink-800)",
          700: "var(--color-ink-700)",
          600: "var(--color-ink-600)",
          300: "var(--color-ink-300)",
          100: "var(--color-ink-100)",
          50: "var(--color-ink-50)",
        },
        // Chalkboard green — success states
        success: {
          700: "var(--color-success-700)",
          600: "var(--color-success-600)",
          100: "var(--color-success-100)",
          50: "var(--color-success-50)",
        },
        // Ocre — merit badges / FaxCoins
        ochre: {
          700: "var(--color-ochre-700)",
          600: "var(--color-ochre-600)",
          100: "var(--color-ochre-100)",
          50: "var(--color-ochre-50)",
        },
        // Reserved strictly for error / correction states
        danger: {
          700: "var(--color-danger-700)",
          600: "var(--color-danger-600)",
          100: "var(--color-danger-100)",
          50: "var(--color-danger-50)",
        },
        // Friendly brand blue — primary surfaces & buttons (see index.css)
        brand: {
          800: "var(--color-brand-800)",
          700: "var(--color-brand-700)",
          600: "var(--color-brand-600)",
          500: "var(--color-brand-500)",
          100: "var(--color-brand-100)",
          50: "var(--color-brand-50)",
        },
        heart: "var(--color-heart)",
        heartEmpty: "var(--color-heart-empty)",
        accent: "var(--color-accent)",
        surface: "var(--color-surface)",
        card: "var(--color-card)",
        border: "var(--color-border)",
        muted: "var(--color-muted)",
        // Body text token — makes `text-text` / `bg-surface text-text` resolve.
        // Without this key those classes were dropped, so back-face lesson text
        // inherited `text-white` and rendered white-on-white (corrections doc:
        // "Le blanc sur le blanc"). Themed via --color-text (light + dark).
        text: "var(--color-text)",
      },
      borderRadius: {
        card: "16px",
        pill: "999px",
      },
      keyframes: {
        flamepulse: {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.12)", opacity: ".85" },
        },
        coinspin: {
          "0%": { transform: "rotateY(0)" },
          "100%": { transform: "rotateY(360deg)" },
        },
        lazyreveal: {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "60%": { transform: "scale(1.05)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        fadeup: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        flamepulse: "flamepulse 1.6s ease-in-out infinite",
        coinspin: "coinspin 5s linear infinite",
        lazyreveal: "lazyreveal 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        fadeup: "fadeup 0.6s ease both",
      },
    },
  },
  plugins: [],
};
