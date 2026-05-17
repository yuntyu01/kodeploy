/* =====================================================================
   Left panel — recursive split (1 → 2 → 3 → 4 panes)
   ===================================================================== */
function LeftPanel({ mode }) {
  // Primary split
  const [primaryDir, setPrimaryDir] = useState(null); // null | "horizontal" | "vertical"
  const [primaryRatio, setPrimaryRatio] = useState(50);
  // Secondary splits for each slot
  const [slot1Dir, setSlot1Dir] = useState(null);
  const [slot1Ratio, setSlot1Ratio] = useState(50);
  const [slot2Dir, setSlot2Dir] = useState(null);
  const [slot2Ratio, setSlot2Ratio] = useState(50);

  const containerRef = useRef(null);
  const draggingRef = useRef(null); // { level: "primary"|"slot1"|"slot2", axis: "h"|"v" }

  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const { level, axis } = draggingRef.current;
      let ratio;
      if (axis === "h") {
        ratio = ((e.clientX - rect.left) / rect.width) * 100;
      } else {
        ratio = ((e.clientY - rect.top) / rect.height) * 100;
      }
      ratio = Math.min(80, Math.max(20, ratio));
      if (level === "primary") setPrimaryRatio(ratio);
      else if (level === "slot1") setSlot1Ratio(ratio);
      else setSlot2Ratio(ratio);
    };
    const onUp = () => {
      draggingRef.current = null;
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

  const startDrag = (level, axis) => (e) => {
    e.preventDefault();
    draggingRef.current = { level, axis };
    document.body.style.cursor = axis === "h" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  };

  const makeDivider = (level, axis) => (
    <div onMouseDown={startDrag(level, axis)}
         className={`shrink-0 ${axis === "h" ? "w-[3px] cursor-col-resize" : "h-[3px] cursor-row-resize"}`}
         style={{ background: "rgba(255,255,255,0.06)" }}
         onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(94,106,210,0.5)")}
         onMouseLeave={(e) => !draggingRef.current && (e.currentTarget.style.background = "rgba(255,255,255,0.06)")} />
  );

  // Split handler for a specific pane
  const handleSplit = (slot) => (dir) => {
    if (!primaryDir) {
      setPrimaryDir(dir);
      setPrimaryRatio(50);
    } else if (slot === 1 && !slot1Dir) {
      setSlot1Dir(dir);
      setSlot1Ratio(50);
    } else if (slot === 2 && !slot2Dir) {
      setSlot2Dir(dir);
      setSlot2Ratio(50);
    }
  };

  const handleUnsplit = (slot) => () => {
    if (slot === 1 && slot1Dir) {
      setSlot1Dir(null);
    } else if (slot === 2 && slot2Dir) {
      setSlot2Dir(null);
    } else {
      setPrimaryDir(null);
      setSlot1Dir(null);
      setSlot2Dir(null);
    }
  };

  // Render a slot that may be further split
  const renderSlot = (slotNum, slotDir, slotRatio) => {
    const isSplit = !!slotDir;
    const compact = !!primaryDir;

    if (!isSplit) {
      return (
        <Pane mode={mode} compact={compact}
              onSplit={handleSplit(slotNum)}
              currentSplit={primaryDir}
              slotSplit={null}
              onUnsplit={primaryDir ? handleUnsplit(slotNum) : null} />
      );
    }

    const axis = slotDir === "horizontal" ? "h" : "v";
    const flexDir = slotDir === "horizontal" ? "flex-row" : "flex-col";
    const sizeProp = slotDir === "horizontal" ? "width" : "height";
    const level = slotNum === 1 ? "slot1" : "slot2";

    return (
      <div className={`flex-1 min-h-0 min-w-0 flex ${flexDir}`}>
        <div className="min-h-0 min-w-0 flex flex-col" style={{ [sizeProp]: `${slotRatio}%`, flexShrink: 0 }}>
          <Pane mode={mode} compact={true}
                onSplit={null}
                currentSplit={primaryDir}
                slotSplit={slotDir}
                onUnsplit={handleUnsplit(slotNum)} />
        </div>
        {makeDivider(level, axis)}
        <div className="min-h-0 min-w-0 flex flex-col flex-1">
          <Pane mode={mode} compact={true}
                onSplit={null}
                currentSplit={primaryDir}
                slotSplit={slotDir}
                onUnsplit={handleUnsplit(slotNum)} />
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col"
         style={{ background: "#0f1011" }}>

      {mode === "visitor" && (
        <div className="flex items-center gap-2 px-4 py-2 shrink-0"
          style={{ background: "rgba(245,158,11,0.08)", borderBottom: "1px solid rgba(245,158,11,0.18)" }}>
          <span className="w-1.5 h-1.5 rounded-full kd-live-dot" style={{ background: "#f59e0b" }} />
          <span className="text-[12px]" style={{ color: "#f5cb6b", fontWeight: 510 }}>데모 화면</span>
          <span className="text-[12px] text-fg-3">로그인하면 본인 서비스의 실시간 로그를 볼 수 있어요.</span>
          <button className="ml-auto text-[12px] text-fg-2 hover:text-fg-1 transition-colors" style={{ fontWeight: 510 }}>로그인 →</button>
        </div>
      )}

      <div ref={containerRef} className="flex-1 min-h-0 flex flex-col">
        {!primaryDir && (
          <Pane mode={mode} compact={false}
                onSplit={handleSplit(0)}
                currentSplit={null}
                slotSplit={null}
                onUnsplit={null} />
        )}

        {primaryDir && (
          <div className={`flex-1 min-h-0 flex ${primaryDir === "horizontal" ? "flex-row" : "flex-col"}`}>
            <div className="min-h-0 min-w-0 flex flex-col"
                 style={{ [primaryDir === "horizontal" ? "width" : "height"]: `${primaryRatio}%`, flexShrink: 0 }}>
              {renderSlot(1, slot1Dir, slot1Ratio)}
            </div>
            {makeDivider("primary", primaryDir === "horizontal" ? "h" : "v")}
            <div className="min-h-0 min-w-0 flex flex-col flex-1">
              {renderSlot(2, slot2Dir, slot2Ratio)}
            </div>
          </div>
        )}
      </div>

      <MiniStatusBar mode={mode} />
    </div>
  );
}

/* =====================================================================
   Pane — independent tab container (used 1x or 2x by LeftPanel)
   ===================================================================== */
function Pane({ mode, compact, onSplit, currentSplit, slotSplit, onUnsplit }) {
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [creating, setCreating] = useState(true);
  const [creatingStep, setCreatingStep] = useState("type");
  const nextIdRef = useRef(1);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const selectType = (type) => {
    if (type === "terminal" || type === "korean") {
      setCreatingStep(type);
    } else {
      const id = nextIdRef.current++;
      const newTab = { id, type, label: "모니터링", icon: "activity" };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(id);
      setCreating(false);
      setCreatingStep("type");
    }
  };

  const selectTarget = (target) => {
    const type = creatingStep;
    const id = nextIdRef.current++;
    let newTab;
    if (type === "terminal") {
      newTab = {
        id, type: "terminal",
        label: target === "was" ? "터미널 · WAS" : "터미널 · DB",
        icon: "terminal-square", target,
      };
    } else {
      newTab = {
        id, type: "korean",
        label: target === "was" ? "로그 · WAS" : "로그 · DB",
        icon: "scroll-text", target,
      };
    }
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
    setCreating(false);
    setCreatingStep("type");
  };

  const addTab = () => {
    setCreating(true);
    setCreatingStep("type");
  };

  const closeTab = (tabId) => {
    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId) {
      if (remaining.length > 0) {
        setActiveTabId(remaining[remaining.length - 1].id);
        setCreating(false);
      } else {
        setActiveTabId(null);
        setCreating(true);
        setCreatingStep("type");
      }
    }
  };

  const typeOptions = [
    { id: "terminal",   icon: "terminal-square", label: "터미널",        sub: "Pod 쉘 접속",           color: "#a4abee" },
    { id: "korean",     icon: "scroll-text",     label: "한글 에러 로그", sub: "로그 스트림 + AI 요약", color: "#f59e0b" },
    { id: "monitoring", icon: "activity",        label: "모니터링",      sub: "CPU · 메모리 · 요청량", color: "#10b981" },
  ];

  const targetOptions = [
    { id: "was", icon: "server",   label: "WAS", sub: mode === "user" ? "myapp-7d8c · Spring Boot" : "demo-pod · Spring Boot", color: "#a4abee" },
    { id: "db",  icon: "database", label: "DB",  sub: mode === "user" ? "postgres-0 · 15.3" : "demo-postgres · 15.3",          color: "#7fb6db" },
  ];

  const showTargets = creatingStep === "terminal" || creatingStep === "korean";
  const cardOptions = showTargets ? targetOptions : typeOptions;
  const cardTitle = showTargets ? "연결할 대상을 선택하세요" : "추가할 패널을 선택하세요";
  const cSize = compact ? "w-[120px] h-[120px]" : (creatingStep === "type" ? "w-[220px] h-[220px]" : "w-[280px] h-[280px]");
  const cIcon = compact ? 24 : (creatingStep === "type" ? 36 : 44);
  const cLabel = compact ? "text-[13px]" : (creatingStep === "type" ? "text-[17px]" : "text-[20px]");
  const cSub = compact ? "text-[9px]" : "text-[12px]";
  const cTitle = compact ? "text-[13px]" : "text-[16px]";

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col" style={{ background: "#0f1011" }}>
      {/* Tab bar */}
      <div className="flex items-center h-10 pl-2 pr-2 shrink-0"
           style={{ borderBottom: "1px solid rgba(255,255,255,0.09)" }}>
        <div className="flex items-stretch h-full overflow-hidden flex-1 min-w-0">
          {tabs.map((t) => {
            const active = activeTabId === t.id && !creating;
            return (
              <button
                key={t.id}
                onClick={() => { setActiveTabId(t.id); setCreating(false); }}
                className="relative flex items-center gap-2 px-3 h-full text-[13px] transition-colors group shrink-0"
                style={{ color: active ? "#f7f8f8" : "#8a8f98", fontWeight: 510 }}
              >
                <Icon name={t.icon} size={13} stroke={1.8} />
                <span>{t.label}</span>
                <span
                  onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}
                  className="ml-0.5 p-0.5 rounded text-fg-4 hover:text-fg-1 hover:bg-white/[0.06] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Icon name="x" size={10} stroke={2} />
                </span>
                {active && (
                  <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-t-sm"
                        style={{ background: "#5e6ad2" }} />
                )}
              </button>
            );
          })}
          <button onClick={addTab}
                  className="flex items-center justify-center px-2.5 h-full text-fg-4 hover:text-fg-1 transition-colors shrink-0">
            <Icon name="plus" size={14} stroke={1.8} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {onSplit && (
            <>
              <button onClick={() => onSplit("horizontal")}
                      className="p-1 rounded hover:bg-white/[0.04] text-fg-4 hover:text-fg-1 transition-colors"
                      title="좌우 분할">
                <Icon name="columns-2" size={13} stroke={1.8} />
              </button>
              <button onClick={() => onSplit("vertical")}
                      className="p-1 rounded hover:bg-white/[0.04] text-fg-4 hover:text-fg-1 transition-colors"
                      title="상하 분할">
                <Icon name="rows-2" size={13} stroke={1.8} />
              </button>
            </>
          )}
          {onUnsplit && (
            <button onClick={onUnsplit}
                    className="p-1 rounded hover:bg-white/[0.04] text-fg-4 hover:text-fg-1 transition-colors"
                    title="분할 해제">
              <Icon name="minimize-2" size={13} stroke={1.8} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {creating ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-5">
              <div className={`${cTitle} text-fg-3`} style={{ fontWeight: 510 }}>{cardTitle}</div>
              <div className="flex gap-4 flex-wrap justify-center">
                {cardOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => !showTargets ? selectType(opt.id) : selectTarget(opt.id)}
                    className={`${cSize} flex flex-col items-center justify-center gap-3 rounded-xl transition-all`}
                    style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(94,106,210,0.1)"; e.currentTarget.style.borderColor = "rgba(94,106,210,0.3)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                  >
                    <Icon name={opt.icon} size={cIcon} stroke={1.3} style={{ color: opt.color }} />
                    <span className={`${cLabel} text-fg-1`} style={{ fontWeight: 510 }}>{opt.label}</span>
                    <span className={`${cSub} text-fg-4 font-mono text-center leading-tight`}>{opt.sub}</span>
                  </button>
                ))}
              </div>
              {showTargets && (
                <button onClick={() => setCreatingStep("type")}
                        className="text-[12px] text-fg-4 hover:text-fg-2 transition-colors"
                        style={{ fontWeight: 510 }}>
                  ← 뒤로
                </button>
              )}
            </div>
          </div>
        ) : activeTab ? (
          <div className="flex-1 min-h-0 flex flex-col">
            {activeTab.type === "terminal"   && <TerminalView mode={mode} paneId={String(activeTab.id)} defaultTarget={activeTab.target} />}
            {activeTab.type === "monitoring" && <MonitoringView mode={mode} />}
            {activeTab.type === "korean"     && <KoreanErrorView mode={mode} defaultTarget={activeTab.target} />}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* =====================================================================
   Mini status bar
   ===================================================================== */
function MiniStatusBar({ mode }) {
  const data = mode === "user"
    ? { cpu: 42, ram: 62, ramText: "318/512 MiB", podText: "pod 3/3 ready", env: "production" }
    : { cpu: 28, ram: 35, ramText: "180/512 MiB", podText: "demo pod ready", env: "demo" };

  return (
    <div className="flex items-center gap-5 h-9 px-4 shrink-0 text-[11.5px] font-mono"
         style={{ borderTop: "1px solid rgba(255,255,255,0.09)", background: "#08090a", color: "#8a8f98" }}>
      <div className="flex items-center gap-1.5">
        <span className="w-1 h-1 rounded-full"
              style={{ background: mode === "user" ? "#10b981" : "#f59e0b" }} />
        <span style={{ color: "#d0d6e0", fontWeight: 500 }}>{data.podText}</span>
      </div>
      <Bar label="CPU" pct={data.cpu} color="#5e6ad2" suffix={`${data.cpu}%`} />
      <Bar label="RAM" pct={data.ram} color="#10b981" suffix={data.ramText} />
      <span className="ml-auto flex items-center gap-3">
        <span>env <span style={{ color: "#d0d6e0", fontWeight: 500 }}>{data.env}</span></span>
        <span>region <span style={{ color: "#d0d6e0", fontWeight: 500 }}>ap-northeast-2</span></span>
        <span className="flex items-center gap-1">
          <Icon name="cloud" size={11} stroke={1.8} className="text-fg-3" />
          k8s 1.30
        </span>
      </span>
    </div>
  );
}

function Bar({ label, pct, color, suffix }) {
  return (
    <div className="flex items-center gap-2">
      <span>{label}</span>
      <span className="w-16 h-1.5 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.06)" }}>
        <span className="block h-full transition-[width] duration-700"
              style={{ width: `${pct}%`, background: color }} />
      </span>
      <span style={{ color: "#d0d6e0", fontWeight: 500 }}>{suffix}</span>
    </div>
  );
}
