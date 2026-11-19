import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, refreshSession, setAccessToken } from '../api/client.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshSession().then((d) => setUser(d.user)).catch(() => {}).finally(() => setLoading(false));
    const onLogout = () => setUser(null);
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  const requestOtp = useCallback(async (phone) => (await api.post('/auth/request-otp', { phone })).data.data, []);

  const verifyOtp = useCallback(async (payload) => {
    const { data } = await api.post('/auth/verify-otp', payload);
    setAccessToken(data.data.accessToken);
    setUser(data.data.user);
    return data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally { setAccessToken(null); setUser(null); }
  }, []);

  const value = useMemo(() => ({
    user, loading, requestOtp, verifyOtp, logout,
    hasRole: (...roles) => !!user?.roles?.some((r) => roles.includes(r)),
  }), [user, loading, requestOtp, verifyOtp, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
