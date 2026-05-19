const STYLES = {
  queued: { bg: "rgba(255,255,255,0.05)", color: "#8a8f98", label: "대기" },
  building: {
    bg: "rgba(94,106,210,0.12)",
    color: "#a4abee",
    label: "빌드 중",
    pulse: true,
  },
  built: {
    bg: "rgba(94,106,210,0.12)",
    color: "#a4abee",
    label: "빌드 완료",
  },
  deploying: {
    bg: "rgba(245,158,11,0.12)",
    color: "#f59e0b",
    label: "배포 중",
    pulse: true,
  },
  running: {
    bg: "rgba(16,185,129,0.12)",
    color: "#10b981",
    label: "실행 중",
  },
  failed: { bg: "rgba(239,68,68,0.12)", color: "#ef4444", label: "실패" },
};

export default function StatusBadge({ status }) {
  const s = STYLES[status] || {
    bg: "rgba(255,255,255,0.05)",
    color: "#8a8f98",
    label: status,
  };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px]"
      style={{ background: s.bg, color: s.color, fontWeight: 510 }}
    >
      {s.pulse && (
        <span
          className="w-1.5 h-1.5 rounded-full kd-pulse"
          style={{ background: s.color }}
        />
      )}
      {s.label}
    </span>
  );
}
