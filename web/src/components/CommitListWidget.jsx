// 우측 하단 floating 위젯 — 커밋 · 빌드 · 환경변수 통합 (탭 3개).
//
// - 미로그인 또는 랜딩("/")에선 숨김
// - 커밋 탭: 최신 build의 repo+branch에서 최근 커밋 N개 폴링 (30s)
// - 빌드 탭: 본인 빌드 목록 폴링 (active 2.5s / 안정 8s)
// - 환경변수 탭: {app_name}-env Secret 1회 fetch (마운트 + 저장 후) — 값은 마스킹
// - 빌드 row 클릭 → /dashboard?build=<id> 로 navigate → Dashboard가 그 빌드를 pin.
//   URL query라 새로고침/공유에도 살아남음.
// - 커밋 row 클릭 → GitHub 페이지 새 창.
// - top-2 미리보기 → "자세히 보기" 클릭 시 CommitListPanel(커밋·빌드) 또는 EnvPanel(환경변수) 오픈.
// - 위젯 어디든 누르고 드래그하면 위치 이동 (5px threshold) — 일반 클릭은 영향 X.
// - 위치는 우하단 기준(right/bottom)으로 저장 — 미니마이즈/확장 토글 시 우하단이 고정됨.
// - localStorage 저장이라 새로고침/페이지 전환에도 유지.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ExternalLink, Minus, Trash2 } from "lucide-react";
import { getAppStatus, getDomain, getEnvVars, listBuilds, listRecentCommits } from "../api/deploy.js";
import AppStatusBadge from "./AppStatusBadge.jsx";
import DomainStatusBadge from "./DomainStatusBadge.jsx";
import DeleteAppModal from "./DeleteAppModal.jsx";
import { relativeTime } from "../lib/format.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import CommitListPanel from "./CommitListPanel.jsx";
import StatusBadge from "./StatusBadge.jsx";

const VISIBLE_COUNT = 2;
const COMMIT_POLL = 60000;                              // 커밋은 자주 안 바뀜 + GitHub unauthenticated 60/h 한도 고려
const ACTIVE = new Set(["queued", "building", "built", "deploying"]);
const POS_STORAGE_KEY = "kd_widget_pos";
const EDGE_MARGIN = 4;                                  // 화면 가장자리 최소 여백
const DRAG_THRESHOLD = 5;                               // px — 이만큼 움직여야 drag로 간주

function formatUptime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 ${m % 60}분`;
  const d = Math.floor(h / 24);
  return `${d}일 ${h % 24}시간`;
}

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
  const { user } = useAuth();
  const [commits, setCommits] = useState([]);
  const [builds, setBuilds] = useState([]);
  const [appStatus, setAppStatus] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  // 슬롯별 상태 — {server: {status,started_at}|null, site: ...|null}. site가 있으면 두 줄 표시.
  const [slotStatus, setSlotStatus] = useState({ server: null, site: null });
  // 커스텀 도메인 + CF 연결 상태 ({ domain, status } 또는 null). pending이면 자주 폴링.
  const [domainInfo, setDomainInfo] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  // env: {KEY: value} dict. 폴링 안 함 — 자주 안 바뀌고 사용자가 바꾸면 직접 refresh.
  const [envVars, setEnvVars] = useState({});
  const [tab, setTab] = useState("status");
  const [minimized, setMinimized] = useState(false);
  // 자세히 보기 패널 — 한 패널 안에서 탭으로 커밋/빌드/환경변수 전환.
  const [showPanel, setShowPanel] = useState(false);
  // null = default 우하단. drag로 5px 이상 움직이면 {right, bottom} 박힘.
  const [pos, setPos] = useState(loadPos);

  const rootRef = useRef(null);
  // mousedown ~ mouseup 동안만 채워짐 — { startX, startY, originRight, originBottom, dragging }
  const pressRef = useRef(null);
  // drag 직후 발생할 click 한 번만 막기 위한 플래그
  const suppressClickRef = useRef(false);
  // 토글 직전 박스 bounding rect — 좌상단 corner를 그대로 유지하기 위한 ref.
  const prevRectRef = useRef(null);

  const toggleMinimize = (next) => {
    if (rootRef.current) {
      prevRectRef.current = rootRef.current.getBoundingClientRect();
    }
    setMinimized(next);
  };

  const isHome = location.pathname === "/";
  // 첫 배포 전엔 위젯에 보여줄 게 없으니 숨김 (커밋·빌드 anchor도 없고 환경변수도 미존재)
  const hidden = isHome || !user || !user.app_name;

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

  // 앱 Pod 상태 폴링
  useEffect(() => {
    if (hidden) { setAppStatus(null); setStartedAt(null); return; }
    let cancelled = false;
    let timer;
    const tick = async () => {
      try {
        const data = await getAppStatus();
        if (!cancelled) {
          setAppStatus(data.status);
          setStartedAt(data.started_at || null);
          setSlotStatus({ server: data.server || null, site: data.site || null });
        }
      } catch {}
      if (!cancelled) {
        const unstable = appStatus === "pending" || appStatus === "crashing";
        timer = setTimeout(tick, unstable ? 5000 : 10000);
      }
    };
    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [hidden, user?.id, user?.app_name]);

  // 커스텀 도메인 + CF 연결 상태 폴링 — pending(인증서 발급 중)이면 8s, active/없음이면 30s.
  useEffect(() => {
    if (hidden || !user?.app_name) { setDomainInfo(null); return; }
    let cancelled = false;
    let timer;
    const tick = async () => {
      let pending = false;
      try {
        const d = await getDomain();
        if (!cancelled) {
          if (d?.domain) {
            setDomainInfo({ domain: d.domain, status: d.status });
            pending = d.status !== "active";
          } else {
            setDomainInfo(null);
          }
        }
      } catch {}
      if (!cancelled) timer = setTimeout(tick, pending ? 8000 : 30000);
    };
    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [hidden, user?.id, user?.app_name]);

  // 환경변수 fetch — 마운트 시 + deploying 감지 시 refetch (env Secret이 deploying 초반에 생성됨)
  const hasDeploying = builds.some((b) => b.status === "deploying");
  useEffect(() => {
    if (hidden || !user?.app_name) {
      setEnvVars({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getEnvVars();
        if (!cancelled) setEnvVars(data.env || {});
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [hidden, user?.id, user?.app_name, hasDeploying]);

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

  // 최소화/펼침 토글 시 알약이 위치한 화면 사분면 판별 → 그 corner를 박스의 같은 corner로.
  // 우하단 알약 → 박스 우하단 corner = 알약 우하단 (박스가 좌/상으로 펼침).
  // 좌상단 알약 → 박스 좌상단 corner = 알약 좌상단 (박스가 우/하로 펼침).
  // cycle 후 알약은 원래 위치 그대로.
  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    let targetRight;
    let targetBottom;
    if (prevRectRef.current) {
      const prev = prevRectRef.current;
      const cx = prev.left + prev.width / 2;
      const cy = prev.top + prev.height / 2;
      if (cx >= window.innerWidth / 2) {
        targetRight = window.innerWidth - prev.right;
      } else {
        targetRight = window.innerWidth - prev.left - w;
      }
      if (cy >= window.innerHeight / 2) {
        targetBottom = window.innerHeight - prev.bottom;
      } else {
        targetBottom = window.innerHeight - prev.top - h;
      }
      prevRectRef.current = null;
    } else {
      targetRight = pos ? pos.right : 16;
      targetBottom = pos ? pos.bottom : 24;
    }

    const maxRight = Math.max(EDGE_MARGIN, window.innerWidth - w - EDGE_MARGIN);
    const maxBottom = Math.max(EDGE_MARGIN, window.innerHeight - h - EDGE_MARGIN);
    const right = Math.min(maxRight, Math.max(EDGE_MARGIN, targetRight));
    const bottom = Math.min(maxBottom, Math.max(EDGE_MARGIN, targetBottom));

    if (right !== (pos?.right ?? -1) || bottom !== (pos?.bottom ?? -1)) {
      setPos({ right, bottom });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minimized]);

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

  // tab별 보여줄 items. env는 dict라 entries로 변환.
  const envEntries = Object.entries(envVars);
  const items =
    tab === "commits" ? commits : tab === "builds" ? builds : envEntries;
  const visible = items.slice(0, VISIBLE_COUNT);
  const hiddenCount = Math.max(0, items.length - VISIBLE_COUNT);
  // 빌드 목록 슬롯 구분(ID 색)·상단 범례 노출 여부 — 정적 빌드가 하나라도 있을 때만 (단일 슬롯이면 노이즈)
  const hasStaticBuilds = builds.some((b) => b.runtime === "static");
  // 슬롯별 활성 빌드 — Pod이 아직 없는 슬롯(missing)도 빌드 중이면 상태 줄에 "빌드 중"으로 표시
  const activeServerBuild = builds.some(
    (b) => b.runtime !== "static" && ACTIVE.has(b.status),
  );
  const activeStaticBuild = builds.some(
    (b) => b.runtime === "static" && ACTIVE.has(b.status),
  );

  // 모든 탭 카운트 한 줄: 커밋 · 빌드 · 환경변수
  const statusEmoji = appStatus === "running" ? "●" : appStatus === "crashing" ? "●" : "○";
  const minimizedLabel = `${statusEmoji} ${commits.length} · ${builds.length} · ${envEntries.length}`;

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
            onClick={() => toggleMinimize(false)}
            className="flex items-center pl-4 pr-4 py-2.5 rounded-2xl"
            style={{
              background: "#6672d5",
              boxShadow:
                "0 4px 20px rgba(129,139,224,0.35), 0 2px 6px rgba(0,0,0,0.3)",
            }}
          >
            <span className="text-[13px] text-white" style={{ fontWeight: 510 }}>
              {minimizedLabel}
            </span>
          </button>
        </div>
        {showPanel && (
          <CommitListPanel
            commits={commits}
            builds={builds}
            envVars={envVars}
            initialTab={tab}
            onEnvSaved={(fresh) => setEnvVars(fresh)}
            onClose={() => setShowPanel(false)}
          />
        )}
        {showDeleteModal && (
          <DeleteAppModal
            appName={user.app_name}
            onClose={() => setShowDeleteModal(false)}
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
          {/* Tab header — 상태 / 커밋 / 빌드 / 환경변수 */}
          <div
            className="flex items-center px-1.5 pt-1 shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-stretch flex-1 min-w-0">
              <WidgetTab
                active={tab === "status"}
                onClick={() => setTab("status")}
                label="상태"
              />
              <WidgetTab
                active={tab === "commits"}
                onClick={() => setTab("commits")}
                label="커밋"
                count={commits.length}
              />
              <WidgetTab
                active={tab === "builds"}
                onClick={() => setTab("builds")}
                label="빌드"
                count={builds.length}
              />
              <WidgetTab
                active={tab === "env"}
                onClick={() => setTab("env")}
                label="환경변수"
                count={envEntries.length}
              />
            </div>
            <button
              onClick={() => toggleMinimize(true)}
              className="w-6 h-6 rounded-md text-fg-4 flex items-center justify-center shrink-0"
              title="최소화"
            >
              <Minus size={13} strokeWidth={2} />
            </button>
          </div>

          {/* Content */}
          {tab === "status" ? (
            <div className="px-3 py-2.5">
              {/* 헤더 없음 — 이름은 모든 주소 줄의 접두라 중복, 상태는 줄마다 뱃지 */}
              <div className="mb-3 flex flex-col gap-1">
                {slotStatus.site ? (
                  <>
                    {/* 두 슬롯 — 프론트({app}=정적) / 백엔드({app}-api). 뱃지는 슬롯별 Pod 상태.
                        Pod이 아직 없어도(missing) 그 슬롯의 빌드가 돌고 있으면 "빌드 중"으로 —
                        java 빌드가 정적보다 오래 걸려서 백엔드 줄이 사라져 보이는 문제 방지. */}
                    <SlotRow
                      label="프론트"
                      host={`${user.app_name}.kodeploy.com`}
                      status={
                        slotStatus.site.status === "missing" && activeStaticBuild
                          ? "building"
                          : slotStatus.site.status
                      }
                    />
                    {slotStatus.server &&
                      (slotStatus.server.status !== "missing" || activeServerBuild) && (
                        <SlotRow
                          label="백엔드"
                          host={`${user.app_name}-api.kodeploy.com`}
                          status={
                            slotStatus.server.status === "missing" && activeServerBuild
                              ? "building"
                              : slotStatus.server.status
                          }
                        />
                      )}
                  </>
                ) : (
                  /* 단일 슬롯(서버만) — 한 줄 + 뱃지 (헤더 뱃지 제거에 따라 여기로) */
                  <div className="flex items-center gap-2 min-w-0">
                    <a
                      href={`https://${user.app_name}.kodeploy.com`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-fg-3 hover:text-fg-1 no-underline transition-colors truncate min-w-0"
                      style={{ fontWeight: 450 }}
                    >
                      <span className="truncate">{user.app_name}.kodeploy.com</span>
                      <ExternalLink size={9} strokeWidth={2} className="shrink-0" />
                    </a>
                    {startedAt && appStatus === "running" && (
                      <span className="text-[10px] text-fg-4 tabular-nums shrink-0" style={{ fontWeight: 450 }}>
                        {formatUptime(startedAt)}
                      </span>
                    )}
                    <span className="ml-auto shrink-0">
                      <AppStatusBadge status={appStatus} />
                    </span>
                  </div>
                )}
                {/* 커스텀 도메인 — 연결 상태 배지(우측). active=연결됨 / 그 외=대기중 */}
                {domainInfo && (
                  <div className="flex items-center gap-2 min-w-0">
                    <a
                      href={`https://${domainInfo.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-fg-3 hover:text-fg-1 no-underline transition-colors truncate min-w-0"
                      style={{ fontWeight: 450 }}
                    >
                      <span className="truncate">{domainInfo.domain}</span>
                      <ExternalLink size={9} strokeWidth={2} className="shrink-0" />
                    </a>
                    <span className="ml-auto shrink-0">
                      <DomainStatusBadge status={domainInfo.status} />
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/deploy"
                  className="flex-1 py-1.5 rounded-md text-[11.5px] text-center text-white no-underline"
                  style={{ background: "#6672d5", fontWeight: 510 }}
                >
                  업데이트
                </Link>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-fg-4 hover:text-red-300 transition-colors shrink-0"
                  style={{ border: "1px solid rgba(255,255,255,0.09)", background: "transparent", cursor: "pointer" }}
                  title="앱 삭제"
                >
                  <Trash2 size={13} strokeWidth={1.8} />
                </button>
              </div>
            </div>
          ) : visible.length === 0 ? (
            <div className="px-4 py-5 text-center text-[11.5px] text-fg-4">
              {tab === "commits"
                ? "불러올 커밋이 없어요."
                : tab === "builds"
                ? "아직 빌드가 없어요."
                : "아직 환경변수가 없어요."}
            </div>
          ) : tab === "commits" ? (
            <div className="px-3 py-1 flex flex-col gap-0.5 overflow-auto scroll-thin">
              {visible.map((c) => (
                <button
                  key={c.sha}
                  onClick={() => setShowPanel(true)}
                  className="w-full text-left px-2.5 py-1.5 rounded-md"
                >
                  <div
                    className="text-[12px] text-fg-1 truncate"
                    style={{ fontWeight: 450 }}
                  >
                    {c.message}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-fg-4 min-w-0">
                    <span
                      className="shrink-0"
                      style={{ fontWeight: 510, color: "#818be0" }}
                    >
                      {c.sha}
                    </span>
                    <span className="shrink-0">·</span>
                    <span className="truncate">{c.author}</span>
                    <span className="shrink-0">·</span>
                    <span className="shrink-0 tabular-nums">
                      {relativeTime(c.date, { compact: true })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : tab === "builds" ? (
            <div className="px-3 py-1 flex flex-col gap-0.5 overflow-auto scroll-thin">
              {(() => {
                // #N은 kind="build"만 카운트 — env_change는 번호 안 매김.
                const totalBuilds = builds.filter(
                  (b) => (b.kind || "build") === "build",
                ).length;
                let buildIdx = totalBuilds;
                return visible.map((b) => {
                  const kind = b.kind || "build";
                  const isEnvChange = kind === "env_change";
                  const number = isEnvChange ? null : buildIdx--;
                  return (
                    <button
                      key={b.build_id}
                      onClick={() => setShowPanel(true)}
                      className="w-full h-7 px-2.5 rounded-md flex items-center gap-2 text-left"
                    >
                      {isEnvChange ? (
                        <>
                          <span
                            className="text-[11px] text-fg-2 truncate"
                            style={{ fontWeight: 510 }}
                          >
                            환경변수 변경
                          </span>
                          <span className="text-[10px] text-fg-4 shrink-0 tabular-nums">
                            {relativeTime(b.created_at, { compact: true })}
                          </span>
                          <span className="ml-auto">
                            <StatusBadge status={b.status} kind="env" />
                          </span>
                        </>
                      ) : (
                        <>
                          <span
                            className="text-[10.5px] text-fg-3 shrink-0 tabular-nums"
                            style={{ fontWeight: 590 }}
                          >
                            #{number}
                          </span>
                          <span
                            className="text-[10.5px] shrink-0"
                            style={{
                              fontWeight: 510,
                              // 슬롯 구분은 ID 색으로 — 프론트(static)=초록, 백엔드=보라 (범례는 자세히 보기에만)
                              color: b.runtime === "static" ? "#4a9d76" : "#818be0",
                            }}
                          >
                            {b.build_id}
                          </span>
                          <span className="text-[10px] text-fg-4 shrink-0 tabular-nums">
                            {relativeTime(b.created_at, { compact: true })}
                          </span>
                          <span className="ml-auto">
                            <StatusBadge status={b.status} />
                          </span>
                        </>
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          ) : (
            // env 탭 — 값은 항상 마스킹. 평문/편집은 자세히 보기 패널에서.
            // row 디자인은 커밋/빌드와 일관 (보라 액센트 식별자 + 회색 보조 정보).
            <div className="px-3 py-1 flex flex-col gap-0.5 overflow-auto scroll-thin">
              {visible.map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setShowPanel(true)}
                  className="w-full h-7 px-2.5 rounded-md flex items-center gap-2 text-left"
                >
                  <span
                    className="text-[10.5px] shrink-0 truncate max-w-[120px]"
                    style={{ fontWeight: 510, color: "#818be0" }}
                  >
                    {key}
                  </span>
                  <span
                    className="text-[10px] text-fg-4 shrink-0"
                    style={{ fontWeight: 450 }}
                  >
                    {"•".repeat(Math.min(value.length, 12))}
                  </span>
                </button>
              ))}
            </div>
          )}

          {tab !== "status" && (
            <div className="px-3 pb-2 pt-0.5 shrink-0">
              <button
                onClick={() => setShowPanel(true)}
                className="w-full py-2 rounded-md text-[12px] text-fg-2 flex items-center justify-center gap-1.5"
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
            </div>
          )}
        </div>
      </div>

      {showPanel && (
        <CommitListPanel
          commits={commits}
          builds={builds}
          envVars={envVars}
          initialTab={tab}
          onEnvSaved={(fresh) => setEnvVars(fresh)}
          onClose={() => setShowPanel(false)}
        />
      )}
      {showDeleteModal && (
        <DeleteAppModal
          appName={user.app_name}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </>
  );
}

// 위젯 상단 작은 탭 버튼 — 보라 액센트 underline (탭 자체는 hover 색 변화 없음)
// 슬롯 한 줄 — 라벨(프론트/백엔드) + 주소 링크 + 슬롯별 상태 뱃지 (status는 호출부가 계산)
function SlotRow({ label, host, status }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className="text-[10px] text-fg-4 w-9 shrink-0"
        style={{ fontWeight: 590 }}
      >
        {label}
      </span>
      <a
        href={`https://${host}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] text-fg-3 hover:text-fg-1 no-underline transition-colors truncate min-w-0"
        style={{ fontWeight: 450 }}
      >
        <span className="truncate">{host}</span>
        <ExternalLink size={9} strokeWidth={2} className="shrink-0" />
      </a>
      <span className="ml-auto shrink-0">
        <AppStatusBadge status={status} />
      </span>
    </div>
  );
}

function WidgetTab({ active, onClick, label, count }) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-1.5 px-2.5 h-7 text-[11.5px] shrink-0"
      style={{ color: active ? "#dde0e4" : "#8a8f98", fontWeight: 510 }}
    >
      <span>{label}</span>
      {count != null && <span className="text-fg-4 text-[10.5px] tabular-nums">{count}</span>}
      {active && (
        <span
          className="absolute left-1.5 right-1.5 -bottom-px h-[2px] rounded-t-sm"
          style={{ background: "#818be0" }}
        />
      )}
    </button>
  );
}
