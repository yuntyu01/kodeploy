import { useState } from "react";
import { GitBranch } from "lucide-react";
import { createDeploy, RUNTIMES } from "../api/deploy.js";

const RUNTIME_META = {
  python: { name: "Python", tag: "FastAPI · uvicorn" },
  java: { name: "Java", tag: "Spring Boot · JDK 17+" },
};

export default function DeployForm({ onCreated }) {
  const [repoUrl, setRepoUrl] = useState("");
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("main");
  const [port, setPort] = useState(80);
  const [buildMode, setBuildMode] = useState("dockerfile");
  const [useDb, setUseDb] = useState(false);
  const [runtime, setRuntime] = useState(RUNTIMES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const disabled = !repoUrl.trim() || submitting;

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (disabled) return;
    setError(null);
    setSubmitting(true);
    try {
      const build = await createDeploy({
        repoUrl: repoUrl.trim(),
        name: name.trim() || undefined,
        branch: branch.trim() || "main",
        port: Number(port) || 80,
        runtime,
      });
      onCreated?.(build);
      setRepoUrl("");
      setName("");
    } catch (err) {
      setError(err.message || "배포 요청 실패");
    } finally {
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
                  background: active ? "rgba(94,106,210,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? "rgba(94,106,210,0.25)" : "rgba(255,255,255,0.06)"}`,
                  color: active ? "#a4abee" : "#8a8f98",
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
                  background: active ? "rgba(94,106,210,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? "rgba(94,106,210,0.25)" : "rgba(255,255,255,0.06)"}`,
                  color: active ? "#a4abee" : "#8a8f98",
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
                    className="flex-1 h-10 rounded-lg text-[12px] transition-all flex items-center justify-center"
                    style={{
                      background: active ? "rgba(94,106,210,0.12)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${active ? "rgba(94,106,210,0.25)" : "rgba(255,255,255,0.06)"}`,
                      color: active ? "#a4abee" : "#8a8f98",
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
          <p className="text-[11px] text-fg-4 mt-2" style={{ fontWeight: 450 }}>
            프로젝트 루트에 Dockerfile이 있어야 합니다.
          </p>
        )}
      </div>

      {/* Domain */}
      <div className="mb-6">
        <div
          className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
          style={{ fontWeight: 590 }}
        >
          도메인
        </div>
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-app (비워두면 자동)"
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
      </div>

      {/* Deploy button */}
      <button
        type="submit"
        disabled={disabled}
        className="w-full py-3 rounded-lg text-[14px] text-white transition-colors disabled:opacity-40"
        style={{ background: "#5e6ad2", fontWeight: 510 }}
        onMouseEnter={(e) =>
          !disabled && (e.currentTarget.style.background = "#828fff")
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = "#5e6ad2")}
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
