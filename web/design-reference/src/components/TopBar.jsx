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
