/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#003366",
          light: "#004488",
          dark: "#002244",
        },
        gold: {
          DEFAULT: "#FFCC00",
          light: "#FFD633",
          dark: "#E6B800",
        },
        orange: {
          DEFAULT: "#FF7A1F",
          light: "#FF9147",
          dark: "#E56200",
        },
        background: "#F8FAFC",
        foreground: "#0F172A",
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        display: ["DM Sans", "sans-serif"],
      },
      boxShadow: {
        neo: "8px 8px 16px #b6c0cf, -8px -8px 16px #ffffff",
        "neo-hover": "14px 14px 30px #9aa6b8, -10px -10px 24px #ffffff",
        "neo-inset": "inset 4px 4px 8px #b6c0cf, inset -4px -4px 8px #ffffff",
        card: "0 6px 20px rgba(0, 51, 102, 0.06)",
      },
      keyframes: {
        "page-ease-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "modal-in": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.97)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.94)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "page-ease-in": "page-ease-in 300ms ease-out backwards",
        "fade-in": "fade-in 200ms ease-out backwards",
        "modal-in": "modal-in 220ms ease-out backwards",
        "pop-in": "pop-in 250ms ease-out forwards",
      },
    },
  },
  plugins: [],
};