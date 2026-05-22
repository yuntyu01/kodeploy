// 인증 상태 전역 컨텍스트.
// - 앱 마운트 시 /auth/me 한 번 호출해 user 채움 (null이면 미로그인)
// - logout()은 백엔드 세션 revoke + cookie 삭제 + 로컬 user state 비우기
// - openLogin()은 LoginModal을 열어주는 공통 entry point — DeployForm 등에서 401 시 호출
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getMe, logout as apiLogout } from "../api/auth.js";

const AuthContext = createContext(null);

export function AuthProvider({ children, onOpenLogin }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // 백엔드가 죽었어도 로컬은 비움
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, refresh, logout, openLogin: onOpenLogin }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth는 AuthProvider 안에서만 사용");
  return ctx;
}
