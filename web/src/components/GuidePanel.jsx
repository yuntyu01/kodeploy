// DeployForm 옆에 fixed drawer로 뜨는 가이드 패널.
// TopBar 아래(60px)부터 화면 끝까지 차지. 자체 스크롤.
// runtime(python/java)에 따라 해당 섹션만 보여줌. 닫기 X 버튼.
// 동일 가이드 컨텐츠가 /guide 페이지에서도 재사용됨.
import { X } from "lucide-react";
import Java from "./guide/Java.jsx";
import Python from "./guide/Python.jsx";

const TITLES = {
  python: "Python 가이드",
  java: "Java 가이드",
};

export default function GuidePanel({ runtime, onClose }) {
  const Body = runtime === "python" ? Python : Java;
  return (
    <aside
      className="kd-slide-in-right fixed overflow-auto scroll-thin"
      style={{
        top: 60,                  // TopBar 높이
        bottom: 0,                // 화면 끝까지
        right: 0,
        width: 520,
        zIndex: 20,               // BuildListWidget(z-30)보다 낮게 — widget 위에 보임
        background: "#0f1011",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        padding: "20px 24px",
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <h3
          className="text-[15px] text-fg-1"
          style={{ fontWeight: 590, letterSpacing: -0.2 }}
        >
          {TITLES[runtime] || "가이드"}
        </h3>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-md text-fg-4 hover:text-fg-1 hover:bg-white/[0.04] transition-colors flex items-center justify-center"
          aria-label="가이드 닫기"
        >
          <X size={14} strokeWidth={1.8} />
        </button>
      </div>
      <Body />
    </aside>
  );
}
