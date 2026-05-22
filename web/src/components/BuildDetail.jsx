import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Activity, ArrowLeft, ScrollText, Terminal } from "lucide-react";
import { getBuild } from "../api/deploy.js";
import { formatFull } from "../lib/format.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import StatusBadge from "./StatusBadge.jsx";

const ACTIVE = new Set(["queued", "building", "built", "deploying"]);

const TABS = [
  {
    id: "terminal",
    label: "터미널",
    sub: "Pod 쉘 접속",
    icon: Terminal,
    color: "#818be0",
    ready: false,
  },
  {
    id: "monitoring",
    label: "모니터링",
    sub: "CPU · 메모리 · 요청량",
    icon: Activity,
    color: "#10b981",
    ready: false,
  },
  {
    id: "logs",
    label: "로그",
    sub: "빌드 / 실행 로그",
    icon: ScrollText,
    color: "#f59e0b",
    ready: true,
  },
];

export default function BuildDetail() {
  const navigate = useNavigate();
  const { id: buildId } = useParams();
  const { user, loading: authLoading, openLogin } = useAuth();
  const [build, setBuild] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(null);

  // 미로그인 진입(직접 URL 또는 mount 후 logout) — LoginModal 띄우고 홈으로.
  // authLoading 동안엔 user가 아직 null일 수 있으니 기다린다.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      openLogin?.();
      navigate("/", { replace: true });
    }
  }, [authLoading, user, openLogin, navigate]);

  useEffect(() => {
    if (!buildId || authLoading || !user) return;    // 인증 확정 + 본인 로그인 후에만 fetch
    let cancelled = false;
    let timer;

    const tick = async () => {
      try {
        const data = await getBuild(buildId);
        if (cancelled) return;
        setBuild(data);
        setError(null);
        if (ACTIVE.has(data.status)) {
          timer = setTimeout(tick, 2500);
        }
      } catch (err) {
        if (cancelled) return;
        // 401: cookie 만료/logout → LoginModal + 홈으로 (위 effect가 이미 처리 중일 수 있음)
        if (err.status === 401) {
          openLogin?.();
          navigate("/", { replace: true });
          return;
        }
        // 404: 다른 user의 build_id로 진입 — 백엔드가 본인 거 아니면 404 마스킹
        setError(err.message || "조회 실패");
      }
    };

    setBuild(null);
    setActiveTab(null);
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [buildId, authLoading, user?.id, navigate, openLogin]);

  // 인증 확인 전엔 빈 화면 (깜빡임 방지)
  if (authLoading || !user) return null;

  if (error) {
    return (
      <div
        className="px-3 py-2 rounded-md text-[12px]"
        style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.25)",
          color: "#fca5a5",
        }}
      >
        {error}
      </div>
    );
  }

  if (!build) {
    return (
      <div className="text-[12px] text-fg-4 py-6 text-center">불러오는 중…</div>
    );
  }

  return (
    <div className="kd-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 shrink-0">
        <span
          className="text-[13px]"
          style={{ fontWeight: 510, color: "#818be0" }}
        >
          {build.build_id}
        </span>
        <span className="text-[14px] text-fg-1" style={{ fontWeight: 510 }}>
          {build.app_name}
        </span>
        <StatusBadge status={build.status} />
      </div>

      {/* Picker (default) */}
      {activeTab === null && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6">
            <div
              className="text-[15px] text-fg-3"
              style={{ fontWeight: 510 }}
            >
              표시할 패널을 선택하세요
            </div>
            <div className="flex gap-4 flex-wrap justify-center">
              {TABS.map((t) => {
                const Icon = t.icon;
                const disabled = !t.ready;
                return (
                  <button
                    key={t.id}
                    onClick={disabled ? undefined : () => setActiveTab(t.id)}
                    disabled={disabled}
                    className="w-[200px] h-[200px] rounded-xl flex flex-col items-center justify-center gap-3 transition-all relative"
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.02)",
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.55 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!disabled) {
                        e.currentTarget.style.background =
                          "rgba(129,139,224,0.1)";
                        e.currentTarget.style.borderColor =
                          "rgba(129,139,224,0.3)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!disabled) {
                        e.currentTarget.style.background =
                          "rgba(255,255,255,0.02)";
                        e.currentTarget.style.borderColor =
                          "rgba(255,255,255,0.08)";
                      }
                    }}
                  >
                    <Icon
                      size={36}
                      strokeWidth={1.3}
                      style={{ color: t.color }}
                    />
                    <span
                      className="text-[17px] text-fg-1"
                      style={{ fontWeight: 510 }}
                    >
                      {t.label}
                    </span>
                    <span className="text-[12px] text-fg-4 text-center leading-tight">
                      {t.sub}
                    </span>
                    {disabled && (
                      <span
                        className="absolute top-3 right-3 text-[9.5px] px-1.5 py-0.5 rounded"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          color: "#8a8f98",
                          fontWeight: 510,
                        }}
                      >
                        준비중
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Active tab — logs */}
      {activeTab === "logs" && (
        <div className="flex-1 min-h-0 flex flex-col">
          <button
            onClick={() => setActiveTab(null)}
            className="self-start flex items-center gap-1.5 text-[12px] text-fg-4 hover:text-fg-2 transition-colors mb-4"
            style={{ fontWeight: 510 }}
          >
            <ArrowLeft size={12} strokeWidth={1.8} />
            <span>뒤로</span>
          </button>

          <div className="flex flex-col gap-5">
            <Field label="이미지" value={build.image} mono />
            {build.error && (
              <Field label="에러" value={build.error} color="#fca5a5" />
            )}
            {build.analysis && (
              <Field label="AI 분석" value={build.analysis} />
            )}

            {build.dockerfile_content && (
              <div>
                <div
                  className="text-[10.5px] uppercase tracking-[0.08em] text-fg-3 mb-2 flex items-center gap-2"
                  style={{ fontWeight: 590 }}
                >
                  Dockerfile
                  {build.build_mode === "auto" && (
                    <span
                      className="normal-case tracking-normal text-[10px] text-fg-4"
                      style={{ fontWeight: 510 }}
                    >
                      nixpacks 자동 생성
                    </span>
                  )}
                </div>
                <pre
                  className="text-[11.5px] font-sans text-fg-2 p-3 rounded-md overflow-auto scroll-thin"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    maxHeight: 360,
                  }}
                >
                  {build.dockerfile_content}
                </pre>
              </div>
            )}

            <div>
              <div
                className="text-[10.5px] uppercase tracking-[0.08em] text-fg-3 mb-2"
                style={{ fontWeight: 590 }}
              >
                빌드 로그
              </div>
              <pre
                className="text-[11.5px] font-sans text-fg-2 p-3 rounded-md overflow-auto scroll-thin whitespace-pre-wrap break-all"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  maxHeight: 360,
                }}
              >
                {build.logs || "(로그 없음)"}
              </pre>
            </div>

            <div className="text-[11px] text-fg-4">
              생성 {formatFull(build.created_at)} · 갱신{" "}
              {formatFull(build.updated_at)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono, color }) {
  return (
    <div>
      <div
        className="text-[10.5px] uppercase tracking-[0.08em] text-fg-3 mb-1.5"
        style={{ fontWeight: 590 }}
      >
        {label}
      </div>
      <div
        className={`text-[12.5px] ${mono ? "font-mono" : ""} break-all`}
        style={{ color: color || "#d0d6e0" }}
      >
        {value}
      </div>
    </div>
  );
}
