import { useEffect, useState } from "react";
import { getBuild } from "../api/deploy.js";
import StatusBadge from "./StatusBadge.jsx";

const ACTIVE = new Set(["queued", "building", "deploying"]);

export default function BuildDetail({ buildId }) {
  const [build, setBuild] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!buildId) return;
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
        if (!cancelled) setError(err.message || "조회 실패");
      }
    };

    setBuild(null);
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [buildId]);

  if (!buildId) {
    return (
      <div
        className="text-[12px] text-fg-4 h-full flex items-center justify-center rounded-lg"
        style={{ border: "1px dashed rgba(255,255,255,0.09)", minHeight: 240 }}
      >
        왼쪽에서 빌드를 선택하세요.
      </div>
    );
  }

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
    <div className="kd-fade-in flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span
          className="font-mono text-[13px] text-violet-brand"
          style={{ fontWeight: 510 }}
        >
          {build.build_id}
        </span>
        <span className="text-[14px] text-fg-1" style={{ fontWeight: 510 }}>
          {build.app_name}
        </span>
        <StatusBadge status={build.status} />
      </div>

      <Field label="이미지" value={build.image} mono />
      {build.error && (
        <Field label="에러" value={build.error} color="#fca5a5" />
      )}
      {build.analysis && <Field label="AI 분석" value={build.analysis} />}

      <div>
        <div
          className="text-[10.5px] uppercase tracking-[0.08em] text-fg-3 mb-2"
          style={{ fontWeight: 590 }}
        >
          빌드 로그
        </div>
        <pre
          className="text-[11.5px] font-mono text-fg-2 p-3 rounded-md overflow-auto scroll-thin whitespace-pre-wrap break-all"
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
        생성 {build.created_at} · 갱신 {build.updated_at}
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
