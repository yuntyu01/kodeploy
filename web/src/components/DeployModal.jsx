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
