/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 2px 10px rgb(0 0 0 / 0.08)",
        popover: "0 8px 30px rgb(0 0 0 / 0.12)",
      },
      colors: {
        primary: {
          DEFAULT: "#7c3aed",
          hover: "#8b5cf6",
          ring: "#a78bfa",
        },
        accent: "#22d3ee",
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#f43f5e",
        info: "#0ea5e9",
      },
    },
  },
  plugins: [],
};
