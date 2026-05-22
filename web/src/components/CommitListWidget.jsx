// 우측 하단 floating 위젯 — 커밋 + 빌드 통합 (탭 2개).
//
// - 미로그인 또는 랜딩("/")에선 숨김
// - 커밋 탭: 최신 build의 repo+branch에서 최근 커밋 N개 폴링 (30s)
// - 빌드 탭: 본인 빌드 목록 폴링 (active 2.5s / 안정 8s)
// - 빌드 row 클릭 → /dashboard?build=<id> 로 navigate → Dashboard가 그 빌드를 pin.
//   URL query라 새로고침/공유에도 살아남음.
// - 커밋 row 클릭 → GitHub 페이지 새 창.
// - top-2 미리보기 → "자세히 보기" 클릭 시 CommitListPanel(전체) 오픈.
// - 위젯 어디든 누르고 드래그하면 위치 이동 (5px threshold) — 일반 클릭은 영향 X.
// - 위치는 우하단 기준(right/bottom)으로 저장 — 미니마이즈/확장 토글 시 우하단이 고정됨.
// - localStorage 저장이라 새로고침/페이지 전환에도 유지.
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronUp,
  GitCommit,
  GitCommitHorizontal,
  Minus,
} from "lucide-react";
import { listBuilds, listRecentCommits } from "../api/deploy.js";
import { relativeTime } from "../lib/format.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import CommitListPanel from "./CommitListPanel.jsx";
import StatusBadge from "./StatusBadge.jsx";

const VISIBLE_COUNT = 2;
const COMMIT_POLL = 30000;                              // 커밋은 자주 안 바뀜
const ACTIVE = new Set(["queued", "building", "built", "deploying"]);
const POS_STORAGE_KEY = "kd_widget_pos";
const EDGE_MARGIN = 4;                                  // 화면 가장자리 최소 여백
const DRAG_THRESHOLD = 5;                               // px — 이만큼 움직여야 drag로 간주

// localStorage에서 저장된 위치 읽기 — 실패 시 null (default 우하단).
// 위치는 우하단 기준 거리 {right, bottom} — 옛 {x,y} 형식은 자동 폐기.
function loadPos() {
  try {
    const raw = localStorage.getItem(POS_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.right === "number" && typeof v?.bottom === "number") return v;
  } catch {
    /* 손상된 값은 무시 */
  }
  return null;
}

export default function CommitListWidget() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [commits, setCommits] = useState([]);
  const [builds, setBuilds] = useState([]);
  const [tab, setTab] = useState("commits");
  const [minimized, setMinimized] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  // null = default 우하단. drag로 5px 이상 움직이면 {right, bottom} 박힘.
  const [pos, setPos] = useState(loadPos);

  const rootRef = useRef(null);
  // mousedown ~ mouseup 동안만 채워짐 — { startX, startY, originRight, originBottom, dragging }
  const pressRef = useRef(null);
  // drag 직후 발생할 click 한 번만 막기 위한 플래그
  const suppressClickRef = useRef(false);

  const isHome = location.pathname === "/";
  const hidden = isHome || !user;

  // 커밋 폴링 — 30s 고정
  useEffect(() => {
    if (hidden) {
      setCommits([]);
      return;
    }
    let cancelled = false;
    let timer;
    const tick = async () => {
      try {
        const data = await listRecentCommits();
        if (!cancelled) setCommits(data || []);
      } catch {
        // 백그라운드 폴링 — 위젯에 빨간 에러 X
      }
      if (!cancelled) timer = setTimeout(tick, COMMIT_POLL);
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [hidden, user?.id]);

  // 빌드 폴링 — active 빌드 있으면 2.5s, 안정이면 8s (Dashboard 폴링과 동일 주기)
  useEffect(() => {
    if (hidden) {
      setBuilds([]);
      return;
    }
    let cancelled = false;
    let timer;
    const tick = async () => {
      let hasActive = false;
      try {
        const data = await listBuilds();
        if (!cancelled) {
          setBuilds(data);
          hasActive = data.some((b) => ACTIVE.has(b.status));
        }
      } catch {
        // 백그라운드 폴링 — 위젯에 빨간 에러 X
      }
      if (!cancelled) timer = setTimeout(tick, hasActive ? 2500 : 8000);
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [hidden, user?.id]);

  // 드래그 — 글로벌 mousemove/mouseup 리스너 한 번만 등록.
  // pressRef가 채워진 상태에서 5px 통과하면 dragging=true → 그때부터 setPos.
  // 위치는 우하단 기준이라 마우스 오른쪽으로 가면 right 줄어듦(부호 반대).
  useEffect(() => {
    const onMove = (e) => {
      const s = pressRef.current;
      if (!s || !rootRef.current) return;
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      if (!s.dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        s.dragging = true;
        document.body.style.cursor = "move";
        document.body.style.userSelect = "none";
      }
      const rect = rootRef.current.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const right = Math.min(
        window.innerWidth - w - EDGE_MARGIN,
        Math.max(EDGE_MARGIN, s.originRight - dx),
      );
      const bottom = Math.min(
        window.innerHeight - h - EDGE_MARGIN,
        Math.max(EDGE_MARGIN, s.originBottom - dy),
      );
      setPos({ right, bottom });
    };
    const onUp = () => {
      const s = pressRef.current;
      if (s?.dragging) {
        // mouseup 직후 발생할 click을 한 번 무시 (onClickCapture에서 처리)
        suppressClickRef.current = true;
      }
      pressRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  // 위치 변경 시 localStorage 저장 (다음 마운트·새로고침에도 유지)
  useEffect(() => {
    if (!pos) return;
    try {
      localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos));
    } catch {
      /* quota 초과 등 — silent */
    }
  }, [pos]);

  // 윈도우 리사이즈 시 위젯이 화면 밖으로 나가면 clamp (우하단 기준)
  useEffect(() => {
    if (!pos) return;
    const onResize = () => {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const right = Math.min(
        window.innerWidth - w - EDGE_MARGIN,
        Math.max(EDGE_MARGIN, pos.right),
      );
      const bottom = Math.min(
        window.innerHeight - h - EDGE_MARGIN,
        Math.max(EDGE_MARGIN, pos.bottom),
      );
      if (right !== pos.right || bottom !== pos.bottom) setPos({ right, bottom });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos]);

  if (hidden) return null;

  // 위젯 어디든 mousedown — 우하단 기준 origin 기록.
  // dragging은 threshold 통과 시점에 true로. 그 전엔 click이 자연 동작.
  const onWidgetMouseDown = (e) => {
    if (e.button !== 0) return;                        // 좌클릭만
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    pressRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originRight: window.innerWidth - rect.right,
      originBottom: window.innerHeight - rect.bottom,
      dragging: false,
    };
  };

  // drag로 떼는 순간 발생하는 click — capture 단계에서 한 번만 막음
  const onWidgetClickCapture = (e) => {
    if (suppressClickRef.current) {
      e.stopPropagation();
      e.preventDefault();
      suppressClickRef.current = false;
    }
  };

  // pos 박혔으면 그 값, 아니면 default 16/24 — 둘 다 right/bottom 고정.
  // 미니마이즈/확장 토글 시 width/height가 바뀌어도 우하단이 같은 좌표라
  // 시각적으로 오른쪽 밑으로 줄어듦/오른쪽 밑에서 펼쳐짐.
  const positionStyle = pos
    ? { right: pos.right, bottom: pos.bottom }
    : { right: 16, bottom: 24 };

  const items = tab === "commits" ? commits : builds;
  const visible = items.slice(0, VISIBLE_COUNT);
  const hiddenCount = Math.max(0, items.length - VISIBLE_COUNT);
  const minimizedLabel =
    tab === "commits"
      ? `최근 커밋 · ${commits.length}`
      : `빌드 기록 · ${builds.length}`;

  if (minimized) {
    return (
      <>
        <div
          ref={rootRef}
          className="fixed z-30"
          style={positionStyle}
          onMouseDown={onWidgetMouseDown}
          onClickCapture={onWidgetClickCapture}
        >
          <button
            onClick={() => setMinimized(false)}
            className="flex items-center gap-2.5 pl-4 pr-5 py-2.5 rounded-full"
            style={{
              background: "#6672d5",
              boxShadow:
                "0 4px 20px rgba(129,139,224,0.35), 0 2px 6px rgba(0,0,0,0.3)",
            }}
          >
            <span className="text-[13px] text-white" style={{ fontWeight: 510 }}>
              {minimizedLabel}
            </span>
            <ChevronUp size={13} strokeWidth={2} className="text-white/60" />
          </button>
        </div>
        {showPanel && (
          <CommitListPanel
            commits={commits}
            builds={builds}
            initialTab={tab}
            onClose={() => setShowPanel(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        ref={rootRef}
        className="fixed z-30 flex flex-col justify-end"
        style={{ ...positionStyle, width: 260, maxHeight: "calc(100vh - 100px)" }}
        onMouseDown={onWidgetMouseDown}
        onClickCapture={onWidgetClickCapture}
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
          {/* Tab header — 커밋 / 빌드 */}
          <div
            className="flex items-center px-1.5 pt-1 shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-stretch flex-1 min-w-0">
              <WidgetTab
                active={tab === "commits"}
                onClick={() => setTab("commits")}
                icon={GitCommit}
                label="커밋"
                count={commits.length}
              />
              <WidgetTab
                active={tab === "builds"}
                onClick={() => setTab("builds")}
                icon={GitCommitHorizontal}
                label="빌드"
                count={builds.length}
              />
            </div>
            <button
              onClick={() => setMinimized(true)}
              className="w-6 h-6 rounded-md text-fg-4 flex items-center justify-center shrink-0"
              title="최소화"
            >
              <Minus size={13} strokeWidth={2} />
            </button>
          </div>

          {/* List (top 2) */}
          {visible.length === 0 ? (
            <div className="px-4 py-5 text-center text-[11.5px] text-fg-4">
              {tab === "commits"
                ? "불러올 커밋이 없어요."
                : "아직 빌드가 없어요."}
            </div>
          ) : tab === "commits" ? (
            <div className="px-3 py-1 flex flex-col gap-0.5 overflow-auto scroll-thin">
              {visible.map((c) => (
                <a
                  key={c.sha}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-left px-2.5 py-1.5 rounded-md no-underline block"
                >
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span
                      className="text-[10.5px] shrink-0 font-mono"
                      style={{ fontWeight: 510, color: "#818be0" }}
                    >
                      {c.sha}
                    </span>
                    <span
                      className="text-[12px] text-fg-1 min-w-0 truncate"
                      style={{ fontWeight: 450 }}
                    >
                      {c.message}
                    </span>
                  </div>
                  <div className="text-[10px] text-fg-4 mt-0.5 tabular-nums">
                    {relativeTime(c.date, { compact: true })}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="px-3 py-1 flex flex-col gap-0.5 overflow-auto scroll-thin">
              {visible.map((b) => (
                <button
                  key={b.build_id}
                  onClick={() =>
                    navigate(`/dashboard?build=${b.build_id}`)
                  }
                  className="w-full text-left px-2.5 py-1.5 rounded-md"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-[10.5px] shrink-0"
                      style={{ fontWeight: 510, color: "#818be0" }}
                    >
                      {b.build_id}
                    </span>
                    <span className="text-[10px] text-fg-4 shrink-0 tabular-nums">
                      {relativeTime(b.created_at, { compact: true })}
                    </span>
                    <span className="ml-auto">
                      <StatusBadge status={b.status} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Footer — 자세히 보기 + 업데이트(재배포) */}
          {/* 업데이트는 첫 배포 끝난 사용자(user.app_name 있음)에게만. */}
          <div className="px-3 pb-2 pt-0.5 shrink-0 flex gap-1.5">
            <button
              onClick={() => setShowPanel(true)}
              className="flex-1 py-2 rounded-lg text-[12px] text-fg-2 flex items-center justify-center gap-1.5"
              style={{
                fontWeight: 510,
                border: "1px solid rgba(255,255,255,0.09)",
              }}
            >
              <span>자세히 보기</span>
              {hiddenCount > 0 && (
                <span className="text-fg-4">· +{hiddenCount}</span>
              )}
            </button>
            {user.app_name && (
              <button
                onClick={() => navigate("/deploy")}
                className="shrink-0 px-3 py-2 rounded-lg text-[12px] text-white"
                style={{ fontWeight: 510, background: "#6672d5" }}
                title="새 커밋/변경 반영해 재배포"
              >
                업데이트
              </button>
            )}
          </div>
        </div>
      </div>

      {showPanel && (
        <CommitListPanel
          commits={commits}
          builds={builds}
          initialTab={tab}
          onClose={() => setShowPanel(false)}
        />
      )}
    </>
  );
}

// 위젯 상단 작은 탭 버튼 — 보라 액센트 underline (탭 자체는 hover 색 변화 없음)
function WidgetTab({ active, onClick, icon: Icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-1.5 px-2.5 h-7 text-[11.5px] shrink-0"
      style={{ color: active ? "#dde0e4" : "#8a8f98", fontWeight: 510 }}
    >
      <Icon size={11} strokeWidth={1.8} />
      <span>{label}</span>
      <span className="text-fg-4 text-[10.5px] tabular-nums">{count}</span>
      {active && (
        <span
          className="absolute left-1.5 right-1.5 -bottom-px h-[2px] rounded-t-sm"
          style={{ background: "#818be0" }}
        />
      )}
    </button>
  );
}
