import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

/**
 * AuthProvider wraps the entire app and exposes auth state globally.
 * Persists token and user to localStorage for page refresh survival.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true); // True while hydrating from localStorage

  // Hydrate auth state from localStorage on first mount
  useEffect(() => {
    const storedToken = localStorage.getItem('cn_token');
    const storedUser = localStorage.getItem('cn_user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        // Corrupted data — clear it
        localStorage.removeItem('cn_token');
        localStorage.removeItem('cn_user');
      }
    }
    setLoading(false);
  }, []);

  /** Persist login credentials to state + localStorage */
  const login = useCallback((userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('cn_token', authToken);
    localStorage.setItem('cn_user', JSON.stringify(userData));
  }, []);

  /** Clear all auth state and redirect to login */
  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('cn_token');
    localStorage.removeItem('cn_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

/** Hook for consuming auth context in any component */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};
