// 상태 → dot 색 + 한글 라벨 (단일 진실원).
// 톤 원칙:
//   - 작업 phase(주황): building/built/deploying — 진행 중인 것만 pulse
//   - 사이클 통과(브랜드 보라): deployed
//   - 최종 안정(초록): running — 일반 컨벤션
//   - 텍스트는 fg-1 흰색 고정 — 색은 dot에만
const STYLES = {
  queued:    { color: "#8a8f98", label: "대기" },
  building:  { color: "#b45309", label: "빌드 중", pulse: true },
  built:     { color: "#b45309", label: "빌드 완료" },
  deploying: { color: "#b45309", label: "배포 중", pulse: true },
  deployed:  { color: "#818be0", label: "배포 완료" },
  running:   { color: "#047857", label: "실행 중" },
  failed:    { color: "#b91c1c", label: "실패" },
};

export default function StatusBadge({ status }) {
  const s = STYLES[status] || { color: "#8a8f98", label: status };
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10.5px] text-fg-1 shrink-0"
      style={{ fontWeight: 510 }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          s.pulse ? "kd-pulse-soft" : ""
        }`}
        style={{ background: s.color }}
      />
      {s.label}
    </span>
  );
}
