// 재귀 분할 워크스페이스 — 최대 1→4분할.
// 구조: primary(1차 분할) → slot1/slot2 각각 다시 한 번 분할 가능 → 총 4칸.
// 각 칸은 독립 Pane(탭 컨테이너). design-reference/LeftPanel.jsx 패턴 그대로,
// 톤(보라 #818be0)·아이콘(lucide-react)만 KoDeploy 컨벤션으로 이식.
import { useEffect, useRef, useState } from "react";
import Pane from "./Pane.jsx";

export default function PanelWorkspace({ build }) {
  // null = 분할 없음, "horizontal" = 좌우, "vertical" = 상하
  const [primaryDir, setPrimaryDir] = useState(null);
  const [primaryRatio, setPrimaryRatio] = useState(50);
  const [slot1Dir, setSlot1Dir] = useState(null);
  const [slot1Ratio, setSlot1Ratio] = useState(50);
  const [slot2Dir, setSlot2Dir] = useState(null);
  const [slot2Ratio, setSlot2Ratio] = useState(50);

  const containerRef = useRef(null);
  // 드래그 중인 divider — { level: "primary"|"slot1"|"slot2", axis: "h"|"v" }
  const draggingRef = useRef(null);

  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const { level, axis } = draggingRef.current;
      let ratio;
      if (axis === "h") {
        ratio = ((e.clientX - rect.left) / rect.width) * 100;
      } else {
        ratio = ((e.clientY - rect.top) / rect.height) * 100;
      }
      // 20~80% 범위 — 한 쪽이 너무 좁아져서 UI 부서지는 것 방지
      ratio = Math.min(80, Math.max(20, ratio));
      if (level === "primary") setPrimaryRatio(ratio);
      else if (level === "slot1") setSlot1Ratio(ratio);
      else setSlot2Ratio(ratio);
    };
    const onUp = () => {
      draggingRef.current = null;
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

  const startDrag = (level, axis) => (e) => {
    e.preventDefault();
    draggingRef.current = { level, axis };
    document.body.style.cursor = axis === "h" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  };

  const Divider = ({ level, axis }) => (
    <div
      onMouseDown={startDrag(level, axis)}
      className={`shrink-0 transition-colors ${
        axis === "h" ? "w-[3px] cursor-col-resize" : "h-[3px] cursor-row-resize"
      }`}
      style={{ background: "rgba(255,255,255,0.06)" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "rgba(129,139,224,0.5)")
      }
      onMouseLeave={(e) => {
        if (draggingRef.current) return;
        e.currentTarget.style.background = "rgba(255,255,255,0.06)";
      }}
    />
  );

  // 분할 요청 — 아직 primary가 없으면 primary 분할, 있으면 해당 slot 안에서 분할
  const handleSplit = (slot) => (dir) => {
    if (!primaryDir) {
      setPrimaryDir(dir);
      setPrimaryRatio(50);
    } else if (slot === 1 && !slot1Dir) {
      setSlot1Dir(dir);
      setSlot1Ratio(50);
    } else if (slot === 2 && !slot2Dir) {
      setSlot2Dir(dir);
      setSlot2Ratio(50);
    }
  };

  // 분할 해제 — slot 안 분할이 있으면 그것부터, 없으면 primary까지 해제
  const handleUnsplit = (slot) => () => {
    if (slot === 1 && slot1Dir) {
      setSlot1Dir(null);
    } else if (slot === 2 && slot2Dir) {
      setSlot2Dir(null);
    } else {
      setPrimaryDir(null);
      setSlot1Dir(null);
      setSlot2Dir(null);
    }
  };

  // 한 slot 렌더 — 내부 분할이 있으면 두 개의 compact Pane, 없으면 하나
  const renderSlot = (slotNum, slotDir, slotRatio) => {
    const isSplit = !!slotDir;
    const compact = !!primaryDir;

    if (!isSplit) {
      return (
        <Pane
          build={build}
          compact={compact}
          onSplit={handleSplit(slotNum)}
          onUnsplit={primaryDir ? handleUnsplit(slotNum) : null}
        />
      );
    }

    const axis = slotDir === "horizontal" ? "h" : "v";
    const flexDir = slotDir === "horizontal" ? "flex-row" : "flex-col";
    const sizeProp = slotDir === "horizontal" ? "width" : "height";
    const level = slotNum === 1 ? "slot1" : "slot2";

    return (
      <div className={`flex-1 min-h-0 min-w-0 flex ${flexDir}`}>
        <div
          className="min-h-0 min-w-0 flex flex-col"
          style={{ [sizeProp]: `${slotRatio}%`, flexShrink: 0 }}
        >
          <Pane
            build={build}
            compact={true}
            onSplit={null}
            onUnsplit={handleUnsplit(slotNum)}
          />
        </div>
        <Divider level={level} axis={axis} />
        <div className="min-h-0 min-w-0 flex flex-col flex-1">
          <Pane
            build={build}
            compact={true}
            onSplit={null}
            onUnsplit={handleUnsplit(slotNum)}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {!primaryDir && (
        <Pane
          build={build}
          compact={false}
          onSplit={handleSplit(0)}
          onUnsplit={null}
        />
      )}
      {primaryDir && (
        <div
          className={`flex-1 min-h-0 flex ${
            primaryDir === "horizontal" ? "flex-row" : "flex-col"
          }`}
        >
          <div
            className="min-h-0 min-w-0 flex flex-col"
            style={{
              [primaryDir === "horizontal" ? "width" : "height"]: `${primaryRatio}%`,
              flexShrink: 0,
            }}
          >
            {renderSlot(1, slot1Dir, slot1Ratio)}
          </div>
          <Divider
            level="primary"
            axis={primaryDir === "horizontal" ? "h" : "v"}
          />
          <div className="min-h-0 min-w-0 flex flex-col flex-1">
            {renderSlot(2, slot2Dir, slot2Ratio)}
          </div>
        </div>
      )}
    </div>
  );
}
