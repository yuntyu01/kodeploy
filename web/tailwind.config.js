/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // 표면·전경 토큰은 CSS 변수로 — [data-theme]에 따라 런타임 전환.
        // 인라인 style의 var(--…)와 동일 소스라 테마가 한 곳에서 일관된다.
        "kd-bg": "var(--kd-bg)",
        "kd-panel": "var(--kd-panel)",
        "kd-surface": "var(--kd-surface)",
        "kd-surface2": "var(--kd-surface2)",
        "kd-nav": "var(--nav-bg)",
        "kd-border": "var(--kd-border)",
        "fg-strong": "var(--fg-strong)",
        "fg-1": "var(--fg-1)",
        "fg-2": "var(--fg-2)",
        "fg-3": "var(--fg-3)",
        "fg-4": "var(--fg-4)",
        // 브랜드·상태색은 두 테마 공통(라이트 대비 미세조정은 추후 스윕에서).
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
