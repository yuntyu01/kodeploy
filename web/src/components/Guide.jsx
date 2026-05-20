// 가이드 페이지 — 좌측 사이드바(가이드 목록) + 우측 가이드 내용(탭 + 본문).
// 사이드바: 가이드 단위(주제별)로 항목 추가.
// 가이드 내부: 탭으로 sub-section 전환 (Dockerfile 가이드는 기본/Python/Java 탭).
// URL deep-link: /guide, /guide/python, /guide/java.
import { Link, useParams } from "react-router-dom";
import Basics from "./guide/Basics.jsx";
import Java from "./guide/Java.jsx";
import Python from "./guide/Python.jsx";

// 좌측 사이드바 — 가이드 목록. 미래 가이드 추가 시 항목만 추가.
const GUIDES = [
  { id: "dockerfile", label: "Dockerfile 작성", path: "/guide" },
];

// Dockerfile 가이드 내부 탭.
const TABS = [
  { id: "basics", label: "기본 규칙", path: "/guide", Component: Basics },
  { id: "python", label: "Python", path: "/guide/python", Component: Python },
  { id: "java", label: "Java", path: "/guide/java", Component: Java },
];

const DEFAULT_TAB = TABS[0];

export default function Guide() {
  const { section } = useParams();
  const activeTab = TABS.find((t) => t.id === section) || DEFAULT_TAB;
  const Body = activeTab.Component;

  // 현재 Dockerfile 가이드 단 하나라 항상 활성. 다른 가이드 추가 시 URL 매칭 로직 추가.
  const activeGuideId = "dockerfile";

  return (
    <div className="kd-fade-in mx-auto px-6 py-10" style={{ maxWidth: 1040 }}>
      <div className="flex gap-10">
        {/* 좌측 사이드바 — 가이드 목록 */}
        <aside className="shrink-0" style={{ width: 200 }}>
          <div
            className="text-[11.5px] tracking-[0.08em] text-fg-4 mb-2 px-3"
            style={{ fontWeight: 590 }}
          >
            GUIDES
          </div>
          <nav className="flex flex-col gap-0.5">
            {GUIDES.map((g) => {
              const isActive = g.id === activeGuideId;
              return (
                <Link
                  key={g.id}
                  to={g.path}
                  className="block px-3 py-1.5 rounded-md text-[14px] no-underline transition-colors"
                  style={{
                    color: isActive ? "#dde0e4" : "#8a8f98",
                    background: isActive
                      ? "rgba(129,139,224,0.08)"
                      : "transparent",
                    fontWeight: 510,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.03)";
                      e.currentTarget.style.color = "#dde0e4";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "#8a8f98";
                    }
                  }}
                >
                  {g.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* 우측 — 가이드 제목 + 탭 + 본문 */}
        <div className="flex-1 min-w-0">
          <h1
            className="text-[28px] text-fg-1 mb-2"
            style={{ fontWeight: 590, letterSpacing: -0.5 }}
          >
            Dockerfile 작성
          </h1>
          <p
            className="text-[14px] text-fg-3 mb-6"
            style={{ fontWeight: 450 }}
          >
            KoDeploy는 BuildKit으로 git 저장소를 그대로 빌드해요. 런타임별
            권장 패턴을 확인하세요.
          </p>

          {/* 탭 */}
          <div
            className="flex gap-1 mb-8 -mx-1"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            {TABS.map((t) => {
              const isActive = t.id === activeTab.id;
              return (
                <Link
                  key={t.id}
                  to={t.path}
                  className="px-3 py-2 text-[14px] no-underline transition-colors"
                  style={{
                    color: isActive ? "#dde0e4" : "#8a8f98",
                    fontWeight: 510,
                    borderBottom: `2px solid ${
                      isActive ? "#818be0" : "transparent"
                    }`,
                    marginBottom: -1,
                  }}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>

          <Body />
        </div>
      </div>
    </div>
  );
}
