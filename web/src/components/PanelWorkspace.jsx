import { useEffect, useRef, useState } from "react";
import Pane from "./Pane.jsx";

let _paneKeySeq = 0;
const genPaneKey = () => `pk-${++_paneKeySeq}`;

export default function PanelWorkspace({ build }) {
  const [primaryDir, setPrimaryDir] = useState(null);
  const [primaryRatio, setPrimaryRatio] = useState(50);
  const [slot1Dir, setSlot1Dir] = useState(null);
  const [slot1Ratio, setSlot1Ratio] = useState(50);
  const [slot2Dir, setSlot2Dir] = useState(null);
  const [slot2Ratio, setSlot2Ratio] = useState(50);

  const [slot1Keys, setSlot1Keys] = useState(() => ({ a: genPaneKey(), b: genPaneKey() }));
  const [slot2Keys, setSlot2Keys] = useState(() => ({ a: genPaneKey(), b: genPaneKey() }));

  const [primaryKeys, setPrimaryKeys] = useState(() => ({ a: genPaneKey(), b: genPaneKey() }));
  const [primaryOrder, setPrimaryOrder] = useState([1, 2]);

  const containerRef = useRef(null);
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

  const handleSplit = (slot) => (dir) => {
    if (!primaryDir) {
      setPrimaryDir(dir);
      setPrimaryRatio(50);
      setPrimaryKeys((prev) => ({ a: prev.a, b: genPaneKey() }));
    } else if (slot === 1 && !slot1Dir) {
      setSlot1Dir(dir);
      setSlot1Ratio(50);
      setSlot1Keys((prev) => ({ a: prev.a, b: genPaneKey() }));
    } else if (slot === 2 && !slot2Dir) {
      setSlot2Dir(dir);
      setSlot2Ratio(50);
      setSlot2Keys((prev) => ({ a: prev.a, b: genPaneKey() }));
    }
  };

  const slotDirs = { 1: slot1Dir, 2: slot2Dir };
  const slotRatios = { 1: slot1Ratio, 2: slot2Ratio };
  const clearSlot = (n) => {
    if (n === 1) setSlot1Dir(null);
    else setSlot2Dir(null);
  };

  const closePrimaryA = () => {
    clearSlot(primaryOrder[0]);
    setPrimaryKeys((prev) => ({ a: prev.b, b: genPaneKey() }));
    setPrimaryOrder((prev) => [prev[1], prev[0]]);
    setPrimaryDir(null);
  };

  const closePrimaryB = () => {
    clearSlot(primaryOrder[1]);
    setPrimaryDir(null);
  };

  const renderSlot = (slotNum, slotDir, slotRatio, onClosePrimary) => {
    const isSplit = !!slotDir;
    const splitLevel = !primaryDir ? 0 : isSplit ? 2 : 1;
    const flexDir = isSplit
      ? slotDir === "horizontal" ? "flex-row" : "flex-col"
      : "flex-col";
    const sizeProp = slotDir === "horizontal" ? "width" : "height";
    const level = slotNum === 1 ? "slot1" : "slot2";
    const keys = slotNum === 1 ? slot1Keys : slot2Keys;
    const setKeys = slotNum === 1 ? setSlot1Keys : setSlot2Keys;
    const setDir = slotNum === 1 ? setSlot1Dir : setSlot2Dir;

    const closeA = () => {
      setKeys((prev) => ({ a: prev.b, b: genPaneKey() }));
      setDir(null);
    };
    const closeB = () => {
      setDir(null);
    };

    return (
      <div className={`flex-1 min-h-0 min-w-0 flex ${flexDir} overflow-hidden`}>
        <Pane
          key={keys.a}
          build={build}
          splitLevel={isSplit ? 2 : splitLevel}
          onSplit={isSplit ? null : handleSplit(slotNum)}
          onUnsplit={isSplit ? closeA : onClosePrimary}
          excludeSplitDir={isSplit ? undefined : primaryDir}
          style={isSplit ? { [sizeProp]: `${slotRatio}%`, flexShrink: 0 } : { flex: 1 }}
        />
        {isSplit && (
          <Divider key="divider" level={level} axis={slotDir === "horizontal" ? "h" : "v"} />
        )}
        {isSplit && (
          <Pane
            key={keys.b}
            build={build}
            splitLevel={2}
            onSplit={null}
            onUnsplit={closeB}
            style={{ flex: 1 }}
          />
        )}
      </div>
    );
  };

  const dir = primaryDir || "horizontal";
  const sizeProp = dir === "horizontal" ? "width" : "height";
  const slotA = primaryOrder[0];
  const slotB = primaryOrder[1];

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 h-full flex flex-col overflow-hidden"
      style={{ background: "#0c0d0e" }}
    >
      <div
        className={`flex-1 min-h-0 flex ${
          dir === "horizontal" ? "flex-row" : "flex-col"
        }`}
      >
        <div
          key={primaryKeys.a}
          className="min-h-0 min-w-0 flex flex-col overflow-hidden"
          style={{
            [sizeProp]: primaryDir ? `${primaryRatio}%` : "100%",
            flexShrink: 0,
            background: "#0c0d0e",
          }}
        >
          {renderSlot(slotA, slotDirs[slotA], slotRatios[slotA], primaryDir ? closePrimaryA : null)}
        </div>

        {primaryDir && (
          <Divider
            level="primary"
            axis={primaryDir === "horizontal" ? "h" : "v"}
          />
        )}
        {primaryDir && (
          <div
            key={primaryKeys.b}
            className="min-h-0 min-w-0 flex flex-col flex-1 overflow-hidden"
            style={{ background: "#0c0d0e" }}
          >
            {renderSlot(slotB, slotDirs[slotB], slotRatios[slotB], closePrimaryB)}
          </div>
        )}
      </div>
    </div>
  );
}
