import { useCallback, useEffect, useRef, useState } from "react";
import { Check, FileCode, Hammer, History, RefreshCw, ScrollText } from "lucide-react";
import { getAppLogs } from "../../api/deploy.js";

const TS_PATTERNS = [
  /^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\]?\s*[-–]?\s*/,
  /^\[?(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\]?\s*[-–]?\s*/,
];

function parseLine(text) {
  for (const re of TS_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const parsed = new Date(m[1]);
      const ts = isNaN(parsed.getTime()) ? null : parsed.getTime();
      return { text: text.slice(m[0].length), ts };
    }
  }
  return { text, ts: null };
}

function formatKST(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${mo}-${day} ${h}:${m}:${s}`;
}

function relativeTime(ts) {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "방금";
  if (diff < 60) return `${diff}초 전`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

const isErrorLine = (l) =>
  /^\s*(ERROR|FATAL)\b/i.test(l) ||
  /\]\s*(ERROR|FATAL)\b/i.test(l) ||
  /^ERROR:/i.test(l) ||
  /^Traceback \(/i.test(l);

const isWarnLine = (l) =>
  /^\s*WARN(ING)?\b/i.test(l) ||
  /\]\s*WARN(ING)?\b/i.test(l) ||
  /^WARNING:/i.test(l);

function SideButton({ active, onClick, disabled, icon: Icon, label, color }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[12px] transition-colors text-left disabled:opacity-50"
      style={{
        background: active ? "rgba(129,139,224,0.1)" : "transparent",
        color: active ? (color || "#818be0") : "var(--fg-3)",
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <Icon size={14} strokeWidth={1.8} />
      {label}
    </button>
  );
}

function NavToggle({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] transition-colors flex-1 min-w-0"
      style={{
        background: active ? "rgba(129,139,224,0.1)" : "transparent",
        color: active ? "#818be0" : "var(--fg-3)",
        fontWeight: 500,
        border: "1px solid var(--line-2)",
      }}
    >
      <Icon size={12} strokeWidth={1.8} className="shrink-0" />
      <span className="truncate">{children}</span>
    </button>
  );
}

function IssueList({ label, color, dotColor, items, emptyText, onJump }) {
  const last = items.length > 0 ? items[items.length - 1] : null;
  return (
    <>
      <div
        className="px-3 py-2 shrink-0 flex items-center gap-2"
        style={{ borderBottom: "1px solid var(--line-1)" }}
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: items.length > 0 ? dotColor : "#3f3f46" }}
        />
        <span className="text-[11.5px]" style={{ fontWeight: 560, color }}>
          {label}
        </span>
        <span className="text-[11px] text-fg-4 tabular-nums">{items.length}</span>
        {last?.ts && (
          <span className="text-[10px] text-fg-4 ml-auto">
            최근 {relativeTime(last.ts)}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-auto scroll-thin">
        {items.length === 0 ? (
          <div className="p-4 text-[11px] text-fg-4 text-center">{emptyText}</div>
        ) : (
          items.map((line) => (
            <button
              key={line.idx}
              onClick={() => onJump(line.idx)}
              className="w-full text-left px-3 py-2 transition-colors hover:bg-[var(--line-1)]"
              style={{ borderBottom: "1px solid var(--line-1)" }}
            >
              <div className="text-[11px] break-all" style={{ color, lineHeight: 1.4 }}>
                {line.text}
              </div>
              {line.ts && (
                <div className="text-[10px] text-fg-4 tabular-nums mt-1">
                  {formatKST(line.ts)}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </>
  );
}

export default function RuntimeLogPanel({ build, splitLevel = 0 }) {
  const [current, setCurrent] = useState([]);
  const [previous, setPrevious] = useState([]);
  const [fetchError, setFetchError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState("current");
  const [mode, setMode] = useState("summary");
  const [justRefreshed, setJustRefreshed] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(null);

  const [sidebarWidth, setSidebarWidth] = useState(480);
  const [errorRatio, setErrorRatio] = useState(50);
  const dragTargetRef = useRef(null);
  const sidebarRef = useRef(null);
  const containerRef = useRef(null);
  const refreshTimer = useRef(null);
  const scrollRef = useRef(null);
  const rowRefs = useRef({});

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAppLogs();
      if (data.error) {
        setFetchError(data.error);
        setCurrent([]);
        setPrevious([]);
      } else {
        setCurrent((data.current || []).map(parseLine));
        setPrevious((data.previous || []).map(parseLine));
        setFetchError(null);
      }
      setLastFetched(Date.now());
      setJustRefreshed(true);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => setJustRefreshed(false), 1500);
    } catch (err) {
      setFetchError(err.message || "조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (splitLevel > 0 && mode !== "summary") setMode("summary");
  }, [splitLevel]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragTargetRef.current) return;
      if (dragTargetRef.current === "sidebar" && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newWidth = rect.right - e.clientX;
        setSidebarWidth(Math.min(rect.width, Math.max(280, newWidth)));
      } else if (dragTargetRef.current === "error-warn" && sidebarRef.current) {
        const rect = sidebarRef.current.getBoundingClientRect();
        const navHeight = sidebarRef.current.querySelector("[data-nav]")?.offsetHeight || 0;
        const available = rect.height - navHeight;
        const offset = e.clientY - rect.top - navHeight;
        const ratio = (offset / available) * 100;
        setErrorRatio(Math.min(85, Math.max(15, ratio)));
      }
    };
    const onUp = () => {
      if (dragTargetRef.current) {
        dragTargetRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startDrag = (target) => (e) => {
    e.preventDefault();
    dragTargetRef.current = target;
    document.body.style.cursor = target === "sidebar" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  };

  const jumpToLine = useCallback((lineIdx) => {
    if (splitLevel > 0) setMode("stream");
    setHighlightIdx(lineIdx);
    setTimeout(() => {
      const row = rowRefs.current[lineIdx];
      if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    setTimeout(() => setHighlightIdx(null), 2000);
  }, [splitLevel]);

  const lines = source === "previous" ? previous : current;
  const errors = lines.map((l, i) => ({ ...l, idx: i })).filter((l) => isErrorLine(l.text));
  const warnings = lines.map((l, i) => ({ ...l, idx: i })).filter((l) => isWarnLine(l.text));

  const renderContent = () => {
    if (mode === "build") {
      return (
        <pre
          className="flex-1 min-h-0 overflow-auto scroll-thin p-5 text-[12px] font-sans text-fg-2 whitespace-pre-wrap break-all"
          style={{ background: "var(--kd-bg)", lineHeight: 1.7 }}
        >
          {build?.error && (
            <div className="text-[var(--err-fg)] mb-3">ERROR: {build.error}</div>
          )}
          {build?.logs || "빌드 로그 없음"}
        </pre>
      );
    }
    if (mode === "dockerfile") {
      return (
        <pre
          className="flex-1 min-h-0 overflow-auto scroll-thin p-5 text-[12px] font-sans text-fg-2 whitespace-pre-wrap"
          style={{ background: "var(--kd-bg)", lineHeight: 1.7 }}
        >
          {build?.dockerfile_content || "Dockerfile 없음"}
        </pre>
      );
    }
    return (
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto scroll-thin font-sans text-[12px]"
        style={{ background: "var(--kd-bg)" }}
      >
        {fetchError ? (
          <div className="p-5 text-[12px] text-[var(--err-fg)]">{fetchError}</div>
        ) : lines.length === 0 ? (
          <div className="p-5 text-fg-4 text-[12px]">
            {loading ? "불러오는 중..." : "로그 없음"}
          </div>
        ) : (
          <table className="w-full border-collapse" style={{ lineHeight: 1.6 }}>
            <tbody>
              {lines.map((line, i) => {
                const text = line.text;
                let color = "";
                if (isErrorLine(text)) color = "var(--err-fg)";
                else if (isWarnLine(text)) color = "var(--warn-fg)";
                return (
                  <tr
                    key={i}
                    ref={(el) => { rowRefs.current[i] = el; }}
                    style={highlightIdx === i ? { background: "rgba(129,139,224,0.12)" } : undefined}
                  >
                    <td
                      className="pl-4 pr-3 py-0.5 align-top select-none whitespace-nowrap tabular-nums"
                      style={{
                        color: "var(--fg-4)",
                        fontSize: "11px",
                        fontWeight: 450,
                        width: "1%",
                        borderRight: "1px solid var(--line-1)",
                      }}
                    >
                      {line.ts ? formatKST(line.ts) : ""}
                    </td>
                    <td
                      className="pl-4 pr-5 py-0.5 break-all whitespace-pre-wrap"
                      style={{ color: color || "var(--fg-2)" }}
                    >
                      {text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  const showLeftPanel = splitLevel === 0;
  const showContentInSidebar = splitLevel > 0 && mode !== "summary";

  return (
    <div ref={containerRef} className="flex-1 min-h-0 flex overflow-hidden">
      {showLeftPanel && (
        <>
          <div className="flex-1 min-w-0 flex flex-col">
            {renderContent()}
          </div>
          <div
            onMouseDown={startDrag("sidebar")}
            className="shrink-0 w-[4px] cursor-col-resize transition-colors hover:bg-[rgba(129,139,224,0.4)]"
            style={{ background: "var(--line-2)" }}
          />
        </>
      )}

      <div
        ref={sidebarRef}
        className={`flex flex-col ${showLeftPanel ? "shrink-0" : "flex-1"}`}
        style={{
          ...(showLeftPanel ? { width: sidebarWidth } : {}),
          background: "var(--kd-bg)",
        }}
      >
        <div
          data-nav
          className="px-2.5 py-2.5 shrink-0 flex flex-col gap-2"
          style={{ borderBottom: "1px solid var(--line-2)" }}
        >
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <SideButton
                active={justRefreshed}
                onClick={() => { fetchLogs(); setSource("current"); setMode("summary"); }}
                disabled={loading}
                icon={justRefreshed ? Check : RefreshCw}
                label={loading ? "불러오는 중..." : justRefreshed ? "갱신됨" : lastFetched ? `새로고침 · ${formatKST(lastFetched)}` : "새로고침"}
                color="#818be0"
              />
            </div>
            {splitLevel > 0 && (
              <button
                onClick={() => setMode(mode === "stream" ? "summary" : "stream")}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] transition-colors shrink-0"
                style={{
                  background: mode === "stream" ? "rgba(129,139,224,0.1)" : "transparent",
                  color: mode === "stream" ? "#818be0" : "var(--fg-3)",
                  fontWeight: 500,
                }}
              >
                <ScrollText size={14} strokeWidth={1.8} />
                {mode === "stream" ? "닫기" : "로그"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {previous.length > 0 && (
              <NavToggle
                active={source === "previous"}
                onClick={() => setSource(source === "previous" ? "current" : "previous")}
                icon={History}
              >
                이전 인스턴스
              </NavToggle>
            )}
            {build?.logs && (
              <NavToggle
                active={mode === "build"}
                onClick={() => setMode(mode === "build" ? "summary" : "build")}
                icon={Hammer}
              >
                빌드 로그
              </NavToggle>
            )}
            {build?.dockerfile_content && (
              <NavToggle
                active={mode === "dockerfile"}
                onClick={() => setMode(mode === "dockerfile" ? "summary" : "dockerfile")}
                icon={FileCode}
              >
                Dockerfile
              </NavToggle>
            )}
          </div>
        </div>

        {showContentInSidebar ? (
          <div className="flex-1 min-h-0 flex flex-col">
            {renderContent()}
          </div>
        ) : (
          <>
            <div className="min-h-0 flex flex-col" style={{ height: `${errorRatio}%` }}>
              <IssueList
                label="에러"
                color="var(--err-fg)"
                dotColor="#ef4444"
                items={errors}
                emptyText="에러 없음"
                onJump={jumpToLine}
              />
            </div>

            <div
              onMouseDown={startDrag("error-warn")}
              className="shrink-0 h-[4px] cursor-row-resize transition-colors hover:bg-[rgba(129,139,224,0.4)]"
              style={{ background: "var(--line-2)" }}
            />

            <div className="flex-1 min-h-0 flex flex-col">
              <IssueList
                label="경고"
                color="var(--warn-fg)"
                dotColor="#f59e0b"
                items={warnings}
                emptyText="경고 없음"
                onJump={jumpToLine}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
