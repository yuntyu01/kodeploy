// 로그인 모달 — fixed full-screen overlay + 가운데 카드.
// 옵션: GitHub OAuth 단일 (OAuth 와이어업은 추후 — 현재는 onLogin 콜백만).
// Esc / 배경 클릭 / X 버튼으로 닫힘. body scroll lock.
import { useEffect } from "react";
import { X } from "lucide-react";
import Brand from "./Brand.jsx";
import { GITHUB_LOGIN_URL } from "../api/auth.js";

// GitHub mark — lucide-react 1.16.0에 브랜드 아이콘 없음 → inline SVG
function GithubMark({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
    </svg>
  );
}

export default function LoginModal({ onClose }) {
  // GitHub OAuth는 백엔드가 state cookie 발급 후 GitHub로 302 redirect 해야 하므로
  // XHR 대신 full-page navigation (location 이동)으로 들어간다.
  const handleGithub = () => {
    window.location.href = GITHUB_LOGIN_URL;
  };

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center kd-fade-in"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        className="relative w-[420px] max-w-[92vw] px-10 pt-12 pb-10 rounded-xl"
        style={{
          background: "var(--kd-bg)",
          border: "1px solid var(--line-2)",
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-md text-fg-4 hover:text-fg-1 hover:bg-[var(--line-1)] transition-colors flex items-center justify-center"
          aria-label="닫기"
        >
          <X size={14} strokeWidth={1.8} />
        </button>

        <div className="flex flex-col items-center mb-8">
          <Brand size={28} />
          <h2
            className="mt-5 text-[20px] text-fg-1"
            style={{ fontWeight: 510, letterSpacing: -0.5 }}
          >
            로그인
          </h2>
          <p className="mt-1.5 text-[13px] text-fg-3">
            KoDeploy 계정으로 계속하세요
          </p>
        </div>

        <button
          onClick={handleGithub}
          className="w-full h-11 rounded-full flex items-center justify-center gap-2.5 text-[13.5px] text-white transition-colors relative"
          style={{
            background: "#5e6ad2",
            border: "1px solid transparent",
            fontWeight: 510,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#828fff")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#5e6ad2")}
        >
          <span className="absolute left-5 flex items-center">
            <GithubMark size={16} />
          </span>
          <span>GitHub 로 계속하기</span>
        </button>

        <p
          className="mt-7 text-center text-[11px] text-fg-4 leading-[1.5]"
          style={{ textWrap: "pretty" }}
        >
          계속 진행하면{" "}
          <span className="text-fg-3">서비스 약관</span> 과{" "}
          <span className="text-fg-3">개인정보 처리방침</span> 에 동의하는 것으로
          간주됩니다.
        </p>
      </div>
    </div>
  );
}
