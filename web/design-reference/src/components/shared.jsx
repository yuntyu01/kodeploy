/* global React, ReactDOM, lucide */
var { useState, useEffect, useRef, useMemo } = React;

function Icon({ name, size = 16, stroke = 1.6, className = "", style }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !lucide?.icons) return;
    const key = name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
    const data = lucide.icons[key] || lucide.icons[name];
    if (!data) { ref.current.innerHTML = ""; return; }
    const svg = lucide.createElement(data);
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("stroke-width", stroke);
    ref.current.innerHTML = "";
    ref.current.appendChild(svg);
  }, [name, size, stroke]);
  return <span ref={ref} className={className} style={{ display: "inline-flex", lineHeight: 0, ...style }} />;
}

function KoDeployMark({ size = 18 }) {
  const fs = size;
  return (
    <span
      aria-label="KoDeploy"
      style={{
        fontFamily: '"Geist", Inter, sans-serif',
        fontWeight: 700,
        fontSize: fs,
        lineHeight: 1,
        letterSpacing: "-0.045em",
        display: "inline-flex",
        alignItems: "baseline",
        userSelect: "none",
      }}
    >
      <span style={{ color: "#f7f8f8" }}>Ko</span>
      <span style={{ color: "#7170ff" }}>Deploy</span>
    </span>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="w-9 h-5 rounded-full transition-colors relative shrink-0 disabled:cursor-not-allowed"
      style={{
        background: checked ? "#5e6ad2" : "rgba(255,255,255,0.1)",
        border: "1px solid " + (checked ? "rgba(94,106,210,0.6)" : "rgba(255,255,255,0.08)"),
      }}
    >
      <span
        className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform"
        style={{ left: 2, transform: checked ? "translateX(16px)" : "translateX(0)" }}
      />
    </button>
  );
}
