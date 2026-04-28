/* global React, ReactDOM, lucide */
const { useState, useEffect, useRef, useMemo } = React;

/* =====================================================================
   Lucide icon shim
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
   KoDeploy wordmark — Notion-style: bold, near-black, tight tracking
   ===================================================================== */
function KoDeployMark({ size = 18 }) {
  // Original wordmark: "Ko" black + "Deploy" violet, Geist, tight tracking.
  return (
    <span
      aria-label="KoDeploy"
      style={{
        fontFamily: '"Geist", Inter, sans-serif',
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "-0.045em",
        display: "inline-flex",
        alignItems: "baseline",
        userSelect: "none",
      }}
    >
      <span style={{ color: "rgba(0,0,0,0.95)" }}>Ko</span>
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
   Top bar — Notion marketing-style: sentence-case nav, soft borders
   ===================================================================== */
function TopBar({ mode, breadcrumb, onLogin, onSignup }) {
  const navItems = ["소개", "데모", "문서", "GitHub"];
  const isUser = mode === "user";
  return (
    <header
      className="relative flex items-center h-[52px] px-6 shrink-0 gap-4"
      style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#ffffff" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <KoDeployMark size={18} />
        {isUser && breadcrumb && (
          <>
            <span className="mx-1 text-n-text-3 text-[14px]">/</span>
            <Breadcrumb {...breadcrumb} />
          </>
        )}
      </div>

      {isUser ? (
        <nav className="ml-auto flex items-center gap-1 shrink-0">
          {navItems.map((item) => (
            <a
              key={item}
              href="#"
              onClick={(e) => e.preventDefault()}
              className="px-2.5 py-1.5 rounded-[5px] text-[14px] text-n-text-2 hover:text-n-text hover:bg-black/[0.04] transition-colors flex items-center gap-1"
              style={{ fontWeight: 500 }}
            >
              {item}
              {item === "GitHub" && <Icon name="arrow-up-right" size={11} stroke={1.8} className="text-n-text-3" />}
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
              className="px-3 py-1.5 rounded-[5px] text-[14px] text-n-text hover:bg-black/[0.04] transition-colors flex items-center gap-1.5"
              style={{ fontWeight: 500 }}
            >
              {item}
              {item === "GitHub" && <Icon name="arrow-up-right" size={11} stroke={1.8} className="text-n-text-3" />}
            </a>
          ))}
        </nav>
      )}

      <div className={`${isUser ? "" : "ml-auto"} flex items-center gap-2 shrink-0`}>
        {mode === "visitor" ? (
          <>
            <button
              onClick={onLogin}
              className="text-[14px] text-n-text-2 hover:text-n-text px-3 py-1.5 rounded-[4px] transition-colors n-btn-press"
              style={{ fontWeight: 500 }}
            >
              로그인
            </button>
            <button
              onClick={onSignup || onLogin}
              className="text-[13.5px] px-3.5 py-1.5 rounded-[4px] transition-colors n-btn-press"
              style={{ background: "#0075de", color: "#fff", fontWeight: 600 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#005bab")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#0075de")}
            >
              회원가입
            </button>
          </>
        ) : (
          <UserMenu />
        )}
      </div>
    </header>
  );
}

function Breadcrumb({ workspace, project, runtime, replicas, version }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[14px]">📦</span>
      <span className="text-[13.5px] text-n-text-2" style={{ fontWeight: 500 }}>{workspace}</span>
      <span className="text-n-text-3">/</span>
      <span className="text-[13.5px] text-n-text" style={{ fontWeight: 600 }}>{project}</span>
      <span className="ml-1 text-n-text-3 text-[12px]">·</span>
      <span className="text-[12.5px] text-n-text-2">{runtime}</span>
      <span className="text-n-text-3 text-[12px]">·</span>
      <span className="text-[12.5px] text-n-text-2">{replicas} replicas</span>
      <span className="text-n-text-3 text-[12px]">·</span>
      <span className="px-1.5 py-0.5 rounded-[4px] text-[11.5px] font-mono text-n-blue"
            style={{ background: "#f2f9ff" }}>
        {version}
      </span>
    </div>
  );
}

function UserMenu() {
  return (
    <button className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-[5px] hover:bg-black/[0.04] transition-colors">
      <span
        className="w-[22px] h-[22px] rounded-[5px] flex items-center justify-center text-[12px] text-white"
        style={{ background: "#0075de", fontWeight: 700 }}
      >
        A
      </span>
      <span className="text-[13.5px] text-n-text" style={{ fontWeight: 500 }}>alice</span>
      <Icon name="chevron-down" size={12} className="text-n-text-3" stroke={1.8} />
    </button>
  );
}

/* =====================================================================
   Left panel
   ===================================================================== */
function LeftPanel({ mode }) {
  const [tab, setTab] = useState("terminal");
  const [split, setSplit] = useState(false);

  const tabs = [
    { id: "terminal",   label: "터미널",          count: 1, icon: "terminal" },
    { id: "monitoring", label: "모니터링",        count: 2, icon: "activity" },
    { id: "korean",     label: "한글 에러 로그",  count: 3, icon: "languages" },
  ];

  return (
    <div className="flex-1 min-w-0 flex flex-col"
         style={{ background: "#ffffff", borderRight: "1px solid rgba(0,0,0,0.06)" }}>

      {/* Tab bar */}
      <div className="flex items-center h-[42px] pl-3 pr-3 shrink-0"
           style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="flex items-stretch h-full">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="relative flex items-center gap-2 px-3 h-full text-[13.5px] transition-colors"
                style={{
                  color: active ? "rgba(0,0,0,0.95)" : "#615d59",
                  fontWeight: active ? 600 : 500,
                }}
              >
                <Icon name={t.icon} size={13} stroke={1.8} />
                <span>{t.label}</span>
                <span
                  className="px-1.5 rounded-[4px] text-[10.5px] font-mono"
                  style={{
                    background: active ? "#f2f9ff" : "rgba(0,0,0,0.04)",
                    color: active ? "#0075de" : "#a39e98",
                    fontWeight: 500,
                  }}
                >
                  {t.count}
                </span>
                {active && (
                  <span className="absolute left-2 right-2 -bottom-px h-[2px]"
                        style={{ background: "#0075de" }} />
                )}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[12.5px] text-n-text-2 cursor-pointer hover:text-n-text transition-colors"
                 style={{ fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={split}
              onChange={(e) => setSplit(e.target.checked)}
              className="appearance-none w-3.5 h-3.5 rounded-[3px] cursor-pointer"
              style={{
                border: "1.5px solid " + (split ? "#0075de" : "rgba(0,0,0,0.25)"),
                background: split ? "#0075de" : "transparent",
              }}
            />
            분할
          </label>
          <button className="p-1 rounded-[4px] hover:bg-black/[0.04] text-n-text-2 hover:text-n-text transition-colors">
            <Icon name="search" size={14} stroke={1.8} />
          </button>
          <button className="p-1 rounded-[4px] hover:bg-black/[0.04] text-n-text-2 hover:text-n-text transition-colors">
            <Icon name="more-horizontal" size={14} stroke={1.8} />
          </button>
        </div>
      </div>

      {/* Visitor demo banner */}
      {mode === "visitor" && (
        <div
          className="flex items-center gap-2 px-4 py-2 shrink-0"
          style={{
            background: "#fff7ed",
            borderBottom: "1px solid rgba(221,91,0,0.12)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full n-live-dot" style={{ background: "#dd5b00" }} />
          <span className="text-[12.5px]" style={{ color: "#dd5b00", fontWeight: 600 }}>
            데모 화면
          </span>
          <span className="text-[12.5px] text-n-text-2">
            로그인하면 본인 서비스의 실시간 로그를 볼 수 있어요.
          </span>
          <button className="ml-auto text-[12.5px] text-n-blue hover:text-n-blue-dark hover:underline transition-colors"
                  style={{ fontWeight: 500 }}>
            로그인 →
          </button>
        </div>
      )}

      {/* Tab body */}
      <div className={`flex-1 min-h-0 ${split ? "grid grid-cols-2" : ""}`}
           style={split ? { borderTop: "1px solid rgba(0,0,0,0.04)" } : {}}>
        <div className="min-h-0 flex flex-col"
             style={split ? { borderRight: "1px solid rgba(0,0,0,0.06)" } : {}}>
          {tab === "terminal"   && <TerminalView mode={mode} paneId="L" defaultTarget="was" />}
          {tab === "monitoring" && <MonitoringView mode={mode} />}
          {tab === "korean"     && <KoreanErrorView mode={mode} />}
        </div>
        {split && (
          <div className="min-h-0 flex flex-col">
            {tab === "terminal"   && <TerminalView mode={mode} paneId="R" defaultTarget="db" />}
            {tab === "monitoring" && <TerminalView mode={mode} paneId="R" defaultTarget="was" />}
            {tab === "korean"     && <TerminalView mode={mode} paneId="R" defaultTarget="was" />}
          </div>
        )}
      </div>

      <MiniStatusBar mode={mode} />
    </div>
  );
}

/* =====================================================================
   Terminal view — Notion code-block style: warm white bg, mono, soft border
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
      case "INFO":  return "#0075de";
      case "DEBUG": return "#a39e98";
      case "WARN":  return "#dd5b00";
      case "ERROR": return "#c92a2a";
      case "LOG":   return "#2a9d99";
      default:      return "#615d59";
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* terminal toolbar */}
      <div className="flex items-center gap-2 px-4 h-[34px] shrink-0 relative"
           style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", background: "#fafaf9" }}>
        <span className="w-1.5 h-1.5 rounded-full n-live-dot"
              style={{ background: target === "db" ? "#2a9d99" : "#1aae39" }} />
        <button
          onClick={() => setPickerOpen((o) => !o)}
          className="flex items-center gap-1.5 text-[12px] text-n-text-2 hover:text-n-text transition-colors px-2 py-0.5 rounded-[4px]"
          style={{ fontWeight: 500 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <Icon name={target === "db" ? "database" : "server"} size={12} stroke={1.8}
                style={{ color: target === "db" ? "#2a9d99" : "#0075de" }} />
          <span className="font-mono">
            {target === "db"
              ? (mode === "user" ? "postgres-0 · 15.3" : "demo-postgres")
              : (mode === "user" ? "myapp-7d8c · pod-0" : "demo-pod-3a2")}
          </span>
          <span className="text-n-text-3">·</span>
          <span style={{ color: "#1aae39" }}>● live</span>
          <Icon name="chevron-down" size={11} stroke={1.8} className="text-n-text-3" />
        </button>
        {pickerOpen && (
          <div className="absolute left-3 top-9 z-20 rounded-[8px] min-w-[240px] py-1.5"
               style={{
                 background: "#ffffff",
                 border: "1px solid rgba(0,0,0,0.1)",
                 boxShadow: "rgba(0,0,0,0.01) 0px 1px 3px, rgba(0,0,0,0.02) 0px 3px 7px, rgba(0,0,0,0.02) 0px 7px 15px, rgba(0,0,0,0.04) 0px 14px 28px, rgba(0,0,0,0.05) 0px 23px 52px",
               }}>
            <div className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-n-text-3"
                 style={{ fontWeight: 600 }}>
              연결할 대상
            </div>
            {[
              { id: "was", icon: "server",   name: mode === "user" ? "WAS — myapp-7d8c" : "WAS — demo-pod",   sub: "Spring Boot · pod-0", color: "#0075de" },
              { id: "db",  icon: "database", name: mode === "user" ? "DB — postgres-0"  : "DB — demo-postgres", sub: "PostgreSQL 15.3",       color: "#2a9d99" },
            ].map((opt) => {
              const active = target === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => { setTarget(opt.id); setPickerOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
                  style={{ background: active ? "#f2f9ff" : "transparent" }}
                  onMouseEnter={(e) => !active && (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
                  onMouseLeave={(e) => !active && (e.currentTarget.style.background = "transparent")}
                >
                  <Icon name={opt.icon} size={14} stroke={1.8} style={{ color: opt.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-n-text" style={{ fontWeight: 500 }}>{opt.name}</div>
                    <div className="text-[11.5px] text-n-text-3 font-mono">{opt.sub}</div>
                  </div>
                  {active && <Icon name="check" size={13} stroke={2} style={{ color: "#0075de" }} />}
                </button>
              );
            })}
          </div>
        )}
        <span className="text-[10.5px] text-n-text-3 font-mono ml-1">[{paneId}]</span>
        <span className="ml-auto flex items-center gap-3">
          <button className="text-[12px] text-n-text-2 hover:text-n-text transition-colors flex items-center gap-1"
                  style={{ fontWeight: 500 }}>
            <Icon name="filter" size={12} stroke={1.8} /> 필터
          </button>
          <button className="text-[12px] text-n-text-2 hover:text-n-text transition-colors flex items-center gap-1"
                  style={{ fontWeight: 500 }}>
            <Icon name="download" size={12} stroke={1.8} /> 내보내기
          </button>
        </span>
      </div>

      {/* terminal body — Notion code-block aesthetic */}
      <div ref={scrollRef}
           className="flex-1 min-h-0 overflow-auto scroll-thin px-5 py-3 font-mono text-[12.5px] leading-[1.7]"
           style={{ background: "#f6f5f4" }}>
        {lines.map((l, i) => {
          const prev = i > 0 ? lines[i - 1] : null;
          const showDay = !prev || prev.d !== l.d;
          return (
          <React.Fragment key={i}>
            {showDay && (
              <div className="flex items-center gap-3 my-2 text-n-text-3 select-none whitespace-pre">
                <span className="flex-1" style={{ borderTop: "1px dashed rgba(0,0,0,0.1)" }} />
                <span className="text-[11px] tracking-wider">{l.d}</span>
                <span className="flex-1" style={{ borderTop: "1px dashed rgba(0,0,0,0.1)" }} />
              </div>
            )}
            <div className="n-log-line flex gap-3 whitespace-pre">
              <span className="text-n-text-3 shrink-0">{l.t}{l.t.includes(" KST") ? "" : " KST"}</span>
              <span className="shrink-0" style={{ color: lvlColor(l.lvl), fontWeight: 600, width: 44 }}>
                {l.lvl}
              </span>
              <span className="text-n-text break-all" style={{ whiteSpace: "pre-wrap" }}>{l.msg}</span>
            </div>
          </React.Fragment>
          );
        })}
        <div className="flex items-center gap-2 mt-1">
          <span style={{ color: "#0075de" }}>$</span>
          <span className="inline-block w-2 h-3.5" style={{ background: "#0075de", animation: "n-pulse 1.1s steps(2) infinite" }} />
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   Monitoring view
   ===================================================================== */
function MonitoringView({ mode }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1500);
    return () => clearInterval(id);
  }, []);

  const cpuSeries = useMemo(() => makeSeries(60, mode === "user" ? 42 : 28, 14, tick, "cpu"), [tick, mode]);
  const ramSeries = useMemo(() => makeSeries(60, mode === "user" ? 62 : 35, 8, tick, "ram"), [tick, mode]);
  const reqSeries = useMemo(() => makeSeries(60, mode === "user" ? 88 : 12, 30, tick, "req"), [tick, mode]);

  return (
    <div className="flex-1 min-h-0 overflow-auto scroll-thin p-7" style={{ background: "#ffffff" }}>
      <div className="grid grid-cols-2 gap-5 mb-6">
        <Stat label="CPU 사용률"      value={mode === "user" ? "42%" : "28%"} sub={mode === "user" ? "정상 운영 중" : "데모 환경"} ok />
        <Stat label="메모리"           value={mode === "user" ? "318/512 MiB" : "180/512 MiB"} sub={mode === "user" ? "62% — 안정적" : "35%"} ok />
        <Stat label="요청 / 분"        value={mode === "user" ? "88 rpm" : "12 rpm"} sub={mode === "user" ? "지난 시간 대비 +14%" : "데모 트래픽"} />
        <Stat label="평균 응답시간"    value={mode === "user" ? "12 ms" : "8 ms"} sub="P95 36 ms" ok />
      </div>

      <ChartCard title="CPU" subtitle="최근 5분" color="#0075de" series={cpuSeries} unit="%" max={100} />
      <ChartCard title="메모리 (MiB)" subtitle="최근 5분" color="#1aae39" series={ramSeries.map((v) => v * 5.12)} unit=" MiB" max={512} />
      <ChartCard title="요청 / 분" subtitle="최근 5분" color="#2a9d99" series={reqSeries} unit=" rpm" max={150} />
    </div>
  );
}

function Stat({ label, value, sub, ok }) {
  return (
    <div className="rounded-[8px] p-4"
         style={{ border: "1px solid rgba(0,0,0,0.1)", background: "#fff" }}>
      <div className="text-[11px] uppercase tracking-[0.06em] text-n-text-3 mb-2" style={{ fontWeight: 600 }}>{label}</div>
      <div className="text-[26px] text-n-text mb-1" style={{ fontWeight: 700, letterSpacing: -0.5 }}>{value}</div>
      <div className="flex items-center gap-1.5 text-[12.5px] text-n-text-2">
        {ok && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#1aae39" }} />}
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
    <div className="py-4 mb-3 rounded-[8px] px-4"
         style={{ border: "1px solid rgba(0,0,0,0.1)", background: "#fff" }}>
      <div className="flex items-baseline mb-3">
        <span className="text-[11px] uppercase tracking-[0.06em] text-n-text-3" style={{ fontWeight: 600 }}>{title}</span>
        <span className="ml-3 text-[11.5px] text-n-text-3">{subtitle}</span>
        <span className="ml-auto text-[12.5px] font-mono text-n-text" style={{ fontWeight: 500 }}>
          {Math.round(series[series.length - 1])}{unit}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <defs>
          <linearGradient id={`g-${title}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.18" />
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
   Korean error log view — Notion callout-style cards
   ===================================================================== */
function KoreanErrorView({ mode }) {
  const items = mode === "visitor" ? KOREAN_ERRORS_VISITOR : KOREAN_ERRORS_USER;
  const [expanded, setExpanded] = useState(null);
  return (
    <div className="flex-1 min-h-0 overflow-auto scroll-thin" style={{ background: "#ffffff" }}>
      <div className="flex items-center gap-2 px-6 py-3 sticky top-0 z-10"
           style={{ background: "rgba(255,255,255,0.94)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <span className="text-[14px]">🪄</span>
        <span className="text-[12.5px] text-n-text-2" style={{ fontWeight: 600 }}>
          AI 요약
        </span>
        <span className="ml-auto text-[12px] text-n-text-3 font-mono">{items.length} 건</span>
      </div>

      <div className="flex flex-col px-4 py-3 gap-2.5">
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
        <div className="mx-4 mt-3 mb-6 px-4 py-3 flex items-center gap-3 rounded-[8px]"
             style={{ background: "#f6f5f4" }}>
          <span className="text-[14px]">💡</span>
          <p className="text-[13px] text-n-text-2" style={{ textWrap: "pretty" }}>
            본인 서비스의 에러도 한국어로 요약해드려요.
          </p>
          <button className="ml-auto text-[12.5px] text-n-blue hover:text-n-blue-dark hover:underline transition-colors" style={{ fontWeight: 500 }}>
            로그인 →
          </button>
        </div>
      )}
    </div>
  );
}

function KoreanErrorCard({ item, expanded, onToggle }) {
  const tone = {
    error: { fg: "#c92a2a", bg: "#fff5f5", emoji: "🚨", label: "에러" },
    warn:  { fg: "#dd5b00", bg: "#fff7ed", emoji: "⚠️", label: "경고" },
    info:  { fg: "#0075de", bg: "#f2f9ff", emoji: "💬", label: "정보" },
  }[item.severity] || {};
  return (
    <button
      onClick={onToggle}
      className="text-left rounded-[8px] transition-colors group overflow-hidden"
      style={{ background: tone.bg, border: "1px solid rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="text-[16px] mt-0.5 shrink-0">{tone.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] uppercase tracking-[0.08em] font-mono shrink-0" style={{ color: tone.fg, fontWeight: 700 }}>
              {tone.label}
            </span>
            <span className="text-[14px] text-n-text truncate" style={{ fontWeight: 600, letterSpacing: -0.1 }}>
              {item.title}
            </span>
            <span className="ml-auto text-[11.5px] text-n-text-3 font-mono shrink-0">{item.when}</span>
          </div>

          <div className="mt-1 text-[13px] text-n-text leading-[1.55]" style={{ textWrap: "pretty" }}>
            {item.summary}
          </div>

          {expanded && (
            <div className="mt-3 flex flex-col gap-2.5">
              <div className="text-[12.5px] text-n-text-2 leading-[1.6]" style={{ textWrap: "pretty" }}>
                {item.detail}
              </div>
              <div className="font-mono text-[11.5px] text-n-text-3 px-2.5 py-2 rounded-[5px]"
                   style={{ background: "rgba(0,0,0,0.04)" }}>
                {item.related}
              </div>
              {item.action && (
                <div className="flex items-center gap-3 mt-1">
                  <span
                    className="text-[12.5px] hover:underline transition-colors flex items-center gap-1.5"
                    style={{ color: "#0075de", fontWeight: 600 }}
                  >
                    {item.action} →
                  </span>
                  <span className="text-[12.5px] text-n-text-2 hover:text-n-text hover:underline transition-colors" style={{ fontWeight: 500 }}>
                    스택트레이스
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
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
    <div className="flex items-center gap-5 h-8 px-4 shrink-0 text-[11.5px] font-mono"
         style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#fafaf9", color: "#615d59" }}>
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full"
              style={{ background: mode === "user" ? "#1aae39" : "#dd5b00" }} />
        <span style={{ color: "rgba(0,0,0,0.85)", fontWeight: 500 }}>{data.podText}</span>
      </div>
      <Bar label="CPU" pct={data.cpu} color="#0075de" suffix={`${data.cpu}%`} />
      <Bar label="RAM" pct={data.ram} color="#1aae39" suffix={data.ramText} />
      <span className="ml-auto flex items-center gap-3">
        <span>env <span style={{ color: "rgba(0,0,0,0.85)", fontWeight: 500 }}>{data.env}</span></span>
        <span>region <span style={{ color: "rgba(0,0,0,0.85)", fontWeight: 500 }}>ap-northeast-2</span></span>
        <span>k8s 1.30</span>
      </span>
    </div>
  );
}

function Bar({ label, pct, color, suffix }) {
  return (
    <div className="flex items-center gap-2">
      <span>{label}</span>
      <span className="w-16 h-1.5 rounded-full overflow-hidden"
            style={{ background: "rgba(0,0,0,0.06)" }}>
        <span className="block h-full transition-[width] duration-700"
              style={{ width: `${pct}%`, background: color }} />
      </span>
      <span style={{ color: "rgba(0,0,0,0.85)", fontWeight: 500 }}>{suffix}</span>
    </div>
  );
}

/* =====================================================================
   Right panel — Notion sidebar aesthetic
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
           style={{ background: "#f9f8f7", borderLeft: "1px solid rgba(0,0,0,0.06)" }}>

      {/* Header */}
      <div className="flex items-center h-[42px] px-4 shrink-0"
           style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <span className="text-[14px] mr-2">⚙️</span>
        <span className="text-[13.5px] text-n-text" style={{ fontWeight: 600 }}>배포 설정</span>
        <span className="ml-2 text-[12px] text-n-text-3">Deploy</span>
        <button className="ml-auto p-1 rounded-[4px] text-n-text-2 hover:text-n-text hover:bg-black/[0.04] transition-colors"
                onClick={() => setCollapsed((c) => !c)}>
          <Icon name={collapsed ? "chevron-down" : "chevron-up"} size={14} stroke={1.8} />
        </button>
      </div>

      {!collapsed && (
        <div className={`flex-1 min-h-0 overflow-auto scroll-thin px-4 py-4 transition-opacity ${disabled ? "opacity-75" : ""}`}>

          {mode === "user" && (
            <div className="mb-5 pb-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <Field label="프로젝트">
                <input
                  className="w-full bg-transparent outline-none text-[13.5px] text-n-text py-1.5 px-2 rounded-[4px]"
                  style={{ border: "1px solid rgba(0,0,0,0.1)", fontWeight: 500 }}
                  defaultValue="alice-myapp"
                  disabled={disabled}
                />
              </Field>
              <Field label="도메인">
                <div className="flex items-center py-1.5 px-2 rounded-[4px]"
                     style={{ border: "1px solid rgba(0,0,0,0.1)", background: "#fff" }}>
                  <span className="text-[13px] text-n-text-2 font-mono">{domain}</span>
                  <button className="ml-auto text-[11.5px] text-n-blue hover:text-n-blue-dark hover:underline transition-colors"
                          style={{ fontWeight: 500 }}>변경</button>
                </div>
              </Field>
            </div>
          )}

          <Section title="런타임" subtitle="Runtime">
            <RuntimeOption
              id="spring"  current={runtime} onChange={setRuntime} disabled={disabled}
              name="Java Spring Boot" tag="3.3.x · JDK 21"
            />
            <RuntimeOption
              id="node"    current={runtime} onChange={setRuntime} disabled={disabled}
              name="Node.js Express" tag="20.x · TypeScript"
            />
            <RuntimeOption
              id="python"  current={runtime} onChange={setRuntime} disabled={disabled}
              name="Python FastAPI" tag="3.12 · uvicorn"
            />
          </Section>

          <Section title="데이터베이스" subtitle="Database">
            <div className="flex items-center px-2 py-2 rounded-[5px]"
                 style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}>
              <span className="text-[16px] mr-2.5">🗄️</span>
              <div className="flex-1">
                <div className="text-[13px] text-n-text" style={{ fontWeight: 500 }}>PostgreSQL</div>
                <div className="text-[11.5px] text-n-text-3 mt-0.5">15.3 · 1 GiB · 일일 자동 백업</div>
              </div>
              <Toggle checked={dbOn} onChange={setDbOn} disabled={disabled} />
            </div>
            <button
              disabled={disabled}
              className="text-[12.5px] text-n-text-2 hover:text-n-text px-2 py-1.5 transition-colors flex items-center gap-1.5 text-left rounded-[4px] hover:bg-black/[0.03]"
              style={{ fontWeight: 500 }}
            >
              <Icon name="plus" size={12} stroke={1.8} />
              Redis · S3 · Kafka 추가
            </button>
          </Section>

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

          <Section title="복제본" subtitle="Replicas">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-[4px]"
                 style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)" }}>
              <button
                disabled={disabled || replicas <= 1}
                onClick={() => setReplicas((r) => Math.max(1, r - 1))}
                className="w-6 h-6 rounded-[3px] text-n-text-2 hover:text-n-text hover:bg-black/[0.04] transition-colors disabled:opacity-30 flex items-center justify-center"
              >−</button>
              <div className="text-[14px] text-n-text font-mono w-8 text-center" style={{ fontWeight: 600 }}>
                {replicas}
              </div>
              <button
                disabled={disabled}
                onClick={() => setReplicas((r) => Math.min(10, r + 1))}
                className="w-6 h-6 rounded-[3px] text-n-text-2 hover:text-n-text hover:bg-black/[0.04] transition-colors disabled:opacity-30 flex items-center justify-center"
              >+</button>
              <span className="text-[11.5px] text-n-text-3 ml-1">pods</span>
            </div>
          </Section>

          <Section title="환경 변수" subtitle="Environment">
            <EnvVarsEditor disabled={disabled} mode={mode} />
          </Section>

          <Section title="배포 소스" subtitle="Source">
            <div className="flex items-center gap-2 px-2 py-2 rounded-[5px]"
                 style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}>
              <Icon name="git-branch" size={13} className="text-n-text-2" stroke={1.8} />
              <span className="font-mono text-[12px] text-n-text">main</span>
              <span className="text-n-text-3 text-[11px]">@</span>
              <span className="font-mono text-[12px] text-n-text-2">{mode === "user" ? "9c4e2a1" : "demo000"}</span>
              <span className="ml-auto text-[11px] text-n-text-3">
                {mode === "user" ? "12분 전" : "데모"}
              </span>
            </div>
          </Section>
        </div>
      )}

      {/* Sticky action bar */}
      <div className="px-4 py-3 shrink-0 flex flex-col gap-2"
           style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#f9f8f7" }}>
        {mode === "user" && (
          <div className="flex items-center gap-2 text-[11.5px] text-n-text-3 mb-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#1aae39" }} />
            마지막 배포: 2시간 전 · v2.4.1 · 정상 운영 중
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            disabled={disabled}
            className="flex-1 h-9 rounded-[4px] text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 n-btn-press"
            style={{
              background: "rgba(0,0,0,0.05)",
              color: "rgba(0,0,0,0.95)",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(0,0,0,0.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
          >
            업데이트
          </button>
          <button
            onClick={onDeploy}
            className="flex-1 h-9 rounded-[4px] text-[13px] text-white transition-colors flex items-center justify-center gap-1.5 n-btn-press"
            style={{ background: "#0075de", fontWeight: 600 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#005bab")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#0075de")}
          >
            {mode === "user" ? (
              <>
                <Icon name="rocket" size={13} stroke={1.8} />
                배포
              </>
            ) : (
              <>
                <Icon name="arrow-right" size={13} stroke={1.8} />
                지금 시작하기
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div className="mb-5">
      <div className="text-[11px] uppercase tracking-[0.06em] text-n-text-3 mb-2.5 px-1" style={{ fontWeight: 600 }}>
        {title}
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <div className="text-[11.5px] text-n-text-2 mb-1.5" style={{ fontWeight: 500 }}>{label}</div>
      {children}
    </div>
  );
}

function RuntimeOption({ id, current, onChange, name, tag, disabled }) {
  const active = current === id;
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(id)}
      className="text-left rounded-[5px] px-2.5 py-2 flex items-center transition-colors"
      style={{
        background: active ? "#fff" : "transparent",
        border: active ? "1px solid #0075de" : "1px solid transparent",
        boxShadow: active ? "0 0 0 3px rgba(0,117,222,0.08)" : "none",
      }}
      onMouseEnter={(e) => !disabled && !active && (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
      onMouseLeave={(e) => !active && (e.currentTarget.style.background = "transparent")}
    >
      <span className="w-3.5 h-3.5 rounded-full mr-2.5 shrink-0 flex items-center justify-center"
            style={{
              border: `1.5px solid ${active ? "#0075de" : "rgba(0,0,0,0.25)"}`,
            }}>
        {active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#0075de" }} />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] text-n-text truncate" style={{ fontWeight: 500 }}>{name}</span>
        <span className="block text-[11.5px] text-n-text-3 truncate font-mono mt-0.5">{tag}</span>
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
      className="text-left rounded-[5px] px-2.5 py-2 transition-colors"
      style={{
        background: active ? "#fff" : "transparent",
        border: active ? "1px solid #0075de" : "1px solid transparent",
        boxShadow: active ? "0 0 0 3px rgba(0,117,222,0.08)" : "none",
      }}
      onMouseEnter={(e) => !disabled && !active && (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
      onMouseLeave={(e) => !active && (e.currentTarget.style.background = "transparent")}
    >
      <div className="flex items-center mb-1">
        <span className="w-3.5 h-3.5 rounded-full mr-2.5 shrink-0 flex items-center justify-center"
              style={{
                border: `1.5px solid ${active ? "#0075de" : "rgba(0,0,0,0.25)"}`,
              }}>
          {active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#0075de" }} />}
        </span>
        <span className="text-[13px] text-n-text" style={{ fontWeight: 500 }}>{name}</span>
        {recommended && (
          <span className="ml-2 text-[10.5px] px-1.5 py-0.5 rounded-[9999px]"
                style={{ background: "#f2f9ff", color: "#0075de", fontWeight: 600, letterSpacing: 0.125 }}>
            추천
          </span>
        )}
      </div>
      <div className="text-[11.5px] text-n-text-2 ml-[24px] leading-[1.55]" style={{ textWrap: "pretty" }}>
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
      <div className="flex flex-col rounded-[5px] overflow-hidden"
           style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}>
        {vars.map((row, i) => (
          <div key={i} className="flex items-center gap-2 group px-2.5 py-1.5 hover:bg-black/[0.02] transition-colors"
               style={{ borderBottom: i < vars.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
            <input
              disabled={disabled}
              value={row.k}
              onChange={(e) => update(i, { k: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })}
              placeholder="KEY"
              className="w-[44%] bg-transparent outline-none text-[12px] font-mono text-n-text"
              style={{ fontWeight: 500 }}
            />
            <span className="text-n-text-3 text-[12px]">=</span>
            <div className="flex-1 min-w-0 flex items-center">
              <input
                disabled={disabled}
                type={row.secret && !reveal[i] ? "password" : "text"}
                value={row.v}
                onChange={(e) => update(i, { v: e.target.value })}
                placeholder="value"
                className="flex-1 min-w-0 bg-transparent outline-none text-[12px] font-mono text-n-text-2"
              />
              {row.secret && (
                <button
                  disabled={disabled}
                  onClick={() => setReveal((r) => ({ ...r, [i]: !r[i] }))}
                  className="p-1 text-n-text-3 hover:text-n-text-2 transition-colors opacity-0 group-hover:opacity-100"
                  title={reveal[i] ? "숨기기" : "보기"}
                >
                  <Icon name={reveal[i] ? "eye-off" : "eye"} size={11} stroke={1.8} />
                </button>
              )}
            </div>
            <button
              disabled={disabled}
              onClick={() => update(i, { secret: !row.secret })}
              className="p-1 text-n-text-3 hover:text-n-text-2 transition-colors"
              title={row.secret ? "비밀" : "공개"}
            >
              <Icon name={row.secret ? "lock" : "lock-open"} size={11} stroke={1.8} />
            </button>
            <button
              disabled={disabled}
              onClick={() => remove(i)}
              className="p-1 text-n-text-3 transition-colors opacity-0 group-hover:opacity-100"
              title="삭제"
              style={{ color: undefined }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#c92a2a")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "")}
            >
              <Icon name="x" size={11} stroke={1.8} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 px-2 mt-2">
        <button
          disabled={disabled}
          onClick={add}
          className="text-[12.5px] text-n-text-2 hover:text-n-text transition-colors flex items-center gap-1.5"
          style={{ fontWeight: 500 }}
        >
          <Icon name="plus" size={11} stroke={1.8} />
          변수 추가
        </button>
        <span className="text-n-text-3">·</span>
        <button
          disabled={disabled}
          className="text-[12.5px] text-n-text-2 hover:text-n-text transition-colors flex items-center gap-1.5"
          style={{ fontWeight: 500 }}
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
      className="w-[34px] h-[20px] rounded-full transition-colors relative shrink-0 disabled:cursor-not-allowed"
      style={{
        background: checked ? "#0075de" : "rgba(0,0,0,0.15)",
      }}
    >
      <span
        className="absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white transition-transform"
        style={{
          left: 2,
          transform: checked ? "translateX(14px)" : "translateX(0)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
        }}
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
      className="fixed bottom-4 left-4 z-40 flex items-center gap-1 p-1 rounded-[9999px]"
      style={{
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.1)",
        boxShadow: "rgba(0,0,0,0.04) 0px 4px 18px, rgba(0,0,0,0.027) 0px 2.025px 7.84688px",
      }}
    >
      <span className="px-2 text-[10.5px] text-n-text-3 font-mono uppercase tracking-wider" style={{ fontWeight: 600 }}>dev</span>
      {[
        { id: "visitor", label: "방문자", icon: "user" },
        { id: "user",    label: "사용자", icon: "user-check" },
      ].map((opt) => {
        const active = mode === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[9999px] text-[12px] transition-colors n-btn-press"
            style={{
              background: active ? (opt.id === "user" ? "#0075de" : "rgba(0,0,0,0.06)") : "transparent",
              color: active ? (opt.id === "user" ? "#fff" : "rgba(0,0,0,0.95)") : "#615d59",
              fontWeight: 500,
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
   Login modal — Notion-style: white card, deep ambient shadow
   ===================================================================== */
function LoginModal({ onClose, onLogin }) {
  const [step, setStep] = useState("choose");
  const [email, setEmail] = useState("");

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
      className="fixed inset-0 z-50 flex items-center justify-center n-fade-in"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="relative w-[420px] max-w-[92vw] px-10 pt-12 pb-9 rounded-[12px]"
        style={{
          background: "#ffffff",
          boxShadow: "rgba(0,0,0,0.01) 0px 1px 3px, rgba(0,0,0,0.02) 0px 3px 7px, rgba(0,0,0,0.02) 0px 7px 15px, rgba(0,0,0,0.04) 0px 14px 28px, rgba(0,0,0,0.05) 0px 23px 52px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-[5px] text-n-text-3 hover:text-n-text hover:bg-black/[0.04] transition-colors flex items-center justify-center"
          aria-label="닫기"
        >
          <Icon name="x" size={14} stroke={1.8} />
        </button>

        <div className="flex flex-col items-center mb-7">
          <KoDeployMark size={26} />
          <h2
            className="mt-5 text-[22px] text-n-text"
            style={{ fontWeight: 700, letterSpacing: -0.4 }}
          >
            {step === "choose" ? "로그인" : "이메일로 계속하기"}
          </h2>
          {step === "choose" && (
            <p className="mt-1.5 text-[13.5px] text-n-text-2">
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

            <div className="flex items-center gap-3 my-3.5">
              <span className="flex-1 h-px" style={{ background: "rgba(0,0,0,0.08)" }} />
              <span className="text-[11.5px] text-n-text-3" style={{ fontWeight: 500 }}>또는</span>
              <span className="flex-1 h-px" style={{ background: "rgba(0,0,0,0.08)" }} />
            </div>

            <div className="flex flex-col gap-2">
              <AuthButton
                onClick={() => setStep("email")}
                icon={<Icon name="mail" size={15} stroke={1.8} className="text-n-text-2" />}
                label="이메일로 계속하기"
              />
              <AuthButton
                onClick={onLogin}
                icon={<Icon name="key-round" size={15} stroke={1.8} className="text-n-text-2" />}
                label="패스키로 로그인"
              />
            </div>

            <p className="mt-6 text-center text-[13px] text-n-text-2">
              계정이 없으신가요?{" "}
              <button
                onClick={onLogin}
                className="text-n-blue hover:text-n-blue-dark hover:underline"
                style={{ fontWeight: 500 }}
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
              className="w-full bg-white outline-none text-[14px] text-n-text px-3.5 py-2.5 rounded-[4px] transition-colors"
              style={{ border: "1px solid #dddddd", fontWeight: 500 }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#097fe8")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#dddddd")}
            />
            <button
              type="submit"
              className="w-full text-[13.5px] text-white px-4 py-2.5 rounded-[4px] transition-colors n-btn-press"
              style={{ background: "#0075de", fontWeight: 600 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#005bab")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#0075de")}
            >
              인증 링크 보내기
            </button>
            <button
              type="button"
              onClick={() => setStep("choose")}
              className="text-[12.5px] text-n-text-2 hover:text-n-text hover:underline transition-colors mt-1"
              style={{ fontWeight: 500 }}
            >
              ← 다른 방법으로 로그인
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-[11.5px] text-n-text-3 leading-[1.55]" style={{ textWrap: "pretty" }}>
          계속 진행하면{" "}
          <span className="text-n-text-2 hover:text-n-text underline cursor-pointer">서비스 약관</span> 과{" "}
          <span className="text-n-text-2 hover:text-n-text underline cursor-pointer">개인정보 처리방침</span> 에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  );
}

function AuthButton({ icon, label, onClick, primary }) {
  const base = primary
    ? { bg: "#0075de", fg: "#ffffff", bdr: "transparent", hover: "#005bab" }
    : { bg: "#ffffff", fg: "rgba(0,0,0,0.95)", bdr: "rgba(0,0,0,0.1)", hover: "rgba(0,0,0,0.04)" };
  return (
    <button
      onClick={onClick}
      className="w-full h-[42px] rounded-[4px] flex items-center justify-center gap-2.5 text-[13.5px] transition-colors relative n-btn-press"
      style={{
        background: base.bg,
        color: base.fg,
        border: `1px solid ${base.bdr}`,
        fontWeight: primary ? 600 : 500,
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
   Toast
   ===================================================================== */
function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onClose, 4500);
    return () => clearTimeout(id);
  }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-[8px] flex items-center gap-3 max-w-md"
         style={{
           background: "#ffffff",
           border: "1px solid rgba(0,0,0,0.1)",
           boxShadow: "rgba(0,0,0,0.01) 0px 1px 3px, rgba(0,0,0,0.02) 0px 3px 7px, rgba(0,0,0,0.02) 0px 7px 15px, rgba(0,0,0,0.04) 0px 14px 28px, rgba(0,0,0,0.05) 0px 23px 52px",
         }}>
      <span className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0 text-[14px]"
            style={{ background: "#f2f9ff" }}>
        {toast.emoji || "🚀"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] text-n-text" style={{ fontWeight: 600 }}>{toast.title}</div>
        <div className="text-[12.5px] text-n-text-2 mt-0.5" style={{ textWrap: "pretty" }}>{toast.detail}</div>
      </div>
      <button onClick={onClose} className="text-n-text-3 hover:text-n-text transition-colors p-1">
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
  const [toast, setToast] = useState(null);
  const [showLogin, setShowLogin] = useState(false);

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
      emoji: "👋",
      title: "alice 님으로 로그인했어요",
      detail: "이제 본인 서비스 myapp 의 실시간 로그와 설정을 보고 있어요.",
    });
  };

  const onDeploy = () => {
    if (mode === "visitor") {
      setToast({
        emoji: "🪄",
        title: "잠깐, 먼저 로그인해주세요",
        detail: "GitHub 저장소를 연결하면 30초 안에 본인 서비스를 띄울 수 있어요.",
      });
    } else {
      setToast({
        emoji: "🚀",
        title: "myapp v2.4.2 배포를 시작했어요",
        detail: "롤링 업데이트로 3개 pod 를 순차 교체해요. 약 1분 소요 예정.",
      });
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col" style={{ background: "#ffffff" }}>
      <TopBar mode={mode} breadcrumb={breadcrumb} onLogin={onLogin} onSignup={onLogin} />
      <div className="flex-1 min-h-0 flex">
        <LeftPanel mode={mode} />
        <RightPanel mode={mode} onDeploy={onDeploy} />
      </div>

      <ModeToggle mode={mode} onChange={setMode} />
      <Toast toast={toast} onClose={() => setToast(null)} />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={completeLogin} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
