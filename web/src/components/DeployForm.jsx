import { useState } from "react";
import { createDeploy } from "../api/deploy.js";

export default function DeployForm({ onCreated }) {
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [port, setPort] = useState(80);
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
        branch: branch.trim() || "main",
        port: Number(port) || 80,
      });
      onCreated?.(build);
      setRepoUrl("");
    } catch (err) {
      setError(err.message || "배포 요청 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="kd-fade-in">
      <h2
        className="text-[20px] text-fg-1 mb-1.5"
        style={{ fontWeight: 510, letterSpacing: -0.4 }}
      >
        GitHub 저장소 배포
      </h2>
      <p className="text-[13px] text-fg-3 mb-5">
        저장소 주소를 입력하면 빌드 후 클러스터에 자동 배포해요.
      </p>

      <div className="flex gap-2 mb-3">
        <div
          className="flex-1 flex items-center rounded-lg px-4"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
        >
          <span className="text-fg-3 mr-3 text-[13px] font-mono shrink-0">↗</span>
          <input
            autoFocus
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/username/repo"
            className="flex-1 bg-transparent outline-none text-[13px] text-fg-1 py-3 font-mono"
            style={{ fontWeight: 500 }}
            disabled={submitting}
          />
        </div>
        <button
          type="submit"
          disabled={disabled}
          className="px-5 py-3 rounded-lg text-[13px] text-white transition-colors disabled:opacity-40 shrink-0"
          style={{ background: "#5e6ad2", fontWeight: 510 }}
          onMouseEnter={(e) =>
            !disabled && (e.currentTarget.style.background = "#828fff")
          }
          onMouseLeave={(e) => (e.currentTarget.style.background = "#5e6ad2")}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white kd-spin"
              />
              요청 중
            </span>
          ) : (
            "배포"
          )}
        </button>
      </div>

      <div className="flex gap-2 mb-2 text-[12px]">
        <label className="flex items-center gap-2 text-fg-3">
          <span style={{ fontWeight: 510 }}>브랜치</span>
          <input
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="bg-transparent outline-none text-fg-1 font-mono rounded-md px-2 py-1 w-28"
            style={{ border: "1px solid rgba(255,255,255,0.09)" }}
            disabled={submitting}
          />
        </label>
        <label className="flex items-center gap-2 text-fg-3">
          <span style={{ fontWeight: 510 }}>포트</span>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className="bg-transparent outline-none text-fg-1 font-mono rounded-md px-2 py-1 w-20"
            style={{ border: "1px solid rgba(255,255,255,0.09)" }}
            disabled={submitting}
          />
        </label>
      </div>

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
