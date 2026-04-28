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
    <svg width="16" height="16" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}
