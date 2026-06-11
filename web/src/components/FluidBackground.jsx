// 홈 배경 — 마우스 궤적을 따라 어두운 보라 잉크가 물에 번지듯 퍼지는 WebGL fluid simulation.
// 시뮬레이션 본체는 lib/fluid.js(vendored)이고 여기선 구동·설정·수명주기만 담당.
// Aurora 레이어와 동일한 "fixed inset-0 + z-0 + pointer-events:none" 패턴 — 콘텐츠(z-1) 아래.
//
// 미장착 가드 3종 — 해당되면 조용히 빠져 Aurora만 남는다:
//   prefers-reduced-motion / coarse pointer(터치 — 마우스 없는 환경) / WebGL 초기화 실패.
// 캔버스를 effect 안에서 생성하는 이유: StrictMode 이중 마운트 시 마운트마다 새 캔버스 =
// 새 WebGL 컨텍스트라, destroy의 loseContext가 다음 마운트를 죽이지 않는다.
import { useEffect, useRef } from "react";
import createFluid from "../lib/fluid.js";

// 브랜드 보라 팔레트 (#6672d5 · #818be0 · #7d6dd5 · 딥 인디고) — 0~1 RGB.
// 밝기 배율은 fluid.js generateColor의 톤 지터가 적용.
const PALETTE = [
  [0.40, 0.45, 0.84],
  [0.51, 0.55, 0.88],
  [0.49, 0.43, 0.84],
  [0.27, 0.30, 0.62],
];

const FLUID_CONFIG = {
  SIM_RESOLUTION: 96,        // 기본 128 — 체감 차이 거의 없이 GPU 절약
  DYE_RESOLUTION: 512,       // 기본 1024 — 은은한 잉크라 충분
  DENSITY_DISSIPATION: 1,    // 잉크가 ~4초에 걸쳐 천천히 가라앉음 (idle 정지 4초와 짝)
  // 버섯구름 방지 묶음: 버섯 모양 = splat이 주입한 운동량이 머리에서 소용돌이 쌍으로
  // 말려 올라간 것. 힘을 빼고(FORCE) 속도장을 즉시 죽이고(VELOCITY) 소용돌이 보강을
  // 끄고(CURL 0) 압력 보정을 느슨하게(PRESSURE) — "밀어 넣기"가 아니라 "놓고 가기".
  VELOCITY_DISSIPATION: 2,
  PRESSURE: 0.55,            // 기본 0.8 — 낮출수록 플룸 윤곽이 뭉개져 얼룩처럼
  PRESSURE_ITERATIONS: 12,   // 기본 20 — 시각 차이 미미
  CURL: 0,
  SPLAT_RADIUS: 0.4,         // 넓고 부드러운 번짐 (좁고 밝으면 네온 줄)
  SPLAT_FORCE: 800,
  SHADING: false,            // 입체 음영 끔 — 3D 연기가 아니라 평평한 물감 얼룩
  COLORFUL: false,           // 무지개 색 순환 금지 — 팔레트 고정
  BLOOM: false,              // 네온 방지 + 후처리 패스 통째 절약
  SUNRAYS: false,
  TRANSPARENT: true,         // 페이지 배경(#0f1011)·Aurora 위에 잉크만 합성
  PALETTE,
};

export default function FluidBackground() {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // 미장착 사유는 콘솔에 남긴다 — "안 보임"이 가드 때문인지 즉시 판별용
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      console.info("[fluid] skipped: prefers-reduced-motion");
      return;
    }
    if (window.matchMedia("(pointer: coarse)").matches) {
      console.info("[fluid] skipped: coarse pointer (touch)");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    host.appendChild(canvas);

    let fluid;
    try {
      fluid = createFluid(canvas, FLUID_CONFIG);
      console.info("[fluid] mounted");
    } catch (err) {
      console.warn("[fluid] init 실패 — 배경 없이 진행:", err);
      canvas.remove();
      return;
    }
    return () => {
      fluid.destroy(); // rAF·리스너·컨텍스트 정리 (SPA 라우트 이탈)
      canvas.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="pointer-events-none fixed"
      // TopBar(60px — GuidePanel과 동일 컨벤션) 아래만 덮음: 잉크가 헤더바에 닿지 않게
      style={{ top: 60, left: 0, right: 0, bottom: 0, zIndex: 0 }}
    />
  );
}
