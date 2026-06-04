// 활동 패널 — 커밋 / 빌드 / 환경변수 통합 (우측 fixed 슬라이드인).
// CommitListWidget "자세히 보기"에서 오픈. 위젯에서 활성이던 탭을 initialTab으로 받아 같은 맥락 유지.
//
// 데이터는 위젯이 들고 있고 props로 전달. 환경변수 저장 시 onEnvSaved 콜백으로 위젯 state 동기화.
// 커밋 row: GitHub 새 창. 빌드 row: /dashboard?build=<id>로 navigate 후 닫음.
// 환경변수: 키-값 row 편집 + 저장 시 Pod 자동 재시작.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  CUSTOM_DOMAIN_CNAME_TARGET,
  dbExportUrl,
  deleteDomain,
  getDomain,
  restoreDb,
  setDomain,
  setEnvVars,
} from "../api/deploy.js";
import DomainStatusBadge from "./DomainStatusBadge.jsx";
import { formatFull, relativeTime, repoSlug } from "../lib/format.js";
import StatusBadge from "./StatusBadge.jsx";

export default function CommitListPanel({
  commits,
  builds,
  envVars,
  initialTab = "commits",
  onEnvSaved,
  onClose,
}) {
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    // defaultPrevented = 위에 뜬 오버레이(빌드 로그/커밋 상세)가 capture 단계에서
    // 이미 소비한 ESC — 활동 패널은 무시해서 한 번에 한 겹만 닫히게.
    const onKey = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const envCount = Object.keys(envVars || {}).length;

  return (
    <div
      className="fixed top-0 right-0 bottom-0 z-40 flex kd-fade-in"
      style={{ width: 380, maxWidth: "94vw" }}
    >
      <div
        className="h-full flex-1 min-w-0 flex flex-col"
        style={{
          background: "#0c0d0e",
          borderLeft: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.09)" }}
        >
          <div className="flex-1">
            <h2
              className="text-[16px] text-fg-1"
              style={{ fontWeight: 590, letterSpacing: -0.3 }}
            >
              활동
            </h2>
            <p className="text-[12px] text-fg-3 mt-0.5">
              커밋 {commits.length} · 빌드 {builds.length} · 환경변수 {envCount}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md text-fg-4 hover:text-fg-1 hover:bg-white/[0.04] transition-colors flex items-center justify-center"
            aria-label="닫기"
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>

        {/* Tab bar */}
        <div
          className="flex items-stretch px-3 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.09)" }}
        >
          <PanelTab
            active={tab === "commits"}
            onClick={() => setTab("commits")}
            label="커밋"
            count={commits.length}
          />
          <PanelTab
            active={tab === "builds"}
            onClick={() => setTab("builds")}
            label="빌드"
            count={builds.length}
          />
          <PanelTab
            active={tab === "env"}
            onClick={() => setTab("env")}
            label="환경변수"
            count={envCount}
          />
          <PanelTab
            active={tab === "extra"}
            onClick={() => setTab("extra")}
            label="부가기능"
          />
        </div>

        {/* Body — 탭별 분기 (sub-component) */}
        {tab === "commits" ? (
          <CommitsBody commits={commits} />
        ) : tab === "builds" ? (
          <BuildsBody builds={builds} />
        ) : tab === "extra" ? (
          <ExtraBody />
        ) : (
          <EnvBody envVars={envVars || {}} onSaved={onEnvSaved} />
        )}
      </div>
    </div>
  );
}

// --- Sub-components ---------------------------------------------------------

function PanelTab({ active, onClick, label, count }) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-1.5 px-3 py-2 text-[12.5px] transition-colors"
      style={{ color: active ? "#dde0e4" : "#8a8f98", fontWeight: 510 }}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className="text-fg-4 text-[11px] tabular-nums">{count}</span>
      )}
      {active && (
        <span
          className="absolute left-2 right-2 -bottom-px h-[2px] rounded-t-sm"
          style={{ background: "#818be0" }}
        />
      )}
    </button>
  );
}

function CommitsBody({ commits }) {
  // 커밋 row 클릭 시 좌측 박스로 본문 표시 — GitHub 새 창 대신.
  const [detail, setDetail] = useState(null);

  if (commits.length === 0) {
    return (
      <div className="flex-1 min-h-0 overflow-auto scroll-thin py-10 text-center text-[12px] text-fg-4">
        불러올 커밋이 없어요.
      </div>
    );
  }
  return (
    <>
      <div className="flex-1 min-h-0 overflow-auto scroll-thin px-5 py-5">
        <div className="flex flex-col gap-1">
          {commits.map((c) => {
            const isOpen = detail?.sha === c.sha;
            return (
              <button
                key={c.sha}
                onClick={() => setDetail(c)}
                className="px-3 py-2.5 rounded-md transition-colors text-left"
                style={{
                  background: isOpen ? "rgba(129,139,224,0.08)" : "transparent",
                }}
                onMouseEnter={(e) =>
                  !isOpen &&
                  (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
                }
                onMouseLeave={(e) =>
                  !isOpen && (e.currentTarget.style.background = "transparent")
                }
              >
                <div
                  className="text-[12.5px] text-fg-1 truncate"
                  style={{ fontWeight: 510 }}
                >
                  {c.message}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-fg-4">
                  <span style={{ fontWeight: 510, color: "#818be0" }}>
                    {c.sha}
                  </span>
                  <span>·</span>
                  <span>{c.author}</span>
                  <span>·</span>
                  <span className="tabular-nums" title={formatFull(c.date)}>
                    {relativeTime(c.date)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {detail && (
        <CommitDetailPanel commit={detail} onClose={() => setDetail(null)} />
      )}
    </>
  );
}

// 좌측 박스 — 커밋 title + body 표시. BuildLogsPanel과 동일 구조/위치.
// portal로 body에 직접 렌더해서 활동 패널 stacking context 밖으로 빠짐.
function CommitDetailPanel({ commit, onClose }) {
  useEffect(() => {
    // capture 단계 + preventDefault — 활동 패널(bubble 단계, defaultPrevented 무시)보다
    // 먼저 ESC를 소비해 이 오버레이만 닫힘. 활동 패널은 그대로 유지.
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <>
      <div
        className="fixed inset-0 kd-fade-in"
        style={{ background: "rgba(0,0,0,0.6)", zIndex: 35 }}
        onClick={onClose}
      />
      <div
        className="fixed kd-fade-in"
        style={{
          zIndex: 45,
          // 상하좌우 56px 패딩으로 통일. 우측은 활동 패널(380px) + 56px gap = 436.
          top: 56,
          bottom: 56,
          left: 56,
          right: 436,
        }}
      >
        <div
          className="h-full w-full flex flex-col rounded-xl overflow-hidden"
          style={{
            background: "#0c0d0e",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
          }}
        >
          <div
            className="flex items-center px-5 py-4 shrink-0 gap-2"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.09)" }}
          >
            <div className="flex-1 min-w-0">
              <h2
                className="text-[16px] text-fg-1"
                style={{ fontWeight: 590, letterSpacing: -0.3 }}
              >
                커밋
              </h2>
              <p className="text-[12px] text-fg-3 mt-0.5 truncate">
                <span style={{ color: "#818be0" }}>{commit.sha}</span>
                {" · "}
                {commit.author}
                {" · "}
                <span title={formatFull(commit.date)}>
                  {relativeTime(commit.date)}
                </span>
              </p>
            </div>
            <a
              href={commit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-md text-fg-4 hover:text-fg-1 hover:bg-white/[0.04] transition-colors flex items-center justify-center shrink-0"
              title="GitHub에서 보기"
            >
              <ExternalLink size={13} strokeWidth={1.8} />
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-md text-fg-4 hover:text-fg-1 hover:bg-white/[0.04] transition-colors flex items-center justify-center shrink-0"
              aria-label="닫기"
            >
              <X size={14} strokeWidth={1.8} />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto scroll-thin px-5 py-5">
            <h3
              className="text-[14px] text-fg-1 mb-3"
              style={{ fontWeight: 510, lineHeight: 1.5 }}
            >
              {commit.message}
            </h3>
            {commit.body ? (
              <pre
                className="text-[12px] font-sans text-fg-2 whitespace-pre-wrap break-all"
                style={{ lineHeight: 1.6 }}
              >
                {commit.body}
              </pre>
            ) : (
              <p
                className="text-[12px] text-fg-4"
                style={{ fontWeight: 450, fontStyle: "italic" }}
              >
                (본문 없음)
              </p>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

function BuildsBody({ builds }) {
  // row 펼침 (build_id 또는 null) + 좌측 BuildLogsPanel state ({build, mode}).
  // 활동 패널은 우측 z-40, BuildLogsPanel은 좌측 z-40 — 동시 표시 가능.
  const [expanded, setExpanded] = useState(null);
  const [logsView, setLogsView] = useState(null);

  if (builds.length === 0) {
    return (
      <div className="flex-1 min-h-0 overflow-auto scroll-thin py-10 text-center text-[12px] text-fg-4">
        아직 빌드가 없어요.
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 min-h-0 overflow-auto scroll-thin px-5 py-5">
        <div className="flex flex-col gap-1">
          {(() => {
            // #N은 kind="build"만 카운트. 역순으로 매겨서 가장 최신이 가장 큰 번호.
            const totalBuilds = builds.filter((b) => (b.kind || "build") === "build").length;
            let buildIdx = totalBuilds;
            return builds.map((b, i) => {
              const isOpen = expanded === b.build_id;
              const kind = b.kind || "build";
              const isEnvChange = kind === "env_change";
              const number = isEnvChange ? null : buildIdx--;
              return (
                <div key={b.build_id}>
                <button
                  onClick={() => setExpanded(isOpen ? null : b.build_id)}
                  className="w-full text-left px-3 py-2.5 rounded-md transition-colors"
                  style={{
                    background: isOpen ? "rgba(129,139,224,0.08)" : "transparent",
                  }}
                  onMouseEnter={(e) =>
                    !isOpen &&
                    (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
                  }
                  onMouseLeave={(e) =>
                    !isOpen && (e.currentTarget.style.background = "transparent")
                  }
                >
                  {isEnvChange ? (
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="text-[12px] text-fg-2 truncate"
                        style={{ fontWeight: 510 }}
                      >
                        환경변수 변경
                      </span>
                      <span
                        className="text-[11px] text-fg-4 shrink-0 tabular-nums"
                        title={formatFull(b.created_at)}
                      >
                        {relativeTime(b.created_at)}
                      </span>
                      <span className="ml-auto">
                        <StatusBadge status={b.status} kind="env" />
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="text-[11.5px] text-fg-3 shrink-0 tabular-nums"
                        style={{ fontWeight: 590 }}
                      >
                        #{number}
                      </span>
                      <span
                        className="text-[11.5px] shrink-0"
                        style={{ fontWeight: 510, color: "#818be0" }}
                      >
                        {b.build_id}
                      </span>
                      <span
                        className="text-[11px] text-fg-4 shrink-0 tabular-nums"
                        title={formatFull(b.created_at)}
                      >
                        {relativeTime(b.created_at)}
                      </span>
                      <span className="ml-auto">
                        <StatusBadge status={b.status} />
                      </span>
                    </div>
                  )}
                </button>
                {isOpen && isEnvChange && (
                  <div
                    className="mt-1.5 mb-2 kd-fade-in flex flex-col gap-2.5 px-4 py-3 rounded-md"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <Row
                      label="변경"
                      value={b.analysis || "(상세 없음)"}
                    />
                    <Row label="시간" value={formatFull(b.created_at)} />
                  </div>
                )}
                {isOpen && !isEnvChange && (
                  <div
                    className="mt-1.5 mb-2 kd-fade-in flex flex-col gap-2.5 px-4 py-3 rounded-md"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="text-[10.5px] uppercase tracking-[0.08em] text-fg-4 shrink-0 w-14 pt-0.5"
                        style={{ fontWeight: 590 }}
                      >
                        저장소
                      </span>
                      <a
                        href={b.repo_url.replace(/\.git$/, "")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0 text-[12px] inline-flex items-center gap-1.5 hover:underline break-all"
                        style={{ color: "#818be0" }}
                      >
                        {repoSlug(b.repo_url)}
                        <ExternalLink
                          size={10}
                          strokeWidth={1.8}
                          className="shrink-0"
                        />
                      </a>
                    </div>
                    <Row label="브랜치" value={b.branch} />
                    <Row label="런타임" value={b.runtime} />
                    <Row label="생성" value={formatFull(b.created_at)} />
                    {b.error && (
                      <Row label="에러" value={b.error} color="#fca5a5" />
                    )}
                    <div className="mt-1 flex gap-2">
                      <button
                        onClick={() => setLogsView({ build: b, mode: "logs" })}
                        className="px-3 py-1.5 rounded-md text-[11.5px] text-fg-2 hover:text-fg-1 hover:bg-white/[0.04] transition-colors"
                        style={{
                          fontWeight: 510,
                          border: "1px solid rgba(255,255,255,0.09)",
                        }}
                      >
                        빌드 로그 보기
                      </button>
                      <button
                        onClick={() =>
                          setLogsView({ build: b, mode: "dockerfile" })
                        }
                        disabled={!b.dockerfile_content}
                        className="px-3 py-1.5 rounded-md text-[11.5px] text-fg-2 hover:text-fg-1 hover:bg-white/[0.04] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          fontWeight: 510,
                          border: "1px solid rgba(255,255,255,0.09)",
                        }}
                        title={
                          !b.dockerfile_content
                            ? "Dockerfile 정보 없음 (public repo 아닐 수 있음)"
                            : undefined
                        }
                      >
                        Dockerfile 보기
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
            });
          })()}
        </div>
      </div>
      {logsView && (
        <BuildLogsPanel
          build={logsView.build}
          mode={logsView.mode}
          onClose={() => setLogsView(null)}
        />
      )}
    </>
  );
}

// 펼친 row 안의 라벨-값. 옛 BuildListPanel의 Row 패턴.
function Row({ label, value, mono, small, color }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="text-[10.5px] uppercase tracking-[0.08em] text-fg-4 shrink-0 w-14 pt-0.5"
        style={{ fontWeight: 590 }}
      >
        {label}
      </span>
      <span
        className={`flex-1 min-w-0 ${
          small ? "text-[11px]" : "text-[12px]"
        } ${mono ? "font-mono" : ""} break-all`}
        style={{ color: color || "#d0d6e0" }}
      >
        {value}
      </span>
    </div>
  );
}

// 박스 형태 — 활동 패널(우측 width 460) 옆 좌측 영역의 가운데에 떠 있음.
// left = (좌측 영역 폭 - 박스 폭) / 2 = (100vw - 460 - 520) / 2 = 50vw - 490px.
function BuildLogsPanel({ build, mode, onClose }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // capture 단계 + preventDefault — 활동 패널보다 먼저 ESC를 소비해
    // 이 로그/Dockerfile 창만 닫히고 뒤의 활동 패널은 유지 (CommitDetailPanel과 동일).
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const title = mode === "logs" ? "빌드 로그" : "Dockerfile";
  const content =
    mode === "logs"
      ? build.logs || "(로그 없음)"
      : build.dockerfile_content || "(Dockerfile 정보 없음)";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 권한 거부 등 — 조용히 무시 (HTTPS 아닌 환경에서 clipboard API 차단됨)
    }
  };

  // body에 portal로 렌더 — 활동 패널의 stacking context에서 빠져나와야
  // backdrop(z-35) 위에 활동 패널(z-40)이 정상적으로 떠 있음.
  return createPortal(
    <>
      {/* 백드롭 — 활동 패널(z-40)보다 뒤(z-35). 활동 패널은 그 위에 떠서 잘 보임. */}
      <div
        className="fixed inset-0 kd-fade-in"
        style={{ background: "rgba(0,0,0,0.6)", zIndex: 35 }}
        onClick={onClose}
      />
      <div
        className="fixed kd-fade-in"
        style={{
          zIndex: 45,
          // 상하좌우 56px 패딩으로 통일. 우측은 활동 패널(380px) + 56px gap = 436.
          top: 56,
          bottom: 56,
          left: 56,
          right: 436,
        }}
      >
      <div
        className="h-full w-full flex flex-col rounded-xl overflow-hidden"
        style={{
          background: "#0c0d0e",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
        }}
      >
        <div
          className="flex items-center px-5 py-4 shrink-0 gap-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.09)" }}
        >
          <div className="flex-1 min-w-0">
            <h2
              className="text-[16px] text-fg-1"
              style={{ fontWeight: 590, letterSpacing: -0.3 }}
            >
              {title}
            </h2>
            <p className="text-[12px] text-fg-3 mt-0.5 truncate">
              <span style={{ color: "#818be0" }}>{build.build_id}</span>
              {" · "}
              {repoSlug(build.repo_url)} · {build.branch}
              {mode === "dockerfile" && build.build_mode === "auto" && (
                <span className="text-fg-4 ml-1.5">(nixpacks 자동 생성)</span>
              )}
            </p>
          </div>
          <button
            onClick={handleCopy}
            className="w-8 h-8 rounded-md text-fg-4 hover:text-fg-1 hover:bg-white/[0.04] transition-colors flex items-center justify-center shrink-0"
            title={copied ? "복사됨" : "복사"}
            aria-label="복사"
          >
            {copied ? (
              <Check size={14} strokeWidth={2} style={{ color: "#818be0" }} />
            ) : (
              <Copy size={13} strokeWidth={1.8} />
            )}
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md text-fg-4 hover:text-fg-1 hover:bg-white/[0.04] transition-colors flex items-center justify-center shrink-0"
            aria-label="닫기"
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto scroll-thin">
          <pre
            className="text-[11.5px] font-sans text-fg-2 whitespace-pre-wrap break-all px-5 py-4"
            style={{ lineHeight: 1.55 }}
          >
            {content}
          </pre>
        </div>
      </div>
    </div>
    </>,
    document.body,
  );
}

// 환경변수 편집 본문. 값은 기본 마스킹, row Eye 토글로 평문 표시.
// 현재 env rows → .env 파일 텍스트. 빈 KEY는 무시.
// 공백·#·따옴표·=·역슬래시 등이 든 값은 큰따옴표로 감싸고 이스케이프(다시 source 가능하게).
function envValueToken(v) {
  if (v === "" || /[\s#"'=\\]/.test(v)) {
    return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
  }
  return v;
}
function rowsToEnvFile(rows) {
  const lines = rows
    .map(({ key, value }) => [key.trim(), value])
    .filter(([k]) => k)
    .map(([k, v]) => `${k}=${envValueToken(v)}`);
  return lines.length ? lines.join("\n") + "\n" : "";
}

// 저장 직후 onSaved(env)로 위젯 state 동기화 → 위젯 미리보기 즉시 갱신.
function EnvBody({ envVars, onSaved }) {
  const [rows, setRows] = useState(() => {
    const entries = Object.entries(envVars);
    return entries.length
      ? entries.map(([k, v]) => ({ key: k, value: v, visible: false }))
      : [{ key: "", value: "", visible: true }];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  const addRow = () =>
    setRows((r) => [...r, { key: "", value: "", visible: true }]);
  const removeRow = (i) =>
    setRows((r) =>
      r.length === 1
        ? [{ key: "", value: "", visible: true }]
        : r.filter((_, idx) => idx !== i),
    );
  const updateRow = (i, field, val) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));
  const toggleVisible = (i) =>
    setRows((r) =>
      r.map((row, idx) => (idx === i ? { ...row, visible: !row.visible } : row)),
    );

  const hasEnv = rows.some((r) => r.key.trim());
  // 현재 rows를 .env 파일로 다운로드 (저장 안 한 편집분도 화면 그대로 반영). 클라이언트 Blob.
  const onExport = () => {
    const blob = new Blob([rowsToEnvFile(rows)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".env";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    setError(null);
    setSavedAt(null);
    const env = {};
    for (const { key, value } of rows) {
      const k = key.trim();
      if (!k) continue;
      env[k] = value;
    }
    setSaving(true);
    try {
      const data = await setEnvVars(env);
      setSavedAt(Date.now());
      onSaved?.(data.env || env);
    } catch (err) {
      setError(err.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Editable rows */}
      <div className="flex-1 min-h-0 overflow-auto scroll-thin px-5 py-5">
        <div className="flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                value={row.key}
                onChange={(e) => updateRow(i, "key", e.target.value.toUpperCase())}
                placeholder="KEY"
                spellCheck={false}
                autoCapitalize="characters"
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-transparent outline-none text-[12.5px] text-fg-1 placeholder:text-fg-4"
                style={{ border: "1px solid rgba(255,255,255,0.09)", fontWeight: 510 }}
              />
              <input
                // visible=false면 점으로 가리고 readOnly. focus 하면 자동 visible 전환.
                value={row.visible ? row.value : "•".repeat(Math.min(row.value.length, 12))}
                onChange={(e) =>
                  row.visible && updateRow(i, "value", e.target.value)
                }
                onFocus={() => !row.visible && toggleVisible(i)}
                readOnly={!row.visible}
                placeholder="value"
                spellCheck={false}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-transparent outline-none text-[12.5px] text-fg-1 placeholder:text-fg-4"
                style={{ border: "1px solid rgba(255,255,255,0.09)", fontWeight: 510 }}
              />
              <button
                onClick={() => toggleVisible(i)}
                className="w-7 h-7 rounded-md text-fg-4 hover:text-fg-1 hover:bg-white/[0.04] flex items-center justify-center shrink-0"
                title={row.visible ? "숨기기" : "보기"}
              >
                {row.visible ? (
                  <EyeOff size={12} strokeWidth={1.8} />
                ) : (
                  <Eye size={12} strokeWidth={1.8} />
                )}
              </button>
              <button
                onClick={() => removeRow(i)}
                className="w-7 h-7 rounded-md text-fg-4 hover:text-red-300 hover:bg-white/[0.04] flex items-center justify-center shrink-0"
                title="삭제"
              >
                <Trash2 size={12} strokeWidth={1.8} />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          className="mt-3 flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] text-fg-3 hover:text-fg-1 hover:bg-white/[0.04]"
          style={{ fontWeight: 510 }}
        >
          <Plus size={11} strokeWidth={2} /> 변수 추가
        </button>

        <p
          className="text-[11px] text-fg-4 mt-5"
          style={{ fontWeight: 450, lineHeight: 1.55 }}
        >
          KEY는 영문 대문자 / 숫자 / _ 만 허용. 최대 50개, value 4KB 이내.
          빈 KEY row는 저장 시 무시돼요.
        </p>
      </div>

      {/* Footer — 상태 메시지(좌) · 저장 버튼(우) */}
      <div
        className="shrink-0 px-5 py-3 flex items-center gap-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.09)" }}
      >
        <button
          onClick={onExport}
          disabled={!hasEnv}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[12.5px] text-fg-3 hover:text-fg-1 hover:bg-white/[0.04] transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
          style={{ fontWeight: 510 }}
          title=".env 파일로 내보내기"
        >
          <Download size={12} strokeWidth={1.8} /> 내보내기
        </button>
        {savedAt && (
          <span
            className="text-[11.5px]"
            style={{ color: "#047857", fontWeight: 510 }}
          >
            저장됨
          </span>
        )}
        {error && (
          <span
            className="text-[11.5px] truncate"
            style={{ color: "#fca5a5", fontWeight: 510 }}
          >
            {error}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto px-4 py-2 rounded-md text-[12.5px] text-white transition-colors disabled:opacity-40"
          style={{ background: "#6672d5", fontWeight: 510 }}
          onMouseEnter={(e) =>
            !saving && (e.currentTarget.style.background = "#828fff")
          }
          onMouseLeave={(e) => (e.currentTarget.style.background = "#6672d5")}
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}

// 커스텀 도메인 — 연결/변경/해제 (재배포 불필요: PUT/DELETE /deploy/domain).
// 넣어야 할 DNS 레코드(라우팅 A/CNAME + apex 검증 TXT)를 읽기 좋게 + 클릭 복사. active 되면 레코드 숨김.
function CustomDomainSection() {
  const [info, setInfo] = useState(null); // { domain, status, ssl_status }
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);

  // 마운트 시 조회 + pending이면 8s, 아니면 30s 폴링 (TXT 추가 후 active 자동 반영)
  useEffect(() => {
    let cancelled = false;
    let timer;
    const tick = async () => {
      let pending = false;
      try {
        const d = await getDomain();
        if (!cancelled) { setInfo(d); pending = !!d?.domain && d.status !== "active"; }
      } catch { /* 폴링 — 조용히 */ }
      if (!cancelled) { setLoading(false); timer = setTimeout(tick, pending ? 8000 : 30000); }
    };
    tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  const copy = (k, text) => {
    navigator.clipboard?.writeText(text);
    setCopied(k);
    setTimeout(() => setCopied((c) => (c === k ? null : c)), 1500);
  };
  const onConnect = async () => {
    const d = value.trim();
    if (!d || busy) return;
    setBusy(true); setError(null);
    try { const res = await setDomain(d); setInfo(res); setValue(""); }
    catch (e) { setError(e.message || "연결 실패"); }
    finally { setBusy(false); }
  };
  const onDisconnect = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await deleteDomain(); setInfo({ domain: null }); }
    catch (e) { setError(e.message || "해제 실패"); }
    finally { setBusy(false); }
  };

  const domain = info?.domain;
  const active = info?.status === "active";
  // 서브도메인 전용 — CNAME 한 줄. (apex 미지원)
  const records = !active && domain
    ? [{ key: "cname", type: "CNAME", name: domain, value: CUSTOM_DOMAIN_CNAME_TARGET }]
    : [];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] text-fg-1" style={{ fontWeight: 590, letterSpacing: -0.2 }}>커스텀 도메인</span>
        <span className="text-[11px] text-fg-4">내 도메인을 앱에 연결 — 재배포 없이 바로 적용.</span>
      </div>

      {loading ? (
        <div className="text-[11.5px] text-fg-4">불러오는 중…</div>
      ) : !domain ? (
        <div className="flex items-center gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value.toLowerCase())}
            placeholder="app.example.com"
            spellCheck={false}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-transparent outline-none text-[12.5px] text-fg-1 placeholder:text-fg-4"
            style={{ border: "1px solid rgba(255,255,255,0.09)", fontWeight: 510 }}
            disabled={busy}
            onKeyDown={(e) => e.key === "Enter" && onConnect()}
          />
          <button onClick={onConnect} disabled={busy || !value.trim()}
            className="px-3 py-1.5 rounded-md text-[12px] shrink-0 text-white disabled:opacity-40"
            style={{ background: "#6672d5", fontWeight: 510 }}>
            {busy ? "연결 중…" : "연결"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* 현재 도메인 — 한 줄 */}
          <div className="flex items-center gap-2 min-w-0">
            <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 text-[12.5px] text-fg-1 no-underline hover:text-[#aab2f0] truncate min-w-0" style={{ fontWeight: 540 }}>
              <span className="truncate">{domain}</span><ExternalLink size={10} strokeWidth={2} className="shrink-0" />
            </a>
            <DomainStatusBadge status={info.status} />
            <button onClick={onDisconnect} disabled={busy}
              className="ml-auto shrink-0 text-[11px] text-fg-4 hover:text-red-300 disabled:opacity-40 transition-colors">
              해제
            </button>
          </div>

          {/* 넣어야 할 레코드 — 한 덩어리 (얇은 구분선) */}
          {records.length > 0 && (
            <div className="rounded-md overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="px-2.5 py-1.5 text-[10px] text-fg-4" style={{ background: "rgba(255,255,255,0.02)", fontWeight: 540 }}>
                DNS에 추가하면 인증서 자동 발급
              </div>
              {records.map((r) => (
                <div key={r.key} className="flex items-start gap-2 px-2.5 py-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-[10px] text-fg-4 w-10 shrink-0 mt-0.5" style={{ fontWeight: 590 }}>{r.type}</span>
                  <div className="flex-1 min-w-0 leading-snug">
                    {/* 이름 — 클릭하면 복사 */}
                    <button onClick={() => copy(`${r.key}-n`, r.name)} title="이름 복사"
                      className="flex items-center gap-1 w-full text-left text-[10.5px] text-fg-4 hover:text-fg-2 transition-colors">
                      <span className="truncate">{r.name}</span>
                      {copied === `${r.key}-n` && <Check size={10} strokeWidth={2.5} style={{ color: "#818be0" }} className="shrink-0" />}
                    </button>
                    {/* 값 — 클릭하면 복사 */}
                    <button onClick={() => copy(`${r.key}-v`, r.value)} title="값 복사"
                      className="flex items-center gap-1 w-full text-left text-[11.5px] text-[#a4abee] hover:text-fg-1 transition-colors" style={{ fontWeight: 510 }}>
                      <span className="truncate">{r.value}</span>
                      {copied === `${r.key}-v` && <Check size={10} strokeWidth={2.5} style={{ color: "#818be0" }} className="shrink-0" />}
                    </button>
                  </div>
                  <Copy size={11} strokeWidth={1.8} className="text-fg-4 shrink-0 mt-0.5" />
                </div>
              ))}
            </div>
          )}

          {/* 변경 */}
          <div className="flex items-center gap-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value.toLowerCase())}
              placeholder="다른 도메인으로 변경"
              spellCheck={false}
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-transparent outline-none text-[12px] text-fg-1 placeholder:text-fg-4"
              style={{ border: "1px solid rgba(255,255,255,0.09)", fontWeight: 510 }}
              disabled={busy}
              onKeyDown={(e) => e.key === "Enter" && onConnect()}
            />
            <button onClick={onConnect} disabled={busy || !value.trim()}
              className="px-3 py-1.5 rounded-md text-[12px] shrink-0 disabled:opacity-40"
              style={{ border: "1px solid rgba(255,255,255,0.12)", color: "#aab2f0", fontWeight: 510 }}>
              변경
            </button>
          </div>
        </div>
      )}

      {error && <div className="text-[11px]" style={{ color: "#e0a0a0" }}>{error}</div>}
    </section>
  );
}

// 부가기능 탭 본문 — 앱 부가 작업 모음. 커스텀 도메인 + DB 스냅샷(내보내기/복원).
// 내보내기: mysqldump → .sql.gz 다운로드. 복원: 업로드 .sql(.gz) 적재 (파괴적, 2단계 확인).
function ExtraBody() {
  const [file, setFile] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind: "ok" | "err", text }

  const onExport = () => {
    // GET + cookie 인증 → 앵커 클릭으로 스트림 다운로드 (메모리 안 씀)
    const a = document.createElement("a");
    a.href = dbExportUrl();
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const onPick = (e) => {
    setFile(e.target.files?.[0] || null);
    setConfirming(false);
    setMsg(null);
  };

  const onRestore = async () => {
    if (!file) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await restoreDb(file);
      setMsg({ kind: "ok", text: res.output ? res.output : "복원 완료" });
    } catch (err) {
      setMsg({ kind: "err", text: err.message || "복원 실패" });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto scroll-thin px-5 py-5 flex flex-col gap-5">
      {/* 커스텀 도메인 */}
      <CustomDomainSection />

      {/* DB 스냅샷 */}
      <section className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-fg-1" style={{ fontWeight: 590, letterSpacing: -0.2 }}>
            DB 스냅샷
          </span>
          <span className="text-[11.5px] text-fg-3" style={{ lineHeight: 1.5 }}>
            현재 앱의 MySQL을 통째로 백업하거나, 백업 파일로 되돌립니다.
          </span>
        </div>

        {/* 내보내기 */}
        <div
          className="group flex items-center gap-3.5 px-3.5 py-3 rounded-xl transition-colors"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(129,139,224,0.12)" }}
          >
            <Download size={16} strokeWidth={1.8} style={{ color: "#aab2f0" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] text-fg-1" style={{ fontWeight: 540 }}>
              내보내기
            </div>
            <div className="text-[11px] text-fg-4 mt-0.5">
              전체 DB를 <span className="text-fg-3">.sql.gz</span>로 다운로드
            </div>
          </div>
          <button
            onClick={onExport}
            className="px-3.5 py-1.5 rounded-lg text-[12px] shrink-0 transition-all"
            style={{ background: "rgba(129,139,224,0.16)", color: "#aab2f0", fontWeight: 540 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(129,139,224,0.26)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(129,139,224,0.16)")}
          >
            다운로드
          </button>
        </div>

        {/* 복원 */}
        <div
          className="flex flex-col gap-3 px-3.5 py-3 rounded-xl"
          style={{
            border: "1px solid rgba(224,129,129,0.22)",
            background: "rgba(224,129,129,0.03)",
          }}
        >
          {/* 내보내기와 동일한 행 레이아웃 — 아이콘 · 텍스트 · 우측 액션 버튼 */}
          <div className="flex items-center gap-3.5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "rgba(224,129,129,0.12)" }}
            >
              <Upload size={16} strokeWidth={1.8} style={{ color: "#e0a0a0" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] text-fg-1" style={{ fontWeight: 540 }}>
                복원
              </div>
              <div className="text-[11px] text-fg-4 mt-0.5">
                <span style={{ color: "#d99" }}>기존 데이터 덮어쓰기</span>
                {" · "}
                <span className="text-fg-3">.sql</span>
                {" · "}
                <span className="text-fg-3">.sql.gz</span>
                {" 지원"}
              </div>
            </div>
            {/* 파일 선택 전엔 '파일 선택', 선택 후엔 '복원 실행'이 같은 자리에서 활성화.
                파일 선택 버튼은 내보내기의 '다운로드'와 동일한 보라 톤/굵기로 통일. */}
            {!file ? (
              <label
                className="px-3.5 py-1.5 rounded-lg text-[12px] cursor-pointer shrink-0 transition-all"
                style={{ background: "rgba(224,129,129,0.16)", color: "#e0a0a0", fontWeight: 540 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(224,129,129,0.26)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(224,129,129,0.16)")}
              >
                파일 선택
                <input
                  type="file"
                  accept=".sql,.gz,.sql.gz,application/sql,application/gzip"
                  onChange={onPick}
                  className="hidden"
                  disabled={busy}
                />
              </label>
            ) : (
              <button
                onClick={onRestore}
                disabled={busy}
                className="px-3.5 py-1.5 rounded-lg text-[12px] shrink-0 transition-all disabled:opacity-35 disabled:cursor-not-allowed"
                style={{
                  background: confirming ? "#8a2f2f" : "rgba(224,129,129,0.16)",
                  color: confirming ? "#fff" : "#e0a0a0",
                  fontWeight: 540,
                }}
              >
                {busy
                  ? "복원 중…"
                  : confirming
                    ? "한 번 더 클릭"
                    : "복원 실행"}
              </button>
            )}
          </div>

          {/* 선택 파일명 + 지원 포맷 — 주변 본문과 동일한 글씨체(sans)로 통일 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] truncate min-w-0" style={{ color: file ? "#c5cad2" : "#6b7280" }}>
              {file ? file.name : "선택된 파일 없음"}
            </span>
            {file && (
              <button
                onClick={() => { setFile(null); setConfirming(false); setMsg(null); }}
                className="text-[11px] text-fg-4 hover:text-fg-2 transition-colors shrink-0"
                title="선택 취소"
              >
                ✕
              </button>
            )}
          </div>

          {confirming && !busy && (
            <div className="text-[10.5px]" style={{ color: "#e0a0a0" }}>
              ⚠ 되돌릴 수 없습니다. 버튼을 한 번 더 누르면 즉시 덮어씁니다.
            </div>
          )}

          {msg && (
            <pre
              className="text-[11px] p-2.5 rounded-lg whitespace-pre-wrap break-words max-h-40 overflow-auto scroll-thin font-mono"
              style={{
                background: "#0a0a0b",
                border: "1px solid rgba(255,255,255,0.06)",
                color: msg.kind === "ok" ? "#9ad0a0" : "#e0a0a0",
                lineHeight: 1.5,
              }}
            >
              {msg.text}
            </pre>
          )}
        </div>
      </section>
    </div>
  );
}
