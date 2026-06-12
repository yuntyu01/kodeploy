// 가이드 섹션 공용 building blocks.
// Section/Bullet/Code/CodeBlock - Basics, Python, Java 모두 import.
import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

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

// inline 코드 - mono 폰트 X. 본문(fg-3)보다 한 단계 밝은 fg-2로 강조.
export function Code({ children }) {
  return <span style={{ color: "#d0d6e0" }}>{children}</span>;
}

// 여러 줄 코드 - sans 폰트 유지(inherit), 줄바꿈/들여쓰기는 whiteSpace: pre.
// 우상단 복사 버튼 - pre의 innerText로 추출 (mixed children: string + HL span 모두 지원).
export function CodeBlock({ children }) {
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!ref.current) return;
    try {
      await navigator.clipboard.writeText(ref.current.innerText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 차단 환경(HTTP, 권한 없음 등) - silent
    }
  };

  return (
    <div className="relative">
      <pre
        ref={ref}
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
      <button
        type="button"
        onClick={handleCopy}
        aria-label="복사"
        className="absolute top-2 right-2 p-1.5 rounded-md transition-colors"
        style={{
          color: copied ? "#818be0" : "#8a8f98",
        }}
      >
        {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.8} />}
      </button>
    </div>
  );
}
