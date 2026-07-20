/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ["'Newsreader'", "serif"],
        sans: ["'Public Sans'", "sans-serif"],
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
        surface: "var(--color-surface)",
        card: "var(--color-card)",
        border: "var(--color-border)",
        muted: "var(--color-muted)",
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
      },
      animation: {
        flamepulse: "flamepulse 1.6s ease-in-out infinite",
        coinspin: "coinspin 5s linear infinite",
      },
    },
  },
  plugins: [],
};
