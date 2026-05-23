// 랜딩 페이지 ("/") — 미로그인/로그인 모두 진입.
// 미로그인 CTA → LoginModal, 로그인 CTA → /deploy.
// 톤: 기존 DeployForm/Guide와 동일 다크 + #6672d5 액센트.
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Database,
  GitBranch,
  Globe,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";

const FEATURES = [
  {
    icon: Sparkles,
    title: "자동 빌드",
    body:
      "Dockerfile이 없어도 nixpacks가 코드를 분석해 Dockerfile을 자동 생성합니다. Python · Java 등 표준 프레임워크 그대로.",
    color: "#818be0",
  },
  {
    icon: Database,
    title: "데이터베이스 토글",
    body:
      "MySQL 토글 한 번으로 같은 네임스페이스에 자동 프로비저닝. 끄면 PVC는 보존돼 데이터가 살아남아요.",
    color: "#a78bfa",
  },
  {
    icon: Globe,
    title: "HTTPS 도메인 자동",
    body:
      "your-app.kodeploy.com 서브도메인 + TLS 인증서가 배포 직후 자동 활성화. 추가 설정 0.",
    color: "#047857",
  },
  {
    icon: Shield,
    title: "격리된 실행 환경",
    body:
      "유저당 독립된 K8s 네임스페이스 + ResourceQuota로 자원 보장. PSS Restricted로 강화된 보안 프로파일.",
    color: "#f59e0b",
  },
];

const STEPS = [
  {
    n: "01",
    title: "GitHub 연결",
    body: "GitHub 계정으로 로그인 한 번이면 끝.",
  },
  {
    n: "02",
    title: "저장소 입력",
    body: "URL · 런타임 · 브랜치만 지정하면 빌드 시작.",
  },
  {
    n: "03",
    title: "도메인 받기",
    body: "빌드 완료 직후 HTTPS 도메인으로 바로 접속.",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { user, openLogin } = useAuth();

  // 미로그인은 모달, 로그인은 폼으로 — CTA 두 위치에서 공유
  const handleStart = () => {
    if (user) navigate("/deploy");
    else openLogin?.();
  };

  return (
    <div className="flex-1 overflow-auto scroll-thin relative">
      {/* Aurora — fixed viewport-relative blobs (Linear/Vercel 풍 ambient). */}
      {/* 큰 radial-gradient + blur로 보라 빛이 잔잔하게 깔리는 효과. */}
      {/* pointer-events:none이라 클릭 영향 X. Home unmount 시 자동 사라짐. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ zIndex: 0, overflow: "hidden" }}
      >
        <div
          className="absolute"
          style={{
            top: "-20%",
            left: "-10%",
            width: 720,
            height: 720,
            background:
              "radial-gradient(circle, rgba(102,114,213,0.32) 0%, rgba(102,114,213,0) 60%)",
            filter: "blur(80px)",
          }}
        />
        <div
          className="absolute"
          style={{
            top: "5%",
            right: "-15%",
            width: 640,
            height: 640,
            background:
              "radial-gradient(circle, rgba(167,139,250,0.22) 0%, rgba(167,139,250,0) 60%)",
            filter: "blur(90px)",
          }}
        />
        <div
          className="absolute"
          style={{
            top: "55%",
            left: "20%",
            width: 800,
            height: 560,
            background:
              "radial-gradient(ellipse, rgba(94,106,210,0.18) 0%, rgba(94,106,210,0) 65%)",
            filter: "blur(110px)",
          }}
        />
      </div>

      {/* Content layer (aurora 위로 떠 있음) */}
      <div className="relative" style={{ zIndex: 1 }}>
      {/* Hero */}
      <section
        className="relative kd-fade-in px-6"
        style={{ padding: "12vh 24px 8vh" }}
      >
        <div className="mx-auto text-center" style={{ maxWidth: 760 }}>
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-8"
            style={{
              background:
                "linear-gradient(135deg, rgba(129,139,224,0.14), rgba(167,139,250,0.08))",
              border: "1px solid rgba(129,139,224,0.22)",
              boxShadow: "0 0 24px rgba(129,139,224,0.15)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            <Zap size={11} strokeWidth={2} className="text-[#818be0]" />
            <span
              className="text-[11.5px] text-[#c7cbf3]"
              style={{ fontWeight: 510, letterSpacing: 0.2 }}
            >
              git push 한 번이면 배포 완료
            </span>
          </div>

          <h1
            className="text-fg-1"
            style={{
              fontSize: "clamp(36px, 6vw, 60px)",
              fontWeight: 590,
              letterSpacing: -1.5,
              lineHeight: 1.05,
            }}
          >
            GitHub 저장소를
            <br />
            <span
              style={{
                background:
                  "linear-gradient(120deg, #6672d5 0%, #a78bfa 45%, #d8b4fe 75%, #818be0 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              한 번에 배포
            </span>
            합니다
          </h1>

          <p
            className="mt-6 text-fg-3 mx-auto"
            style={{
              fontSize: 16,
              fontWeight: 450,
              lineHeight: 1.6,
              maxWidth: 560,
            }}
          >
            Dockerfile이 있으면 그대로, 없으면 자동 생성. KoDeploy가 빌드 ·
            배포 · HTTPS 도메인까지 처리합니다.
          </p>

          <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={handleStart}
              className="flex items-center gap-2 px-5 py-3 rounded-md text-[14px] text-white transition-all"
              style={{
                background:
                  "linear-gradient(135deg, #6672d5 0%, #7d6dd5 100%)",
                fontWeight: 510,
                boxShadow:
                  "0 8px 24px rgba(102,114,213,0.35), 0 0 0 1px rgba(255,255,255,0.06) inset",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  "linear-gradient(135deg, #828fff 0%, #9e8aff 100%)";
                e.currentTarget.style.boxShadow =
                  "0 12px 32px rgba(130,143,255,0.5), 0 0 0 1px rgba(255,255,255,0.1) inset";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  "linear-gradient(135deg, #6672d5 0%, #7d6dd5 100%)";
                e.currentTarget.style.boxShadow =
                  "0 8px 24px rgba(102,114,213,0.35), 0 0 0 1px rgba(255,255,255,0.06) inset";
              }}
            >
              {user ? "배포하기" : "GitHub으로 시작"}
              <ArrowRight size={14} strokeWidth={2} />
            </button>
            <Link
              to="/guide"
              className="px-5 py-3 rounded-md text-[14px] text-fg-2 hover:text-fg-1 transition-colors no-underline"
              style={{
                fontWeight: 510,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              가이드 보기
            </Link>
          </div>

          {/* Pseudo-terminal preview — frosted glass (aurora 비치게) */}
          <div
            className="mt-16 mx-auto rounded-xl overflow-hidden text-left"
            style={{
              maxWidth: 680,
              background: "rgba(15,16,17,0.55)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow:
                "0 30px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(129,139,224,0.06) inset, 0 0 60px rgba(102,114,213,0.08)",
              backdropFilter: "blur(24px) saturate(140%)",
              WebkitBackdropFilter: "blur(24px) saturate(140%)",
            }}
          >
            <div
              className="flex items-center gap-1.5 px-4 py-2.5"
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(0,0,0,0.25)",
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: "#ff5f56" }}
              />
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: "#ffbd2e" }}
              />
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: "#27c93f" }}
              />
              <span
                className="ml-3 text-[11px] text-fg-4"
                style={{ fontWeight: 450 }}
              >
                kodeploy.com
              </span>
            </div>
            <div className="p-5 text-[12.5px] leading-relaxed">
              <Line prompt="$" color="#047857">
                <span className="text-fg-2">kodeploy deploy</span>{" "}
                <span className="text-[#818be0]">github.com/me/api</span>
              </Line>
              <Line>
                <span className="text-fg-3">→ cloning · detecting runtime</span>
                <span className="text-[#818be0]"> · python</span>
              </Line>
              <Line>
                <span className="text-fg-3">→ building image (nixpacks)</span>
              </Line>
              <Line>
                <span className="text-fg-3">→ deploying to K8s</span>
              </Line>
              <Line prompt="✓" color="#047857">
                <span className="text-fg-1">https://api.kodeploy.com</span>{" "}
                <span className="text-fg-4">· 47s</span>
              </Line>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto px-6" style={{ maxWidth: 1080, paddingBottom: "10vh" }}>
        <div className="text-center mb-12">
          <div
            className="text-[10.5px] tracking-[0.12em] text-[#818be0] mb-3 uppercase"
            style={{ fontWeight: 590 }}
          >
            Features
          </div>
          <h2
            className="text-fg-1"
            style={{
              fontSize: "clamp(28px, 4vw, 38px)",
              fontWeight: 590,
              letterSpacing: -0.8,
              lineHeight: 1.15,
            }}
          >
            배포에 필요한 것들을
            <br />
            기본으로 챙겨드려요
          </h2>
        </div>

        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="p-6 rounded-xl transition-all"
                style={{
                  background: "rgba(20,21,24,0.55)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(28,29,33,0.7)";
                  e.currentTarget.style.borderColor = `${f.color}33`;
                  e.currentTarget.style.boxShadow = `0 12px 36px rgba(0,0,0,0.3), 0 0 36px ${f.color}1a`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(20,21,24,0.55)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
                  style={{
                    background: `${f.color}1c`,
                    border: `1px solid ${f.color}40`,
                  }}
                >
                  <Icon size={17} strokeWidth={1.6} style={{ color: f.color }} />
                </div>
                <h3
                  className="text-[15px] text-fg-1 mb-1.5"
                  style={{ fontWeight: 590 }}
                >
                  {f.title}
                </h3>
                <p
                  className="text-[13px] text-fg-3"
                  style={{ fontWeight: 450, lineHeight: 1.55 }}
                >
                  {f.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto px-6" style={{ maxWidth: 900, paddingBottom: "12vh" }}>
        <div className="text-center mb-10">
          <div
            className="text-[10.5px] tracking-[0.12em] text-[#818be0] mb-3 uppercase"
            style={{ fontWeight: 590 }}
          >
            How it works
          </div>
          <h2
            className="text-fg-1"
            style={{
              fontSize: "clamp(28px, 4vw, 38px)",
              fontWeight: 590,
              letterSpacing: -0.8,
              lineHeight: 1.15,
            }}
          >
            3단계면 충분합니다
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n}>
              <div
                className="text-[11px] text-fg-4 mb-3 tracking-[0.1em]"
                style={{ fontWeight: 590 }}
              >
                {s.n}
              </div>
              <h3
                className="text-[16px] text-fg-1 mb-2"
                style={{ fontWeight: 590 }}
              >
                {s.title}
              </h3>
              <p
                className="text-[13px] text-fg-3"
                style={{ fontWeight: 450, lineHeight: 1.55 }}
              >
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 pb-20 relative">
        <div
          className="mx-auto rounded-2xl text-center px-6 py-14 relative overflow-hidden"
          style={{
            maxWidth: 880,
            background:
              "radial-gradient(circle at 50% 0%, rgba(129,139,224,0.22), transparent 70%), rgba(15,16,17,0.6)",
            border: "1px solid rgba(129,139,224,0.22)",
            boxShadow:
              "0 30px 80px rgba(0,0,0,0.4), 0 0 80px rgba(129,139,224,0.08)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <GitBranch
            size={28}
            strokeWidth={1.3}
            className="mx-auto mb-5 text-[#818be0]"
          />
          <h2
            className="text-fg-1 mb-3"
            style={{
              fontSize: "clamp(24px, 3.5vw, 32px)",
              fontWeight: 590,
              letterSpacing: -0.6,
              lineHeight: 1.2,
            }}
          >
            지금 저장소를 배포해 보세요
          </h2>
          <p
            className="text-fg-3 mb-7 mx-auto"
            style={{
              fontSize: 14,
              fontWeight: 450,
              maxWidth: 460,
              lineHeight: 1.55,
            }}
          >
            GitHub 로그인 후 URL만 붙여넣으면 끝.
          </p>
          <button
            onClick={handleStart}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-[14px] text-white transition-all"
            style={{
              background: "linear-gradient(135deg, #6672d5 0%, #7d6dd5 100%)",
              fontWeight: 510,
              boxShadow:
                "0 8px 24px rgba(102,114,213,0.35), 0 0 0 1px rgba(255,255,255,0.06) inset",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "linear-gradient(135deg, #828fff 0%, #9e8aff 100%)";
              e.currentTarget.style.boxShadow =
                "0 12px 32px rgba(130,143,255,0.5), 0 0 0 1px rgba(255,255,255,0.1) inset";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                "linear-gradient(135deg, #6672d5 0%, #7d6dd5 100%)";
              e.currentTarget.style.boxShadow =
                "0 8px 24px rgba(102,114,213,0.35), 0 0 0 1px rgba(255,255,255,0.06) inset";
            }}
          >
            {user ? "배포하기" : "GitHub으로 시작"}
            <ArrowRight size={14} strokeWidth={2} />
          </button>
        </div>
      </section>
      </div>{/* /content layer */}
    </div>
  );
}

// 한 줄짜리 가짜 터미널 라인 (prompt 색 + 본문 children)
function Line({ prompt, color, children }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="shrink-0 w-3"
        style={{ color: color || "#5e6772", fontWeight: 510 }}
      >
        {prompt || " "}
      </span>
      <span className="min-w-0 flex-1 break-all">{children}</span>
    </div>
  );
}
