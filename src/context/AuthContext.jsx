import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, session } from '../utils/api';

/**
 * AuthContext — single source of truth for the logged-in user.
 *
 * - On startup, loads the cached user from AsyncStorage (fast) and then
 *   refreshes it from the backend /me endpoint (accurate).
 * - `setUser` is used by Login/OTP screens after a successful sign-in.
 * - `refresh` re-fetches the profile (e.g. after approval status changes).
 * - `logout` clears the session and the in-memory user.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load cached user, then refresh from server
  useEffect(() => {
    (async () => {
      try {
        const cached = await session.getUser();
        if (cached) setUserState(cached);

        // If we have a session, refresh from /me for the latest data
        if (cached) {
          try {
            const fresh = await authApi.me();
            if (fresh) {
              setUserState(fresh);
              await session.save(undefined, fresh); // keep cache in sync
            }
          } catch {
            // token invalid/expired or offline — keep cached user
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Called by Login / OTP screens after session.save
  const setUser = useCallback((u) => setUserState(u), []);

  const refresh = useCallback(async () => {
    try {
      const fresh = await authApi.me();
      if (fresh) {
        setUserState(fresh);
        await session.save(undefined, fresh);
      }
      return fresh;
    } catch {
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.warn('[Auth] Backend logout failed:', error.message);
    } finally {
      await session.clear();
      setUserState(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
