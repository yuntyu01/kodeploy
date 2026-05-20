// GitHub repo URL → "owner/repo" (e.g., "username/repo"). 못 파싱하면 원본 반환.
export function repoSlug(url) {
  if (!url) return "";
  const m = url.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/);
  return m ? m[1] : url;
}

// 백엔드는 timezone-aware UTC ISO를 보냄 ("...+00:00"). 혹시 timezone 없는 옛 데이터면 UTC로 가정.
// 모든 시간 처리는 이 함수를 거쳐 Date 객체를 얻는다 — 직접 new Date(iso) 금지.
export function parseDate(iso) {
  if (!iso) return null;
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(iso);
  const d = new Date(hasTz ? iso : iso + "Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

// ISO → "방금" / "N분 전" / "N시간 전" / "N일 전" / "M월 D일"
// compact=true 면 "전" 생략 ("5분", "2시간") — 좁은 영역(widget) 용도.
export function relativeTime(iso, { compact = false } = {}) {
  const d = parseDate(iso);
  if (!d) return iso || "";
  const diffSec = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (diffSec < 30) return "방금";
  const suffix = compact ? "" : " 전";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분${suffix}`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간${suffix}`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}일${suffix}`;
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

// ISO → "YY.MM.DD HH:MM" 단일 형식 (브라우저 로컬 timezone).
export function formatFull(iso) {
  const d = parseDate(iso);
  if (!d) return iso || "";
  const pad = (n) => String(n).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yy}.${mm}.${dd} ${hh}:${min}`;
}
