import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Admin from "./components/Admin.jsx";
import CommitListWidget from "./components/CommitListWidget.jsx";
import Dashboard from "./components/Dashboard.jsx";
import DeployForm from "./components/DeployForm.jsx";
import Community from "./components/Community.jsx";
import Guide from "./components/Guide.jsx";
import GuidePanel from "./components/GuidePanel.jsx";
import Home from "./components/Home.jsx";
import LoginModal from "./components/LoginModal.jsx";
import TopBar from "./components/TopBar.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";

function FormView() {
  // 가이드 패널 열림 여부 + 어떤 runtime의 가이드를 보여줄지.
  // DeployForm의 "가이드 보기" 버튼(빌드 방식·프론트엔드·커스텀 도메인)이 호출 — 자동 오픈 없음.
  // Panel은 fixed drawer라 form 영역 layout과 독립.
  const [guideRuntime, setGuideRuntime] = useState(null);
  const isOpen = guideRuntime !== null;

  return (
    <div className="flex-1 overflow-auto scroll-thin">
      <div
        className="pt-[6vh] pb-4 px-6 mx-auto transition-transform duration-[350ms] ease-out"
        style={{
          width: 520,
          maxWidth: "90vw",
          transform: isOpen ? "translateX(-260px)" : "translateX(0)",
        }}
      >
        <DeployForm onRequestGuide={setGuideRuntime} />
      </div>
      {isOpen && (
        <GuidePanel
          runtime={guideRuntime}
          onClose={() => setGuideRuntime(null)}
        />
      )}
    </div>
  );
}

function GuideView() {
  return (
    <div className="flex-1 overflow-auto scroll-thin">
      <Guide />
    </div>
  );
}

export default function App() {
  // LoginModal은 App 최상위에서 관리 — TopBar 클릭, DeployForm 401 응답 등 어디서든 트리거.
  // AuthProvider가 openLogin을 자식들에게 흘려준다.
  const [showLogin, setShowLogin] = useState(false);

  return (
    <BrowserRouter>
      <AuthProvider onOpenLogin={() => setShowLogin(true)}>
        <div className="h-screen w-screen flex flex-col" style={{ background: "#08090a" }}>
          <TopBar onLogin={() => setShowLogin(true)} />
          <div className="flex-1 min-h-0 flex flex-col" style={{ background: "#0f1011" }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/deploy" element={<FormView />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/admin" element={<div className="flex-1 overflow-auto scroll-thin"><Admin /></div>} />
              <Route path="/community" element={<div className="flex-1 overflow-auto scroll-thin"><Community /></div>} />
              <Route path="/guide" element={<GuideView />} />
              <Route path="/guide/:section" element={<GuideView />} />
              {/* 옛 빌드 단위 URL → dashboard로 흡수 (북마크/공유 호환) */}
              <Route path="/builds/:id" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          <CommitListWidget />
          {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
