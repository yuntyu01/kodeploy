// 유저의 단일 앱 dashboard (1유저=1앱).
//
// - 미로그인 → LoginModal + 홈으로
// - user.app_name 없음(첫 배포 안 함) → 안내 + "배포하기" CTA
// - app_name 있음 → 헤더(app_name·domain·상태) + 메인(선택 빌드의 로그/Dockerfile) + 사이드(빌드 히스토리)
//
// 빌드 선택: 사용자가 사이드 클릭 안 했으면 자동 — running > 최신.
// 사용자가 한 번 선택하면 그 빌드 유지(폴링으로 다른 빌드가 active 돼도 강제 전환 안 함).
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ExternalLink,
  GitBranch,
  MoreHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { deleteApp, getAppStatus, listBuilds } from "../api/deploy.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import AppStatusBadge from "./AppStatusBadge.jsx";
import PanelWorkspace from "./PanelWorkspace.jsx";

const ACTIVE = new Set(["queued", "building", "built", "deploying"]);

function pickAutoBuild(builds) {
  if (!builds.length) return null;
  const running = builds.find((b) => b.status === "running");
  if (running) return running;
  const active = builds.find((b) => ACTIVE.has(b.status));
  if (active) return active;
  return builds[0];                                       // 최신순 정렬돼 있음
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading, openLogin, refresh } = useAuth();
  const [builds, setBuilds] = useState([]);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  // 현재 Pod 상태 — 빌드와 독립. 폴링 (running 안정 시 10초).
  const [appStatus, setAppStatus] = useState(null);
  // 빌드 선택은 URL query — 위젯에서 navigate(`/dashboard?build=<id>`)로 전달.
  // null/없으면 자동 선택(running > 최신). 새로고침에도 살아남고 URL 공유 가능.
  const [searchParams] = useSearchParams();
  const pinnedBuildId = searchParams.get("build");

  // 미로그인 가드
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      openLogin?.();
      navigate("/", { replace: true });
    }
  }, [authLoading, user, openLogin, navigate]);

  // 앱 Pod 상태 폴링 — pending/crashing이면 5초, running/missing이면 10초.
  useEffect(() => {
    if (authLoading || !user || !user.app_name) return;
    let cancelled = false;
    let timer;
    const tick = async () => {
      try {
        const data = await getAppStatus();
        if (cancelled) return;
        setAppStatus(data.status);
        const unstable = data.status === "pending" || data.status === "crashing";
        timer = setTimeout(tick, unstable ? 5000 : 10000);
      } catch {
        if (!cancelled) timer = setTimeout(tick, 10000);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [authLoading, user?.id, user?.app_name]);

  // 빌드 폴링 — 활성 빌드 있으면 2.5s, 안정이면 8s
  useEffect(() => {
    if (authLoading || !user || !user.app_name) return;
    let cancelled = false;
    let timer;

    const tick = async () => {
      try {
        const data = await listBuilds();
        if (cancelled) return;
        setBuilds(data);
        setError(null);
        const hasActive = data.some((b) => ACTIVE.has(b.status));
        timer = setTimeout(tick, hasActive ? 2500 : 8000);
      } catch (err) {
        if (cancelled) return;
        if (err.status === 401) {
          openLogin?.();
          navigate("/", { replace: true });
          return;
        }
        setError(err.message || "조회 실패");
        timer = setTimeout(tick, 8000);
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [authLoading, user?.id, user?.app_name, navigate, openLogin]);

  if (authLoading || !user) return null;

  // 첫 배포 안 한 상태 — empty state로 유도
  if (!user.app_name) {
    return (
      <div className="flex-1 overflow-auto scroll-thin">
        <div
          className="mx-auto px-6 text-center"
          style={{ maxWidth: 520, paddingTop: "16vh" }}
        >
          <div
            className="w-12 h-12 rounded-xl mx-auto mb-6 flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(129,139,224,0.18), rgba(167,139,250,0.12))",
              border: "1px solid rgba(129,139,224,0.25)",
            }}
          >
            <GitBranch size={20} strokeWidth={1.5} className="text-[#818be0]" />
          </div>
          <h2
            className="text-fg-1 mb-3"
            style={{
              fontSize: 22,
              fontWeight: 590,
              letterSpacing: -0.4,
            }}
          >
            아직 배포한 앱이 없어요
          </h2>
          <p
            className="text-fg-3 mb-8 mx-auto"
            style={{ fontSize: 13.5, fontWeight: 450, lineHeight: 1.55, maxWidth: 380 }}
          >
            첫 배포가 끝나면 이 페이지에 앱의 도메인 · 빌드 로그 · 상태가 표시됩니다.
          </p>
          <Link
            to="/deploy"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-md text-[14px] text-white no-underline transition-all"
            style={{
              background: "linear-gradient(135deg, #6672d5 0%, #7d6dd5 100%)",
              fontWeight: 510,
              boxShadow:
                "0 8px 24px rgba(102,114,213,0.35), 0 0 0 1px rgba(255,255,255,0.06) inset",
            }}
          >
            배포하기
            <ArrowRight size={14} strokeWidth={2} />
          </Link>
        </div>
      </div>
    );
  }

  const selected =
    builds.find((b) => b.build_id === pinnedBuildId) || pickAutoBuild(builds);
  const appUrl = `https://${user.app_name}.kodeploy.com`;

  return (
    <div className="flex-1 overflow-auto scroll-thin">
      <div className="mx-auto px-6 py-6" style={{ maxWidth: 1120 }}>
        {/* Header */}
        <header className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1
                className="text-fg-1"
                style={{
                  fontSize: 22,
                  fontWeight: 590,
                  letterSpacing: -0.4,
                }}
              >
                {user.app_name}
              </h1>
              <AppStatusBadge status={appStatus} />
            </div>
            <a
              href={appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-1.5 text-[12.5px] text-fg-3 hover:text-fg-1 transition-colors no-underline"
              style={{ fontWeight: 510 }}
            >
              {appUrl.replace(/^https:\/\//, "")}
              <ExternalLink size={11} strokeWidth={1.8} />
            </a>
          </div>
          <Link
            to="/deploy"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] text-white no-underline transition-all"
            style={{
              background: "linear-gradient(135deg, #6672d5 0%, #7d6dd5 100%)",
              fontWeight: 510,
              boxShadow:
                "0 6px 18px rgba(102,114,213,0.3), 0 0 0 1px rgba(255,255,255,0.06) inset",
            }}
          >
            업데이트
            <ArrowRight size={13} strokeWidth={2} />
          </Link>
          <AppMenu onDelete={() => setShowDeleteModal(true)} />
        </header>

        {error && (
          <div
            className="mb-4 px-3 py-2 rounded-md text-[12px]"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#fca5a5",
            }}
          >
            {error}
          </div>
        )}

        {/* Body — 분할 워크스페이스가 전폭. 빌드 히스토리는 우하단 CommitListWidget(빌드 탭)로 이동. */}
        <div className="flex flex-col" style={{ minHeight: "70vh" }}>
          {selected ? (
            <PanelWorkspace key={selected.build_id} build={selected} />
          ) : (
            <div
              className="flex-1 rounded-xl p-10 flex items-center justify-center text-[12px] text-fg-4"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              불러오는 중…
            </div>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <DeleteAppModal
          appName={user.app_name}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={async () => {
            // user.app_name=null로 풀린 상태를 AuthContext에 반영 → 위 분기가 empty state로.
            await refresh();
            setShowDeleteModal(false);
          }}
        />
      )}
    </div>
  );
}

// 헤더 우측 ··· 드롭다운. 위험 액션(삭제)을 primary 버튼과 분리.
function AppMenu({ onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-md flex items-center justify-center text-fg-3 hover:text-fg-1 hover:bg-white/[0.04] transition-colors"
        title="앱 메뉴"
        aria-label="앱 메뉴"
      >
        <MoreHorizontal size={16} strokeWidth={1.8} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] w-44 rounded-md py-1 kd-fade-in"
          style={{
            background: "#131415",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            zIndex: 30,
          }}
        >
          <button
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] hover:bg-white/[0.04] transition-colors"
            style={{ fontWeight: 510, color: "#fca5a5" }}
          >
            <Trash2 size={13} strokeWidth={1.8} />
            앱 삭제
          </button>
        </div>
      )}
    </div>
  );
}

// 삭제 확인 모달 — appName 정확히 타이핑해야 활성. destructive 액션 표준 패턴.
function DeleteAppModal({ appName, onClose, onDeleted }) {
  const [typed, setTyped] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const canDelete = typed === appName && !submitting;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !submitting && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, submitting]);

  const handleDelete = async () => {
    if (!canDelete) return;
    setSubmitting(true);
    setError(null);
    try {
      await deleteApp();
      await onDeleted();
    } catch (err) {
      setError(err.message || "삭제 실패");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center kd-fade-in"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={() => !submitting && onClose()}
    >
      <div
        className="relative w-[440px] max-w-[92vw] px-8 pt-8 pb-7 rounded-xl"
        style={{
          background: "#08090a",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={submitting}
          className="absolute top-3 right-3 w-8 h-8 rounded-md text-fg-4 hover:text-fg-1 hover:bg-white/[0.04] transition-colors flex items-center justify-center disabled:opacity-40"
          aria-label="닫기"
        >
          <X size={14} strokeWidth={1.8} />
        </button>

        <h2
          className="text-[17px] text-fg-1 mb-2"
          style={{ fontWeight: 590, letterSpacing: -0.3 }}
        >
          앱을 정말 삭제할까요?
        </h2>
        <p
          className="text-[13px] text-fg-3 mb-5"
          style={{ fontWeight: 450, lineHeight: 1.55 }}
        >
          K8s 리소스 · MySQL 데이터(PVC) · 환경변수 · 빌드 히스토리가 모두
          삭제됩니다. 되돌릴 수 없어요.
        </p>

        <div className="mb-4">
          <div
            className="text-[10.5px] tracking-[0.08em] text-fg-3 mb-2"
            style={{ fontWeight: 590 }}
          >
            확인하려면 앱 이름{" "}
            <span style={{ color: "#818be0" }}>{appName}</span>을 입력하세요
          </div>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={appName}
            spellCheck={false}
            autoFocus
            disabled={submitting}
            className="w-full px-3 py-2 rounded-md bg-transparent outline-none text-[13px] text-fg-1 placeholder:text-fg-4"
            style={{ border: "1px solid rgba(255,255,255,0.09)", fontWeight: 510 }}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            disabled={!canDelete}
            className="flex-1 py-2.5 rounded-md text-[13px] transition-colors disabled:opacity-40"
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "#f87171",
              fontWeight: 510,
            }}
            onMouseEnter={(e) => {
              if (!canDelete) return;
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {submitting ? "삭제 중…" : "영구 삭제"}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-md text-[13px] text-fg-2 hover:text-fg-1 hover:bg-white/[0.04] transition-colors disabled:opacity-40"
            style={{ fontWeight: 510, border: "1px solid rgba(255,255,255,0.09)" }}
          >
            취소
          </button>
        </div>

        {error && (
          <p
            className="mt-3 text-[12px]"
            style={{ color: "#fca5a5", fontWeight: 510 }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

