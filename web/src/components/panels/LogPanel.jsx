// 빌드 로그 패널 — Pane 안에서 보여지는 단일 뷰.
// 기존 Dashboard.BuildPanel 내용을 그대로 패널 형태로 이식 (메타 + 에러 + Dockerfile + 빌드 로그).
import { formatFull, repoSlug } from "../../lib/format.js";

export default function LogPanel({ build }) {
  if (!build) {
    return (
      <div className="flex-1 flex items-center justify-center text-[12px] text-fg-4">
        선택된 빌드가 없어요
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto scroll-thin">
      {/* Panel sub-header — 빌드 ID + 시간 + repo */}
      <div
        className="flex items-center gap-3 px-5 py-2.5 flex-wrap"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="text-[12px]" style={{ fontWeight: 510, color: "#818be0" }}>
          {build.build_id}
        </span>
        <span className="text-[12px] text-fg-3 tabular-nums">
          {formatFull(build.created_at)}
        </span>
        <span className="ml-auto text-[11.5px] text-fg-3">
          {repoSlug(build.repo_url)} · {build.branch}
        </span>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {build.error && <Field label="에러" value={build.error} color="#fca5a5" />}
        {build.analysis && <Field label="AI 분석" value={build.analysis} />}
        <Field label="이미지" value={build.image} mono />

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
                maxHeight: 320,
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
              maxHeight: 420,
            }}
          >
            {build.logs || "(로그 없음)"}
          </pre>
        </div>
      </div>
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
