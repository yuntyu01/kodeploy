import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getAppMetrics, getAppStatus } from "../../api/deploy.js";

const RANGES = ["15m", "1h", "6h", "1d", "3d", "7d", "14d", "30d"];

function formatCpu(v) {
  return (v * 1000).toFixed(0) + "m";
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes.toFixed(0) + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KiB";
  return (bytes / (1024 * 1024)).toFixed(0) + " MiB";
}

function formatRate(bytes) {
  if (bytes < 1024) return bytes.toFixed(0) + " B/s";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB/s";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB/s";
}

function formatPct(current, limit) {
  if (!limit) return "—";
  return `${Math.round((current / limit) * 100)}%`;
}

function formatMs(v) {
  if (v < 1) return "<1ms";
  if (v < 1000) return v.toFixed(0) + "ms";
  return (v / 1000).toFixed(1) + "s";
}

function formatRps(v) {
  if (v < 0.01) return "0";
  if (v < 1) return v.toFixed(2);
  if (v < 100) return v.toFixed(1);
  return v.toFixed(0);
}

function last(arr) {
  return arr && arr.length > 0 ? arr[arr.length - 1].value : 0;
}

function formatTime(ts) {
  const d = new Date(ts * 1000);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return { time: `${h}:${m}:${s}`, short: `${h}:${m}`, date: `${mo}/${day}` };
}

function formatUptime(startedAt) {
  if (!startedAt) return "—";
  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  if (diff < 0) return "—";
  if (diff < 60) return `${diff}초`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 ${m % 60}분`;
  const d = Math.floor(h / 24);
  return `${d}일 ${h % 24}시간`;
}

const STATUS_META = {
  running:  { color: "#047857", label: "실행 중" },
  pending:  { color: "#b45309", label: "시작 중" },
  crashing: { color: "#991b1b", label: "오류" },
  missing:  { color: "var(--fg-3)", label: "중지" },
};

function Stat({ label, value, sub, ok, statusColor }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.08em] text-fg-4 mb-1.5" style={{ fontWeight: 590 }}>
        {label}
      </div>
      <div className="text-[22px] text-fg-1 mb-0.5 tabular-nums" style={{ fontWeight: 510, letterSpacing: -0.5 }}>
        {value}
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-fg-3" style={{ fontWeight: 450 }}>
        {statusColor && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusColor }} />}
        {ok != null && !statusColor && <span className="w-1 h-1 rounded-full" style={{ background: ok ? "#10b981" : "#ef4444" }} />}
        {sub}
      </div>
    </div>
  );
}

function ChartCard({ title, color, data, formatValue, id, sub }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);

  if (!data || !data.length) {
    return (
      <div className="py-3 mb-1" style={{ borderTop: "1px solid var(--line-2)" }}>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-[11px] uppercase tracking-[0.08em] text-fg-2" style={{ fontWeight: 590 }}>{title}</span>
          {sub && <span className="text-[9.5px] text-fg-4">{sub}</span>}
        </div>
        <div className="text-[11px] text-fg-4 py-4 text-center">데이터 없음</div>
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const max = Math.max(...values) || 1;
  const current = values[values.length - 1];

  const labelW = 42;
  const bottomH = 20;
  const chartW = 600 - labelW;
  const chartH = 125;
  const totalW = 600;
  const totalH = chartH + bottomH;
  const pad = 6;

  const yTicks = [max, max * 0.75, max * 0.5, max * 0.25, 0];
  const xTickCount = 5;
  const spanTs = data[data.length - 1].ts - data[0].ts;
  const showDate = spanTs > 86400;

  const pts = values.map((v, i) => {
    const x = labelW + pad + (i / (values.length - 1 || 1)) * (chartW - pad * 2);
    const y = pad + ((max - v) / max) * (chartH - pad * 2);
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const area = `${path} L${pts[pts.length - 1][0]},${chartH - pad} L${pts[0][0]},${chartH - pad} Z`;
  const gradientId = `g-${id}`;

  const wrapRef = useRef(null);
  const [tooltipPos, setTooltipPos] = useState(null);

  const onMouseMove = (e) => {
    if (!svgRef.current || !wrapRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const wrapRect = wrapRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * totalW;
    const chartLeft = labelW + pad;
    const chartRight = totalW - pad;
    if (mouseX < chartLeft || mouseX > chartRight) { setHover(null); setTooltipPos(null); return; }
    const ratio = (mouseX - chartLeft) / (chartRight - chartLeft);
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1))));
    setHover(idx);
    const pxX = rect.left - wrapRect.left + (pts[idx][0] / totalW) * rect.width;
    const pxY = rect.top - wrapRect.top + (pts[idx][1] / totalH) * rect.height;
    setTooltipPos({ x: pxX, y: pxY });
  };

  const onMouseLeave = () => { setHover(null); setTooltipPos(null); };

  const hoverData = hover !== null ? data[hover] : null;
  const hoverPt = hover !== null ? pts[hover] : null;
  const hoverTime = hoverData ? formatTime(hoverData.ts) : null;
  const displayValue = hover !== null ? formatValue(data[hover].value) : formatValue(current);

  return (
    <div ref={wrapRef} className="py-2 relative">
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-[0.08em] text-fg-2" style={{ fontWeight: 590 }}>{title}</span>
        {sub && <span className="text-[9.5px] text-fg-4">{sub}</span>}
        <span className="ml-auto text-[11.5px] text-fg-2 tabular-nums" style={{ fontWeight: 510 }}>{displayValue}</span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${totalW} ${totalH}`}
        className="w-full rounded"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{ cursor: "crosshair" }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.32" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((tick, i) => {
          const y = pad + ((max - tick) / max) * (chartH - pad * 2);
          return (
            <g key={`y-${i}`}>
              <line x1={labelW} y1={y} x2={totalW} y2={y} style={{ stroke: "var(--line-1)" }} strokeWidth="0.5" />
              <text x={1} y={y + 2} textAnchor="start" fill="#3f3f46" fontSize="10" style={{ fontFamily: "inherit" }}>
                {formatValue(tick)}
              </text>
            </g>
          );
        })}
        {Array.from({ length: xTickCount }).map((_, i) => {
          const idx = Math.round((i / (xTickCount - 1)) * (data.length - 1));
          const d = data[idx];
          const x = labelW + pad + (idx / (data.length - 1 || 1)) * (chartW - pad * 2);
          const t = formatTime(d.ts);
          return (
            <text key={`x-${i}`} x={x} y={chartH + 10} textAnchor="middle" fill="#3f3f46" fontSize="10" style={{ fontFamily: "inherit" }}>
              {showDate ? t.date : t.short}
            </text>
          );
        })}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="1.5" fill={color} />
        {hoverPt && (
          <>
            <line x1={hoverPt[0]} y1={pad} x2={hoverPt[0]} y2={chartH - pad} stroke={`${color}50`} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
            <circle cx={hoverPt[0]} cy={hoverPt[1]} r="2.5" fill="none" stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <circle cx={hoverPt[0]} cy={hoverPt[1]} r="1" fill={color} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {tooltipPos && hoverData && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: "translate(-50%, -100%) translateY(-10px)",
          }}
        >
          <div
            className="px-2.5 py-1.5 rounded-md text-center whitespace-nowrap"
            style={{
              background: "var(--kd-surface)",
              border: "1px solid var(--line-3)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            }}
          >
            <div className="text-[11px] tabular-nums text-fg-1" style={{ fontWeight: 590 }}>
              {formatValue(hoverData.value)}
            </div>
            <div className="text-[9.5px] text-fg-4 tabular-nums mt-0.5">
              {showDate ? `${hoverTime.date} ` : ""}{hoverTime.time}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MonitoringPanel() {
  const [range, setRange] = useState("1h");
  const [data, setData] = useState(null);
  const [appStatus, setAppStatus] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metrics, status] = await Promise.all([getAppMetrics(range), getAppStatus()]);
      setData(metrics);
      setAppStatus(status.status);
      setStartedAt(status.started_at || null);
    } catch (err) {
      setError(err.message || "조회 실패");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const cpuCur = data?.cpu_now ?? 0;
  const memCur = data?.mem_now ?? 0;
  const cpuLim = data?.cpu_limit;
  const memLim = data?.mem_limit;
  const restarts = Math.floor(data?.restart_total ?? last(data?.restarts));
  const oom = Math.floor(data?.oom_total ?? 0);
  const s = STATUS_META[appStatus] || STATUS_META.missing;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ background: "var(--kd-panel)" }}>
      {error ? (
        <div className="flex-1 flex items-center justify-center text-[12px] text-[var(--err-fg)]">
          {error}
        </div>
      ) : !data ? (
        <div className="flex-1 flex items-center justify-center text-[12px] text-fg-4">
          불러오는 중...
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto scroll-thin p-5">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Stat
              label="상태"
              value={s.label}
              sub={startedAt ? `가동 ${formatUptime(startedAt)}` : ""}
              statusColor={s.color}
            />
            <Stat
              label="CPU"
              value={cpuLim ? formatPct(cpuCur, cpuLim) : formatCpu(cpuCur)}
              sub={cpuLim ? `${formatCpu(cpuCur)} / ${formatCpu(cpuLim)}` : "현재"}
              ok={cpuLim ? cpuCur < cpuLim * 0.8 : null}
            />
            <Stat
              label="메모리"
              value={memLim ? formatPct(memCur, memLim) : formatBytes(memCur)}
              sub={memLim ? `${formatBytes(memCur)} / ${formatBytes(memLim)}` : "현재"}
              ok={memLim ? memCur < memLim * 0.8 : null}
            />
            <Stat
              label="재시작 / OOM"
              value={`${restarts} / ${oom}회`}
              sub="재시작 / OOM Kill"
              ok={restarts > 0 || oom > 0 ? false : null}
            />
            <Stat
              label="RPS"
              value={`${formatRps(last(data.rps))}/s`}
              sub="초당 요청"
            />
            <Stat
              label="응답 시간 (p95)"
              value={formatMs(last(data.latency_p95))}
              sub={`p50 ${formatMs(last(data.latency_p50))}`}
              ok={last(data.latency_p95) > 0 ? last(data.latency_p95) < 1000 : null}
            />
          </div>

          <div className="flex items-center gap-2 mb-1">
            <div className="flex gap-0.5">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className="px-2 py-0.5 rounded text-[10.5px] transition-colors"
                  style={{
                    background: range === r ? "rgba(129,139,224,0.12)" : "transparent",
                    color: range === r ? "#818be0" : "var(--fg-4)",
                    fontWeight: 510,
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="ml-auto p-1 rounded text-fg-4 hover:text-fg-1 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={11} strokeWidth={1.8} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          <div style={{ containerType: "inline-size" }}>
            <div className="kd-chart-grid">
              <ChartCard title="메모리" id="memory" color="#5e6ad2" data={data.memory} formatValue={formatBytes} />
              <ChartCard title="CPU" id="cpu" color="#10b981" data={data.cpu} formatValue={formatCpu} />
              <ChartCard title="RPS" id="rps" color="#818be0" data={data.rps} formatValue={(v) => `${formatRps(v)}/s`} sub="초당 요청" />
              <ChartCard title="응답 시간" id="latency" color="#f59e0b" data={data.latency_p95} formatValue={formatMs} sub="p95" />
              <ChartCard title="에러율" id="error" color="#ef4444" data={data.error_rate} formatValue={(v) => `${formatRps(v)}/s`} sub="4xx+5xx" />
              <ChartCard title="네트워크 수신" id="netrx" color="#7170ff" data={data.net_rx} formatValue={formatRate} />
              <ChartCard title="네트워크 송신" id="nettx" color="#38bdf8" data={data.net_tx} formatValue={formatRate} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
