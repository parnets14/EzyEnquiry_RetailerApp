import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, session, setUnauthorizedHandler, warmUp } from '../utils/api';
import {
  requestPermission,
  registerFcmToken,
  clearFcmToken,
  createNotificationChannels,
} from '../services/pushNotificationService';

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
    // Kick the Render backend awake immediately. Free instances cold-start in
    // 30-60 s; doing this now means the first real request (usually login OTP)
    // hits a warm server instead of stalling. Fire-and-forget — never blocks.
    warmUp();

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
          } catch (e) {
            // A 401 here means the stored token is dead. `api.js` has already
            // cleared the session and fired the unauthorized handler, which sets
            // user to null — so we must NOT restore the cached user, or the app
            // would sit on the authenticated stack with a token that no longer
            // works and every screen would show "Invalid or expired token".
            // Any other failure (offline, server down) keeps the cache so the
            // user can still open the app without a connection.
            if (e?.status === 401) {
              setUserState(null);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Register FCM token whenever user becomes logged in
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        await createNotificationChannels();
        const granted = await requestPermission();
        if (granted) await registerFcmToken();
      } catch { /* non-fatal */ }
    })();
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps
  // ^ Deliberately keyed on the id, not the whole `user` object. `user` is
  // replaced on every refresh()/setUser, so depending on it would re-run this
  // effect on each state update and re-prompt for notification permission and
  // re-register the FCM token. Only a change of identity should re-register.

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
      await clearFcmToken();
      await session.clear();
      setUserState(null);
    }
  }, []);

  /**
   * Global session-expiry handler.
   *
   * `api.js` calls this whenever an authenticated request comes back 401 with a
   * dead-session message. The stored token has ALREADY been cleared by the time
   * we get here, so we only need to drop the in-memory user — the navigator then
   * falls back to the Login stack on its own.
   *
   * Deliberately does NOT call `logout()`: that would fire a network request
   * with a token we already know is invalid.
   */
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUserState(null);
    });
    return () => setUnauthorizedHandler(null);
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
