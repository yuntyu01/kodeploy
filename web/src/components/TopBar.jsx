import { ArrowUpRight } from "lucide-react";
import Brand from "./Brand.jsx";

const NAV_ITEMS = [
  { label: "소개", href: "#" },
  { label: "문서", href: "#" },
  { label: "GitHub", href: "https://github.com", external: true },
];

export default function TopBar() {
  return (
    <header
      className="relative flex items-center h-14 px-6 shrink-0 gap-4"
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.09)",
        background: "#08090a",
      }}
    >
      {/* Brand (left) */}
      <div className="flex items-center gap-3 min-w-0">
        <Brand size={20} />
        <span className="text-[12px] text-fg-4">
          GitHub → Build → Deploy
        </span>
      </div>

      {/* Nav (center) */}
      <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.label}
            href={item.href}
            onClick={item.href === "#" ? (e) => e.preventDefault() : undefined}
            className="px-3 py-1.5 rounded-md text-[13px] text-fg-2 hover:text-fg-1 hover:bg-white/[0.04] transition-colors flex items-center gap-1.5"
            style={{ fontWeight: 510 }}
            {...(item.external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            {item.label}
            {item.external && (
              <ArrowUpRight size={11} strokeWidth={1.8} className="text-fg-3" />
            )}
          </a>
        ))}
      </nav>

      {/* Right placeholder */}
      <div className="ml-auto flex items-center gap-3 shrink-0" />
    </header>
  );
}
