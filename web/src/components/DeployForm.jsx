import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GitBranch } from "lucide-react";
import { createDeploy, RUNTIMES } from "../api/deploy.js";
import { useAuth } from "../contexts/AuthContext.jsx";

const RUNTIME_META = {
  python: { name: "Python", tag: "FastAPI · uvicorn" },
  java: { name: "Java", tag: "Spring Boot · JDK 17+" },
};

// runtime별 기본 listen 포트
const DEFAULT_PORTS = {
  python: 8000,
  java: 8080,
};

export default function DeployForm({ onRequestGuide }) {
  const navigate = useNavigate();
  const { user, openLogin, refresh } = useAuth();
  // 1유저=1앱 — user.app_name이 있으면 첫 배포 끝난 상태. 이름 입력란 숨기고 그 이름 재사용.
  const isFirstDeploy = !user?.app_name;
  const [repoUrl, setRepoUrl] = useState("");
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("main");
  const [port, setPort] = useState(DEFAULT_PORTS[RUNTIMES[0]] ?? 80);
  const [buildMode, setBuildMode] = useState("auto");
  const [dockerfilePath, setDockerfilePath] = useState("Dockerfile");
  const [projectPath, setProjectPath] = useState("");
  const [useDb, setUseDb] = useState(false);
  const [runtime, setRuntime] = useState(RUNTIMES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Dockerfile 모드 + 해당 runtime 변경 시 우측 가이드 패널 자동 표시.
  // auto 모드면 패널 닫기. X 버튼으로 닫아도 buildMode/runtime이 안 바뀌면 다시 안 열림.
  useEffect(() => {
    onRequestGuide?.(buildMode === "dockerfile" ? runtime : null);
  }, [buildMode, runtime, onRequestGuide]);

  // runtime 변경 시 default 포트 자동 적용 (사용자 수정 후에도 reset됨 — MVP 단순화).
  useEffect(() => {
    const def = DEFAULT_PORTS[runtime];
    if (def) setPort(def);
  }, [runtime]);

  const disabled = !repoUrl.trim() || submitting;

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (disabled) return;
    // 미로그인이면 API 호출 전에 LoginModal 띄움 (API도 401로 막지만 UX 단축)
    if (!user) {
      openLogin?.();
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await createDeploy({
        repoUrl: repoUrl.trim(),
        // 첫 배포: 사용자가 입력한 이름 또는 자동 생성(서버 측). 두 번째부터는 user.app_name 재사용되니 보냄 의미 없음.
        name: isFirstDeploy ? name.trim() || undefined : undefined,
        branch: branch.trim() || "main",
        port: Number(port) || 80,
        runtime,
        useDb,
        buildMode,
        dockerfilePath:
          buildMode === "dockerfile" ? dockerfilePath.trim() || "Dockerfile" : "Dockerfile",
        projectPath: buildMode === "auto" ? projectPath.trim().replace(/^\/+|\/+$/g, "") : "",
      });
      // 첫 배포면 user.app_name이 백엔드에 박혔으니 AuthContext 갱신 — Dashboard에서 즉시 반영
      if (isFirstDeploy) await refresh();
      navigate("/dashboard");
    } catch (err) {
      if (err.status === 401) {
        openLogin?.();
        setSubmitting(false);
        return;
      }
      setError(err.message || "배포 요청 실패");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="kd-fade-in w-[520px] max-w-[90vw] mx-auto pb-12">
      <h2
        className="text-[22px] text-fg-1 mb-2"
        style={{ fontWeight: 510, letterSpacing: -0.5 }}
      >
        GitHub 저장소 배포
      </h2>
      <p className="text-[13px] text-fg-3 mb-6">
        저장소 주소를 입력하면 빌드 후 클러스터에 자동 배포해요.
      </p>

      {/* GitHub URL + Branch */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <div
            className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
            style={{ fontWeight: 590 }}
          >
            GitHub 링크
          </div>
          <div
            className="flex items-center rounded-md px-3"
            style={{
              border: "1px solid rgba(255,255,255,0.09)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <GitBranch size={15} strokeWidth={1.6} className="text-fg-3 mr-2 shrink-0" />
            <input
              autoFocus
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/username/repo"
              className="flex-1 bg-transparent outline-none text-[14px] text-fg-1 py-2 placeholder:text-fg-3"
              style={{ fontWeight: 510 }}
              disabled={submitting}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
        </div>
        <div className="w-28 shrink-0">
          <div
            className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
            style={{ fontWeight: 590 }}
          >
            브랜치
          </div>
          <input
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
            className="w-full bg-transparent outline-none text-[14px] text-fg-1 rounded-md px-3 py-2 placeholder:text-fg-3"
            style={{
              border: "1px solid rgba(255,255,255,0.09)",
              background: "rgba(255,255,255,0.02)",
              fontWeight: 510,
            }}
            disabled={submitting}
          />
        </div>
      </div>

      {/* Runtime */}
      <div className="mb-5">
        <div
          className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2.5"
          style={{ fontWeight: 590 }}
        >
          런타임
        </div>
        <div className="flex gap-1.5">
          {RUNTIMES.map((r) => {
            const meta = RUNTIME_META[r] || { name: r, tag: "" };
            const active = runtime === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRuntime(r)}
                className="flex-1 h-10 rounded-lg text-[13px] transition-colors flex items-center justify-center"
                style={{
                  background: active ? "rgba(129,139,224,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? "rgba(129,139,224,0.25)" : "rgba(255,255,255,0.06)"}`,
                  color: active ? "#818be0" : "#8a8f98",
                  fontWeight: 510,
                }}
                disabled={submitting}
              >
                {meta.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* DB */}
      <div className="mb-5">
        <div
          className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2.5"
          style={{ fontWeight: 590 }}
        >
          데이터베이스
        </div>
        <div className="flex gap-1.5">
          {[
            { id: false, name: "사용 안 함" },
            { id: true, name: "MySQL 8.4" },
          ].map((d) => {
            const active = useDb === d.id;
            return (
              <button
                key={String(d.id)}
                type="button"
                onClick={() => setUseDb(d.id)}
                className="flex-1 h-10 rounded-lg text-[13px] transition-colors flex items-center justify-center"
                style={{
                  background: active ? "rgba(129,139,224,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? "rgba(129,139,224,0.25)" : "rgba(255,255,255,0.06)"}`,
                  color: active ? "#818be0" : "#8a8f98",
                  fontWeight: 510,
                }}
                disabled={submitting}
              >
                {d.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Build mode */}
      <div className="mb-6">
        <div className="flex gap-3">
          <div className={buildMode === "dockerfile" ? "flex-1" : "w-full"}>
            <div
              className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2.5"
              style={{ fontWeight: 590 }}
            >
              빌드 방식
            </div>
            <div className="flex gap-1.5">
              {[
                { id: "auto", name: "자동 빌드" },
                { id: "dockerfile", name: "Dockerfile" },
              ].map((m) => {
                const active = buildMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setBuildMode(m.id)}
                    className="flex-1 h-10 rounded-lg text-[13px] transition-all flex items-center justify-center"
                    style={{
                      background: active ? "rgba(129,139,224,0.12)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${active ? "rgba(129,139,224,0.25)" : "rgba(255,255,255,0.06)"}`,
                      color: active ? "#818be0" : "#8a8f98",
                      fontWeight: 510,
                    }}
                    disabled={submitting}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>
          {buildMode === "dockerfile" && (
            <div className="w-24 shrink-0">
              <div
                className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2.5"
                style={{ fontWeight: 590 }}
              >
                포트
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full h-10 bg-transparent outline-none text-fg-1 text-[14px] rounded-md px-3"
                style={{
                  border: "1px solid rgba(255,255,255,0.09)",
                  background: "rgba(255,255,255,0.02)",
                  fontWeight: 510,
                }}
                disabled={submitting}
              />
            </div>
          )}
        </div>
        {buildMode === "dockerfile" && (
          <div className="mt-3">
            <div
              className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
              style={{ fontWeight: 590 }}
            >
              Dockerfile 경로
            </div>
            <input
              value={dockerfilePath}
              onChange={(e) => setDockerfilePath(e.target.value)}
              placeholder="Dockerfile"
              className="w-full bg-transparent outline-none text-fg-1 text-[14px] rounded-md px-3 py-2 placeholder:text-fg-3"
              style={{
                border: "1px solid rgba(255,255,255,0.09)",
                background: "rgba(255,255,255,0.02)",
                fontWeight: 510,
              }}
              disabled={submitting}
            />
            <p className="text-[11px] text-fg-3 mt-2" style={{ fontWeight: 450 }}>
              프로젝트 루트에 Dockerfile이 있어야 합니다. 서브 디렉토리에 있으면{" "}
              <span style={{ color: "#d0d6e0" }}>subdir/Dockerfile</span> 같이
              입력.
            </p>
          </div>
        )}
        {buildMode === "auto" && (
          <div className="mt-3">
            <div
              className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
              style={{ fontWeight: 590 }}
            >
              앱 디렉토리 (선택)
            </div>
            <input
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              placeholder="비워두면 자동 탐색 (예: backend)"
              className="w-full bg-transparent outline-none text-fg-1 text-[14px] rounded-md px-3 py-2 placeholder:text-fg-3"
              style={{
                border: "1px solid rgba(255,255,255,0.09)",
                background: "rgba(255,255,255,0.02)",
                fontWeight: 510,
              }}
              disabled={submitting}
            />
            <p className="text-[11px] text-fg-3 mt-2" style={{ fontWeight: 450 }}>
              <span style={{ color: "#d0d6e0" }}>pom.xml</span>,{" "}
              <span style={{ color: "#d0d6e0" }}>requirements.txt</span> 같은
              파일이 있는 폴더 경로를 입력하세요.
              <br />
              모노레포·비표준 구조면 자동 탐색이 실패할 수 있어요.
            </p>
          </div>
        )}
      </div>

      {/* Domain — 첫 배포에만 표시. 두 번째부터는 user.app_name fix되어 변경 불가 (안내만). */}
      <div className="mb-6">
        <div
          className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
          style={{ fontWeight: 590 }}
        >
          도메인
        </div>
        {isFirstDeploy ? (
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="비워두면 자동으로 채워져요"
              className="bg-transparent outline-none text-fg-1 text-[14px] rounded-md px-3 py-2 w-1/2 placeholder:text-fg-3"
              style={{
                border: "1px solid rgba(255,255,255,0.09)",
                background: "rgba(255,255,255,0.02)",
                fontWeight: 510,
              }}
              disabled={submitting}
            />
            <span className="text-[14px] text-fg-3 shrink-0" style={{ fontWeight: 510 }}>.kodeploy.com</span>
          </div>
        ) : (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-md"
            style={{
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <span className="text-[14px] text-fg-1" style={{ fontWeight: 510 }}>
              {user.app_name}
            </span>
            <span className="text-[14px] text-fg-3" style={{ fontWeight: 510 }}>
              .kodeploy.com
            </span>
            <span className="ml-auto text-[10.5px] text-fg-4" style={{ fontWeight: 510 }}>
              앱 이름은 변경 불가
            </span>
          </div>
        )}
      </div>

      {/* Deploy button */}
      <button
        type="submit"
        disabled={disabled}
        className="w-full py-3 rounded-lg text-[14px] text-white transition-colors disabled:opacity-40"
        style={{ background: "#6672d5", fontWeight: 510 }}
        onMouseEnter={(e) =>
          !disabled && (e.currentTarget.style.background = "#828fff")
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = "#6672d5")}
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white kd-spin" />
            배포 요청 중
          </span>
        ) : (
          "배포 시작"
        )}
      </button>

      {error && (
        <div
          className="mt-3 px-3 py-2 rounded-md text-[12px]"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#fca5a5",
          }}
        >
          {error}
        </div>
      )}
    </form>
  );
}
