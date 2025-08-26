/** Tailwind config tailored to the app brand tokens (drop into project when using Tailwind) */
module.exports = {
  content: ["./src/renderer/**/*.{js,jsx,ts,tsx,html}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d9b",
        },
        accent: {
          400: "#06b6d4",
        },
        surface: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          700: "#374151",
          800: "#1f2937",
          900: "#0f1724",
        },
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#f43f5e",
        info: "#0ea5e9",
      },
      borderRadius: {
        "2xl": "1rem",
      },
      boxShadow: {
        card: "0 2px 10px rgba(0,0,0,0.08)",
        popover: "0 8px 30px rgba(0,0,0,0.12)",
      },
      transitionDuration: {
        150: "150ms",
      },
      translate: {
        0.5: "0.125rem",
      },
    },
  },
  plugins: [],
};
