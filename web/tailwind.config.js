/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        "kd-bg": "#08090a",
        "kd-panel": "#0f1011",
        "kd-surface": "#191a1b",
        "kd-surface2": "#28282c",
        "fg-1": "#dde0e4",
        "fg-2": "#d0d6e0",
        "fg-3": "#8a8f98",
        "fg-4": "#62666d",
        "indigo-brand": "#5e6ad2",
        "violet-brand": "#7170ff",
        "violet-hov": "#828fff",
        "green-ok": "#10b981",
        "amber-warn": "#f59e0b",
        "red-err": "#ef4444",
      },
      fontFamily: {
        sans: [
          '"Inter Variable"',
          "Inter",
          '"Pretendard Variable"',
          "Pretendard",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          '"Berkeley Mono"',
          '"JetBrains Mono"',
          "ui-monospace",
          "SF Mono",
          "Menlo",
          "monospace",
        ],
      },
      fontWeight: {
        med: "510",
        emp: "590",
      },
    },
  },
  plugins: [],
};
