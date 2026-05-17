function DeployWidget({ onDeploy }) {
  const [showPanel, setShowPanel] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [expandedCommit, setExpandedCommit] = useState(null);

  const commits = MOCK_COMMITS.slice(0, 2);

  if (minimized) {
    return (
      <>
        <div className="fixed right-4 z-30" style={{ bottom: 45 }}>
          <button onClick={() => setMinimized(false)}
                  className="flex items-center gap-2.5 pl-4 pr-5 py-2.5 rounded-full transition-colors"
                  style={{
                    background: "#5e6ad2",
                    boxShadow: "0 4px 20px rgba(94,106,210,0.35), 0 2px 6px rgba(0,0,0,0.3)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#828fff")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#5e6ad2")}>
            <span className="text-[13px] text-white" style={{ fontWeight: 510 }}>배포 대기 · {MOCK_COMMITS.length}</span>
            <Icon name="chevron-up" size={13} stroke={2} className="text-white/60" />
          </button>
        </div>
        {showPanel && (
          <DeployPanel onClose={() => setShowPanel(false)} onDeploy={() => { setShowPanel(false); onDeploy(); }} />
        )}
      </>
    );
  }

  return (
    <>
      {/* Always-visible widget — anchored to bottom, grows upward */}
      <div className="fixed right-4 z-30 flex flex-col justify-end" style={{ width: 320, bottom: 45, maxHeight: "calc(100vh - 100px)" }}>
        <div className="rounded-xl overflow-hidden flex flex-col"
             style={{
               background: "#131415",
               border: "1px solid rgba(255,255,255,0.09)",
               boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
             }}>

          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2.5 shrink-0"
               style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <Icon name="git-commit-horizontal" size={13} stroke={1.8} className="text-fg-3" />
            <span className="text-[11px] text-fg-3" style={{ fontWeight: 590 }}>
              배포 대기 · {MOCK_COMMITS.length}건
            </span>
            <span className="ml-auto text-[10px] text-fg-4 font-mono">main</span>
            <button onClick={() => setMinimized(true)}
                    className="ml-1 w-6 h-6 rounded-md text-fg-4 hover:text-fg-1 hover:bg-white/[0.04] transition-colors flex items-center justify-center"
                    title="최소화">
              <Icon name="minus" size={13} stroke={2} />
            </button>
          </div>

          {/* Commits — expand upward */}
          <div className="px-3 py-2 flex flex-col-reverse gap-0.5 overflow-auto scroll-thin">
            {[...commits].reverse().map((c) => {
              const isExpanded = expandedCommit === c.hash;
              return (
                <div key={c.hash}>
                  <button
                    onClick={() => setExpandedCommit(isExpanded ? null : c.hash)}
                    className="w-full text-left px-2.5 py-2 rounded-md transition-colors"
                    style={{ background: isExpanded ? "rgba(94,106,210,0.08)" : "transparent" }}
                    onMouseEnter={(e) => !isExpanded && (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={(e) => !isExpanded && (e.currentTarget.style.background = "transparent")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-violet-brand shrink-0">{c.hash}</span>
                      <span className="text-[12px] text-fg-1 flex-1 min-w-0 truncate" style={{ fontWeight: 500 }}>{c.msg}</span>
                      <span className="text-[10px] text-fg-4 shrink-0">{c.time}</span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="flex items-start gap-2 px-3 py-2 mx-2.5 mt-1 mb-1 rounded-md kd-fade-in"
                         style={{ background: "rgba(94,106,210,0.06)", border: "1px solid rgba(94,106,210,0.1)" }}>
                      <Icon name="sparkles" size={11} stroke={1.8} className="text-violet-brand mt-0.5 shrink-0" />
                      <p className="text-[11px] text-fg-3 leading-[1.5]">{c.summary}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Settings button */}
          <div className="px-3 pb-3 pt-1 shrink-0">
            <button onClick={() => setShowPanel(true)}
                    className="w-full py-2 rounded-lg text-[13px] text-white transition-colors flex items-center justify-center gap-2"
                    style={{ background: "#5e6ad2", fontWeight: 510 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#828fff")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#5e6ad2")}>
              설정하기
            </button>
          </div>
        </div>
      </div>

      {/* Right panel — slides up */}
      {showPanel && (
        <DeployPanel onClose={() => setShowPanel(false)} onDeploy={() => { setShowPanel(false); onDeploy(); }} />
      )}
    </>
  );
}

function DeployPanel({ onClose, onDeploy }) {
  const [strategy, setStrategy] = useState("rolling");
  const [replicas, setReplicas] = useState(3);
  const [envVars, setEnvVars] = useState([
    { key: "SPRING_PROFILES_ACTIVE", value: "production", secret: false },
    { key: "DB_HOST", value: "postgres-0.internal", secret: false },
    { key: "DB_PASSWORD", value: "s3cur3-p@ss!", secret: true },
    { key: "JWT_SECRET", value: "eyJhbGciOiJIUzI1NiJ9...", secret: true },
    { key: "", value: "", secret: false },
  ]);
  const [revealedSecrets, setRevealedSecrets] = useState({});

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const updateEnv = (idx, field, val) => {
    setEnvVars((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      if (idx === next.length - 1 && (next[idx].key || next[idx].value)) {
        next.push({ key: "", value: "", secret: false });
      }
      return next;
    });
  };

  const toggleSecret = (idx) => {
    setEnvVars((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], secret: !next[idx].secret };
      return next;
    });
  };

  const toggleReveal = (idx) => {
    setRevealedSecrets((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const [panelWidth, setPanelWidth] = useState(400);
  const [expandedCommit, setExpandedCommit] = useState(null);
  const resizingRef = useRef(false);

  useEffect(() => {
    const onMove = (e) => {
      if (!resizingRef.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setPanelWidth(Math.min(800, Math.max(320, newWidth)));
    };
    const onUp = () => {
      resizingRef.current = false;
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

  const startResize = (e) => {
    e.preventDefault();
    resizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const removeEnv = (idx) => {
    setEnvVars((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 z-40 flex kd-fade-in"
         style={{ width: panelWidth, maxWidth: "90vw" }}>
      {/* Resize handle */}
      <div className="w-[4px] h-full cursor-col-resize shrink-0"
           onMouseDown={startResize}
           style={{ background: "rgba(255,255,255,0.04)" }}
           onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(94,106,210,0.5)")}
           onMouseLeave={(e) => !resizingRef.current && (e.currentTarget.style.background = "rgba(255,255,255,0.04)")} />
      <div className="h-full flex-1 min-w-0 flex flex-col"
           style={{
             background: "#0c0d0e",
             borderLeft: "1px solid rgba(255,255,255,0.09)",
             boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
           }}>

        {/* Header */}
        <div className="flex items-center px-5 py-4 shrink-0"
             style={{ borderBottom: "1px solid rgba(255,255,255,0.09)" }}>
          <div className="flex-1">
            <h2 className="text-[16px] text-fg-1" style={{ fontWeight: 590, letterSpacing: -0.3 }}>배포 설정</h2>
            <p className="text-[12px] text-fg-3 mt-0.5">myapp · v2.4.1 → v2.4.2</p>
          </div>
          <button onClick={onClose}
                  className="w-8 h-8 rounded-md text-fg-4 hover:text-fg-1 hover:bg-white/[0.04] transition-colors flex items-center justify-center">
            <Icon name="x" size={14} stroke={1.8} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto scroll-thin px-5 py-5">

          {/* AI Summary */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg mb-5"
               style={{ background: "rgba(94,106,210,0.08)", border: "1px solid rgba(94,106,210,0.15)" }}>
            <Icon name="sparkles" size={13} stroke={1.8} className="text-violet-brand mt-0.5 shrink-0" />
            <div>
              <div className="text-[10.5px] text-violet-brand mb-1" style={{ fontWeight: 590 }}>AI 요약</div>
              <p className="text-[12.5px] text-fg-2 leading-[1.6]">{COMMIT_SUMMARY}</p>
            </div>
          </div>

          {/* Strategy + Replicas */}
          <div className="mb-5">
            <div className="text-[10.5px] uppercase tracking-[0.08em] text-fg-3 mb-2.5" style={{ fontWeight: 590 }}>배포 전략</div>
            <div className="flex gap-1.5 mb-4">
              {[{ id: "rolling", label: "롤링" }, { id: "recreate", label: "재생성" }].map((s) => (
                <button key={s.id} onClick={() => setStrategy(s.id)}
                        className="flex-1 h-9 rounded-lg text-[12px] transition-colors flex items-center justify-center"
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

            <div className="flex items-center gap-3">
              <span className="text-[10.5px] uppercase tracking-[0.08em] text-fg-3" style={{ fontWeight: 590 }}>레플리카</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setReplicas((r) => Math.max(1, r - 1))}
                        className="w-6 h-6 rounded text-fg-3 hover:text-fg-1 hover:bg-white/[0.04] transition-colors text-[14px]"
                        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>−</button>
                <span className="text-[13px] font-mono text-fg-1 w-5 text-center" style={{ fontWeight: 510 }}>{replicas}</span>
                <button onClick={() => setReplicas((r) => Math.min(10, r + 1))}
                        className="w-6 h-6 rounded text-fg-3 hover:text-fg-1 hover:bg-white/[0.04] transition-colors text-[14px]"
                        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>+</button>
                <span className="text-[11px] text-fg-4">pods</span>
              </div>
            </div>
          </div>

          {/* Environment Variables */}
          <div className="mb-5" style={{ borderTop: "1px solid rgba(255,255,255,0.09)", paddingTop: 20 }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="text-[10.5px] uppercase tracking-[0.08em] text-fg-3" style={{ fontWeight: 590 }}>환경 변수</div>
              <span className="text-[10px] text-fg-4">{envVars.filter((e) => e.key).length}개</span>
              <span className="text-[10px] text-fg-4">· 시크릿 {envVars.filter((e) => e.secret && e.key).length}개</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {envVars.map((env, i) => (
                <div key={i} className="flex items-center gap-1.5 group">
                  <input
                    value={env.key}
                    onChange={(e) => updateEnv(i, "key", e.target.value)}
                    placeholder="KEY"
                    className="bg-transparent outline-none text-[12px] text-fg-1 font-mono px-3 py-2 rounded-md transition-colors"
                    style={{ border: "1px solid rgba(255,255,255,0.06)", minWidth: 0, width: "40%" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(94,106,210,0.4)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
                  />
                  <div className="flex-1 relative" style={{ minWidth: 0 }}>
                    <input
                      type={env.secret && !revealedSecrets[i] ? "password" : "text"}
                      value={env.value}
                      onChange={(e) => updateEnv(i, "value", e.target.value)}
                      placeholder="value"
                      className="w-full bg-transparent outline-none text-[12px] text-fg-1 font-mono px-3 py-2 pr-8 rounded-md transition-colors"
                      style={{ border: `1px solid ${env.secret ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)"}`, minWidth: 0 }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = env.secret ? "rgba(245,158,11,0.5)" : "rgba(94,106,210,0.4)")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = env.secret ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)")}
                    />
                    {env.secret && env.key && (
                      <button onClick={() => toggleReveal(i)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-4 hover:text-fg-2 transition-colors">
                        <Icon name={revealedSecrets[i] ? "eye-off" : "eye"} size={12} stroke={1.8} />
                      </button>
                    )}
                  </div>
                  {env.key && (
                    <button onClick={() => toggleSecret(i)}
                            className="w-6 h-6 rounded transition-colors flex items-center justify-center shrink-0"
                            title={env.secret ? "시크릿 해제" : "시크릿으로 설정"}
                            style={{ color: env.secret ? "#f59e0b" : "#62666d" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <Icon name={env.secret ? "lock" : "unlock"} size={11} stroke={1.8} />
                    </button>
                  )}
                  {env.key && (
                    <button onClick={() => removeEnv(i)}
                            className="w-6 h-6 rounded text-fg-4 hover:text-red-err hover:bg-white/[0.04] transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 shrink-0">
                      <Icon name="x" size={11} stroke={2} />
                    </button>
                  )}
                  {!env.key && <div className="w-12 shrink-0" />}
                </div>
              ))}
            </div>
          </div>

          {/* Commits */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.09)", paddingTop: 20 }}>
            <div className="text-[10.5px] uppercase tracking-[0.08em] text-fg-3 mb-2.5" style={{ fontWeight: 590 }}>
              최근 커밋 · {MOCK_COMMITS.length}건
            </div>
            <div className="flex flex-col gap-1">
              {MOCK_COMMITS.map((c) => {
                const isOpen = expandedCommit === c.hash;
                return (
                  <div key={c.hash}>
                    <button
                      onClick={() => setExpandedCommit(isOpen ? null : c.hash)}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-md transition-colors"
                      style={{ background: isOpen ? "rgba(94,106,210,0.08)" : "transparent" }}
                      onMouseEnter={(e) => !isOpen && (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                      onMouseLeave={(e) => !isOpen && (e.currentTarget.style.background = "transparent")}
                    >
                      <Icon name={isOpen ? "chevron-down" : "chevron-right"} size={11} stroke={2} className="text-fg-4 shrink-0" />
                      <span className="font-mono text-[11px] text-violet-brand shrink-0">{c.hash}</span>
                      <span className="text-[12px] text-fg-1 flex-1 min-w-0 truncate" style={{ fontWeight: 500 }}>{c.msg}</span>
                      <span className="text-[11px] text-fg-4 shrink-0">{c.time}</span>
                    </button>
                    {isOpen && (
                      <div className="ml-8 mr-3 mt-1 mb-2 kd-fade-in">
                        <div className="flex items-center gap-3 mb-2 text-[11px] text-fg-4">
                          <span>{c.author}</span>
                          <span>·</span>
                          <span>{c.files} files changed</span>
                        </div>
                        <div className="flex items-start gap-2 px-3 py-2.5 rounded-md"
                             style={{ background: "rgba(94,106,210,0.06)", border: "1px solid rgba(94,106,210,0.12)" }}>
                          <Icon name="sparkles" size={11} stroke={1.8} className="text-violet-brand mt-0.5 shrink-0" />
                          <p className="text-[11.5px] text-fg-2 leading-[1.55]">{c.summary}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 shrink-0 flex items-center gap-3"
             style={{ borderTop: "1px solid rgba(255,255,255,0.09)", background: "#08090a" }}>
          <div className="flex-1 flex items-center gap-2 text-[11px] text-fg-4">
            <Icon name="git-branch" size={12} stroke={1.8} className="text-fg-3" />
            <span className="font-mono">main</span>
            <span>·</span>
            <span>{strategy === "rolling" ? "롤링" : "재생성"} · {replicas} pods</span>
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
