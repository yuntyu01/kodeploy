// 관리자 페이지 (/admin) — role admin/root만 진입 (TopBar 링크도 동일 조건).
//
// - 통계 카드: 가입자 · 배포된 앱 · 총 빌드(성공/실패) · 최근 24h
// - 노드: CPU/메모리/디스크 사용량 바 (kubelet stats/summary, 30s 폴링)
// - 가입자 테이블: tenant · 앱 · 도메인 · 빌드 수 · 마지막 빌드 · 등급
//   등급 select는 root에게만, 대상이 root/본인이면 잠김.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Server, ShieldCheck, Users } from "lucide-react";
import { getNodes, getOverview, listUsers, setUserRole } from "../api/admin.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { relativeTime } from "../lib/format.js";

const ADMIN_ROLES = ["admin", "root"];
const NODE_POLL_MS = 30000;

const GiB = 1024 ** 3;
const fmtGiB = (bytes) =>
  bytes == null ? "—" : `${(bytes / GiB).toFixed(1)}Gi`;
const fmtCores = (cores) => (cores == null ? "—" : cores.toFixed(2));
const fmtDuration = (sec) => {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
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
        />
        <StatCard
          label="최근 24시간"
          value={overview?.builds.last_24h}
          sub={`평균 성공 소요 ${fmtDuration(overview?.builds.avg_success_seconds)}`}
        />
      </div>

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
              <tr
                key={u.id}
                className="text-fg-2"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
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
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <RoleCell user={u} me={user} onChange={handleRoleChange} />
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

function StatCard({ label, value, sub }) {
  return (
    <div
      className="rounded-xl px-4 py-3.5"
      style={{
        border: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.015)",
      }}
    >
      <div className="text-[11px] text-fg-4 mb-1.5" style={{ fontWeight: 590 }}>
        {label}
      </div>
      <div
        className="text-[22px] text-fg-1 tabular-nums"
        style={{ fontWeight: 590, letterSpacing: -0.5 }}
      >
        {value ?? "—"}
      </div>
      <div className="text-[11px] text-fg-4 mt-1 truncate">{sub}</div>
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
        border: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.015)",
      }}
    >
      <div className="flex items-center gap-2.5 mb-3">
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
      </div>
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
