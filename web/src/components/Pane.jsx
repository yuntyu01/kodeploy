// 독립 탭 컨테이너 — PanelWorkspace 안에 1개 또는 2개씩 들어감.
// 탭이 비었으면 "패널 선택" 카드를 보여주고, 선택 시 탭 생성 + 활성.
// 터미널 / 모니터링은 백엔드 미구현 상태라 disabled "준비중" — 클릭해도 탭 안 생김.
import { useRef, useState } from "react";
import {
  Activity,
  Columns2,
  Minimize2,
  Plus,
  Rows2,
  ScrollText,
  TerminalSquare,
  X,
} from "lucide-react";
import LogPanel from "./panels/LogPanel.jsx";

// 패널 종류 — ready=true만 실제 동작. 추가 시 ready 토글 + 본문 렌더 분기 추가.
const PANEL_TYPES = [
  {
    id: "logs",
    icon: ScrollText,
    label: "로그",
    sub: "빌드 / 실행 로그",
    color: "#818be0",
    ready: true,
  },
  {
    id: "terminal",
    icon: TerminalSquare,
    label: "터미널",
    sub: "Pod 쉘 접속",
    color: "#a4abee",
    ready: false,
  },
  {
    id: "monitoring",
    icon: Activity,
    label: "모니터링",
    sub: "CPU · 메모리 · 요청량",
    color: "#047857",
    ready: false,
  },
];

export default function Pane({ build, compact, onSplit, onUnsplit }) {
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
  const cardSize = compact ? "w-[120px] h-[120px]" : "w-[200px] h-[200px]";
  const iconSize = compact ? 24 : 36;
  const labelSize = compact ? "text-[13px]" : "text-[16px]";
  const subSize = compact ? "text-[9.5px]" : "text-[11.5px]";
  const titleSize = compact ? "text-[12.5px]" : "text-[14px]";

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col">
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
              <button
                onClick={() => onSplit("horizontal")}
                className="p-1 rounded hover:bg-white/[0.04] text-fg-4 hover:text-fg-1 transition-colors"
                title="좌우 분할"
              >
                <Columns2 size={12} strokeWidth={1.8} />
              </button>
              <button
                onClick={() => onSplit("vertical")}
                className="p-1 rounded hover:bg-white/[0.04] text-fg-4 hover:text-fg-1 transition-colors"
                title="상하 분할"
              >
                <Rows2 size={12} strokeWidth={1.8} />
              </button>
            </>
          )}
          {onUnsplit && (
            <button
              onClick={onUnsplit}
              className="p-1 rounded hover:bg-white/[0.04] text-fg-4 hover:text-fg-1 transition-colors"
              title="분할 해제"
            >
              <Minimize2 size={12} strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {creating ? (
          <div className="flex-1 flex items-center justify-center p-6">
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
        ) : activeTab && activeTab.type === "logs" ? (
          <LogPanel build={build} />
        ) : null}
      </div>
    </div>
  );
}
