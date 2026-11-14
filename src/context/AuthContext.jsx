import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { fetchMe, login as apiLogin, logout as apiLogout } from '../api/client';
import { reconnectSocket } from '../api/socket';

const AuthContext = createContext(null);

export const HOME_BY_ROLE = { staff: '/staff', kitchen: '/kitchen', owner: '/owner' };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const authCheckRef = useRef(null);
  const authCheckedRef = useRef(false);

  const ensureAuth = useCallback(() => {
    if (authCheckedRef.current) return Promise.resolve(user);
    if (authCheckRef.current) return authCheckRef.current;

    setLoading(true);
    authCheckRef.current = fetchMe()
      .then((d) => {
        setUser(d.user);
        return d.user;
      })
      .catch(() => {
        setUser(null);
        return null;
      })
      .finally(() => {
        authCheckedRef.current = true;
        authCheckRef.current = null;
        setLoading(false);
      });

    return authCheckRef.current;
  }, [user]);

  const login = useCallback(async (username, password) => {
    const d = await apiLogin(username, password);
    authCheckedRef.current = true;
    setUser(d.user);
    reconnectSocket();
    return d.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {}
    authCheckedRef.current = true;
    setUser(null);
    reconnectSocket();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, ensureAuth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
