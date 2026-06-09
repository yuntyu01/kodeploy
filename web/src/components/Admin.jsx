// 관리자 페이지 (/admin) — role admin/root만 진입 (TopBar 링크도 동일 조건).
//
// - 통계 카드: 가입자 · 배포된 앱 · 총 빌드(성공/실패) · 최근 24h
//   "총 빌드" 클릭 → 빌드 기록 테이블 토글 (단계별 소요시간 포함)
// - 노드: CPU/메모리/디스크 사용량 바 (kubelet stats/summary, 30s 폴링)
//   노드 카드 클릭 → 그 노드 Pod별 사용량+limit 테이블 펼침
// - 가입자 테이블: tenant · 앱 · 도메인 · 빌드 수 · 마지막 빌드 · 등급
//   등급 select는 root에게만, 대상이 root/본인이면 잠김.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Hammer, Server, ShieldCheck, Users } from "lucide-react";
import {
  getNodePods,
  getNodes,
  getOverview,
  getUserTenant,
  listBuildRecords,
  listUsers,
  setUserRole,
} from "../api/admin.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { relativeTime } from "../lib/format.js";

const ADMIN_ROLES = ["admin", "root"];
const NODE_POLL_MS = 30000;

const GiB = 1024 ** 3;
const MiB = 1024 ** 2;
const fmtGiB = (bytes) =>
  bytes == null ? "—" : `${(bytes / GiB).toFixed(1)}Gi`;
// Pod 단위는 MiB가 읽기 좋음 (수십~수백 Mi). 1GiB 넘으면 Gi로.
const fmtMem = (bytes) => {
  if (bytes == null) return "—";
  if (bytes >= GiB) return `${(bytes / GiB).toFixed(2)}Gi`;
  return `${Math.round(bytes / MiB)}Mi`;
};
const fmtCores = (cores) => (cores == null ? "—" : cores.toFixed(2));
// Pod CPU는 millicores가 직관적 (0.0032 cores → 3m)
const fmtMilli = (cores) =>
  cores == null ? "—" : `${Math.round(cores * 1000)}m`;
const fmtDuration = (sec) => {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
};

const BUILD_STATUS_COLORS = {
  running: "#6dd5a0",   // 성공 (롤아웃 완료)
  failed: "#f87171",
  cancelled: "#8a8f98",
  building: "#d8a657",  // 진행 중 (아직 마감 안 됨)
};

const ROLE_COLORS = {
  root: "#d8a657",
  admin: "#818be0",
  user: "#8a8f98",
};

export default function Admin() {
  const navigate = useNavigate();
  const { user, loading: authLoading, openLogin } = useAuth();
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [nodes, setNodes] = useState(null);               // null=로딩
  const [error, setError] = useState(null);
  // "총 빌드" 카드 드릴다운 — 열 때 1회 fetch 후 캐시 (닫았다 열어도 재요청 X)
  const [showBuilds, setShowBuilds] = useState(false);
  const [buildRecords, setBuildRecords] = useState(null);
  // 유저 row 드릴다운 — 한 번에 한 명만 펼침. 상세는 id별 캐시.
  const [expandedUser, setExpandedUser] = useState(null);
  const [tenantDetails, setTenantDetails] = useState({});

  const isAdmin = user && ADMIN_ROLES.includes(user.role);

  // 가드 — 미로그인은 로그인 유도, 일반 user는 홈으로.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      openLogin?.();
      navigate("/", { replace: true });
      return;
    }
    if (!ADMIN_ROLES.includes(user.role)) {
      navigate("/", { replace: true });
    }
  }, [authLoading, user, openLogin, navigate]);

  // 통계 + 유저 목록 — 마운트 시 1회 (수동 새로고침은 노드 영역 버튼).
  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([getOverview(), listUsers()])
      .then(([ov, us]) => {
        setOverview(ov);
        setUsers(us);
        setError(null);
      })
      .catch((e) => setError(e.message || "조회 실패"));
  }, [isAdmin]);

  // 빌드 기록 — 드릴다운 첫 오픈 시 fetch.
  useEffect(() => {
    if (!isAdmin || !showBuilds || buildRecords !== null) return;
    listBuildRecords()
      .then(setBuildRecords)
      .catch(() => setBuildRecords([]));
  }, [isAdmin, showBuilds, buildRecords]);

  // 노드 리소스 — 30초 폴링.
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    let timer;
    const tick = async () => {
      try {
        const data = await getNodes();
        if (cancelled) return;
        setNodes(data);
      } catch {
        if (cancelled) return;
        setNodes([]);
      }
      timer = setTimeout(tick, NODE_POLL_MS);
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isAdmin]);

  if (authLoading || !isAdmin) return null;

  // 유저 row 클릭 — 펼침 토글 + 첫 오픈 시 테넌트 상세 fetch.
  const toggleUser = (u) => {
    const next = expandedUser === u.id ? null : u.id;
    setExpandedUser(next);
    if (next && !tenantDetails[u.id]) {
      getUserTenant(u.id)
        .then((d) => setTenantDetails((prev) => ({ ...prev, [u.id]: d })))
        .catch((e) =>
          setTenantDetails((prev) => ({
            ...prev,
            [u.id]: { error: e.message || "조회 실패" },
          })),
        );
    }
  };

  const handleRoleChange = async (target, role) => {
    try {
      await setUserRole(target.id, role);
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, role } : u)),
      );
    } catch (e) {
      setError(e.message || "등급 변경 실패");
    }
  };

  return (
    <div className="kd-fade-in mx-auto px-6 py-10" style={{ maxWidth: 1040 }}>
      <div className="flex items-center gap-2.5 mb-1">
        <ShieldCheck size={18} strokeWidth={1.8} className="text-[#818be0]" />
        <h1
          className="text-[20px] text-fg-1"
          style={{ fontWeight: 590, letterSpacing: -0.4 }}
        >
          관리자
        </h1>
      </div>
      <p className="text-[12.5px] text-fg-3 mb-8" style={{ fontWeight: 450 }}>
        가입 · 빌드 · 노드 현황
      </p>

      {error && (
        <div
          className="mb-6 px-3 py-2 rounded-md text-[12px]"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#fca5a5",
          }}
        >
          {error}
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <StatCard
          label="가입자"
          value={overview?.users.total}
          sub={`7일 +${overview?.users.signups_7d ?? "—"}`}
        />
        <StatCard
          label="배포된 앱"
          value={overview?.users.with_app}
          sub="app_name 보유 유저"
        />
        <StatCard
          label="총 빌드"
          value={overview?.builds.total}
          sub={`성공 ${overview?.builds.succeeded ?? "—"} · 실패 ${overview?.builds.failed ?? "—"}`}
          onClick={() => setShowBuilds((v) => !v)}
          active={showBuilds}
        />
        <StatCard
          label="최근 24시간"
          value={overview?.builds.last_24h}
          sub={`평균 성공 소요 ${fmtDuration(overview?.builds.avg_success_seconds)}`}
        />
      </div>

      {/* 빌드 기록 — "총 빌드" 카드 토글 */}
      {showBuilds && (
        <>
          <SectionTitle icon={Hammer} title="빌드 기록 (최근 100건)" />
          <div className="mb-10">
            <BuildRecordsTable records={buildRecords} />
          </div>
        </>
      )}

      {/* 노드 현황 */}
      <SectionTitle icon={Server} title="노드" />
      <div className="flex flex-col gap-3 mb-10">
        {nodes === null && <Hint>노드 정보를 불러오는 중…</Hint>}
        {nodes?.length === 0 && <Hint>노드 정보를 불러오지 못했어요.</Hint>}
        {nodes?.map((n) => (
          <NodeCard key={n.name} node={n} />
        ))}
      </div>

      {/* 가입자 테이블 */}
      <SectionTitle icon={Users} title="가입자" />
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.015)",
        }}
      >
        <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="text-left text-[11px] text-fg-4" style={{ fontWeight: 590 }}>
              {["유저", "등급", "앱 / 테넌트", "도메인", "빌드", "마지막 빌드", "가입"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 uppercase tracking-[0.06em]"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow
                key={u.id}
                u={u}
                me={user}
                expanded={expandedUser === u.id}
                detail={tenantDetails[u.id]}
                onToggle={() => toggleUser(u)}
                onRoleChange={handleRoleChange}
              />
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[12px] text-fg-4">
                  가입자가 없어요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={14} strokeWidth={1.8} className="text-fg-3" />
      <h2 className="text-[14px] text-fg-1" style={{ fontWeight: 590 }}>
        {title}
      </h2>
    </div>
  );
}

function Hint({ children }) {
  return (
    <div className="text-[12px] text-fg-4 py-4" style={{ fontWeight: 450 }}>
      {children}
    </div>
  );
}

// onClick 있으면 클릭 가능 카드 (총 빌드 → 기록 토글). active면 강조 테두리.
function StatCard({ label, value, sub, onClick, active }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`rounded-xl px-4 py-3.5 text-left ${onClick ? "transition-colors" : ""}`}
      style={{
        border: `1px solid ${active ? "rgba(129,139,224,0.4)" : "rgba(255,255,255,0.07)"}`,
        background: active ? "rgba(129,139,224,0.06)" : "rgba(255,255,255,0.015)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div className="text-[11px] text-fg-4 mb-1.5 flex items-center gap-1" style={{ fontWeight: 590 }}>
        {label}
        {onClick && (
          <ChevronDown
            size={11}
            strokeWidth={2}
            className="transition-transform"
            style={{ transform: active ? "rotate(180deg)" : "none" }}
          />
        )}
      </div>
      <div
        className="text-[22px] text-fg-1 tabular-nums"
        style={{ fontWeight: 590, letterSpacing: -0.5 }}
      >
        {value ?? "—"}
      </div>
      <div className="text-[11px] text-fg-4 mt-1 truncate">{sub}</div>
    </Tag>
  );
}

// 빌드 기록 테이블 — build_records 최신순. 단계 시간(nixpacks/buildkit)은
// dockerfile 모드나 타임아웃이면 비어 있을 수 있음 ("—").
function BuildRecordsTable({ records }) {
  if (records === null) return <Hint>빌드 기록을 불러오는 중…</Hint>;
  if (records.length === 0) return <Hint>빌드 기록이 없어요.</Hint>;
  return (
    <div
      className="rounded-xl overflow-x-auto scroll-thin"
      style={{
        border: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.015)",
      }}
    >
      <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr className="text-left text-[10.5px] text-fg-4" style={{ fontWeight: 590 }}>
            {["시작", "유저", "앱", "#", "모드", "nixpacks", "buildkit", "총", "상태"].map((h) => (
              <th
                key={h}
                className="px-3 py-2 uppercase tracking-[0.06em] whitespace-nowrap"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr
              key={r.id}
              className="text-fg-2"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              title={r.error || undefined}
            >
              <td className="px-3 py-2 text-fg-3 tabular-nums whitespace-nowrap">
                {relativeTime(r.started_at)}
              </td>
              <td className="px-3 py-2" style={{ fontWeight: 510, color: "#dde0e4" }}>
                {r.login}
              </td>
              <td className="px-3 py-2">{r.app_name}</td>
              <td className="px-3 py-2 tabular-nums text-fg-3">#{r.seq}</td>
              <td className="px-3 py-2 text-fg-3">
                {r.build_mode === "auto" ? "auto" : "dockerfile"}
              </td>
              <td className="px-3 py-2 tabular-nums">{fmtDuration(r.nixpacks_seconds)}</td>
              <td className="px-3 py-2 tabular-nums">{fmtDuration(r.buildkit_seconds)}</td>
              <td className="px-3 py-2 tabular-nums" style={{ fontWeight: 510, color: "#dde0e4" }}>
                {fmtDuration(r.total_seconds)}
              </td>
              <td className="px-3 py-2">
                <span
                  style={{
                    color: BUILD_STATUS_COLORS[r.status] || "#8a8f98",
                    fontWeight: 590,
                  }}
                >
                  {r.status === "running" ? "성공" : r.status === "failed" ? "실패" : r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 가입자 row + 클릭 펼침 (테넌트 상세). 등급 select·앱 링크 클릭은 토글에 안 걸리게 차단.
function UserRow({ u, me, expanded, detail, onToggle, onRoleChange }) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="text-fg-2 transition-colors"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          cursor: "pointer",
          background: expanded ? "rgba(129,139,224,0.05)" : "transparent",
        }}
        title={expanded ? "테넌트 상세 접기" : "테넌트 상세 보기"}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            {u.avatar_url && (
              <img
                src={u.avatar_url}
                alt=""
                className="w-5 h-5 rounded-full shrink-0"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              />
            )}
            <span className="truncate" style={{ fontWeight: 510, color: "#dde0e4" }}>
              {u.login}
            </span>
            <ChevronDown
              size={11}
              strokeWidth={2}
              className="text-fg-4 transition-transform shrink-0"
              style={{ transform: expanded ? "rotate(180deg)" : "none" }}
            />
          </div>
        </td>
        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
          <RoleCell user={u} me={me} onChange={onRoleChange} />
        </td>
        <td className="px-4 py-2.5">
          {u.app_name ? (
            <div className="min-w-0">
              <a
                href={`https://${u.app_name}.kodeploy.com`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: "#818be0", fontWeight: 510 }}
                onClick={(e) => e.stopPropagation()}
              >
                {u.app_name}
              </a>
              <div className="text-[11px] text-fg-4 font-mono">{u.tenant_id}</div>
            </div>
          ) : (
            <span className="text-fg-4">—</span>
          )}
        </td>
        <td className="px-4 py-2.5">
          {u.custom_domain || <span className="text-fg-4">—</span>}
        </td>
        <td className="px-4 py-2.5 tabular-nums">{u.build_count}</td>
        <td className="px-4 py-2.5 text-fg-3 tabular-nums">
          {u.last_build_at ? relativeTime(u.last_build_at) : "—"}
        </td>
        <td className="px-4 py-2.5 text-fg-3 tabular-nums">
          {relativeTime(u.created_at)}
        </td>
      </tr>
      {expanded && (
        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <td colSpan={7} className="px-4 py-4" style={{ background: "rgba(0,0,0,0.25)" }}>
            <TenantDetail detail={detail} />
          </td>
        </tr>
      )}
    </>
  );
}

// 펼침 내용 — 선택 스택 chips + 테넌트 Pod 상태 테이블.
function TenantDetail({ detail }) {
  if (!detail) return <Hint>테넌트 정보를 불러오는 중…</Hint>;
  if (detail.error)
    return (
      <div className="text-[11.5px]" style={{ color: "#fca5a5" }}>
        {detail.error}
      </div>
    );

  const cfg = detail.config;
  if (!cfg && detail.pods.length === 0) {
    return <Hint>아직 배포한 앱이 없어요.</Hint>;
  }

  // 선택 스택 → chips. db "none"/redis off/storage off는 표시 안 함.
  const chips = [];
  if (cfg) {
    chips.push({ label: { python: "Python", java: "Java", php: "PHP" }[cfg.runtime] || cfg.runtime, color: "#a4abee" });
    if (cfg.db_type && cfg.db_type !== "none")
      chips.push({ label: cfg.db_type === "mysql" ? "MySQL" : "PostgreSQL", color: "#7fb6db" });
    if (cfg.use_redis) chips.push({ label: "Redis", color: "#f87171" });
    if (cfg.use_storage) chips.push({ label: "스토리지 (R2)", color: "#d8a657" });
    if (cfg.volume_mount_path) chips.push({ label: "스토리지 (로컬)", color: "#d8a657" });
    chips.push({
      label: cfg.build_mode === "auto" ? "auto (nixpacks)" : "Dockerfile",
      color: "#8a8f98",
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {cfg && (
        <>
          <div className="flex items-center gap-1.5 flex-wrap">
            {chips.map((c) => (
              <span
                key={c.label}
                className="text-[11px] px-2 py-0.5 rounded"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: c.color,
                  fontWeight: 590,
                }}
              >
                {c.label}
              </span>
            ))}
            <span className="text-[11px] text-fg-4 ml-1">port {cfg.port}</span>
          </div>
          <div className="text-[11.5px] text-fg-3">
            <a
              href={cfg.repo_url.replace(/\.git$/, "")}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: "#818be0" }}
            >
              {cfg.repo_url.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\.git$/, "")}
            </a>
            <span className="text-fg-4"> · {cfg.branch} 브랜치 · 마지막 빌드 {relativeTime(cfg.created_at)}</span>
          </div>
        </>
      )}
      {detail.pods.length > 0 ? (
        <div
          className="rounded-lg overflow-x-auto scroll-thin"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <table className="w-full text-[11.5px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr className="text-left text-[10px] text-fg-4" style={{ fontWeight: 590 }}>
                {["POD", "컴포넌트", "상태", "재시작", "시작"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-1.5 tracking-[0.06em] whitespace-nowrap"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.pods.map((p) => (
                <tr
                  key={p.name}
                  className="text-fg-2"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                >
                  <td className="px-3 py-1.5 font-mono" style={{ color: "#dde0e4" }}>
                    {p.name}
                  </td>
                  <td className="px-3 py-1.5 text-fg-3">{p.component || "—"}</td>
                  <td className="px-3 py-1.5">
                    <span
                      style={{
                        color:
                          p.phase === "Running" && p.ready
                            ? "#6dd5a0"
                            : p.phase === "Running"
                              ? "#d8a657"
                              : "#f87171",
                        fontWeight: 590,
                      }}
                    >
                      {p.phase}
                      {p.phase === "Running" && !p.ready && " (NotReady)"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">{p.restarts}</td>
                  <td className="px-3 py-1.5 text-fg-3 tabular-nums whitespace-nowrap">
                    {p.started_at ? relativeTime(p.started_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Hint>테넌트 네임스페이스에 실행 중인 Pod이 없어요.</Hint>
      )}
    </div>
  );
}

// 등급 표시/변경 — root만 select 노출, 대상이 root나 본인이면 배지 고정.
function RoleCell({ user: target, me, onChange }) {
  const locked = me.role !== "root" || target.role === "root" || target.id === me.id;
  if (locked) {
    return (
      <span
        className="text-[11px] px-2 py-0.5 rounded"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: ROLE_COLORS[target.role] || "#8a8f98",
          fontWeight: 590,
        }}
      >
        {target.role}
      </span>
    );
  }
  return (
    <select
      value={target.role}
      onChange={(e) => onChange(target, e.target.value)}
      className="text-[11.5px] px-1.5 py-1 rounded-md"
      style={{
        background: "#131415",
        border: "1px solid rgba(255,255,255,0.09)",
        color: ROLE_COLORS[target.role] || "#dde0e4",
        fontWeight: 510,
      }}
    >
      <option value="user">user</option>
      <option value="admin">admin</option>
    </select>
  );
}

function NodeCard({ node }) {
  // 클릭 펼침 — 첫 오픈 때 Pod 목록 fetch 후 캐시.
  const [expanded, setExpanded] = useState(false);
  const [pods, setPods] = useState(null);
  const [podsError, setPodsError] = useState(null);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && pods === null) {
      getNodePods(node.name)
        .then(setPods)
        .catch((e) => setPodsError(e.message || "Pod 조회 실패"));
    }
  };

  const cpuPct =
    node.cpu_used_cores != null && node.cpu_capacity_cores
      ? (node.cpu_used_cores / node.cpu_capacity_cores) * 100
      : null;
  const memPct =
    node.memory_used_bytes != null && node.memory_capacity_bytes
      ? (node.memory_used_bytes / node.memory_capacity_bytes) * 100
      : null;
  const diskPct =
    node.disk_used_bytes != null && node.disk_capacity_bytes
      ? (node.disk_used_bytes / node.disk_capacity_bytes) * 100
      : null;

  return (
    <div
      className="rounded-xl px-4 py-3.5"
      style={{
        border: `1px solid ${expanded ? "rgba(129,139,224,0.3)" : "rgba(255,255,255,0.07)"}`,
        background: "rgba(255,255,255,0.015)",
      }}
    >
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2.5 mb-3 text-left"
        style={{ cursor: "pointer" }}
        title={expanded ? "Pod 목록 접기" : "Pod 목록 보기"}
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: node.ready ? "#6dd5a0" : "#f87171" }}
          title={node.ready ? "Ready" : "NotReady"}
        />
        <span className="text-[13px] text-fg-1" style={{ fontWeight: 590 }}>
          {node.name}
        </span>
        <span
          className="text-[10.5px] px-1.5 py-0.5 rounded"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: node.role === "master" ? "#d8a657" : "#8a8f98",
            fontWeight: 590,
          }}
        >
          {node.role}
        </span>
        {node.pod_count != null && (
          <span className="text-[11px] text-fg-4 tabular-nums">
            Pod {node.pod_count}
          </span>
        )}
        {node.error && (
          <span className="text-[11px]" style={{ color: "#fca5a5" }}>
            {node.error}
          </span>
        )}
        <ChevronDown
          size={13}
          strokeWidth={2}
          className="ml-auto text-fg-4 transition-transform shrink-0"
          style={{ transform: expanded ? "rotate(180deg)" : "none" }}
        />
      </button>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2">
        <UsageBar
          label="CPU"
          percent={cpuPct}
          detail={`${fmtCores(node.cpu_used_cores)} / ${fmtCores(node.cpu_capacity_cores)} cores`}
        />
        <UsageBar
          label="메모리"
          percent={memPct}
          detail={`${fmtGiB(node.memory_used_bytes)} / ${fmtGiB(node.memory_capacity_bytes)}`}
        />
        <UsageBar
          label="디스크"
          percent={diskPct}
          detail={`${fmtGiB(node.disk_used_bytes)} / ${fmtGiB(node.disk_capacity_bytes)}`}
        />
      </div>

      {/* Pod별 사용량 + limit — 클릭 펼침 */}
      {expanded && (
        <div className="mt-4 kd-fade-in">
          {podsError && (
            <div className="text-[11.5px] py-2" style={{ color: "#fca5a5" }}>
              {podsError}
            </div>
          )}
          {!podsError && pods === null && <Hint>Pod 목록을 불러오는 중…</Hint>}
          {pods?.length === 0 && <Hint>실행 중인 Pod이 없어요.</Hint>}
          {pods?.length > 0 && <NodePodsTable pods={pods} />}
        </div>
      )}
    </div>
  );
}

// 노드 드릴다운 Pod 테이블 — "사용 / limit" 형식. limit 없으면(무제한) "—".
function NodePodsTable({ pods }) {
  return (
    <div
      className="rounded-lg overflow-x-auto scroll-thin"
      style={{ border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <table className="w-full text-[11.5px]" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr className="text-left text-[10px] text-fg-4" style={{ fontWeight: 590 }}>
            {["NAMESPACE", "POD", "CPU", "메모리", "디스크"].map((h) => (
              <th
                key={h}
                className="px-3 py-1.5 tracking-[0.06em] whitespace-nowrap"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pods.map((p) => (
            <tr
              key={`${p.namespace}/${p.name}`}
              className="text-fg-2"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
            >
              <td className="px-3 py-1.5 text-fg-4 font-mono whitespace-nowrap">
                {p.namespace}
              </td>
              <td className="px-3 py-1.5 font-mono" style={{ color: "#dde0e4" }}>
                {p.name}
              </td>
              <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">
                {fmtMilli(p.cpu_used_cores)}
                <span className="text-fg-4"> / {fmtMilli(p.cpu_limit_cores)}</span>
              </td>
              <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">
                {fmtMem(p.memory_used_bytes)}
                <span className="text-fg-4"> / {fmtMem(p.memory_limit_bytes)}</span>
              </td>
              <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">
                {fmtMem(p.disk_used_bytes)}
                <span className="text-fg-4"> / {fmtMem(p.disk_limit_bytes)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 사용량 바 — 65% 이상 주황, 85% 이상 빨강.
function UsageBar({ label, percent, detail }) {
  const color =
    percent == null
      ? "rgba(255,255,255,0.15)"
      : percent >= 85
        ? "#f87171"
        : percent >= 65
          ? "#d8a657"
          : "#6dd5a0";
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] text-fg-4" style={{ fontWeight: 590 }}>
          {label}
        </span>
        <span className="text-[11px] text-fg-3 tabular-nums">
          {percent == null ? "—" : `${percent.toFixed(0)}%`}
          <span className="text-fg-4 ml-1.5">{detail}</span>
        </span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(percent ?? 0, 100)}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}
