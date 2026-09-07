import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '../api/client';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<User>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  // If a token exists but no cached user, we must wait for the session
  // restore request before protected routes decide whether to redirect.
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem('token') && !localStorage.getItem('user');
    } catch {
      return false;
    }
  });

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, user: userData } = response.data.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // H10: quiz drafts and redirect targets must not leak across sessions
    // on shared school computers - clear any quiz/attempt-scoped keys plus
    // the post-login redirect.
    try {
      const doomed: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && /^(quiz|attempt|draft)[-_]/i.test(key)) doomed.push(key);
      }
      doomed.forEach((k) => localStorage.removeItem(k));
      sessionStorage.removeItem('postLoginRedirect');
    } catch {
      // storage unavailable - nothing to clear
    }
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      const userData = response.data.data.user;
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return userData;
    } catch (err: any) {
      // H10: only a 401 means the session is actually dead (expired or
      // revoked). A network blip keeps the cached user instead of logging
      // out from under in-progress work.
      if (err?.response?.status === 401) {
        logout();
      }
      throw err;
    }
  }, [logout]);

  useEffect(() => {
    // H10: always revalidate on mount. A cached user with an expired or
    // revoked (server-side tokenVersion) token must not look authenticated
    // until the first 401 proves otherwise.
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    refreshUser()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  // The API client dispatches this when any authenticated request comes
  // back 401 (expired/revoked session). Clear user state so protected
  // routes redirect through React Router instead of a hard reload.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    isTeacher: user?.role === 'TEACHER',
    isStudent: user?.role === 'STUDENT',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}