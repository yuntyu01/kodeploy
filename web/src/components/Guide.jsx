// 가이드 페이지 — 좌측 사이드바(가이드 목록) + 우측 가이드 내용(탭 + 본문).
// 가이드 단위로 GUIDES에 추가. 각 가이드는 자체 탭(sub-section)을 가짐.
// URL deep-link: /guide(dockerfile/기본), /guide/python, /guide/java, /guide/custom-domain.
import { Link, useParams } from "react-router-dom";
import Basics from "./guide/Basics.jsx";
import Java from "./guide/Java.jsx";
import Python from "./guide/Python.jsx";
import CustomDomain from "./guide/CustomDomain.jsx";

// 가이드 목록 — 미래 가이드 추가 시 항목만 추가. 첫 탭 path가 사이드바 링크.
const GUIDES = [
  {
    id: "dockerfile",
    label: "Dockerfile 작성",
    title: "Dockerfile 작성",
    desc: "KoDeploy는 BuildKit으로 git 저장소를 그대로 빌드해요. 런타임별 권장 패턴을 확인하세요.",
    tabs: [
      { id: "basics", label: "기본 규칙", path: "/guide", Component: Basics },
      { id: "python", label: "Python", path: "/guide/python", Component: Python },
      { id: "java", label: "Java", path: "/guide/java", Component: Java },
    ],
  },
  {
    id: "custom-domain",
    label: "커스텀 도메인 연결",
    title: "커스텀 도메인 연결",
    desc: "내가 가진 도메인을 앱에 연결하는 법과 CNAME 설정을 안내해요.",
    tabs: [
      { id: "custom-domain", label: "개요", path: "/guide/custom-domain", Component: CustomDomain },
    ],
  },
];

// 모든 탭을 평탄화해 URL section → 탭/가이드 역매핑.
const ALL_TABS = GUIDES.flatMap((g) => g.tabs.map((t) => ({ ...t, guideId: g.id })));
const DEFAULT_TAB = ALL_TABS[0];

export default function Guide() {
  const { section } = useParams();
  const activeTab = ALL_TABS.find((t) => t.id === section) || DEFAULT_TAB;
  const activeGuide = GUIDES.find((g) => g.id === activeTab.guideId);
  const Body = activeTab.Component;

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
              const isActive = g.id === activeGuide.id;
              return (
                <Link
                  key={g.id}
                  to={g.tabs[0].path}
                  className="block px-3 py-1.5 rounded-md text-[14px] no-underline transition-colors"
                  style={{
                    color: isActive ? "#dde0e4" : "#8a8f98",
                    background: isActive ? "rgba(129,139,224,0.08)" : "transparent",
                    fontWeight: 510,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
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
            {activeGuide.title}
          </h1>
          <p className="text-[14px] text-fg-3 mb-6" style={{ fontWeight: 450 }}>
            {activeGuide.desc}
          </p>

          {/* 탭 — 활성 가이드의 sub-section (단일 탭이면 숨김) */}
          {activeGuide.tabs.length > 1 && (
            <div
              className="flex gap-1 mb-8 -mx-1"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              {activeGuide.tabs.map((t) => {
                const isActive = t.id === activeTab.id;
                return (
                  <Link
                    key={t.id}
                    to={t.path}
                    className="px-3 py-2 text-[14px] no-underline transition-colors"
                    style={{
                      color: isActive ? "#dde0e4" : "#8a8f98",
                      fontWeight: 510,
                      borderBottom: `2px solid ${isActive ? "#818be0" : "transparent"}`,
                      marginBottom: -1,
                    }}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </div>
          )}

          <Body />
        </div>
      </div>
    </div>
  );
}
