function TerminalView({ mode, paneId = "L", defaultTarget = "was" }) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([
    { type: "system", text: `접속 완료 — ${defaultTarget === "db" ? "postgres-0" : "myapp-7d8c"} (${defaultTarget === "db" ? "PostgreSQL 15.3" : "Spring Boot 3.3"})` },
    { type: "system", text: "셸을 사용하려면 명령어를 입력하세요." },
  ]);
  const scrollRef = useRef(null);

  const podName = defaultTarget === "db"
    ? (mode === "user" ? "postgres-0" : "demo-postgres")
    : (mode === "user" ? "myapp-7d8c-pod-0" : "demo-pod-3a2");

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const cmd = input.trim();
    setInput("");
    const newItems = [{ type: "input", text: cmd }];

    if (cmd === "ls") {
      newItems.push({ type: "output", text: "app.jar  config/  logs/  tmp/" });
    } else if (cmd === "whoami") {
      newItems.push({ type: "output", text: "app" });
    } else if (cmd === "pwd") {
      newItems.push({ type: "output", text: "/app" });
    } else if (cmd === "env" || cmd === "printenv") {
      newItems.push({ type: "output", text: "SPRING_PROFILES_ACTIVE=production\nDB_HOST=postgres-0.internal\nJAVA_HOME=/usr/lib/jvm/java-21\nPOD_NAME=" + podName });
    } else if (cmd.startsWith("cat ")) {
      newItems.push({ type: "output", text: "# 파일 내용 (데모)" });
    } else if (cmd === "exit") {
      newItems.push({ type: "system", text: "세션을 종료했어요. 다시 접속하려면 탭을 닫고 새로 열어주세요." });
    } else if (cmd === "help") {
      newItems.push({ type: "output", text: "사용 가능: ls, pwd, whoami, env, cat, ps, top, exit" });
    } else if (cmd === "ps" || cmd === "ps aux") {
      newItems.push({ type: "output", text: "PID  CMD\n  1  java -jar app.jar\n 42  /bin/sh" });
    } else if (cmd === "top") {
      newItems.push({ type: "output", text: "CPU: 42%  MEM: 318/512 MiB  UPTIME: 3d 14h" });
    } else {
      newItems.push({ type: "error", text: `sh: ${cmd}: command not found` });
    }
    setHistory((prev) => [...prev, ...newItems].slice(-100));
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* toolbar */}
      <div className="flex items-center gap-2 px-4 h-8 shrink-0"
           style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <span className="w-1.5 h-1.5 rounded-full kd-live-dot" style={{ background: "#10b981" }} />
        <span className="text-[11px] font-mono text-fg-2" style={{ fontWeight: 500 }}>
          <Icon name={defaultTarget === "db" ? "database" : "server"} size={11} stroke={1.8}
                style={{ color: defaultTarget === "db" ? "#7fb6db" : "#a4abee", display: "inline-flex", verticalAlign: "middle", marginRight: 6 }} />
          {podName}
        </span>
        <span className="flex items-center gap-1 text-[10px]" style={{ color: "#10b981" }}><span style={{ fontSize: 8 }}>●</span> connected</span>
      </div>

      {/* shell body */}
      <div ref={scrollRef}
           className="flex-1 min-h-0 overflow-auto scroll-thin px-4 py-3 font-mono text-[12.5px] leading-[1.7]"
           style={{ background: "#0a0b0c" }}>
        {history.map((item, i) => (
          <div key={i} className="kd-log-line">
            {item.type === "system" && (
              <span className="text-fg-4 italic">{item.text}</span>
            )}
            {item.type === "input" && (
              <span><span className="text-violet-brand">$ </span><span className="text-fg-1">{item.text}</span></span>
            )}
            {item.type === "output" && (
              <span className="text-fg-2 whitespace-pre-wrap">{item.text}</span>
            )}
            {item.type === "error" && (
              <span className="text-red-err">{item.text}</span>
            )}
          </div>
        ))}
        {/* input line */}
        <form onSubmit={handleSubmit} className="flex items-center gap-1 mt-1">
          <span className="text-violet-brand">$</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent outline-none text-fg-1 text-[12.5px] font-mono"
            autoFocus
            spellCheck={false}
          />
        </form>
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
   Korean error log view — 3 display modes
   ===================================================================== */
function KoreanErrorView({ mode, defaultTarget = "was" }) {
  const [viewMode, setViewMode] = useState("inline"); // "inline" | "incident" | "filter"
  const items = mode === "visitor" ? KOREAN_ERRORS_VISITOR : KOREAN_ERRORS_USER;
  const [expanded, setExpanded] = useState(null);

  const target = defaultTarget;
  const wasBase = mode === "visitor" ? MOCK_LOGS_VISITOR : MOCK_LOGS_USER;
  const dbBase = DB_BASE;
  const base = target === "db" ? dbBase : wasBase;
  const [lines, setLines] = useState(base);
  const scrollRef = useRef(null);

  useEffect(() => {
    setLines(base);
    if (mode !== "user") return;
    const POOL = target === "db" ? DB_POOL : WAS_POOL;
    let n = 0;
    const id = setInterval(() => {
      const pool = POOL[n % POOL.length];
      const day = "2026.04.26";
      const hh = String(Math.floor(n / 360) % 24).padStart(2, "0");
      const mm = String(Math.floor(n / 6) % 60).padStart(2, "0");
      const ss = String((n * 7) % 60).padStart(2, "0");
      const t = `${hh}:${mm}:${ss}`;
      const suffix = pool.msg.endsWith("ord_") ? Math.random().toString(16).slice(2, 6) : "";
      setLines((prev) => [...prev, { d: day, t, lvl: pool.lvl, msg: pool.msg + suffix }].slice(-80));
      n++;
    }, 1700);
    return () => clearInterval(id);
  }, [mode, target]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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

  const podLabel = target === "db"
    ? (mode === "user" ? "postgres-0" : "demo-postgres")
    : (mode === "user" ? "myapp-7d8c" : "demo-pod");

  const viewModes = [
    { id: "inline",   label: "인라인",   desc: "로그 사이에 AI 카드 삽입" },
    { id: "incident", label: "인시던트", desc: "관련 로그를 이벤트로 그룹" },
    { id: "filter",   label: "필터",     desc: "에러/경고만 + AI 설명" },
  ];

  // Find which log lines are WARN/ERROR to insert AI cards near them
  const getAiCardForLog = (log, idx) => {
    if (log.lvl === "WARN" && items.find((it) => it.severity === "warn")) {
      return items.find((it) => it.severity === "warn");
    }
    if (log.lvl === "ERROR" && items.find((it) => it.severity === "error")) {
      return items.find((it) => it.severity === "error");
    }
    return null;
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 h-9 shrink-0"
           style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <span className="w-1.5 h-1.5 rounded-full kd-live-dot"
              style={{ background: target === "db" ? "#7fb6db" : "#10b981" }} />
        <span className="text-[11px] font-mono text-fg-2" style={{ fontWeight: 500 }}>
          {podLabel}
        </span>
        <div className="flex items-center gap-0.5 ml-3">
          {viewModes.map((vm) => (
            <button key={vm.id} onClick={() => setViewMode(vm.id)}
                    className="px-2.5 py-1 rounded text-[11px] transition-colors"
                    title={vm.desc}
                    style={{ background: viewMode === vm.id ? "rgba(94,106,210,0.15)" : "transparent", color: viewMode === vm.id ? "#a4abee" : "#8a8f98", fontWeight: 510 }}>
              {vm.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[10px] text-fg-4">
          {items.filter((it) => it.severity === "error").length > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#ef4444" }} />
              에러 {items.filter((it) => it.severity === "error").length}
            </span>
          )}
        </span>
      </div>

      {/* ─── Mode 1: 인라인 — 로그 스트림에 AI 카드가 끼어듦 ─── */}
      {viewMode === "inline" && (
        <div ref={scrollRef}
             className="flex-1 min-h-0 overflow-auto scroll-thin px-4 py-3 font-mono text-[12.5px] leading-[1.65]"
             style={{ background: "#0f1011" }}>
          {lines.map((l, i) => {
            const aiCard = getAiCardForLog(l, i);
            const prev = i > 0 ? lines[i - 1] : null;
            const showDay = !prev || prev.d !== l.d;
            const prevHadSameLvl = prev && prev.lvl === l.lvl && (l.lvl === "WARN" || l.lvl === "ERROR");
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
                  <span className="text-fg-4 shrink-0">{l.t}</span>
                  <span className="shrink-0" style={{ color: lvlColor(l.lvl), fontWeight: 500, width: 44 }}>{l.lvl}</span>
                  <span className="text-fg-2 break-all" style={{ whiteSpace: "pre-wrap" }}>{l.msg}</span>
                </div>
                {aiCard && !prevHadSameLvl && (
                  <div className="my-2 mx-1 px-3 py-2.5 rounded-lg font-sans text-[12px]"
                       style={{
                         borderLeft: `2px solid ${aiCard.severity === "error" ? "#ef4444" : "#f59e0b"}`,
                         background: aiCard.severity === "error" ? "rgba(239,68,68,0.05)" : "rgba(245,158,11,0.05)",
                       }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon name="sparkles" size={11} stroke={1.8} className="text-violet-brand" />
                      <span className="text-fg-1" style={{ fontWeight: 510 }}>{aiCard.title}</span>
                    </div>
                    <p className="text-fg-3 leading-[1.5] pl-[19px]">{aiCard.summary}</p>
                    {aiCard.action && (
                      <div className="pl-[19px] mt-1.5">
                        <span className="text-[11px] text-violet-brand" style={{ fontWeight: 510 }}>{aiCard.action} →</span>
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* ─── Mode 2: 인시던트 — 관련 로그를 이벤트로 묶음 ─── */}
      {viewMode === "incident" && (
        <div className="flex-1 min-h-0 overflow-auto scroll-thin py-3 px-3">
          {items.map((it, i) => {
            const isOpen = expanded === i;
            const relatedLogs = lines.filter((l) =>
              (it.severity === "error" && l.lvl === "ERROR") ||
              (it.severity === "warn" && l.lvl === "WARN") ||
              (it.severity === "info" && l.msg && it.related && l.msg.includes("Flyway"))
            ).slice(0, 4);
            const tone = { error: { bg: "rgba(239,68,68,0.04)", border: "#ef4444" }, warn: { bg: "rgba(245,158,11,0.04)", border: "#f59e0b" }, info: { bg: "rgba(127,163,255,0.03)", border: "#7fa3ff" } }[it.severity] || {};

            return (
              <div key={i} className="mb-3 rounded-lg overflow-hidden"
                   style={{ border: `1px solid ${tone.border}22`, background: tone.bg }}>
                {/* Event header */}
                <button onClick={() => setExpanded(isOpen ? null : i)}
                        className="w-full text-left px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10.5px] font-mono shrink-0" style={{ color: tone.border, fontWeight: 590 }}>
                        {it.severity === "error" ? "에러" : it.severity === "warn" ? "경고" : "정보"}
                      </span>
                      <span className="text-[13px] text-fg-1 truncate" style={{ fontWeight: 510 }}>{it.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon name="sparkles" size={10} stroke={1.8} className="text-violet-brand shrink-0" />
                      <p className="text-[12px] text-fg-3 truncate">{it.summary}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-fg-4 font-mono shrink-0">{it.when}</span>
                  <Icon name={isOpen ? "chevron-down" : "chevron-right"} size={12} stroke={2} className="text-fg-4 mt-1 shrink-0" />
                </button>

                {/* Expanded: detail + related logs */}
                {isOpen && (
                  <div className="px-4 pb-3 kd-fade-in" style={{ borderTop: `1px solid ${tone.border}15` }}>
                    <p className="text-[12px] text-fg-3 leading-[1.6] py-2">{it.detail}</p>
                    {it.action && (
                      <div className="mb-2">
                        <span className="text-[12px] text-violet-brand" style={{ fontWeight: 510 }}>{it.action} →</span>
                      </div>
                    )}
                    <div className="text-[10.5px] uppercase tracking-[0.06em] text-fg-4 mb-1.5 mt-2" style={{ fontWeight: 590 }}>관련 로그</div>
                    <div className="font-mono text-[11.5px] leading-[1.6] rounded-md px-3 py-2"
                         style={{ background: "rgba(0,0,0,0.3)" }}>
                      {relatedLogs.length > 0 ? relatedLogs.map((l, j) => (
                        <div key={j} className="flex gap-2 whitespace-pre">
                          <span className="text-fg-4">{l.t}</span>
                          <span style={{ color: lvlColor(l.lvl), fontWeight: 500 }}>{l.lvl}</span>
                          <span className="text-fg-2">{l.msg}</span>
                        </div>
                      )) : (
                        <span className="text-fg-4">{it.related}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Mode 3: 필터 — WARN/ERROR만 + AI 설명 ─── */}
      {viewMode === "filter" && (
        <div className="flex-1 min-h-0 overflow-auto scroll-thin">
          {/* Error/Warn count header */}
          <div className="flex items-center gap-4 px-5 py-3 sticky top-0 z-10"
               style={{ background: "rgba(15,16,17,0.95)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: "#ef4444" }} />
              <span className="text-[12px] text-fg-2" style={{ fontWeight: 510 }}>에러 {items.filter((it) => it.severity === "error").length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: "#f59e0b" }} />
              <span className="text-[12px] text-fg-2" style={{ fontWeight: 510 }}>경고 {items.filter((it) => it.severity === "warn").length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: "#7fa3ff" }} />
              <span className="text-[12px] text-fg-2" style={{ fontWeight: 510 }}>정보 {items.filter((it) => it.severity === "info").length}</span>
            </div>
            <span className="ml-auto text-[11px] text-fg-4 font-mono">
              전체 {lines.length}줄 중 {lines.filter((l) => l.lvl === "WARN" || l.lvl === "ERROR").length}건 이상
            </span>
          </div>

          {/* Filtered lines with AI explanation attached */}
          <div className="px-3 py-2">
            {lines.filter((l) => l.lvl === "WARN" || l.lvl === "ERROR").map((l, i) => {
              const aiCard = items.find((it) =>
                (it.severity === "error" && l.lvl === "ERROR") ||
                (it.severity === "warn" && l.lvl === "WARN")
              );
              const isOpen = expanded === `f-${i}`;
              return (
                <div key={i} className="mb-1.5">
                  <button onClick={() => setExpanded(isOpen ? null : `f-${i}`)}
                          className="w-full text-left px-3 py-2 rounded-md transition-colors font-mono text-[12px] flex gap-3"
                          style={{ background: isOpen ? "rgba(255,255,255,0.03)" : "transparent" }}
                          onMouseEnter={(e) => !isOpen && (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                          onMouseLeave={(e) => !isOpen && (e.currentTarget.style.background = "transparent")}>
                    <span className="text-fg-4 shrink-0">{l.t}</span>
                    <span className="shrink-0" style={{ color: lvlColor(l.lvl), fontWeight: 500, width: 44 }}>{l.lvl}</span>
                    <span className="text-fg-2 flex-1 min-w-0 truncate">{l.msg}</span>
                    {aiCard && <Icon name="sparkles" size={10} stroke={1.8} className="text-violet-brand shrink-0 mt-0.5" />}
                  </button>
                  {isOpen && aiCard && (
                    <div className="ml-[88px] mr-3 mt-1 mb-2 px-3 py-2.5 rounded-md font-sans kd-fade-in"
                         style={{ background: "rgba(94,106,210,0.06)", border: "1px solid rgba(94,106,210,0.12)" }}>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon name="sparkles" size={11} stroke={1.8} className="text-violet-brand" />
                        <span className="text-[12px] text-fg-1" style={{ fontWeight: 510 }}>{aiCard.title}</span>
                      </div>
                      <p className="text-[12px] text-fg-3 leading-[1.55] pl-[19px]">{aiCard.summary}</p>
                      {aiCard.action && (
                        <div className="pl-[19px] mt-2">
                          <span className="text-[11px] text-violet-brand" style={{ fontWeight: 510 }}>{aiCard.action} →</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {lines.filter((l) => l.lvl === "WARN" || l.lvl === "ERROR").length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-fg-4">
                <Icon name="check-circle" size={24} stroke={1.5} className="mb-3 text-green-ok" />
                <span className="text-[13px]" style={{ fontWeight: 510 }}>에러·경고가 없어요</span>
                <span className="text-[12px] mt-1">모든 로그가 정상 수준이에요.</span>
              </div>
            )}
          </div>
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
