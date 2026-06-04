import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import Brand from "./Brand.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

const NAV_ITEMS = [
  { label: "소통", to: "/community" },
  { label: "가이드", to: "/guide" },
];

// 로그인 사용자만 보이는 추가 nav (대시보드 등) — NAV_ITEMS와 GITHUB_NAV_ITEM 사이에 삽입
const AUTHED_NAV_ITEMS = [
  { label: "대시보드", to: "/dashboard" },
];

// 등급(admin/root)에게만 보이는 관리자 링크 — /auth/me의 role로 분기
const ADMIN_NAV_ITEM = { label: "관리자", to: "/admin" };
const ADMIN_ROLES = ["admin", "root"];

// NAV 끝(대시보드 우측)에 항상 표시되는 KoDeploy 소스 repo 링크
const GITHUB_NAV_ITEM = {
  label: "GitHub",
  href: "https://github.com/yuntyu01/kodeploy",
  external: true,
};

export default function TopBar({ onLogin }) {
  const { user, loading } = useAuth();

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

      {/* Nav (center) — 소개·가이드·(대시보드)·GitHub. GitHub은 항상 끝. */}
      <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
        {[
          ...NAV_ITEMS,
          ...(user ? AUTHED_NAV_ITEMS : []),
          ...(user && ADMIN_ROLES.includes(user.role) ? [ADMIN_NAV_ITEM] : []),
        ].map((item) => {
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

      {/* Right: 인증 영역만 (GitHub은 center NAV 끝으로 이동됨) */}
      <div className="ml-auto flex items-center gap-3 shrink-0">
        {/* /me 첫 호출 완료 전엔 깜빡임 방지 — placeholder는 비워둠 */}
        {loading ? null : user ? (
          <UserMenu />
        ) : (
          <button
            onClick={onLogin}
            className="flex items-center px-3 py-1.5 rounded-md text-[13px] text-white transition-colors"
            style={{ background: "#6672d5", fontWeight: 510 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#828fff")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#6672d5")}
          >
            로그인
          </button>
        )}
      </div>
    </header>
  );
}

// avatar + login + dropdown(로그아웃). 외부 클릭 / Esc로 닫힘.
function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (user.login || "?").slice(0, 1).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-md hover:bg-white/[0.04] transition-colors"
      >
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt=""
            className="w-6 h-6 rounded-full"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          />
        ) : (
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] text-white"
            style={{
              background: "linear-gradient(135deg, #7170ff 0%, #5e6ad2 100%)",
              fontWeight: 590,
            }}
          >
            {initial}
          </span>
        )}
        <span className="text-[13px] text-fg-1" style={{ fontWeight: 510 }}>
          {user.login}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] w-40 rounded-md py-1 kd-fade-in"
          style={{
            background: "#131415",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            zIndex: 30,
          }}
        >
          <button
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-fg-2 hover:text-fg-1 hover:bg-white/[0.04] transition-colors"
            style={{ fontWeight: 510 }}
          >
            <LogOut size={13} strokeWidth={1.8} className="text-fg-3" />
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
