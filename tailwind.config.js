/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "var(--ink)", 2: "var(--ink-2)", 3: "var(--ink-3)" },
        navy: { DEFAULT: "var(--navy)", 2: "var(--navy-2)", 3: "var(--navy-3)", text: "var(--navy-text)" },
        brand: { DEFAULT: "var(--brand)", hover: "var(--brand-hover)", soft: "var(--brand-soft)" },
        surface: { DEFAULT: "var(--surface)", 2: "var(--surface-2)" },
        page: "var(--page)",
        line: { DEFAULT: "var(--line)", strong: "var(--line-strong)" },
        ok: { DEFAULT: "var(--ok)", soft: "var(--ok-soft)" },
        warn: { DEFAULT: "var(--warn)", soft: "var(--warn-soft)" },
        bad: { DEFAULT: "var(--bad)", soft: "var(--bad-soft)" },
        info: { DEFAULT: "var(--info)", soft: "var(--info-soft)" },
      },
      fontFamily: {
        sans: ['"Noto Sans"', '"Noto Sans Lao"', "system-ui", "sans-serif"],
        mono: ['"Noto Sans Mono"', '"Noto Sans Lao"', "ui-monospace", "monospace"],
      },
      fontSize: { xs: ["12px", "18px"], sm: ["13.5px", "21px"], base: ["14.5px", "23px"], lg: ["17px", "26px"], xl: ["20px", "30px"], "2xl": ["25px", "34px"], "3xl": ["32px", "40px"] },
      borderRadius: { DEFAULT: "4px", md: "6px", lg: "8px" },
      boxShadow: { pop: "0 8px 28px -6px rgb(11 42 74 / .22), 0 2px 6px -2px rgb(11 42 74 / .12)" },
    },
  },
  plugins: [],
};
