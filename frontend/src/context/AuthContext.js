import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const API = '/api/auth';

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true); // true while checking session

  // Check existing session on mount
  useEffect(() => {
    fetch(`${API}/me`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => setUser(data?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const register = useCallback(async (formData) => {
    const res = await fetch(`${API}/register`, {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(formData),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    setUser(data.user);
    return data;
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const res = await fetch(`${API}/login`, {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API}/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch(`${API}/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data?.user ?? null);
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
