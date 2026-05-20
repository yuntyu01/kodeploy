// 가이드 섹션 공용 building blocks.
// Section/Bullet/Code/CodeBlock — Basics, Python, Java 모두 import.

export function Section({ title, children }) {
  return (
    <section className="mb-10">
      <h2
        className="text-[17px] text-fg-1 mb-3"
        style={{ fontWeight: 590, letterSpacing: -0.2 }}
      >
        {title}
      </h2>
      <div className="text-[14px] text-fg-3 leading-relaxed">{children}</div>
    </section>
  );
}

export function Bullet({ children }) {
  return (
    <div className="flex gap-2 mb-1.5">
      <span style={{ color: "#818be0" }}>·</span>
      <span>{children}</span>
    </div>
  );
}

// inline 코드 — mono 폰트 X. 본문(fg-3)보다 한 단계 밝은 fg-2로 강조.
export function Code({ children }) {
  return <span style={{ color: "#d0d6e0" }}>{children}</span>;
}

// 여러 줄 코드 — sans 폰트 유지(inherit), 줄바꿈/들여쓰기는 whiteSpace: pre.
export function CodeBlock({ children }) {
  return (
    <pre
      className="text-[13px] text-fg-2 p-3 rounded-md overflow-auto scroll-thin"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        whiteSpace: "pre",
        fontFamily: "inherit",
      }}
    >
      {children}
    </pre>
  );
}
