import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import Brand from "./Brand.jsx";

const NAV_ITEMS = [
  { label: "소개", href: "#" },
  { label: "가이드", to: "/guide" },                  // 내부 라우트 — Link 사용
  { label: "GitHub", href: "https://github.com", external: true },
];

export default function TopBar() {
  return (
    <header
      className="relative flex items-center h-[60px] px-6 shrink-0 gap-4"
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.09)",
        background: "#08090a",
      }}
    >
      {/* Brand (left) */}
      <Link
        to="/"
        className="flex items-center gap-3 min-w-0 no-underline"
      >
        <Brand size={20} />
        <span className="text-[12px] text-fg-4">
          GitHub → Build → Deploy
        </span>
      </Link>

      {/* Nav (center) */}
      <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const className =
            "px-3 py-1.5 rounded-md text-[14px] text-fg-2 hover:text-fg-1 hover:bg-white/[0.04] transition-colors flex items-center gap-1.5 no-underline";
          const style = { fontWeight: 510 };
          if (item.to) {
            return (
              <Link
                key={item.label}
                to={item.to}
                className={className}
                style={style}
              >
                {item.label}
              </Link>
            );
          }
          return (
            <a
              key={item.label}
              href={item.href}
              onClick={item.href === "#" ? (e) => e.preventDefault() : undefined}
              className={className}
              style={style}
              {...(item.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {item.label}
              {item.external && (
                <ArrowUpRight size={11} strokeWidth={1.8} className="text-fg-3" />
              )}
            </a>
          );
        })}
      </nav>

      {/* Right: 새 배포 CTA */}
      <Link
        to="/"
        className="ml-auto flex items-center px-3 py-1.5 rounded-md text-[13px] text-white transition-colors no-underline shrink-0"
        style={{ background: "#6672d5", fontWeight: 510 }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#828fff")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#6672d5")}
      >
        새 배포
      </Link>
    </header>
  );
}
