// 랜딩 페이지 ("/").
// 흐름: Hero → 지그재그(패널 UI) → Included(인프라) → How it works(3단계) → CTA.
// 모션: 스크롤 시 각 블록이 fade + slide-up (useReveal), 지그재그 이미지 hover lift.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  Database,
  Globe,
  HardDrive,
  LayoutTemplate,
  Lock,
  Server,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";
import FluidBackground from "./FluidBackground.jsx";
import monitoringImg from "../assets/monitoring.webp";
import terminalImg from "../assets/db_terminel.webp";
import logImg from "../assets/log.webp";
import storageImg from "../assets/storage.webp";

// Included 그리드 — 배포 한 번에 따라오는 제공 인프라.
const PROVIDED = [
  { icon: Server, title: "서버 런타임", body: "Python · Java 자동 실행" },
  { icon: LayoutTemplate, title: "정적 호스팅", body: "SPA · 정적 사이트 서빙" },
  { icon: Database, title: "데이터베이스", body: "MySQL · PostgreSQL 토글" },
  { icon: Zap, title: "캐시", body: "Redis 인메모리" },
  { icon: HardDrive, title: "오브젝트 스토리지", body: "앱당 R2 버킷 + S3 키" },
  { icon: Globe, title: "도메인", body: "서브도메인 + 커스텀 도메인" },
  { icon: Lock, title: "TLS · HTTPS", body: "인증서 자동 발급" },
  { icon: ShieldCheck, title: "엣지 · WAF", body: "Cloudflare 프록시 · DDoS" },
  { icon: Activity, title: "모니터링", body: "메트릭 · 로그 · 상태" },
];

// 지그재그 — 실제 패널 UI. 순서: 모니터링 → 터미널 → 로그 → 스토리지.
const FEATURES = [
  {
    title: "메트릭 모니터링",
    body:
      "CPU · 메모리 · 요청량(RPS) · 응답시간(p95) · 재시작 / OOM을 시계열 차트로. 15분부터 30일까지 구간을 골라 봅니다",
    image: monitoringImg,
  },
  {
    title: "브라우저에서 바로 터미널",
    body:
      "앱 Pod 쉘과 DB 쉘(mysql · psql)에 설치 없이 접속. SQL을 그 자리에서 실행하고 결과를 바로 확인합니다",
    image: terminalImg,
  },
  {
    title: "실시간 로그, 한 곳에서",
    body:
      "현재 · 이전 인스턴스 런타임 로그에 빌드 로그와 실제 Dockerfile까지. 크래시 원인을 한 화면에서 추적합니다",
    image: logImg,
  },
  {
    title: "오브젝트 스토리지",
    body:
      "앱당 R2 버킷에 올린 객체를 썸네일로 한눈에. 이미지 미리보기 · 공개 URL · 삭제까지 브라우저에서",
    image: storageImg,
  },
];

// How it works — 3단계 (CTA 직전).
const STEPS = [
  { n: "01", title: "GitHub 연결", body: "GitHub 계정으로 로그인 한 번이면 끝" },
  { n: "02", title: "저장소 입력", body: "URL · 런타임 · 브랜치만 지정하면 빌드 시작" },
  { n: "03", title: "도메인 받기", body: "빌드 완료 직후 HTTPS 도메인으로 바로 접속" },
];

// 뷰포트에 들어오면 한 번 표시 토글. prefers-reduced-motion이면 즉시 표시(모션 생략).
function useReveal() {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, shown];
}

// 스크롤 등장 래퍼 — 자식을 fade + slide-up. className/style은 래퍼 div에 그대로 적용
// (그래서 grid 컨테이너 자체를 Reveal로 쓸 수도 있음).
function Reveal({ children, className, style }) {
  const [ref, shown] = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(28px)",
        transition:
          "opacity 0.7s ease, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

// 섹션 헤더 (eyebrow + h2) 공통 — 등장 애니메이션 포함.
function SectionHead({ eyebrow, title }) {
  const [ref, shown] = useReveal();
  return (
    <div
      ref={ref}
      className="text-center mb-12"
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(20px)",
        transition:
          "opacity 0.6s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <div
        className="text-[10.5px] tracking-[0.12em] text-[#818be0] mb-3 uppercase"
        style={{ fontWeight: 590 }}
      >
        {eyebrow}
      </div>
      <h2
        className="text-fg-1"
        style={{
          fontSize: "clamp(26px, 4vw, 36px)",
          fontWeight: 590,
          letterSpacing: -0.8,
          lineHeight: 1.15,
          wordBreak: "keep-all",
        }}
      >
        {title}
      </h2>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { user, openLogin } = useAuth();

  // 미로그인은 로그인 모달, 로그인은 배포 폼으로 — CTA 두 곳에서 공유
  const handleStart = () => {
    if (user) navigate("/deploy");
    else openLogin?.();
  };

  return (
    <div className="flex-1 overflow-auto scroll-thin relative">
      {/* Aurora — fixed viewport-relative blobs (ambient 보라 빛). pointer-events:none. */}
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
      </div>

      {/* Fluid ink — 마우스 궤적 따라 번지는 보라 잉크 (Aurora와 같은 fixed z-0 레이어) */}
      <FluidBackground />

      {/* Content layer */}
      <div className="relative" style={{ zIndex: 1 }}>
        {/* ── Hero: 헤드라인 + 한 줄 설명 + 버튼 ── */}
        {/* 상+하 합계 18vh 고정 — 텍스트 블록만 위로, 아래(지그재그)는 제자리 */}
        <section className="kd-fade-in px-6" style={{ padding: "13.5vh 24px 4.5vh" }}>
          <div className="mx-auto text-center" style={{ maxWidth: 820 }}>
            <h1
              className="text-fg-1"
              style={{
                fontSize: "clamp(34px, 6vw, 60px)",
                fontWeight: 590,
                letterSpacing: -1.5,
                lineHeight: 1.1,
                wordBreak: "keep-all",
                textWrap: "balance",
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
                fontSize: 17,
                fontWeight: 450,
                lineHeight: 1.6,
                maxWidth: 560,
                wordBreak: "keep-all",
                textWrap: "pretty",
              }}
            >
              Dockerfile이 없어도 자동 빌드 - 빌드부터 배포 · 운영까지 한 곳에서
            </p>

            <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
              <CtaButton onClick={handleStart}>배포하기</CtaButton>
              <Link
                to="/guide"
                className="inline-flex items-center justify-center min-w-[130px] px-6 py-3 rounded-md text-[14px] text-fg-2 hover:text-fg-1 transition-colors no-underline"
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
          </div>
        </section>

        {/* ── 패널 UI 지그재그 (각 행 스크롤 등장) ── */}
        <section
          className="mx-auto px-6"
          style={{ maxWidth: 1120, padding: "0 24px 4vh" }}
        >
          {FEATURES.map((f, i) => (
            <Reveal key={f.title}>
              <FeatureRow {...f} reverse={i % 2 === 1} />
            </Reveal>
          ))}
        </section>

        {/* ── Included: 제공 인프라 그리드 ── */}
        <section
          className="mx-auto px-6"
          style={{ maxWidth: 1080, padding: "10vh 24px 0" }}
        >
          <SectionHead eyebrow="Included" title="앱에 필요한 인프라, 전부 포함" />
          <Reveal
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}
          >
            {PROVIDED.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.title}
                  className="p-5 rounded-xl transition-all"
                  style={{
                    background: "rgba(20,21,24,0.55)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(129,139,224,0.3)";
                    e.currentTarget.style.background = "rgba(28,29,33,0.7)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                    e.currentTarget.style.background = "rgba(20,21,24,0.55)";
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                    style={{
                      background: "rgba(129,139,224,0.12)",
                      border: "1px solid rgba(129,139,224,0.3)",
                    }}
                  >
                    <Icon size={15} strokeWidth={1.7} style={{ color: "#a7adf0" }} />
                  </div>
                  <h3
                    className="text-[14px] text-fg-1 mb-1"
                    style={{ fontWeight: 590 }}
                  >
                    {p.title}
                  </h3>
                  <p
                    className="text-[12px] text-fg-3"
                    style={{ fontWeight: 450, lineHeight: 1.5 }}
                  >
                    {p.body}
                  </p>
                </div>
              );
            })}
          </Reveal>
        </section>

        {/* ── How it works: 3단계 (CTA 직전) ── */}
        <section
          className="mx-auto px-6"
          style={{ maxWidth: 900, padding: "12vh 24px 4vh" }}
        >
          <SectionHead eyebrow="How it works" title="3단계면 충분합니다" />
          <Reveal className="grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n}>
                <div
                  className="text-[12px] text-[#818be0] mb-3 tracking-[0.1em]"
                  style={{ fontWeight: 700 }}
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
                  className="text-[13.5px] text-fg-3"
                  style={{ fontWeight: 450, lineHeight: 1.55, wordBreak: "keep-all" }}
                >
                  {s.body}
                </p>
              </div>
            ))}
          </Reveal>
        </section>

        {/* ── 하단 CTA ── */}
        <section className="px-6 pt-[8vh] pb-24">
          <Reveal className="mx-auto text-center" style={{ maxWidth: 560 }}>
            <h2
              className="text-fg-1 mb-3"
              style={{
                fontSize: "clamp(24px, 3.5vw, 32px)",
                fontWeight: 590,
                letterSpacing: -0.6,
                lineHeight: 1.2,
                wordBreak: "keep-all",
              }}
            >
              지금 저장소를 배포해 보세요
            </h2>
            <p
              className="text-fg-3 mb-7 mx-auto"
              style={{ fontSize: 14, fontWeight: 450, lineHeight: 1.55, maxWidth: 420 }}
            >
              GitHub 로그인 후 URL만 붙여넣으면 끝
            </p>
            <CtaButton onClick={handleStart}>배포하기</CtaButton>
          </Reveal>
        </section>
      </div>
    </div>
  );
}

// 지그재그 한 행 — 데스크톱은 reverse로 좌우 번갈아, 이미지를 텍스트보다 넓게 + hover lift.
function FeatureRow({ title, body, image, reverse }) {
  return (
    <div
      className={`flex flex-col items-center gap-8 md:gap-16 py-12 ${
        reverse ? "md:flex-row-reverse" : "md:flex-row"
      }`}
    >
      <div className="w-full md:flex-[1.5]">
        <img
          src={image}
          alt={title}
          className="block w-full rounded-xl"
          style={{
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
            transition: "transform 0.4s ease, box-shadow 0.4s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-6px)";
            e.currentTarget.style.boxShadow =
              "0 30px 70px rgba(0,0,0,0.5), 0 0 60px rgba(102,114,213,0.18)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow = "0 20px 50px rgba(0,0,0,0.4)";
          }}
        />
      </div>
      <div className="w-full md:flex-1">
        <h3
          className="text-fg-1"
          style={{
            fontSize: "clamp(20px, 2.6vw, 27px)",
            fontWeight: 590,
            letterSpacing: -0.5,
            lineHeight: 1.2,
            wordBreak: "keep-all",
          }}
        >
          {title}
        </h3>
        <p
          className="mt-3 text-fg-3"
          style={{ fontSize: 15, fontWeight: 450, lineHeight: 1.6, wordBreak: "keep-all" }}
        >
          {body}
        </p>
      </div>
    </div>
  );
}

// 그라데이션 primary 버튼 (Hero + 하단 CTA 공용)
function CtaButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center min-w-[130px] px-6 py-3 rounded-md text-[14px] text-white transition-all"
      style={{
        background: "linear-gradient(135deg, #6672d5 0%, #7d6dd5 100%)",
        fontWeight: 510,
        border: "1px solid transparent",
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
      {children}
    </button>
  );
}
