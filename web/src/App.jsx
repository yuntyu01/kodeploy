import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import BuildDetail from "./components/BuildDetail.jsx";
import BuildListWidget from "./components/BuildListWidget.jsx";
import DeployForm from "./components/DeployForm.jsx";
import Guide from "./components/Guide.jsx";
import GuidePanel from "./components/GuidePanel.jsx";
import TopBar from "./components/TopBar.jsx";

function FormView() {
  // 가이드 패널 열림 여부 + 어떤 runtime의 가이드를 보여줄지.
  // DeployForm에서 buildMode === "dockerfile"이면 useEffect로 자동 호출.
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

function BuildDetailView() {
  return (
    <div className="flex-1 overflow-auto scroll-thin">
      <div className="max-w-[900px] mx-auto px-6 py-6 h-full">
        <BuildDetail />
      </div>
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
  return (
    <BrowserRouter>
      <div className="h-screen w-screen flex flex-col" style={{ background: "#08090a" }}>
        <TopBar />
        <div className="flex-1 min-h-0 flex flex-col" style={{ background: "#0f1011" }}>
          <Routes>
            <Route path="/" element={<FormView />} />
            <Route path="/builds/:id" element={<BuildDetailView />} />
            <Route path="/guide" element={<GuideView />} />
            <Route path="/guide/:section" element={<GuideView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <BuildListWidget />
      </div>
    </BrowserRouter>
  );
}
