// 독립 탭 컨테이너 — PanelWorkspace 안에 1개 또는 2개씩 들어감.
// 탭이 비었으면 "패널 선택" 카드를 보여주고, 선택 시 탭 생성 + 활성.
// 터미널 / 모니터링은 백엔드 미구현 상태라 disabled "준비중" — 클릭해도 탭 안 생김.
import { useRef, useState } from "react";
import {
  Activity,
  Columns2,
  Database,
  FileText,
  HardDrive,
  Plus,
  Rows2,
  Server,
  TerminalSquare,
  X,
} from "lucide-react";
import MonitoringPanel from "./panels/MonitoringPanel.jsx";
import RuntimeLogPanel from "./panels/RuntimeLogPanel.jsx";
import TerminalPanel from "./panels/TerminalPanel.jsx";
import DbConsolePanel from "./panels/DbConsolePanel.jsx";
import StoragePanel from "./panels/StoragePanel.jsx";

const PANEL_TYPES = [
  {
    id: "logs",
    icon: FileText,
    label: "로그",
    sub: "실시간 · 빌드 · Dockerfile",
    color: "#7fb6db",
    ready: true,
  },
  {
    id: "terminal",
    icon: TerminalSquare,
    label: "터미널",
    sub: "앱 · DB 쉘 접속",
    color: "#a4abee",
    ready: true,
  },
  {
    id: "monitoring",
    icon: Activity,
    label: "모니터링",
    sub: "CPU · 메모리 · 요청량",
    color: "#6dd5a0",
    ready: true,
  },
  {
    id: "storage",
    icon: HardDrive,
    label: "스토리지",
    sub: "R2 객체 · 이미지",
    color: "#d8a657",
    ready: true,
  },
];

export default function Pane({ build, splitLevel = 0, onSplit, onUnsplit, excludeSplitDir, style }) {
  const compact = splitLevel > 0;
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [creating, setCreating] = useState(true);
  const nextIdRef = useRef(1);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // 카드 클릭 — disabled 옵션이면 아무 일 안 일어남
  const selectType = (opt) => {
    if (!opt.ready) return;
    const id = nextIdRef.current++;
    setTabs((prev) => [...prev, { id, type: opt.id, label: opt.label, icon: opt.icon }]);
    setActiveTabId(id);
    setCreating(false);
  };

  const addTab = () => setCreating(true);

  const closeTab = (tabId) => {
    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId !== tabId) return;
    if (remaining.length > 0) {
      setActiveTabId(remaining[remaining.length - 1].id);
      setCreating(false);
    } else {
      setActiveTabId(null);
      setCreating(true);
    }
  };

  // compact = 분할로 좁아진 상태 — 카드/아이콘/라벨 사이즈 축소
  const cardSize = compact ? "w-[160px] h-[160px]" : "w-[200px] h-[200px]";
  const iconSize = compact ? 30 : 36;
  const labelSize = compact ? "text-[14px]" : "text-[16px]";
  const subSize = compact ? "text-[10.5px]" : "text-[11.5px]";
  const titleSize = compact ? "text-[13px]" : "text-[14px]";

  return (
    <div className="min-h-0 min-w-0 flex flex-col overflow-hidden" style={{ background: "#0c0d0e", ...style }}>
      {/* Tab bar */}
      <div
        className="flex items-center h-9 pl-1.5 pr-1.5 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-stretch h-full overflow-hidden flex-1 min-w-0">
          {tabs.map((t) => {
            const active = activeTabId === t.id && !creating;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTabId(t.id);
                  setCreating(false);
                }}
                className="relative flex items-center gap-1.5 px-2.5 h-full text-[12.5px] transition-colors group shrink-0"
                style={{ color: active ? "#dde0e4" : "#8a8f98", fontWeight: 510 }}
              >
                <Icon size={12} strokeWidth={1.8} />
                <span>{t.label}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(t.id);
                  }}
                  className="ml-0.5 p-0.5 rounded text-fg-4 hover:text-fg-1 hover:bg-white/[0.06] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <X size={9} strokeWidth={2} />
                </span>
                {active && (
                  <span
                    className="absolute left-2 right-2 -bottom-px h-[2px] rounded-t-sm"
                    style={{ background: "#818be0" }}
                  />
                )}
              </button>
            );
          })}
          <button
            onClick={addTab}
            className="flex items-center justify-center px-2 h-full text-fg-4 hover:text-fg-1 transition-colors shrink-0"
            title="패널 추가"
          >
            <Plus size={13} strokeWidth={1.8} />
          </button>
        </div>

        {/* Split controls — 우측 끝 */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {onSplit && (
            <>
              {excludeSplitDir !== "horizontal" && (
                <button
                  onClick={() => onSplit("horizontal")}
                  className="p-1 rounded hover:bg-white/[0.04] text-fg-4 hover:text-fg-1 transition-colors"
                  title="좌우 분할"
                >
                  <Columns2 size={12} strokeWidth={1.8} />
                </button>
              )}
              {excludeSplitDir !== "vertical" && (
                <button
                  onClick={() => onSplit("vertical")}
                  className="p-1 rounded hover:bg-white/[0.04] text-fg-4 hover:text-fg-1 transition-colors"
                  title="상하 분할"
                >
                  <Rows2 size={12} strokeWidth={1.8} />
                </button>
              )}
            </>
          )}
          {onUnsplit && (
            <button
              onClick={onUnsplit}
              className="p-1 rounded hover:bg-white/[0.04] text-fg-4 hover:text-fg-1 transition-colors"
              title="닫기"
            >
              <X size={12} strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>

      {/* Content — 모든 탭을 항상 마운트, display로 전환 (WebSocket 등 연결 유지) */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div
          className="flex-1 flex items-center justify-center p-6"
          style={{ display: creating ? "flex" : "none" }}
        >
          <div className="flex flex-col items-center gap-5">
            <div className={`${titleSize} text-fg-3`} style={{ fontWeight: 510 }}>
              추가할 패널을 선택하세요
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              {PANEL_TYPES.map((opt) => {
                const Icon = opt.icon;
                const disabled = !opt.ready;
                return (
                  <button
                    key={opt.id}
                    onClick={disabled ? undefined : () => selectType(opt)}
                    disabled={disabled}
                    className={`${cardSize} relative flex flex-col items-center justify-center gap-2.5 rounded-xl transition-all`}
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.02)",
                      opacity: disabled ? 0.55 : 1,
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                    onMouseEnter={(e) => {
                      if (disabled) return;
                      e.currentTarget.style.background = "rgba(129,139,224,0.1)";
                      e.currentTarget.style.borderColor = "rgba(129,139,224,0.3)";
                    }}
                    onMouseLeave={(e) => {
                      if (disabled) return;
                      e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                    }}
                  >
                    <Icon
                      size={iconSize}
                      strokeWidth={1.3}
                      style={{ color: opt.color }}
                    />
                    <span
                      className={`${labelSize} text-fg-1`}
                      style={{ fontWeight: 510 }}
                    >
                      {opt.label}
                    </span>
                    <span
                      className={`${subSize} text-fg-4 text-center leading-tight px-1`}
                    >
                      {opt.sub}
                    </span>
                    {disabled && (
                      <span
                        className="absolute top-2 right-2 text-[9.5px] px-1.5 py-0.5 rounded"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          color: "#8a8f98",
                          fontWeight: 510,
                        }}
                      >
                        준비중
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {tabs.map((t) => {
          const visible = !creating && activeTabId === t.id;
          return (
            <div
              key={t.id}
              className="flex-1 min-h-0 flex flex-col"
              style={{ display: visible ? "flex" : "none" }}
            >
              {t.type === "logs" ? (
                <RuntimeLogPanel build={build} splitLevel={splitLevel} />
              ) : t.type === "terminal" ? (
                <TerminalSelector compact={compact} />
              ) : t.type === "monitoring" ? (
                <MonitoringPanel />
              ) : t.type === "storage" ? (
                <StoragePanel />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TerminalSelector({ compact }) {
  const [target, setTarget] = useState(null);

  if (target === "app") return <TerminalPanel />;
  if (target === "db") return <DbConsolePanel />;

  const cardSize = compact ? "w-[160px] h-[160px]" : "w-[200px] h-[200px]";
  const iconSize = compact ? 30 : 36;
  const labelSize = compact ? "text-[14px]" : "text-[16px]";
  const subSize = compact ? "text-[10.5px]" : "text-[11.5px]";

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center gap-3 p-6">
      {[
        { id: "app", icon: Server, label: "WAS", sub: "앱 Pod 쉘 접속", color: "#a4abee" },
        { id: "db", icon: Database, label: "DB", sub: "쿼리 콘솔 · 쉘", color: "#7fb6db" },
      ].map((opt) => {
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            onClick={() => setTarget(opt.id)}
            className={`${cardSize} flex flex-col items-center justify-center gap-2.5 rounded-xl transition-all`}
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.02)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(129,139,224,0.1)";
              e.currentTarget.style.borderColor = "rgba(129,139,224,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.02)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
            }}
          >
            <Icon size={iconSize} strokeWidth={1.3} style={{ color: opt.color }} />
            <span className={`${labelSize} text-fg-1`} style={{ fontWeight: 510 }}>{opt.label}</span>
            <span className={`${subSize} text-fg-4 text-center leading-tight px-1`}>{opt.sub}</span>
          </button>
        );
      })}
    </div>
  );
}
