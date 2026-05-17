import { useEffect, useState } from "react";
import { listBuilds } from "../api/deploy.js";
import StatusBadge from "./StatusBadge.jsx";

const ACTIVE = new Set(["queued", "building", "deploying"]);

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", { hour12: false });
}

export default function BuildList({ refreshSignal, onSelect, selectedId }) {
  const [builds, setBuilds] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer;

    const tick = async () => {
      let hasActive = false;
      try {
        const data = await listBuilds();
        if (cancelled) return;
        setBuilds(data);
        setError(null);
        hasActive = data.some((b) => ACTIVE.has(b.status));
      } catch (err) {
        if (!cancelled) setError(err.message || "조회 실패");
      } finally {
        if (!cancelled) setLoading(false);
      }
      if (!cancelled) {
        timer = setTimeout(tick, hasActive ? 2500 : 8000);
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [refreshSignal]);

  return (
    <div className="kd-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-[10.5px] uppercase tracking-[0.08em] text-fg-3"
          style={{ fontWeight: 590 }}
        >
          빌드 기록
        </span>
        <span className="text-[10.5px] text-fg-4">{builds.length}건</span>
      </div>

      {error && (
        <div
          className="mb-3 px-3 py-2 rounded-md text-[12px]"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#fca5a5",
          }}
        >
          {error}
        </div>
      )}

      {loading && builds.length === 0 && (
        <div className="text-[12px] text-fg-4 py-6 text-center">불러오는 중…</div>
      )}

      {!loading && builds.length === 0 && !error && (
        <div
          className="text-[12px] text-fg-4 py-8 text-center rounded-lg"
          style={{ border: "1px dashed rgba(255,255,255,0.09)" }}
        >
          아직 배포한 저장소가 없어요.
        </div>
      )}

      <div className="flex flex-col gap-1">
        {builds.map((b) => {
          const active = b.build_id === selectedId;
          return (
            <button
              key={b.build_id}
              onClick={() => onSelect?.(b)}
              className="text-left rounded-md px-3 py-2.5 transition-colors flex items-center gap-3"
              style={{
                background: active
                  ? "rgba(94,106,210,0.08)"
                  : "transparent",
                border: `1px solid ${
                  active ? "rgba(94,106,210,0.25)" : "rgba(255,255,255,0.06)"
                }`,
              }}
              onMouseEnter={(e) =>
                !active &&
                (e.currentTarget.style.background = "rgba(255,255,255,0.025)")
              }
              onMouseLeave={(e) =>
                !active && (e.currentTarget.style.background = "transparent")
              }
            >
              <span
                className="font-mono text-[11px] text-violet-brand shrink-0 w-16"
                style={{ fontWeight: 510 }}
              >
                {b.build_id}
              </span>
              <span
                className="flex-1 min-w-0 text-[13px] text-fg-1 truncate"
                style={{ fontWeight: 500 }}
              >
                {b.app_name}
              </span>
              <span className="text-[11px] text-fg-4 shrink-0 hidden sm:inline">
                {formatTime(b.created_at)}
              </span>
              <StatusBadge status={b.status} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
