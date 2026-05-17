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

      {mode === "user" && hasProject && <DeployWidget onDeploy={executeDeploy} />}
      <Toast toast={toast} onClose={() => setToast(null)} />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={completeLogin} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
