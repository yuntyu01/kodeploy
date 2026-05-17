function SetupView({ onComplete }) {
  const [step, setStep] = useState(1);
  const [repoUrl, setRepoUrl] = useState("");
  const [runtime, setRuntime] = useState("spring");
  const [dbType, setDbType] = useState("postgres");
  const [dbOn, setDbOn] = useState(true);
  const [replicas, setReplicas] = useState(1);
  const [detecting, setDetecting] = useState(false);
  const [envVars, setEnvVars] = useState([
    { key: "SPRING_PROFILES_ACTIVE", value: "production", secret: false },
    { key: "DB_HOST", value: "", secret: false },
    { key: "DB_PASSWORD", value: "", secret: true },
    { key: "", value: "", secret: false },
  ]);
  const [revealedSecrets, setRevealedSecrets] = useState({});

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
  const removeEnv = (idx) => {
    setEnvVars((prev) => prev.filter((_, i) => i !== idx));
  };

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
    <div className="flex-1 overflow-auto scroll-thin font-sans" style={{ background: "#08090a" }}>
      <div className="w-[520px] max-w-[90vw] mx-auto py-12">

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
            <h2 className="text-[20px] text-fg-1 mb-1" style={{ fontWeight: 590, letterSpacing: -0.3 }}>
              배포 환경 구성
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

            {/* Database */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="text-[10.5px] uppercase tracking-[0.08em] text-fg-3" style={{ fontWeight: 590 }}>데이터베이스</div>
                <div className="ml-auto"><Toggle checked={dbOn} onChange={setDbOn} /></div>
              </div>
              {dbOn && (
                <div className="flex gap-1.5">
                  {[{ id: "postgres", label: "PostgreSQL" }, { id: "mysql", label: "MySQL" }].map((d) => (
                    <button key={d.id} onClick={() => setDbType(d.id)}
                            className="flex-1 h-10 rounded-lg text-[12px] transition-colors flex items-center justify-center"
                            style={{
                              background: dbType === d.id ? "rgba(94,106,210,0.12)" : "rgba(255,255,255,0.03)",
                              border: `1px solid ${dbType === d.id ? "rgba(94,106,210,0.25)" : "rgba(255,255,255,0.06)"}`,
                              color: dbType === d.id ? "#a4abee" : "#8a8f98",
                              fontWeight: 510,
                            }}>
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
              {!dbOn && (
                <div className="h-10 flex items-center justify-center text-[12px] text-fg-4 rounded-lg"
                     style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  사용 안 함
                </div>
              )}
            </div>

            {/* Environment Variables */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="text-[10.5px] uppercase tracking-[0.08em] text-fg-3" style={{ fontWeight: 590 }}>환경 변수</div>
                <span className="text-[10px] text-fg-4">{envVars.filter((e) => e.key).length}개</span>
                {envVars.filter((e) => e.secret && e.key).length > 0 && (
                  <span className="flex items-center gap-1 text-[10px]" style={{ color: "#f59e0b" }}>
                    <Icon name="lock" size={9} stroke={2} />
                    시크릿 {envVars.filter((e) => e.secret && e.key).length}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {envVars.map((env, i) => (
                  <div key={i} className="flex items-center gap-1.5 group">
                    <input
                      value={env.key}
                      onChange={(e) => updateEnv(i, "key", e.target.value)}
                      placeholder="KEY"
                      className="bg-transparent outline-none text-[12px] text-fg-1 font-mono px-3 py-2 rounded-md transition-colors"
                      style={{ border: "1px solid rgba(255,255,255,0.06)", width: "40%", minWidth: 0 }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(94,106,210,0.4)")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
                    />
                    <div className="flex-1 relative" style={{ minWidth: 0 }}>
                      <input
                        type={env.secret && !revealedSecrets[i] ? "password" : "text"}
                        value={env.value}
                        onChange={(e) => updateEnv(i, "value", e.target.value)}
                        placeholder={env.secret ? "••••••••" : "value"}
                        className="w-full bg-transparent outline-none text-[12px] text-fg-1 font-mono px-3 py-2 pr-8 rounded-md transition-colors"
                        style={{ border: `1px solid ${env.secret ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)"}` }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = env.secret ? "rgba(245,158,11,0.5)" : "rgba(94,106,210,0.4)")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = env.secret ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)")}
                      />
                      {env.secret && env.key && (
                        <button onClick={() => toggleReveal(i)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-4 hover:text-fg-2 transition-colors"
                                type="button">
                          <Icon name={revealedSecrets[i] ? "eye-off" : "eye"} size={12} stroke={1.8} />
                        </button>
                      )}
                    </div>
                    {env.key && (
                      <button onClick={() => toggleSecret(i)}
                              className="w-6 h-6 rounded transition-colors flex items-center justify-center shrink-0"
                              title={env.secret ? "시크릿 해제" : "시크릿으로 설정"}
                              style={{ color: env.secret ? "#f59e0b" : "#62666d" }}
                              type="button">
                        <Icon name={env.secret ? "lock" : "unlock"} size={11} stroke={1.8} />
                      </button>
                    )}
                    {env.key && (
                      <button onClick={() => removeEnv(i)}
                              className="w-6 h-6 rounded text-fg-4 hover:text-red-err hover:bg-white/[0.04] transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 shrink-0"
                              type="button">
                        <Icon name="x" size={11} stroke={2} />
                      </button>
                    )}
                    {!env.key && <div className="w-12 shrink-0" />}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-fg-4 mt-2.5 flex items-center gap-1.5">
                <Icon name="info" size={11} stroke={1.8} />
                시크릿 변수는 암호화되어 저장돼요. 배포 후에도 수정할 수 있어요.
              </p>
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

