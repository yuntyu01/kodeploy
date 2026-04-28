/* global React, ReactDOM, lucide */
const { useState, useEffect, useRef, useMemo } = React;

/* =====================================================================
   Lucide icon shim — <Icon name="terminal" size={14} />
   ===================================================================== */
function Icon({ name, size = 16, stroke = 1.6, className = "", style }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !lucide?.icons) return;
    const key = name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
    const data = lucide.icons[key] || lucide.icons[name];
    if (!data) { ref.current.innerHTML = ""; return; }
    const svg = lucide.createElement(data);
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("stroke-width", stroke);
    ref.current.innerHTML = "";
    ref.current.appendChild(svg);
  }, [name, size, stroke]);
  return <span ref={ref} className={className} style={{ display: "inline-flex", lineHeight: 0, ...style }} />;
}

/* =====================================================================
   KoDeploy logomark — abstract "K" cube layered with deploy arrow
   ===================================================================== */
function KoDeployMark({ size = 18 }) {
  // Wordmark rendered in Geist — modern, geometric, minimal.
  // "Ko" in white, "Deploy" in brand violet, side-by-side on one line.
  // `size` controls the visual height (cap-height roughly tracks fontSize).
  const fs = size;
  return (
    <span
      aria-label="KoDeploy"
      style={{
        fontFamily: '"Geist", Inter, sans-serif',
        fontWeight: 700,
        fontSize: fs,
        lineHeight: 1,
        letterSpacing: "-0.045em",
        display: "inline-flex",
        alignItems: "baseline",
        userSelect: "none",
      }}
    >
      <span style={{ color: "#f7f8f8" }}>Ko</span>
      <span style={{ color: "#7170ff" }}>Deploy</span>
    </span>
  );
}

/* =====================================================================
   Mock log streams
   ===================================================================== */
const MOCK_LOGS_VISITOR = [
  { d: "2026.04.25", t: "23:58:11", lvl: "INFO",  msg: "데모 환경에서 generated-app 컨테이너를 시작합니다" },
  { d: "2026.04.25", t: "23:58:12", lvl: "INFO",  msg: "server listening on :8080" },
  { d: "2026.04.25", t: "23:58:13", lvl: "INFO",  msg: "Hibernate: select * from sample_user limit ?" },
  { d: "2026.04.26", t: "00:00:01", lvl: "INFO",  msg: "GET / 200 4ms — visited from demo session" },
  { d: "2026.04.26", t: "00:00:12", lvl: "DEBUG", msg: "GET /healthz 200 1ms" },
  { d: "2026.04.26", t: "00:00:18", lvl: "INFO",  msg: "POST /api/items 201 18ms" },
  { d: "2026.04.26", t: "00:00:24", lvl: "DEBUG", msg: "scheduler tick — no jobs" },
  { d: "2026.04.26", t: "00:00:35", lvl: "INFO",  msg: "GET /api/items 200 7ms" },
  { d: "2026.04.26", t: "00:00:41", lvl: "WARN",  msg: "데모 데이터는 10분마다 초기화됩니다" },
];

const MOCK_LOGS_USER = [
  { d: "2026.04.25", t: "23:59:42", lvl: "INFO",  msg: "server listening on :8080" },
  { d: "2026.04.25", t: "23:59:43", lvl: "INFO",  msg: "connected to postgres (15.3) — pool size=10" },
  { d: "2026.04.25", t: "23:59:43", lvl: "INFO",  msg: "Flyway: migrations up to date (V18__add_billing.sql)" },
  { d: "2026.04.25", t: "23:59:44", lvl: "INFO",  msg: "Started MyappApplication in 2.184 seconds (JVM running for 2.41)" },
  { d: "2026.04.26", t: "00:00:01", lvl: "DEBUG", msg: "GET /healthz 200 1ms" },
  { d: "2026.04.26", t: "00:00:02", lvl: "INFO",  msg: "GET /api/orders?status=open 200 14ms" },
  { d: "2026.04.26", t: "00:00:04", lvl: "INFO",  msg: "POST /api/orders 201 38ms — order_id=ord_8f2a" },
  { d: "2026.04.26", t: "00:00:07", lvl: "DEBUG", msg: "Hibernate: select o.* from orders o where o.tenant_id=?" },
  { d: "2026.04.26", t: "00:00:12", lvl: "WARN",  msg: "rate limit approaching for tenant=acme (84/100 rpm)" },
  { d: "2026.04.26", t: "00:00:18", lvl: "INFO",  msg: "GET /api/orders/ord_8f2a 200 6ms" },
  { d: "2026.04.26", t: "00:00:24", lvl: "INFO",  msg: "kafka-producer: published event order.created (offset=18241)" },
];

/* AI-translated 한글 에러 로그 */
const KOREAN_ERRORS_VISITOR = [
  {
    when: "08:14:31",
    severity: "warn",
    title: "데모 데이터 초기화 안내",
    summary: "데모 환경의 데이터는 10분마다 자동으로 초기화돼요.",
    detail: "운영 환경에서는 PostgreSQL 볼륨이 영구적으로 유지됩니다. 로그인 후 본인 서비스에서 시도해보세요.",
    related: "WARN  scheduler.demo.reset → next reset in 04:21",
  },
];

const KOREAN_ERRORS_USER = [
  {
    when: "08:14:12",
    severity: "warn",
    title: "tenant=acme 의 요청량이 한도에 가까워요",
    summary: "분당 100건 중 84건이 사용됐어요. 5분 안에 한도를 넘을 가능성이 있어요.",
    detail: "RateLimitInterceptor 가 84/100 rpm 을 기록했어요. 일시적인 트래픽이라면 그대로 두셔도 되고, 지속된다면 limit 을 200 rpm 으로 올려보세요.",
    related: "WARN  c.k.security.RateLimitInterceptor — bucket=acme remaining=16/100",
    action: "한도 늘리기 (200 rpm)",
  },
  {
    when: "08:09:54",
    severity: "info",
    title: "Flyway 마이그레이션이 완료됐어요",
    summary: "V18__add_billing.sql 이 정상적으로 적용됐어요.",
    detail: "billing_invoice 테이블이 생성됐고, orders 에 invoice_id 컬럼이 추가됐어요.",
    related: "INFO  o.f.core.internal.command.DbMigrate — Successfully applied 1 migration",
  },
  {
    when: "07:42:18",
    severity: "error",
    title: "결제 콜백 처리 중 NullPointerException 이 발생했어요",
    summary: "PaymentService.handleCallback 에서 order.getCustomer() 가 null 인 상태로 호출됐어요.",
    detail: "주문 ord_7c1e 는 게스트 주문(customer_id=null)인데, 콜백 핸들러가 customer 를 항상 존재한다고 가정하고 있어요.",
    related: "ERROR c.k.payment.PaymentService — NullPointerException at PaymentService.java:184",
    action: "PR 자동 생성하기",
  },
];

/* =====================================================================
   Top bar
   ===================================================================== */
function TopBar({ mode, breadcrumb, onLogin, onSignup, onDeploy, showDeploy }) {
  const navItems = ["소개", "데모", "문서", "GitHub"];
  // In user mode, the breadcrumb takes the brand+breadcrumb area, so we
  // drop nav out of the absolute-center to avoid overlap and place it
  // inline on the right of the breadcrumb instead.
  const isUser = mode === "user";
  return (
    <header
      className="relative flex items-center h-14 px-6 shrink-0 gap-4"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.09)", background: "#08090a" }}
    >
      {/* Brand (left) */}
      <div className="flex items-center gap-3 min-w-0">
        <KoDeployMark size={20} />
        {isUser && breadcrumb && (
          <>
            <div className="mx-1 h-4 w-px bg-white/10 shrink-0" />
            <Breadcrumb {...breadcrumb} />
          </>
        )}
      </div>

      {/* Nav — absolute-centered in visitor mode (clean marketing look),
          inline-right in user mode so it never collides with the breadcrumb. */}
      {isUser ? (
        <nav className="ml-auto flex items-center gap-1 shrink-0">
          {navItems.map((item) => (
            <a
              key={item}
              href="#"
              onClick={(e) => e.preventDefault()}
              className="px-2.5 py-1.5 rounded-md text-[13px] text-fg-3 hover:text-fg-1 hover:bg-white/[0.04] transition-colors flex items-center gap-1.5"
              style={{ fontWeight: 510 }}
            >
              {item}
              {item === "GitHub" && <Icon name="arrow-up-right" size={11} stroke={1.8} className="text-fg-4" />}
            </a>
          ))}
        </nav>
      ) : (
        <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
          {navItems.map((item) => (
            <a
              key={item}
              href="#"
              onClick={(e) => e.preventDefault()}
              className="px-3 py-1.5 rounded-md text-[13px] text-fg-2 hover:text-fg-1 hover:bg-white/[0.04] transition-colors flex items-center gap-1.5"
              style={{ fontWeight: 510 }}
            >
              {item}
              {item === "GitHub" && <Icon name="arrow-up-right" size={11} stroke={1.8} className="text-fg-3" />}
            </a>
          ))}
        </nav>
      )}

      {/* Right cluster */}
      <div className={`${isUser ? "" : "ml-auto"} flex items-center gap-3 shrink-0`}>
        {mode === "visitor" ? (
          <>
            <button
              onClick={onLogin}
              className="text-[13px] text-fg-2 hover:text-fg-1 px-3 py-1.5 rounded-md transition-colors"
              style={{ fontWeight: 510 }}
            >
              로그인
            </button>
            <button
              onClick={onSignup || onLogin}
              className="text-[13px] px-4 py-1.5 rounded-full transition-colors"
              style={{
                background: "#f7f8f8",
                color: "#08090a",
                fontWeight: 590,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#ffffff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#f7f8f8")}
            >
              회원가입
            </button>
          </>
        ) : (
          <>
            {showDeploy && (
              <button
                onClick={onDeploy}
                className="text-[13px] text-white px-4 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
                style={{ background: "#5e6ad2", fontWeight: 510 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#828fff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#5e6ad2")}
              >
                배포
              </button>
            )}
            <UserMenu />
          </>
        )}
      </div>
    </header>
  );
}

function Breadcrumb({ workspace, project, runtime, replicas, version }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon name="folder" size={13} className="text-fg-3" />
      <span className="text-[13px] text-fg-3" style={{ fontWeight: 510 }}>{workspace}</span>
      <span className="text-fg-4">/</span>
      <span className="text-[13px] text-fg-1" style={{ fontWeight: 510 }}>{project}</span>
      <span className="ml-2 text-fg-4 text-[12px]">·</span>
      <span className="text-[12px] text-fg-3">{runtime}</span>
      <span className="text-fg-4 text-[12px]">·</span>
      <span className="text-[12px] text-fg-3">{replicas} replicas</span>
      <span className="text-fg-4 text-[12px]">·</span>
      <span className="px-1.5 py-0.5 rounded-[3px] text-[11px] font-mono text-fg-2"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {version}
      </span>
    </div>
  );
}

function UserMenu() {
  return (
    <button className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-md hover:bg-white/[0.04] transition-colors">
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] text-white"
        style={{
          background: "linear-gradient(135deg, #7170ff 0%, #5e6ad2 100%)",
          fontWeight: 590,
        }}
      >
        A
      </span>
      <span className="text-[13px] text-fg-1" style={{ fontWeight: 510 }}>alice</span>
      <Icon name="chevrons-up-down" size={11} className="text-fg-3" stroke={1.8} />
    </button>
  );
}

/* =====================================================================
   Left panel — split support with draggable divider
   ===================================================================== */
function LeftPanel({ mode }) {
  const [split, setSplit] = useState(null);
  const [splitRatio, setSplitRatio] = useState(50);
  const containerRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current || !containerRef.current || !split) return;
      const rect = containerRef.current.getBoundingClientRect();
      let ratio;
      if (split === "horizontal") {
        ratio = ((e.clientX - rect.left) / rect.width) * 100;
      } else {
        ratio = ((e.clientY - rect.top) / rect.height) * 100;
      }
      setSplitRatio(Math.min(80, Math.max(20, ratio)));
    };
    const onUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [split]);

  const startDrag = (e) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = split === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
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

      <div ref={containerRef}
           className={`flex-1 min-h-0 flex ${split === "horizontal" ? "flex-row" : "flex-col"}`}>
        <div className="min-h-0 min-w-0 flex flex-col"
             style={split ? { [split === "horizontal" ? "width" : "height"]: `${splitRatio}%`, flexShrink: 0 } : { flex: 1 }}>
          <Pane key="pane-1" mode={mode} compact={!!split}
                onSplit={!split ? (dir) => { setSplit(dir); setSplitRatio(50); } : null}
                onUnsplit={split ? () => setSplit(null) : null} />
        </div>
        {split && (
          <>
            <div onMouseDown={startDrag}
                 className={`shrink-0 ${split === "horizontal" ? "w-[3px] cursor-col-resize" : "h-[3px] cursor-row-resize"}`}
                 style={{ background: "rgba(255,255,255,0.06)" }}
                 onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(94,106,210,0.5)")}
                 onMouseLeave={(e) => !draggingRef.current && (e.currentTarget.style.background = "rgba(255,255,255,0.06)")} />
            <div className="min-h-0 min-w-0 flex flex-col" style={{ flex: 1 }}>
              <Pane key="pane-2" mode={mode} compact={true}
                    onUnsplit={() => setSplit(null)} />
            </div>
          </>
        )}
      </div>

      <MiniStatusBar mode={mode} />
    </div>
  );
}

/* =====================================================================
   Pane — independent tab container (used 1x or 2x by LeftPanel)
   ===================================================================== */
function Pane({ mode, compact, onSplit, onUnsplit }) {
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [creating, setCreating] = useState(true);
  const [creatingStep, setCreatingStep] = useState("type");
  const nextIdRef = useRef(1);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const selectType = (type) => {
    if (type === "terminal") {
      setCreatingStep("target");
    } else {
      const id = nextIdRef.current++;
      const newTab = {
        id,
        type,
        label: type === "monitoring" ? "모니터링" : "한글 에러 로그",
        icon: type === "monitoring" ? "activity" : "languages",
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(id);
      setCreating(false);
      setCreatingStep("type");
    }
  };

  const selectTarget = (target) => {
    const id = nextIdRef.current++;
    const newTab = {
      id,
      type: "terminal",
      label: target === "was" ? "터미널 · WAS" : "터미널 · DB",
      icon: "terminal",
      target,
    };
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
    { id: "terminal",   icon: "terminal",  label: "터미널",        sub: "WAS · DB 로그 스트림",  color: "#a4abee" },
    { id: "monitoring", icon: "activity",  label: "모니터링",      sub: "CPU · 메모리 · 요청량", color: "#10b981" },
    { id: "korean",     icon: "languages", label: "한글 에러 로그", sub: "AI 요약 에러 분석",     color: "#f59e0b" },
  ];

  const targetOptions = [
    { id: "was", icon: "server",   label: "WAS", sub: mode === "user" ? "myapp-7d8c · Spring Boot" : "demo-pod · Spring Boot", color: "#a4abee" },
    { id: "db",  icon: "database", label: "DB",  sub: mode === "user" ? "postgres-0 · 15.3" : "demo-postgres · 15.3",          color: "#7fb6db" },
  ];

  const cardOptions = creatingStep === "type" ? typeOptions : targetOptions;
  const cardTitle = creatingStep === "type" ? "추가할 패널을 선택하세요" : "연결할 대상을 선택하세요";
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
                    onClick={() => creatingStep === "type" ? selectType(opt.id) : selectTarget(opt.id)}
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
              {creatingStep === "target" && (
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
            {activeTab.type === "korean"     && <KoreanErrorView mode={mode} />}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* =====================================================================
   Terminal view (with rolling stream)
   ===================================================================== */
const WAS_POOL = [
  { lvl: "INFO",  msg: "GET /api/orders 200 9ms" },
  { lvl: "INFO",  msg: "POST /api/orders 201 41ms — order_id=ord_" },
  { lvl: "DEBUG", msg: "GET /healthz 200 1ms" },
  { lvl: "INFO",  msg: "kafka-producer: published event order.updated" },
  { lvl: "DEBUG", msg: "Hibernate: update orders set status=? where id=?" },
  { lvl: "INFO",  msg: "GET /api/items 200 6ms" },
  { lvl: "WARN",  msg: "slow query 312ms: select * from invoice where ..." },
];
const DB_POOL = [
  { lvl: "LOG",   msg: "connection received: host=10.0.4.18 port=53412" },
  { lvl: "LOG",   msg: "statement: SELECT o.* FROM orders o WHERE o.tenant_id = $1" },
  { lvl: "LOG",   msg: "duration: 4.218 ms  bind: COMMIT" },
  { lvl: "LOG",   msg: "checkpoint starting: time" },
  { lvl: "LOG",   msg: "checkpoint complete: wrote 12 buffers (0.1%)" },
  { lvl: "WARN",  msg: "could not receive data from client: Connection reset" },
  { lvl: "LOG",   msg: "autovacuum: processing database \"app\"" },
];
const DB_BASE = [
  { d: "2026.04.25", t: "23:59:42", lvl: "LOG", msg: "database system is ready to accept connections" },
  { d: "2026.04.25", t: "23:59:43", lvl: "LOG", msg: "connection authorized: user=app database=app" },
  { d: "2026.04.25", t: "23:59:44", lvl: "LOG", msg: "statement: SET application_name = 'myapp-7d8c'" },
  { d: "2026.04.26", t: "00:00:01", lvl: "LOG", msg: "duration: 1.842 ms  statement: SELECT 1" },
];

function TerminalView({ mode, paneId = "L", defaultTarget = "was" }) {
  const [target, setTarget] = useState(defaultTarget);
  const [pickerOpen, setPickerOpen] = useState(false);
  const wasBase = mode === "visitor" ? MOCK_LOGS_VISITOR : MOCK_LOGS_USER;
  const dbBase  = DB_BASE;
  const base    = target === "db" ? dbBase : wasBase;
  const [lines, setLines] = useState(base);
  const scrollRef = useRef(null);

  useEffect(() => {
    setLines(base);
    if (mode !== "user") return;
    const POOL = target === "db" ? DB_POOL : WAS_POOL;
    let n = 0;
    const id = setInterval(() => {
      const pool = POOL[n % POOL.length];
      const minute = Math.floor(n / 6);
      const hour = Math.floor(minute / 60);
      const dayOffset = Math.floor(hour / 24);
      const day = dayOffset === 0 ? "2026.04.26" : "2026.04.27";
      const hh = String(hour % 24).padStart(2, "0");
      const mm = String(minute % 60).padStart(2, "0");
      const ss = String((n * 7) % 60).padStart(2, "0");
      const t = `${hh}:${mm}:${ss} KST`;
      const suffix = pool.msg.endsWith("ord_") ? Math.random().toString(16).slice(2, 6) : "";
      setLines((prev) => {
        const next = [...prev, { d: day, t, lvl: pool.lvl, msg: pool.msg + suffix }];
        return next.slice(-80);
      });
      n++;
    }, 1700);
    return () => clearInterval(id);
  }, [mode, target]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  const lvlColor = (lvl) => {
    switch (lvl) {
      case "INFO":  return "#7fa3ff";
      case "DEBUG": return "#62666d";
      case "WARN":  return "#f59e0b";
      case "ERROR": return "#ef4444";
      default:      return "#8a8f98";
    }
  };


  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* terminal toolbar */}
      <div className="flex items-center gap-2 px-4 h-8 shrink-0 relative"
           style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <span className="w-1.5 h-1.5 rounded-full kd-live-dot"
              style={{ background: target === "db" ? "#7fb6db" : "#10b981" }} />
        <button
          onClick={() => setPickerOpen((o) => !o)}
          className="flex items-center gap-1.5 text-[11px] font-mono text-fg-2 hover:text-fg-1 transition-colors px-1.5 py-0.5 rounded"
          style={{ fontWeight: 500 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <Icon name={target === "db" ? "database" : "server"} size={11} stroke={1.8}
                style={{ color: target === "db" ? "#7fb6db" : "#a4abee" }} />
          <span>
            {target === "db"
              ? (mode === "user" ? "postgres-0 · 15.3" : "demo-postgres")
              : (mode === "user" ? "myapp-7d8c · pod-0" : "demo-pod-3a2")}
          </span>
          <span className="text-fg-4">·</span>
          <span className="flex items-center gap-1" style={{ color: "#10b981" }}><span style={{ fontSize: 8 }}>●</span> live</span>
          <Icon name="chevron-down" size={10} stroke={1.8} className="text-fg-3" />
        </button>
        {pickerOpen && (
          <div className="absolute left-3 top-7 z-20 rounded-md min-w-[220px] py-1"
               style={{
                 background: "#191a1b",
                 border: "1px solid rgba(255,255,255,0.08)",
                 boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.4)",
               }}>
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-fg-4"
                 style={{ fontWeight: 590 }}>
              연결할 대상
            </div>
            {[
              { id: "was", icon: "server",   name: mode === "user" ? "WAS — myapp-7d8c" : "WAS — demo-pod",   sub: "Spring Boot · pod-0", color: "#a4abee" },
              { id: "db",  icon: "database", name: mode === "user" ? "DB — postgres-0"  : "DB — demo-postgres", sub: "PostgreSQL 15.3",       color: "#7fb6db" },
            ].map((opt) => {
              const active = target === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => { setTarget(opt.id); setPickerOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
                  style={{ background: active ? "rgba(94,106,210,0.12)" : "transparent" }}
                  onMouseEnter={(e) => !active && (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                  onMouseLeave={(e) => !active && (e.currentTarget.style.background = "transparent")}
                >
                  <Icon name={opt.icon} size={13} stroke={1.8} style={{ color: opt.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] text-fg-1" style={{ fontWeight: 510 }}>{opt.name}</div>
                    <div className="text-[10.5px] text-fg-3 font-mono">{opt.sub}</div>
                  </div>
                  {active && <Icon name="check" size={12} stroke={2} className="text-violet-brand" />}
                </button>
              );
            })}
          </div>
        )}
        <span className="text-[10px] text-fg-4 font-mono ml-1">[{paneId}]</span>
        <span className="ml-auto flex items-center gap-2">
          <button className="text-[11px] text-fg-3 hover:text-fg-1 transition-colors flex items-center gap-1"
                  style={{ fontWeight: 510 }}>
            <Icon name="filter" size={11} stroke={1.8} /> 필터
          </button>
          <button className="text-[11px] text-fg-3 hover:text-fg-1 transition-colors flex items-center gap-1"
                  style={{ fontWeight: 510 }}>
            <Icon name="download" size={11} stroke={1.8} /> 내보내기
          </button>
        </span>
      </div>

      {/* terminal body */}
      <div ref={scrollRef}
           className="flex-1 min-h-0 overflow-auto scroll-thin px-4 py-3 font-mono text-[12.5px] leading-[1.65]"
           style={{ background: "#0f1011" }}>
        {lines.map((l, i) => {
          const prev = i > 0 ? lines[i - 1] : null;
          const showDay = !prev || prev.d !== l.d;
          return (
          <React.Fragment key={i}>
            {showDay && (
              <div className="flex items-center gap-3 my-2 text-fg-4 select-none whitespace-pre">
                <span className="flex-1" style={{ borderTop: "1px dashed rgba(255,255,255,0.08)" }} />
                <span className="text-[11px] tracking-wider">{l.d}</span>
                <span className="flex-1" style={{ borderTop: "1px dashed rgba(255,255,255,0.08)" }} />
              </div>
            )}
            <div className="kd-log-line flex gap-3 whitespace-pre">
            <span className="text-fg-4 shrink-0">{l.t}{l.t.includes(" KST") ? "" : " KST"}</span>
            <span className="shrink-0" style={{ color: lvlColor(l.lvl), fontWeight: 500, width: 44 }}>
              {l.lvl}
            </span>
            <span className="text-fg-2 break-all" style={{ whiteSpace: "pre-wrap" }}>{l.msg}</span>
          </div>
          </React.Fragment>
          );
        })}
        {/* cursor */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-violet-brand">$</span>
          <span className="inline-block w-2 h-3.5" style={{ background: "#7170ff", animation: "kd-pulse 1.1s steps(2) infinite" }} />
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   Monitoring view — CPU / RAM sparkline charts
   ===================================================================== */
function MonitoringView({ mode }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1500);
    return () => clearInterval(id);
  }, []);

  // generate stable-ish series per mode
  const cpuSeries = useMemo(() => makeSeries(60, mode === "user" ? 42 : 28, 14, tick, "cpu"), [tick, mode]);
  const ramSeries = useMemo(() => makeSeries(60, mode === "user" ? 62 : 35, 8, tick, "ram"), [tick, mode]);
  const reqSeries = useMemo(() => makeSeries(60, mode === "user" ? 88 : 12, 30, tick, "req"), [tick, mode]);

  return (
    <div className="flex-1 min-h-0 overflow-auto scroll-thin p-5">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Stat label="CPU 사용률"      value={mode === "user" ? "42%" : "28%"} sub={mode === "user" ? "정상 운영 중" : "데모 환경"} ok />
        <Stat label="메모리"           value={mode === "user" ? "318/512 MiB" : "180/512 MiB"} sub={mode === "user" ? "62% — 안정적" : "35%"} ok />
        <Stat label="요청 / 분"        value={mode === "user" ? "88 rpm" : "12 rpm"} sub={mode === "user" ? "지난 시간 대비 +14%" : "데모 트래픽"} />
        <Stat label="평균 응답시간"    value={mode === "user" ? "12 ms" : "8 ms"} sub="P95 36 ms" ok />
      </div>

      <ChartCard title="CPU" subtitle="최근 5분" color="#5e6ad2" series={cpuSeries} unit="%" max={100} />
      <ChartCard title="메모리 (MiB)" subtitle="최근 5분" color="#10b981" series={ramSeries.map((v) => v * 5.12)} unit=" MiB" max={512} />
      <ChartCard title="요청 / 분" subtitle="최근 5분" color="#7170ff" series={reqSeries} unit=" rpm" max={150} />
    </div>
  );
}

function Stat({ label, value, sub, ok }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.08em] text-fg-4 mb-2" style={{ fontWeight: 590 }}>{label}</div>
      <div className="text-[26px] text-fg-1 mb-1" style={{ fontWeight: 510, letterSpacing: -0.6 }}>{value}</div>
      <div className="flex items-center gap-1.5 text-[12px] text-fg-3">
        {ok && <span className="w-1 h-1 rounded-full" style={{ background: "#10b981" }} />}
        {sub}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, color, series, unit, max }) {
  const w = 600, h = 110, pad = 8;
  const pts = series.map((v, i) => {
    const x = pad + (i / (series.length - 1)) * (w - pad * 2);
    const y = h - pad - (v / max) * (h - pad * 2);
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const area = `${path} L${pts[pts.length - 1][0]},${h - pad} L${pts[0][0]},${h - pad} Z`;

  return (
    <div className="py-4 mb-2" style={{ borderTop: "1px solid rgba(255,255,255,0.09)" }}>
      <div className="flex items-baseline mb-3">
        <span className="text-[10.5px] uppercase tracking-[0.08em] text-fg-4" style={{ fontWeight: 590 }}>{title}</span>
        <span className="ml-auto text-[12px] font-mono text-fg-2">
          {Math.round(series[series.length - 1])}{unit}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full rounded">
        <defs>
          <linearGradient id={`g-${title}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.32" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#g-${title})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />
      </svg>
    </div>
  );
}

function makeSeries(n, mean, variance, tick, salt) {
  // Deterministic pseudo-random walk that shifts each tick.
  const out = [];
  const seed = salt.charCodeAt(0) + salt.charCodeAt(1) * 7;
  let v = mean;
  for (let i = 0; i < n; i++) {
    const x = (Math.sin((i + tick) * 0.31 + seed) + Math.sin((i + tick) * 0.13 + seed * 2)) * 0.5;
    v = mean + x * variance + ((i + tick) % 17 === 0 ? variance * 0.5 : 0);
    out.push(Math.max(0, Math.min(100, v)));
  }
  return out;
}

/* =====================================================================
   Korean error log view — AI-translated
   ===================================================================== */
function KoreanErrorView({ mode }) {
  const items = mode === "visitor" ? KOREAN_ERRORS_VISITOR : KOREAN_ERRORS_USER;
  const [expanded, setExpanded] = useState(null);
  return (
    <div className="flex-1 min-h-0 overflow-auto scroll-thin">
      <div className="flex items-center gap-2 px-6 py-3.5 sticky top-0 z-10"
           style={{ background: "rgba(15,16,17,0.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,0.09)" }}>
        <Icon name="sparkles" size={12} className="text-violet-brand" stroke={1.8} />
        <span className="text-[11.5px] text-fg-3" style={{ fontWeight: 510 }}>
          AI 요약
        </span>
        <span className="ml-auto text-[11px] text-fg-4 font-mono">{items.length} 건</span>
      </div>

      <div className="flex flex-col px-2 py-2">
        {items.map((it, i) => (
          <KoreanErrorCard
            key={i}
            item={it}
            expanded={expanded === i}
            onToggle={() => setExpanded(expanded === i ? null : i)}
          />
        ))}
      </div>

      {mode === "visitor" && (
        <div className="mx-6 mt-4 mb-6 px-4 py-3 flex items-center gap-3"
             style={{ borderTop: "1px solid rgba(255,255,255,0.09)" }}>
          <Icon name="sparkles" size={12} className="text-fg-4" stroke={1.8} />
          <p className="text-[12px] text-fg-3" style={{ textWrap: "pretty" }}>
            본인 서비스의 에러도 한국어로 요약해드려요.
          </p>
          <button className="ml-auto text-[12px] text-fg-2 hover:text-fg-1 transition-colors" style={{ fontWeight: 510 }}>
            로그인 →
          </button>
        </div>
      )}
    </div>
  );
}

function KoreanErrorCard({ item, expanded, onToggle }) {
  const tone = {
    error: { fg: "#ef4444", label: "에러" },
    warn:  { fg: "#f59e0b", label: "경고" },
    info:  { fg: "#7fa3ff", label: "정보" },
  }[item.severity] || {};
  return (
    <button
      onClick={onToggle}
      className="text-left px-4 py-3 rounded-md transition-colors group"
      style={{
        borderLeft: `2px solid ${tone.fg}`,
        background: item.severity === "error" ? "rgba(239,68,68,0.04)" : item.severity === "warn" ? "rgba(245,158,11,0.04)" : "rgba(127,163,255,0.03)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = item.severity === "error" ? "rgba(239,68,68,0.07)" : item.severity === "warn" ? "rgba(245,158,11,0.07)" : "rgba(127,163,255,0.06)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = item.severity === "error" ? "rgba(239,68,68,0.04)" : item.severity === "warn" ? "rgba(245,158,11,0.04)" : "rgba(127,163,255,0.03)")}
    >
      <div className="flex items-center gap-3">
        <span className="text-[11.5px] font-mono shrink-0" style={{ color: tone.fg, fontWeight: 590 }}>
          {tone.label}
        </span>
        <span className="text-[13px] text-fg-1 truncate" style={{ fontWeight: 510, letterSpacing: -0.1 }}>
          {item.title}
        </span>
        <span className="ml-auto text-[11px] text-fg-4 font-mono shrink-0">{item.when}</span>
      </div>

      <div className="pl-[46px] mt-1.5 text-[12.5px] text-fg-3 leading-[1.55]" style={{ textWrap: "pretty" }}>
        {item.summary}
      </div>

      {expanded && (
        <div className="pl-[46px] mt-3 flex flex-col gap-2.5">
          <div className="text-[12px] text-fg-3 leading-[1.6]" style={{ textWrap: "pretty" }}>
            {item.detail}
          </div>
          <div className="font-mono text-[11px] text-fg-4">{item.related}</div>
          {item.action && (
            <div className="flex items-center gap-3 mt-1">
              <span
                className="text-[12px] text-violet-brand hover:text-[#828fff] transition-colors flex items-center gap-1.5"
                style={{ fontWeight: 510 }}
              >
                {item.action} →
              </span>
              <span className="text-[12px] text-fg-4 hover:text-fg-2 transition-colors" style={{ fontWeight: 510 }}>
                스택트레이스
              </span>
            </div>
          )}
        </div>
      )}
    </button>
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

/* =====================================================================
   Deploy modal — commit summary + infra changes
   ===================================================================== */
const MOCK_COMMITS = [
  { hash: "a3f8c21", msg: "fix: 결제 콜백 NPE 수정 (guest order 처리)", author: "alice", time: "12분 전", files: 3 },
  { hash: "e7b1d04", msg: "feat: 주문 상세 API 응답에 invoice 필드 추가", author: "alice", time: "48분 전", files: 5 },
  { hash: "91c4e2a", msg: "chore: Flyway V18 billing 마이그레이션 추가", author: "alice", time: "1시간 전", files: 2 },
  { hash: "b5d09f3", msg: "refactor: RateLimitInterceptor 버킷 로직 개선", author: "bob", time: "3시간 전", files: 4 },
];

const COMMIT_SUMMARY = "결제 콜백 버그를 수정하고, 주문 API에 청구서 필드를 추가했어요. Billing 테이블 마이그레이션과 속도 제한 로직도 개선됐어요.";

function DeployModal({ mode, onClose, onDeploy }) {
  const [infraOpen, setInfraOpen] = useState(false);
  const [dbOn, setDbOn] = useState(true);
  const [strategy, setStrategy] = useState("rolling");
  const [replicas, setReplicas] = useState(3);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center kd-fade-in"
         style={{ background: "rgba(0,0,0,0.85)" }}
         onClick={onClose}>
      <div className="relative w-[560px] max-w-[92vw] max-h-[85vh] flex flex-col rounded-xl overflow-hidden"
           style={{
             background: "#0c0d0e",
             border: "1px solid rgba(255,255,255,0.09)",
             boxShadow: "0 24px 60px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4)",
           }}
           onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center px-6 py-4 shrink-0"
             style={{ borderBottom: "1px solid rgba(255,255,255,0.09)" }}>
          <div className="flex-1">
            <h2 className="text-[17px] text-fg-1" style={{ fontWeight: 510, letterSpacing: -0.3 }}>배포 업데이트</h2>
            <p className="text-[12px] text-fg-3 mt-0.5">myapp · v2.4.1 → v2.4.2</p>
          </div>
          <button onClick={onClose}
                  className="w-8 h-8 rounded-md text-fg-4 hover:text-fg-1 hover:bg-white/[0.04] transition-colors flex items-center justify-center">
            <Icon name="x" size={14} stroke={1.8} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto scroll-thin px-6 py-5">

          {/* AI Summary */}
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-lg mb-5"
               style={{ background: "rgba(94,106,210,0.08)", border: "1px solid rgba(94,106,210,0.15)" }}>
            <Icon name="sparkles" size={14} stroke={1.8} className="text-violet-brand mt-0.5 shrink-0" />
            <div>
              <div className="text-[11px] text-violet-brand mb-1" style={{ fontWeight: 590 }}>AI 요약</div>
              <p className="text-[13px] text-fg-2 leading-[1.6]">{COMMIT_SUMMARY}</p>
            </div>
          </div>

          {/* Commits */}
          <div className="mb-5">
            <div className="text-[10.5px] uppercase tracking-[0.08em] text-fg-3 mb-3" style={{ fontWeight: 590 }}>
              최근 커밋 · {MOCK_COMMITS.length}건
            </div>
            <div className="flex flex-col gap-1">
              {MOCK_COMMITS.map((c) => (
                <div key={c.hash} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/[0.02] transition-colors">
                  <span className="font-mono text-[11px] text-violet-brand shrink-0">{c.hash}</span>
                  <span className="text-[12.5px] text-fg-1 flex-1 min-w-0 truncate" style={{ fontWeight: 500 }}>{c.msg}</span>
                  <span className="text-[11px] text-fg-4 shrink-0">{c.files} files</span>
                  <span className="text-[11px] text-fg-4 shrink-0 w-16 text-right">{c.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Infra changes (collapsible) */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.09)" }}>
            <button onClick={() => setInfraOpen(!infraOpen)}
                    className="w-full flex items-center gap-2 py-3 text-left">
              <Icon name={infraOpen ? "chevron-down" : "chevron-right"} size={12} stroke={2} className="text-fg-4" />
              <span className="text-[10.5px] uppercase tracking-[0.08em] text-fg-3" style={{ fontWeight: 590 }}>
                인프라 변경
              </span>
              <span className="text-[11px] text-fg-4">런타임 · DB · 전략 · 레플리카</span>
            </button>

            {infraOpen && (
              <div className="pb-3 flex flex-col gap-3">
                {/* DB */}
                <div className="px-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[12px] text-fg-3" style={{ fontWeight: 510 }}>데이터베이스</span>
                    <Toggle checked={dbOn} onChange={setDbOn} />
                  </div>
                  {dbOn && (
                    <div className="flex gap-1.5">
                      {[{ id: "postgres", label: "PostgreSQL" }, { id: "mysql", label: "MySQL" }].map((d) => (
                        <button key={d.id} onClick={() => setStrategy((prev) => prev)}
                                className="px-2.5 py-1 rounded-md text-[12px] transition-colors"
                                style={{
                                  background: d.id === "postgres" ? "rgba(94,106,210,0.15)" : "rgba(255,255,255,0.03)",
                                  color: d.id === "postgres" ? "#a4abee" : "#8a8f98",
                                  fontWeight: 510,
                                }}>
                          {d.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Strategy */}
                <div className="flex items-center gap-3 px-3">
                  <span className="text-[12px] text-fg-3" style={{ fontWeight: 510 }}>배포 전략</span>
                  <div className="flex gap-1.5">
                    {[{ id: "rolling", label: "롤링" }, { id: "recreate", label: "재생성" }].map((s) => (
                      <button key={s.id} onClick={() => setStrategy(s.id)}
                              className="px-2.5 py-1 rounded-md text-[12px] transition-colors"
                              style={{
                                background: strategy === s.id ? "rgba(94,106,210,0.15)" : "rgba(255,255,255,0.03)",
                                color: strategy === s.id ? "#a4abee" : "#8a8f98",
                                fontWeight: 510,
                              }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Replicas */}
                <div className="flex items-center gap-3 px-3">
                  <span className="text-[12px] text-fg-3" style={{ fontWeight: 510 }}>레플리카</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setReplicas((r) => Math.max(1, r - 1))}
                            className="w-6 h-6 rounded text-fg-3 hover:text-fg-1 hover:bg-white/[0.04] transition-colors text-[14px]">−</button>
                    <span className="text-[13px] font-mono text-fg-1 w-5 text-center" style={{ fontWeight: 510 }}>{replicas}</span>
                    <button onClick={() => setReplicas((r) => Math.min(10, r + 1))}
                            className="w-6 h-6 rounded text-fg-3 hover:text-fg-1 hover:bg-white/[0.04] transition-colors text-[14px]">+</button>
                    <span className="text-[11px] text-fg-4">pods</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 shrink-0 flex items-center gap-3"
             style={{ borderTop: "1px solid rgba(255,255,255,0.09)", background: "#08090a" }}>
          <div className="flex-1 flex items-center gap-2 text-[11px] text-fg-4">
            <Icon name="git-branch" size={12} stroke={1.8} className="text-fg-3" />
            <span className="font-mono">main</span>
            <span>@</span>
            <span className="font-mono">{MOCK_COMMITS[0].hash}</span>
            <span>· 롤링 업데이트 · {replicas} pods</span>
          </div>
          <button onClick={onClose}
                  className="px-4 py-2 rounded-md text-[13px] text-fg-2 transition-colors"
                  style={{ fontWeight: 510, border: "1px solid rgba(255,255,255,0.09)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            취소
          </button>
          <button onClick={onDeploy}
                  className="px-5 py-2 rounded-md text-[13px] text-white transition-colors"
                  style={{ background: "#5e6ad2", fontWeight: 510 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#828fff")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#5e6ad2")}>
            배포
          </button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   Right panel — deploy settings (legacy, unused)
   ===================================================================== */
function RightPanel({ mode, onDeploy }) {
  const [collapsed, setCollapsed] = useState(false);
  const [runtime, setRuntime]   = useState("spring");
  const [dbOn, setDbOn]         = useState(true);
  const [strategy, setStrategy] = useState("rolling");
  const [replicas, setReplicas] = useState(mode === "user" ? 3 : 1);
  const [domain, setDomain]     = useState(mode === "user" ? "myapp.alice.kodeploy.io" : "demo-app.kodeploy.io");

  const disabled = mode === "visitor";

  return (
    <aside className="w-[336px] shrink-0 flex flex-col"
           style={{ background: "#0c0d0e", borderLeft: "1px solid rgba(255,255,255,0.09)" }}>

      {/* Header */}
      <div className="flex items-center h-12 px-4 shrink-0"
           style={{ borderBottom: "1px solid rgba(255,255,255,0.09)" }}>
        <Icon name="settings-2" size={14} className="text-fg-3 mr-2" stroke={1.8} />
        <span className="text-[13px] text-fg-1" style={{ fontWeight: 510 }}>배포 설정</span>
        <span className="ml-2 text-[11px] text-fg-4">Deploy</span>
        <button className="ml-auto p-1 rounded text-fg-3 hover:text-fg-1 hover:bg-white/[0.04] transition-colors"
                onClick={() => setCollapsed((c) => !c)}>
          <Icon name={collapsed ? "chevron-down" : "chevron-up"} size={14} stroke={1.8} />
        </button>
      </div>

      {!collapsed && (
        <div className={`flex-1 min-h-0 overflow-auto scroll-thin px-4 py-4 transition-opacity ${disabled ? "opacity-70" : ""}`}>

          {/* Project meta (user mode) */}
          {mode === "user" && (
            <div className="mb-6 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.09)" }}>
              <Field label="프로젝트">
                <input
                  className="w-full bg-transparent outline-none text-[13px] text-fg-1 py-1"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", fontWeight: 510 }}
                  defaultValue="alice-myapp"
                  disabled={disabled}
                />
              </Field>
              <Field label="도메인">
                <div className="flex items-center py-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-[13px] text-fg-2 font-mono">{domain}</span>
                  <button className="ml-auto text-[11px] text-fg-3 hover:text-fg-1 transition-colors"
                          style={{ fontWeight: 510 }}>변경</button>
                </div>
              </Field>
            </div>
          )}

          {/* Runtime */}
          <Section title="런타임" subtitle="Runtime">
            <RuntimeOption
              id="spring"  current={runtime} onChange={setRuntime} disabled={disabled}
              name="Java Spring Boot" tag="3.3.x · JDK 21"
              accent="#6db33f"
            />
            <RuntimeOption
              id="node"    current={runtime} onChange={setRuntime} disabled={disabled}
              name="Node.js Express" tag="20.x · TypeScript"
              accent="#83cd29"
            />
            <RuntimeOption
              id="python"  current={runtime} onChange={setRuntime} disabled={disabled}
              name="Python FastAPI" tag="3.12 · uvicorn"
              accent="#3776ab"
            />
          </Section>

          {/* Database */}
          <Section title="데이터베이스" subtitle="Database">
            <div className="flex items-center px-3 py-2.5">
              <Icon name="database" size={14} stroke={1.8} className="text-fg-3 mr-3" />
              <div className="flex-1">
                <div className="text-[13px] text-fg-1" style={{ fontWeight: 510 }}>PostgreSQL</div>
                <div className="text-[11px] text-fg-4 mt-0.5">15.3 · 1 GiB · 일일 자동 백업</div>
              </div>
              <Toggle checked={dbOn} onChange={setDbOn} disabled={disabled} />
            </div>
            <button
              disabled={disabled}
              className="text-[12px] text-fg-4 hover:text-fg-2 px-3 py-2 transition-colors flex items-center gap-1.5 text-left"
              style={{ fontWeight: 510 }}
            >
              <Icon name="plus" size={11} stroke={1.8} />
              Redis · S3 · Kafka 추가
            </button>
          </Section>

          {/* Strategy */}
          <Section title="배포 전략" subtitle="Strategy">
            <StrategyOption
              id="rolling" current={strategy} onChange={setStrategy} disabled={disabled}
              name="롤링 업데이트" desc="무중단 배포. 한 번에 한 개 pod 씩 교체해요." recommended
            />
            <StrategyOption
              id="recreate" current={strategy} onChange={setStrategy} disabled={disabled}
              name="재생성" desc="기존 pod 를 모두 종료한 뒤 새로 띄워요. 짧은 다운타임이 있어요."
            />
          </Section>

          {/* Replicas */}
          <Section title="복제본" subtitle="Replicas">
            <div className="flex items-center gap-3 px-3 py-1">
              <button
                disabled={disabled || replicas <= 1}
                onClick={() => setReplicas((r) => Math.max(1, r - 1))}
                className="w-6 h-6 text-fg-3 hover:text-fg-1 transition-colors disabled:opacity-30"
              >−</button>
              <div className="text-[14px] text-fg-1 font-mono w-6 text-center" style={{ fontWeight: 510 }}>
                {replicas}
              </div>
              <button
                disabled={disabled}
                onClick={() => setReplicas((r) => Math.min(10, r + 1))}
                className="w-6 h-6 text-fg-3 hover:text-fg-1 transition-colors disabled:opacity-30"
              >+</button>
              <span className="text-[11px] text-fg-4 ml-1">pods</span>
            </div>
          </Section>

          {/* Env vars */}
          <Section title="환경 변수" subtitle="Environment">
            <EnvVarsEditor disabled={disabled} mode={mode} />
          </Section>

          {/* Build / git ref */}
          <Section title="배포 소스" subtitle="Source">
            <div className="flex items-center gap-2.5 px-3 py-2">
              <Icon name="git-branch" size={13} className="text-fg-3" stroke={1.8} />
              <span className="font-mono text-[12px] text-fg-2">main</span>
              <span className="text-fg-4 text-[11px]">@</span>
              <span className="font-mono text-[12px] text-fg-3">{mode === "user" ? "9c4e2a1" : "demo000"}</span>
              <span className="ml-auto text-[11px] text-fg-4">
                {mode === "user" ? "12분 전" : "데모"}
              </span>
            </div>
          </Section>
        </div>
      )}

      {/* Sticky action bar */}
      <div className="px-4 py-3.5 shrink-0 flex flex-col gap-2.5"
           style={{ borderTop: "1px solid rgba(255,255,255,0.09)", background: "#08090a" }}>
        {mode === "user" && (
          <div className="flex items-center gap-2 text-[11px] text-fg-4 mb-1">
            <span className="w-1 h-1 rounded-full" style={{ background: "#10b981" }} />
            마지막 배포: 2시간 전 · v2.4.1 · 정상 운영 중
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            disabled={disabled}
            className="flex-1 h-9 rounded-md text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "transparent",
              color: "#d0d6e0",
              border: "1px solid rgba(255,255,255,0.1)",
              fontWeight: 510,
            }}
            onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            업데이트
          </button>
          <button
            onClick={onDeploy}
            className="flex-1 h-9 rounded-md text-[13px] text-white transition-colors flex items-center justify-center gap-1.5"
            style={{ background: "#5e6ad2", fontWeight: 510 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#828fff")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#5e6ad2")}
          >
            {mode === "user" ? (
              "배포"
            ) : (
              "지금 시작하기"
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div className="mb-6">
      <div className="text-[10.5px] uppercase tracking-[0.08em] text-fg-3 mb-3" style={{ fontWeight: 590 }}>
        {title}
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <div className="text-[11px] text-fg-3 mb-1.5" style={{ fontWeight: 510 }}>{label}</div>
      {children}
    </div>
  );
}

function RuntimeOption({ id, current, onChange, name, tag, accent, disabled }) {
  const active = current === id;
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(id)}
      className="text-left rounded-md px-3 py-2.5 flex items-center transition-colors"
      style={{
        background: active ? "rgba(94,106,210,0.08)" : "transparent",
      }}
      onMouseEnter={(e) => !disabled && !active && (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
      onMouseLeave={(e) => !active && (e.currentTarget.style.background = "transparent")}
    >
      <span className="w-2 h-2 rounded-full mr-3 shrink-0"
            style={{
              background: active ? "#7170ff" : "transparent",
              border: `1.5px solid ${active ? "#7170ff" : "rgba(255,255,255,0.2)"}`,
            }} />
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] text-fg-1 truncate" style={{ fontWeight: 510 }}>{name}</span>
        <span className="block text-[11px] text-fg-4 truncate font-mono mt-0.5">{tag}</span>
      </span>
    </button>
  );
}

function StrategyOption({ id, current, onChange, name, desc, recommended, disabled }) {
  const active = current === id;
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(id)}
      className="text-left rounded-md px-3 py-2.5 transition-colors"
      style={{ background: active ? "rgba(94,106,210,0.08)" : "transparent" }}
      onMouseEnter={(e) => !disabled && !active && (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
      onMouseLeave={(e) => !active && (e.currentTarget.style.background = "transparent")}
    >
      <div className="flex items-center mb-1">
        <span className="w-2 h-2 rounded-full mr-3 shrink-0"
              style={{
                background: active ? "#7170ff" : "transparent",
                border: `1.5px solid ${active ? "#7170ff" : "rgba(255,255,255,0.2)"}`,
              }} />
        <span className="text-[13px] text-fg-1" style={{ fontWeight: 510 }}>{name}</span>
        {recommended && (
          <span className="ml-2 text-[10.5px] text-fg-3" style={{ fontWeight: 510 }}>
            — 추천
          </span>
        )}
      </div>
      <div className="text-[11.5px] text-fg-4 ml-[20px] leading-[1.55]" style={{ textWrap: "pretty" }}>
        {desc}
      </div>
    </button>
  );
}

function EnvVarsEditor({ disabled, mode }) {
  const [vars, setVars] = useState(
    mode === "user"
      ? [
          { k: "SPRING_PROFILES_ACTIVE", v: "prod",        secret: false },
          { k: "DATABASE_URL",           v: "postgres://...alice-myapp.svc:5432/app", secret: true },
          { k: "JWT_SECRET",             v: "sk_live_8f2a4c91...e2",      secret: true },
          { k: "LOG_LEVEL",              v: "INFO",        secret: false },
        ]
      : [
          { k: "SPRING_PROFILES_ACTIVE", v: "demo",        secret: false },
          { k: "DATABASE_URL",           v: "postgres://demo:demo@demo.svc:5432/app", secret: true },
        ]
  );
  const [reveal, setReveal] = useState({});

  const update = (i, patch) => {
    setVars((vs) => vs.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  };
  const remove = (i) => setVars((vs) => vs.filter((_, idx) => idx !== i));
  const add = () => setVars((vs) => [...vs, { k: "", v: "", secret: false }]);

  return (
    <div>
      <div className="flex flex-col">
        {vars.map((row, i) => (
          <div key={i} className="flex items-center gap-2 group px-3 py-1.5 hover:bg-white/[0.015] transition-colors">
            <input
              disabled={disabled}
              value={row.k}
              onChange={(e) => update(i, { k: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })}
              placeholder="KEY"
              className="w-[44%] bg-transparent outline-none text-[12px] font-mono text-fg-2"
              style={{ fontWeight: 500 }}
            />
            <span className="text-fg-4 text-[12px]">=</span>
            <div className="flex-1 min-w-0 flex items-center">
              <input
                disabled={disabled}
                type={row.secret && !reveal[i] ? "password" : "text"}
                value={row.v}
                onChange={(e) => update(i, { v: e.target.value })}
                placeholder="value"
                className="flex-1 min-w-0 bg-transparent outline-none text-[12px] font-mono text-fg-3"
              />
              {row.secret && (
                <button
                  disabled={disabled}
                  onClick={() => setReveal((r) => ({ ...r, [i]: !r[i] }))}
                  className="p-1 text-fg-4 hover:text-fg-2 transition-colors opacity-0 group-hover:opacity-100"
                  title={reveal[i] ? "숨기기" : "보기"}
                >
                  <Icon name={reveal[i] ? "eye-off" : "eye"} size={11} stroke={1.8} />
                </button>
              )}
            </div>
            <button
              disabled={disabled}
              onClick={() => update(i, { secret: !row.secret })}
              className="p-1 text-fg-4 hover:text-fg-2 transition-colors"
              title={row.secret ? "비밀" : "공개"}
            >
              <Icon name={row.secret ? "lock" : "lock-open"} size={11} stroke={1.8} />
            </button>
            <button
              disabled={disabled}
              onClick={() => remove(i)}
              className="p-1 text-fg-4 hover:text-red-err transition-colors opacity-0 group-hover:opacity-100"
              title="삭제"
            >
              <Icon name="x" size={11} stroke={1.8} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 px-3 mt-1">
        <button
          disabled={disabled}
          onClick={add}
          className="text-[12px] text-fg-3 hover:text-fg-1 transition-colors flex items-center gap-1.5"
          style={{ fontWeight: 510 }}
        >
          <Icon name="plus" size={11} stroke={1.8} />
          변수 추가
        </button>
        <span className="text-fg-4">·</span>
        <button
          disabled={disabled}
          className="text-[12px] text-fg-3 hover:text-fg-1 transition-colors flex items-center gap-1.5"
          style={{ fontWeight: 510 }}
          title=".env 파일 가져오기"
        >
          <Icon name="upload" size={11} stroke={1.8} />
          .env 가져오기
        </button>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="w-9 h-5 rounded-full transition-colors relative shrink-0 disabled:cursor-not-allowed"
      style={{
        background: checked ? "#5e6ad2" : "rgba(255,255,255,0.1)",
        border: "1px solid " + (checked ? "rgba(94,106,210,0.6)" : "rgba(255,255,255,0.08)"),
      }}
    >
      <span
        className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform"
        style={{ left: 2, transform: checked ? "translateX(16px)" : "translateX(0)" }}
      />
    </button>
  );
}

/* =====================================================================
   Dev mode toggle
   ===================================================================== */
function ModeToggle({ mode, onChange }) {
  return (
    <div
      className="fixed bottom-4 left-4 z-40 flex items-center gap-1 p-1 rounded-full shadow-dialog"
      style={{ background: "#0f1011", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <span className="px-2 text-[10px] text-fg-4 font-mono uppercase tracking-wider">dev</span>
      {[
        { id: "visitor", label: "방문자", icon: "user" },
        { id: "user",    label: "사용자", icon: "user-check" },
      ].map((opt) => {
        const active = mode === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] transition-colors"
            style={{
              background: active ? (opt.id === "user" ? "#5e6ad2" : "rgba(255,255,255,0.06)") : "transparent",
              color: active ? (opt.id === "user" ? "#fff" : "#f7f8f8") : "#8a8f98",
              fontWeight: 510,
            }}
          >
            <Icon name={opt.icon} size={11} stroke={1.8} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* =====================================================================
   Login modal — Linear-style auth (한국어)
   ===================================================================== */
function LoginModal({ onClose, onLogin }) {
  const [step, setStep] = useState("choose"); // "choose" | "email"
  const [email, setEmail] = useState("");

  // Lock body scroll + close on Esc
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center kd-fade-in"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        className="relative w-[420px] max-w-[92vw] px-10 pt-12 pb-10 rounded-xl"
        style={{
          background: "#08090a",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-md text-fg-4 hover:text-fg-1 hover:bg-white/[0.04] transition-colors flex items-center justify-center"
          aria-label="닫기"
        >
          <Icon name="x" size={14} stroke={1.8} />
        </button>

        <div className="flex flex-col items-center mb-8">
          <KoDeployMark size={28} />
          <h2
            className="mt-5 text-[20px] text-fg-1"
            style={{ fontWeight: 510, letterSpacing: -0.5 }}
          >
            {step === "choose" ? "로그인" : "이메일로 계속하기"}
          </h2>
          {step === "choose" && (
            <p className="mt-1.5 text-[13px] text-fg-3">
              KoDeploy 계정으로 계속하세요
            </p>
          )}
        </div>

        {step === "choose" ? (
          <>
            <AuthButton
              primary
              onClick={onLogin}
              icon={<GoogleG />}
              label="Google 로 계속하기"
            />

            <div className="flex items-center gap-3 my-4">
              <span className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              <span className="text-[11px] text-fg-4" style={{ fontWeight: 510 }}>또는</span>
              <span className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            </div>

            <div className="flex flex-col gap-2">
              <AuthButton
                onClick={() => setStep("email")}
                label="이메일로 계속하기"
              />
              <AuthButton
                onClick={onLogin}
                label="패스키로 로그인"
              />
            </div>

            <p className="mt-7 text-center text-[12.5px] text-fg-3">
              계정이 없으신가요?{" "}
              <button
                onClick={onLogin}
                className="text-fg-1 hover:underline"
                style={{ fontWeight: 510 }}
              >
                회원가입
              </button>
            </p>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) onLogin();
            }}
            className="flex flex-col gap-3"
          >
            <input
              type="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full bg-transparent outline-none text-[14px] text-fg-1 px-4 py-3 rounded-full focus:border-[rgba(94,106,210,0.5)] transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.1)", fontWeight: 500 }}
            />
            <button
              type="submit"
              className="w-full text-[13.5px] text-white px-4 py-3 rounded-full transition-colors"
              style={{ background: "#5e6ad2", fontWeight: 510 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#828fff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#5e6ad2")}
            >
              인증 링크 보내기
            </button>
            <button
              type="button"
              onClick={() => setStep("choose")}
              className="text-[12.5px] text-fg-3 hover:text-fg-1 transition-colors mt-1"
              style={{ fontWeight: 510 }}
            >
              ← 다른 방법으로 로그인
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-[11px] text-fg-4 leading-[1.5]" style={{ textWrap: "pretty" }}>
          계속 진행하면{" "}
          <span className="text-fg-3">서비스 약관</span> 과{" "}
          <span className="text-fg-3">개인정보 처리방침</span> 에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  );
}

function AuthButton({ icon, label, onClick, primary }) {
  const base = primary
    ? { bg: "#5e6ad2", fg: "#ffffff", bdr: "transparent", hover: "#828fff" }
    : { bg: "#191a1b", fg: "#f7f8f8", bdr: "rgba(255,255,255,0.06)", hover: "#23252a" };
  return (
    <button
      onClick={onClick}
      className="w-full h-11 rounded-full flex items-center justify-center gap-2.5 text-[13.5px] transition-colors relative"
      style={{
        background: base.bg,
        color: base.fg,
        border: `1px solid ${base.bdr}`,
        fontWeight: 510,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = base.hover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = base.bg)}
    >
      <span className="absolute left-5 flex items-center">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function GoogleG() {
  return (
    <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.3 2.4-5.3 0-9.7-3.4-11.3-8L6.2 33C9.6 39.6 16.3 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2C40.6 36 44 30.5 44 24c0-1.3-.1-2.6-.4-3.5z"/>
    </svg>
  );
}

/* =====================================================================
   Setup view — first deployment onboarding
   ===================================================================== */
function SetupView({ onComplete }) {
  const [step, setStep] = useState(1);
  const [repoUrl, setRepoUrl] = useState("");
  const [runtime, setRuntime] = useState("spring");
  const [dbType, setDbType] = useState("postgres");
  const [dbOn, setDbOn] = useState(true);
  const [strategy, setStrategy] = useState("rolling");
  const [replicas, setReplicas] = useState(1);
  const [detecting, setDetecting] = useState(false);

  const handleRepoSubmit = () => {
    if (!repoUrl.trim()) return;
    setDetecting(true);
    setTimeout(() => {
      setDetecting(false);
      setStep(2);
    }, 1500);
  };

  const runtimes = [
    { id: "spring", name: "Java Spring Boot", tag: "3.3.x · JDK 21", color: "#6db33f" },
    { id: "node",   name: "Node.js Express",  tag: "20.x · TypeScript", color: "#83cd29" },
    { id: "python", name: "Python FastAPI",    tag: "3.12 · uvicorn", color: "#3776ab" },
  ];

  return (
    <div className="flex-1 flex items-center justify-center font-sans" style={{ background: "#08090a" }}>
      <div className="w-[520px] max-w-[90vw]">

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2].map((s) => (
            <React.Fragment key={s}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] transition-colors"
                   style={{
                     background: step >= s ? "#5e6ad2" : "rgba(255,255,255,0.06)",
                     color: step >= s ? "#fff" : "#62666d",
                     fontWeight: 590,
                   }}>
                {step > s ? <Icon name="check" size={13} stroke={2} /> : s}
              </div>
              {s < 2 && (
                <div className="flex-1 h-px" style={{ background: step > s ? "#5e6ad2" : "rgba(255,255,255,0.09)" }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {step === 1 && (
          <div className="kd-fade-in">
            <h2 className="text-[22px] text-fg-1 mb-2" style={{ fontWeight: 510, letterSpacing: -0.5 }}>
              GitHub 저장소 연결
            </h2>
            <p className="text-[13px] text-fg-3 mb-6">
              저장소 주소를 입력하면 런타임을 자동으로 감지해요.
            </p>

            <div className="flex gap-2 mb-4">
              <div className="flex-1 flex items-center rounded-lg px-4"
                   style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
                <Icon name="github" size={16} stroke={1.6} className="text-fg-3 mr-3 shrink-0" />
                <input
                  autoFocus
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/repo"
                  className="flex-1 bg-transparent outline-none text-[13px] text-fg-1 py-3 font-mono"
                  style={{ fontWeight: 500 }}
                  onKeyDown={(e) => e.key === "Enter" && handleRepoSubmit()}
                />
              </div>
              <button
                onClick={handleRepoSubmit}
                disabled={!repoUrl.trim() || detecting}
                className="px-5 py-3 rounded-lg text-[13px] text-white transition-colors disabled:opacity-40 shrink-0"
                style={{ background: "#5e6ad2", fontWeight: 510 }}
                onMouseEnter={(e) => !detecting && (e.currentTarget.style.background = "#828fff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#5e6ad2")}
              >
                {detecting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    감지 중
                  </span>
                ) : "연결"}
              </button>
            </div>

            <div className="flex items-center gap-2 text-[12px] text-fg-4">
              <Icon name="lock" size={11} stroke={1.8} />
              비공개 저장소도 지원해요
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="kd-fade-in">
            <h2 className="text-[22px] text-fg-1 mb-1" style={{ fontWeight: 510, letterSpacing: -0.5 }}>
              배포 설정
            </h2>
            <p className="text-[13px] text-fg-3 mb-6">
              저장소를 분석해서 설정을 추천했어요. 필요하면 변경할 수 있어요.
            </p>

            {/* Detected repo info */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg mb-5"
                 style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <Icon name="check-circle" size={15} stroke={1.8} style={{ color: "#10b981" }} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-fg-1 font-mono truncate" style={{ fontWeight: 500 }}>{repoUrl.split("/").slice(-1)[0] || "my-repo"}</div>
                <div className="text-[11px] text-fg-3 mt-0.5">Java Spring Boot 감지됨 · Dockerfile 있음</div>
              </div>
            </div>

            {/* Runtime */}
            <div className="mb-5">
              <div className="text-[10.5px] uppercase tracking-[0.08em] text-fg-3 mb-2.5" style={{ fontWeight: 590 }}>런타임</div>
              <div className="flex flex-col gap-1.5">
                {runtimes.map((r) => {
                  const active = runtime === r.id;
                  return (
                    <button key={r.id} onClick={() => setRuntime(r.id)}
                            className="text-left rounded-lg px-3 py-2.5 flex items-center transition-colors"
                            style={{ background: active ? "rgba(94,106,210,0.08)" : "transparent" }}
                            onMouseEnter={(e) => !active && (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
                            onMouseLeave={(e) => !active && (e.currentTarget.style.background = "transparent")}>
                      <span className="w-2 h-2 rounded-full mr-3 shrink-0"
                            style={{ background: active ? "#7170ff" : "transparent", border: `1.5px solid ${active ? "#7170ff" : "rgba(255,255,255,0.2)"}` }} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] text-fg-1" style={{ fontWeight: 510 }}>{r.name}</span>
                        <span className="block text-[11px] text-fg-4 font-mono mt-0.5">{r.tag}</span>
                      </span>
                      {r.id === "spring" && <span className="text-[10px] text-green-ok" style={{ fontWeight: 510 }}>감지됨</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DB + Strategy row */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="text-[10.5px] uppercase tracking-[0.08em] text-fg-3" style={{ fontWeight: 590 }}>데이터베이스</div>
                  <div className="ml-auto"><Toggle checked={dbOn} onChange={setDbOn} /></div>
                </div>
                {dbOn && (
                  <div className="flex gap-1.5">
                    {[{ id: "postgres", label: "PostgreSQL" }, { id: "mysql", label: "MySQL" }].map((d) => (
                      <button key={d.id} onClick={() => setDbType(d.id)}
                              className="flex-1 py-2.5 rounded-lg text-[12px] transition-colors flex items-center justify-center gap-1.5"
                              style={{
                                background: dbType === d.id ? "rgba(94,106,210,0.12)" : "rgba(255,255,255,0.03)",
                                border: `1px solid ${dbType === d.id ? "rgba(94,106,210,0.25)" : "rgba(255,255,255,0.06)"}`,
                                color: dbType === d.id ? "#a4abee" : "#8a8f98",
                                fontWeight: 510,
                              }}>
                        <Icon name="database" size={12} stroke={1.8} />
                        {d.label}
                      </button>
                    ))}
                  </div>
                )}
                {!dbOn && (
                  <div className="py-2.5 text-center text-[12px] text-fg-4">사용 안 함</div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="text-[10.5px] uppercase tracking-[0.08em] text-fg-3" style={{ fontWeight: 590 }}>배포 전략</div>
                  <div className="ml-auto h-5" />
                </div>
                <div className="flex gap-1.5">
                  {[{ id: "rolling", label: "롤링" }, { id: "recreate", label: "재생성" }].map((s) => (
                    <button key={s.id} onClick={() => setStrategy(s.id)}
                            className="flex-1 py-2.5 rounded-lg text-[12px] transition-colors"
                            style={{
                              background: strategy === s.id ? "rgba(94,106,210,0.12)" : "rgba(255,255,255,0.03)",
                              border: `1px solid ${strategy === s.id ? "rgba(94,106,210,0.25)" : "rgba(255,255,255,0.06)"}`,
                              color: strategy === s.id ? "#a4abee" : "#8a8f98",
                              fontWeight: 510,
                            }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Replicas */}
            <div className="mb-6">
              <div className="text-[10.5px] uppercase tracking-[0.08em] text-fg-3 mb-2.5" style={{ fontWeight: 590 }}>레플리카</div>
              <div className="flex items-center gap-3 px-3">
                <button onClick={() => setReplicas((r) => Math.max(1, r - 1))}
                        className="w-7 h-7 rounded-md text-fg-3 hover:text-fg-1 hover:bg-white/[0.04] transition-colors text-[15px]"
                        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>−</button>
                <span className="text-[15px] font-mono text-fg-1 w-6 text-center" style={{ fontWeight: 510 }}>{replicas}</span>
                <button onClick={() => setReplicas((r) => Math.min(10, r + 1))}
                        className="w-7 h-7 rounded-md text-fg-3 hover:text-fg-1 hover:bg-white/[0.04] transition-colors text-[15px]"
                        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>+</button>
                <span className="text-[11px] text-fg-4">pods</span>
              </div>
            </div>

            {/* Deploy button */}
            <button onClick={onComplete}
                    className="w-full py-3 rounded-lg text-[14px] text-white transition-colors"
                    style={{ background: "#5e6ad2", fontWeight: 510 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#828fff")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#5e6ad2")}>
              첫 배포 시작하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* =====================================================================
   Toast (deploy click feedback)
   ===================================================================== */
function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onClose, 4500);
    return () => clearTimeout(id);
  }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg flex items-center gap-3 max-w-md"
         style={{
           background: "#191a1b",
           border: "1px solid rgba(255,255,255,0.08)",
           boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.4)",
         }}>
      <span className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            style={{ background: "rgba(94,106,210,0.18)" }}>
        <Icon name={toast.icon || "rocket"} size={14} stroke={1.8} className="text-violet-brand" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-fg-1" style={{ fontWeight: 510 }}>{toast.title}</div>
        <div className="text-[12px] text-fg-3 mt-0.5">{toast.detail}</div>
      </div>
      <button onClick={onClose} className="text-fg-3 hover:text-fg-1 transition-colors p-1">
        <Icon name="x" size={13} stroke={1.8} />
      </button>
    </div>
  );
}

/* =====================================================================
   App
   ===================================================================== */
function App() {
  const [mode, setMode] = useState("visitor");
  const [hasProject, setHasProject] = useState(false);
  const [toast, setToast] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);

  const breadcrumb = {
    workspace: "alice-myapp",
    project:   "myapp",
    runtime:   "Spring Boot API",
    replicas:  3,
    version:   "v2.4.1",
  };

  const onLogin = () => {
    setShowLogin(true);
  };

  const completeLogin = () => {
    setShowLogin(false);
    setMode("user");
    setToast({
      icon: "user-check",
      title: "alice 님으로 로그인했어요",
      detail: "이제 본인 서비스 myapp 의 실시간 로그와 설정을 보고 있어요.",
    });
  };

  const handleDeployClick = () => {
    if (mode === "visitor") {
      setToast({
        icon: "sparkles",
        title: "잠깐, 먼저 로그인해주세요",
        detail: "GitHub 저장소를 연결하면 30초 안에 본인 서비스를 띄울 수 있어요.",
      });
    } else {
      setShowDeploy(true);
    }
  };

  const executeDeploy = () => {
    setShowDeploy(false);
    setToast({
      icon: "check-circle",
      title: "myapp v2.4.2 배포를 시작했어요",
      detail: "롤링 업데이트로 3개 pod 를 순차 교체해요. 약 1분 소요 예정.",
    });
  };

  const completeSetup = () => {
    setHasProject(true);
    setToast({
      icon: "check-circle",
      title: "myapp 첫 배포를 시작했어요",
      detail: "Spring Boot + PostgreSQL 환경을 구성하고 있어요. 약 2분 소요 예정.",
    });
  };

  return (
    <div className="h-screen w-screen flex flex-col" style={{ background: "#08090a" }}>
      <TopBar mode={mode} breadcrumb={hasProject ? breadcrumb : null} onLogin={onLogin} onSignup={onLogin} onDeploy={handleDeployClick} showDeploy={mode === "user" && hasProject} />
      <div className="flex-1 min-h-0 flex">
        {mode === "user" && !hasProject ? (
          <SetupView onComplete={completeSetup} />
        ) : (
          <LeftPanel mode={mode} />
        )}
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={completeLogin} />}
      {showDeploy && <DeployModal mode={mode} onClose={() => setShowDeploy(false)} onDeploy={executeDeploy} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
