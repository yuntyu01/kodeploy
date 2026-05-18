import { useState } from "react";
import TopBar from "./components/TopBar.jsx";
import DeployForm from "./components/DeployForm.jsx";
import BuildList from "./components/BuildList.jsx";
import BuildDetail from "./components/BuildDetail.jsx";

export default function App() {
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  const handleCreated = (build) => {
    setSelectedId(build.build_id);
    setRefreshSignal((n) => n + 1);
  };

  return (
    <div className="h-screen w-screen flex flex-col" style={{ background: "#08090a" }}>
      <TopBar />

      <div className="flex-1 min-h-0 flex flex-col" style={{ background: "#0f1011" }}>
        {/* Deploy form strip */}
        <div
          className="shrink-0 px-6 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.09)" }}
        >
          <DeployForm onCreated={handleCreated} />
        </div>

        {/* Build list + detail */}
        <div className="flex-1 min-h-0 flex">
          {/* Left: build list */}
          <div
            className="w-[340px] shrink-0 overflow-auto scroll-thin p-4"
            style={{ borderRight: "1px solid rgba(255,255,255,0.09)" }}
          >
            <BuildList
              refreshSignal={refreshSignal}
              onSelect={(b) => setSelectedId(b.build_id)}
              selectedId={selectedId}
            />
          </div>

          {/* Right: build detail */}
          <div className="flex-1 min-w-0 overflow-auto scroll-thin p-5">
            <BuildDetail buildId={selectedId} />
          </div>
        </div>
      </div>
    </div>
  );
}
