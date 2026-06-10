import { useState } from "react";
import { HelpCircle } from "lucide-react";

// 라벨 옆 동그란 ? 아이콘 - 마우스 올리면 부가 설명 툴팁. 폼/패널 공용.
export default function InfoHint({ children }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex shrink-0 align-middle">
      <HelpCircle
        size={11}
        strokeWidth={2.25}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-fg-4 hover:text-fg-2 cursor-help shrink-0"
      />
      {show && (
        <span
          className="absolute left-0 top-6 z-30 w-64 px-3 py-2 rounded-md text-[11px]"
          style={{
            background: "#16181b",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#c5cad2",
            lineHeight: 1.6,
            fontWeight: 450,
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          }}
        >
          {children}
        </span>
      )}
    </span>
  );
}
