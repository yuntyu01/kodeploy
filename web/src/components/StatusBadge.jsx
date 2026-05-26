// 상태 → dot 색 + 한글 라벨 (단일 진실원).
// 톤 원칙:
//   - 작업 phase(주황): building/built/deploying — 진행 중인 것만 pulse
//   - 사이클 통과(브랜드 보라): deployed
//   - 최종 안정(초록): running — 일반 컨벤션
//   - 텍스트는 fg-1 흰색 고정 — 색은 dot에만
// 빌드 row용 — running은 "실행 중" (그 빌드 시점 Pod 정상 출발)
const STYLES_BUILD = {
  queued:    { color: "#8a8f98", label: "대기" },
  building:  { color: "#b45309", label: "빌드 중", pulse: true },
  built:     { color: "#b45309", label: "빌드 완료" },
  deploying: { color: "#b45309", label: "배포 중", pulse: true },
  deployed:  { color: "#818be0", label: "배포 완료" },
  running:   { color: "#047857", label: "성공" },
  failed:    { color: "#991b1b", label: "실패" },
};

// env_change row용 — 같은 status값이지만 의미 다름: "그 변경이 성공/실패했나"
const STYLES_ENV = {
  applied: { color: "#b45309", label: "적용 중", pulse: true },
  running: { color: "#047857", label: "성공" },
  failed:  { color: "#991b1b", label: "실패" },
};

export default function StatusBadge({ status, kind = "build" }) {
  const styles = kind === "env" ? STYLES_ENV : STYLES_BUILD;
  const s = styles[status] || { color: "#8a8f98", label: status };
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
