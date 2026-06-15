// xterm.js 색 테마 — xterm은 canvas 렌더라 CSS 변수(var(--…))를 파싱하지 못한다.
// 따라서 실제 hex/rgb 문자열을 줘야 한다. 여기 값은 index.css의 --kd-bg/--fg-1 등과 의미가 같다.
// 터미널 컴포넌트는 useTheme()으로 현재 테마를 읽어 이 함수로 객체를 만들고,
// 토글 시 term.options.theme에 다시 할당해 (재생성/재접속 없이) 색만 라이브 갱신한다.
export function xtermTheme(theme) {
  if (theme === "light") {
    return {
      background: "#f5f5f5", // 컨테이너 var(--kd-bg) 라이트값과 일치
      foreground: "#383c46",
      cursor: "#5e6ad2",
      selectionBackground: "rgba(94,106,210,0.25)",
    };
  }
  return {
    background: "#08090a",
    foreground: "#dde0e4",
    cursor: "#818be0",
    selectionBackground: "rgba(129,139,224,0.3)",
  };
}
