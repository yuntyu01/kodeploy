import { useState } from "react";
import Brand from "./components/Brand.jsx";
import DeployForm from "./components/DeployForm.jsx";
import BuildList from "./components/BuildList.jsx";
import BuildDetail from "./components/BuildDetail.jsx";

export default function App() {
  // refreshSignal을 토글해서 BuildList에 새로고침을 트리거
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  const handleCreated = (build) => {
    setSelectedId(build.build_id);
    setRefreshSignal((n) => n + 1);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="flex items-center px-6 h-14 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Brand size={20} />
        <span className="ml-3 text-[12px] text-fg-4">
          GitHub → Build → Deploy
        </span>
      </header>

      <main className="flex-1 min-h-0 flex flex-col gap-8 px-6 py-10 max-w-[1100px] w-full mx-auto">
        <section
          className="p-6 rounded-xl"
          style={{
            background: "#0c0d0e",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <DeployForm onCreated={handleCreated} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_1fr] gap-6">
          <div
            className="p-5 rounded-xl"
            style={{
              background: "#0c0d0e",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <BuildList
              refreshSignal={refreshSignal}
              onSelect={(b) => setSelectedId(b.build_id)}
              selectedId={selectedId}
            />
          </div>
          <div
            className="p-5 rounded-xl"
            style={{
              background: "#0c0d0e",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <BuildDetail buildId={selectedId} />
          </div>
        </section>
      </main>
    </div>
  );
}
