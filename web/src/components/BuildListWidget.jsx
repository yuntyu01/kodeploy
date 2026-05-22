import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronUp, GitCommitHorizontal, Minus } from "lucide-react";
import { listBuilds } from "../api/deploy.js";
import { relativeTime } from "../lib/format.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import BuildListPanel from "./BuildListPanel.jsx";
import StatusBadge from "./StatusBadge.jsx";

const ACTIVE = new Set(["queued", "building", "built", "deploying"]);
const VISIBLE_COUNT = 2;

export default function BuildListWidget() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { id: selectedId } = useParams();
  const [builds, setBuilds] = useState([]);
  const [minimized, setMinimized] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  // 숨김 조건:
  //   - 랜딩("/"): 마케팅 화면에 빌드 목록이 뜨면 어색
  //   - 미로그인: 본인 빌드만 보이게 — 미로그인은 보일 빌드 자체가 없음
  // user 변경(로그인↔로그아웃, 다른 계정 전환) 시 의존성으로 자연 재실행 → builds 클리어 + 새 polling.
  const isHome = location.pathname === "/";
  const hidden = isHome || !user;

  useEffect(() => {
    if (hidden) {
      setBuilds([]);                                 // 이전 user의 빌드 잔여 클리어
      return;
    }
    let cancelled = false;
    let timer;

    const tick = async () => {
      let hasActive = false;
      try {
        const data = await listBuilds();
        if (cancelled) return;
        setBuilds(data);
        hasActive = data.some((b) => ACTIVE.has(b.status));
      } catch {
        // 백그라운드 폴링 — 위젯에 빨간 에러 띄우진 않음
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
  }, [hidden, user?.id]);                            // user.id 변경(계정 전환) 시 재폴링

  // hooks 호출 후 early return (rules-of-hooks 준수)
  if (hidden) return null;

  const visible = builds.slice(0, VISIBLE_COUNT);
  const hiddenCount = Math.max(0, builds.length - VISIBLE_COUNT);

  if (minimized) {
    return (
      <>
        <div className="fixed right-4 z-30" style={{ bottom: 24 }}>
          <button
            onClick={() => setMinimized(false)}
            className="flex items-center gap-2.5 pl-4 pr-5 py-2.5 rounded-full transition-colors"
            style={{
              background: "#6672d5",
              boxShadow:
                "0 4px 20px rgba(129,139,224,0.35), 0 2px 6px rgba(0,0,0,0.3)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "#828fff")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "#6672d5")
            }
          >
            <span
              className="text-[13px] text-white"
              style={{ fontWeight: 510 }}
            >
              빌드 기록 · {builds.length}
            </span>
            <ChevronUp size={13} strokeWidth={2} className="text-white/60" />
          </button>
        </div>
        {showPanel && (
          <BuildListPanel
            builds={builds}
            onClose={() => setShowPanel(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        className="fixed right-4 z-30 flex flex-col justify-end"
        style={{ width: 224, bottom: 24, maxHeight: "calc(100vh - 100px)" }}
      >
        <div
          className="rounded-xl overflow-hidden flex flex-col"
          style={{
            background: "#131415",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-4 py-1.5 shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <GitCommitHorizontal
              size={13}
              strokeWidth={1.8}
              className="text-fg-3"
            />
            <span
              className="text-[11px] text-fg-3"
              style={{ fontWeight: 590 }}
            >
              빌드 기록 · {builds.length}건
            </span>
            <button
              onClick={() => setMinimized(true)}
              className="ml-auto w-6 h-6 rounded-md text-fg-4 hover:text-fg-1 hover:bg-white/[0.04] transition-colors flex items-center justify-center"
              title="최소화"
            >
              <Minus size={13} strokeWidth={2} />
            </button>
          </div>

          {/* List (top 3) */}
          {visible.length === 0 ? (
            <div className="px-4 py-5 text-center text-[11.5px] text-fg-4">
              아직 배포한 저장소가 없어요.
            </div>
          ) : (
            <div className="px-3 py-1 flex flex-col gap-0.5 overflow-auto scroll-thin">
              {visible.map((b) => {
                const active = b.build_id === selectedId;
                return (
                  <button
                    key={b.build_id}
                    onClick={() => navigate(`/builds/${b.build_id}`)}
                    className="w-full text-left px-2.5 py-1.5 rounded-md transition-colors"
                    style={{
                      background: active
                        ? "rgba(129,139,224,0.08)"
                        : "transparent",
                    }}
                    onMouseEnter={(e) =>
                      !active &&
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.03)")
                    }
                    onMouseLeave={(e) =>
                      !active &&
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                        <span
                          className="text-[12px] text-fg-1 min-w-0 truncate"
                          style={{ fontWeight: 500 }}
                        >
                          {b.app_name}
                        </span>
                        <span className="text-[10px] text-fg-4 shrink-0 tabular-nums">
                          {relativeTime(b.created_at, { compact: true })}
                        </span>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* 자세히 보기 (bottom) */}
          <div className="px-3 pb-2 pt-0.5 shrink-0">
            <button
              onClick={() => setShowPanel(true)}
              className="w-full py-2 rounded-lg text-[12px] text-fg-2 transition-colors flex items-center justify-center gap-1.5"
              style={{
                fontWeight: 510,
                border: "1px solid rgba(255,255,255,0.09)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <span>자세히 보기</span>
              {hiddenCount > 0 && (
                <span className="text-fg-4">· +{hiddenCount}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {showPanel && (
        <BuildListPanel
          builds={builds}
          onClose={() => setShowPanel(false)}
        />
      )}
    </>
  );
}
