function ModeToggle({ mode, onChange }) {
  return (
    <div
      className="fixed bottom-4 left-4 z-40 flex items-center gap-1 p-1 rounded-full shadow-dialog"
      style={{ background: "#0f1011", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <span className="px-2 text-[10px] text-fg-4 font-mono uppercase tracking-wider">dev</span>
      {[
        { id: "visitor", label: "방문자", icon: "user" },
        { id: "user",    label: "사용자", icon: "user-check" },
      ].map((opt) => {
        const active = mode === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] transition-colors"
            style={{
              background: active ? (opt.id === "user" ? "#5e6ad2" : "rgba(255,255,255,0.06)") : "transparent",
              color: active ? (opt.id === "user" ? "#fff" : "#f7f8f8") : "#8a8f98",
              fontWeight: 510,
            }}
          >
            <Icon name={opt.icon} size={11} stroke={1.8} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
