/* =====================================================================
   Toast (deploy click feedback)
   ===================================================================== */
function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onClose, 4500);
    return () => clearTimeout(id);
  }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg flex items-center gap-3 max-w-md"
         style={{
           background: "#191a1b",
           border: "1px solid rgba(255,255,255,0.08)",
           boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.4)",
         }}>
      <span className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            style={{ background: "rgba(94,106,210,0.18)" }}>
        <Icon name={toast.icon || "rocket"} size={14} stroke={1.8} className="text-violet-brand" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-fg-1" style={{ fontWeight: 510 }}>{toast.title}</div>
        <div className="text-[12px] text-fg-3 mt-0.5">{toast.detail}</div>
      </div>
      <button onClick={onClose} className="text-fg-3 hover:text-fg-1 transition-colors p-1">
        <Icon name="x" size={13} stroke={1.8} />
      </button>
    </div>
  );
}
