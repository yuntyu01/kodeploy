// 우측 fixed panel — 활동(커밋 + 빌드) 전체 리스트. CommitListWidget "자세히 보기"에서 오픈.
// 탭 두 개 — 위젯에서 활성이던 탭을 initialTab으로 받아 같은 맥락 유지.
// 커밋 row: GitHub commit 페이지 새 창. 빌드 row: /dashboard?build=<id>로 navigate 후 패널 닫음.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, GitCommit, GitCommitHorizontal, X } from "lucide-react";
import { formatFull, relativeTime, repoSlug } from "../lib/format.js";
import StatusBadge from "./StatusBadge.jsx";

export default function CommitListPanel({
  commits,
  builds,
  initialTab = "commits",
  onClose,
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const openBuild = (buildId) => {
    navigate(`/dashboard?build=${buildId}`);
    onClose();
  };

  return (
    <div
      className="fixed top-0 right-0 bottom-0 z-40 flex kd-fade-in"
      style={{ width: 380, maxWidth: "90vw" }}
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
              커밋 {commits.length} · 빌드 {builds.length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md text-fg-4 hover:text-fg-1 hover:bg-white/[0.04] transition-colors flex items-center justify-center"
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
            icon={GitCommit}
            label="커밋"
            count={commits.length}
          />
          <PanelTab
            active={tab === "builds"}
            onClick={() => setTab("builds")}
            icon={GitCommitHorizontal}
            label="빌드"
            count={builds.length}
          />
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto scroll-thin px-5 py-5">
          {tab === "commits" ? (
            commits.length === 0 ? (
              <div className="py-10 text-center text-[12px] text-fg-4">
                불러올 커밋이 없어요.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {commits.map((c) => (
                  <a
                    key={c.sha}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2.5 rounded-md transition-colors no-underline block"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.03)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span
                        className="text-[11px] shrink-0 font-mono"
                        style={{ fontWeight: 510, color: "#818be0" }}
                      >
                        {c.sha}
                      </span>
                      <span
                        className="text-[12.5px] text-fg-1 min-w-0 flex-1 truncate"
                        style={{ fontWeight: 510 }}
                      >
                        {c.message}
                      </span>
                      <ExternalLink
                        size={11}
                        strokeWidth={1.8}
                        className="text-fg-4 shrink-0"
                      />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-fg-4">
                      <span>{c.author}</span>
                      <span>·</span>
                      <span
                        className="tabular-nums"
                        title={formatFull(c.date)}
                      >
                        {relativeTime(c.date)}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            )
          ) : builds.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-fg-4">
              아직 빌드가 없어요.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {builds.map((b) => (
                <button
                  key={b.build_id}
                  onClick={() => openBuild(b.build_id)}
                  className="px-3 py-2.5 rounded-md transition-colors text-left"
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255,255,255,0.03)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-[11px] shrink-0"
                      style={{ fontWeight: 510, color: "#818be0" }}
                    >
                      {b.build_id}
                    </span>
                    <span
                      className="text-[12.5px] text-fg-1 min-w-0 flex-1 truncate"
                      style={{ fontWeight: 510 }}
                    >
                      {b.app_name}
                    </span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-fg-4">
                    <span>{repoSlug(b.repo_url)}</span>
                    <span>·</span>
                    <span
                      className="tabular-nums"
                      title={formatFull(b.created_at)}
                    >
                      {relativeTime(b.created_at)}
                    </span>
                    {b.error && (
                      <span
                        className="ml-auto truncate"
                        style={{ color: "#fca5a5" }}
                        title={b.error}
                      >
                        {b.error}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PanelTab({ active, onClick, icon: Icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-1.5 px-3 py-2 text-[12.5px] transition-colors"
      style={{ color: active ? "#dde0e4" : "#8a8f98", fontWeight: 510 }}
    >
      <Icon size={12} strokeWidth={1.8} />
      <span>{label}</span>
      <span className="text-fg-4 text-[11px] tabular-nums">{count}</span>
      {active && (
        <span
          className="absolute left-2 right-2 -bottom-px h-[2px] rounded-t-sm"
          style={{ background: "#818be0" }}
        />
      )}
    </button>
  );
}
