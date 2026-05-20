import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronRight, ExternalLink, X } from "lucide-react";
import { formatFull, relativeTime, repoSlug } from "../lib/format.js";
import StatusBadge from "./StatusBadge.jsx";

export default function BuildListPanel({ builds, onClose }) {
  const navigate = useNavigate();
  const { id: selectedId } = useParams();
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const goDetail = (id) => {
    navigate(`/builds/${id}`);
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
              빌드 기록
            </h2>
            <p className="text-[12px] text-fg-3 mt-0.5">전체 {builds.length}건</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md text-fg-4 hover:text-fg-1 hover:bg-white/[0.04] transition-colors flex items-center justify-center"
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto scroll-thin px-5 py-5">
          {builds.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-fg-4">
              아직 배포한 저장소가 없어요.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {builds.map((b) => {
                const isOpen = expanded === b.build_id;
                const isSelected = b.build_id === selectedId;
                return (
                  <div key={b.build_id}>
                    <button
                      onClick={() =>
                        setExpanded(isOpen ? null : b.build_id)
                      }
                      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors"
                      style={{
                        background: isOpen
                          ? "rgba(129,139,224,0.08)"
                          : isSelected
                          ? "rgba(129,139,224,0.04)"
                          : "transparent",
                      }}
                      onMouseEnter={(e) =>
                        !isOpen &&
                        (e.currentTarget.style.background =
                          "rgba(255,255,255,0.03)")
                      }
                      onMouseLeave={(e) =>
                        !isOpen &&
                        (e.currentTarget.style.background = isSelected
                          ? "rgba(129,139,224,0.04)"
                          : "transparent")
                      }
                    >
                      {isOpen ? (
                        <ChevronDown
                          size={11}
                          strokeWidth={2}
                          className="text-fg-4 shrink-0"
                        />
                      ) : (
                        <ChevronRight
                          size={11}
                          strokeWidth={2}
                          className="text-fg-4 shrink-0"
                        />
                      )}
                      <span
                        className="text-[11px] shrink-0"
                        style={{ fontWeight: 510, color: "#818be0" }}
                      >
                        {b.build_id}
                      </span>
                      <div className="flex items-baseline gap-2 min-w-0 flex-1">
                        <span
                          className="text-[12.5px] text-fg-1 min-w-0 truncate"
                          style={{ fontWeight: 510 }}
                        >
                          {b.app_name}
                        </span>
                        <span className="text-[11px] text-fg-4 shrink-0 tabular-nums">
                          {relativeTime(b.created_at)}
                        </span>
                      </div>
                      <StatusBadge status={b.status} />
                    </button>
                    {isOpen && (
                      <div className="ml-7 mr-3 mt-1 mb-2 kd-fade-in flex flex-col gap-2.5">
                        <Row label="저장소" value={repoSlug(b.repo_url)} />
                        <Row label="브랜치" value={b.branch} />
                        <Row label="런타임" value={b.runtime} />
                        <Row label="이미지" value={b.image} small mono />
                        <Row label="생성" value={formatFull(b.created_at)} />
                        <Row label="갱신" value={formatFull(b.updated_at)} />
                        {b.error && (
                          <Row label="에러" value={b.error} color="#fca5a5" />
                        )}
                        <button
                          onClick={() => goDetail(b.build_id)}
                          className="self-start mt-1 flex items-center gap-1.5 text-[12px] transition-colors"
                          style={{ fontWeight: 510, color: "#818be0" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.color = "#c7cbf3")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.color = "#818be0")
                          }
                        >
                          <span>상세 보기</span>
                          <ExternalLink size={11} strokeWidth={1.8} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
