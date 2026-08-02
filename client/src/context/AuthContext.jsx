import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, onUnauthorized } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Any request that comes back 401 drops us to the login screen, so an
  // expired session can never leave a half-working page on screen.
  useEffect(() => onUnauthorized(() => setUser(null)), []);

  const login = useCallback(async (username, password) => {
    const data = await api.post('/auth/login', { username, password });
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const changePassword = useCallback(async (payload) => {
    const data = await api.post('/auth/change-password', payload);
    setUser(data.user);
    return data.user;
  }, []);

  const can = useCallback(
    (...roles) => !!user && roles.includes(user.role),
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        changePassword,
        can,
        isAdmin: user?.role === 'admin',
        canEdit: user?.role === 'admin' || user?.role === 'hr',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export const ROLE_LABELS = {
  admin: 'Administrator',
  hr: 'HR / Data Entry',
  viewer: 'Viewer',
};
