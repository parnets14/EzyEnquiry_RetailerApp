// src/utils/storage.js
//
// Token / user persistence helpers.
//
// Mirrors wholesalerapp/src/utils/storage.js so services/api.js and
// services/reportsService.js can call `getToken()` exactly as their wholesaler
// twins do. The KEYS themselves are the Retailer app's own
// (constants.STORAGE_KEYS → '@ezy_*') so the two apps never share a session
// on a device that has both installed.
//
// NOTE: unlike the wholesaler's version this file does NOT define its own
// STORAGE_KEYS constant — the Retailer app already owns one in
// src/constants/index.js and that is the single source of truth.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

export { STORAGE_KEYS };

// ── Auth token ───────────────────────────────────────────────────────────────
export const getToken    = () => AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
export const setToken    = (t) => AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, t);
export const removeToken = () => AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);

// ── Cached user ──────────────────────────────────────────────────────────────
export const getUser = async () => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
export const setUser    = (u) => AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(u));
export const removeUser = () => AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);

// ── FCM push token ───────────────────────────────────────────────────────────
export const getFcmToken    = () => AsyncStorage.getItem(STORAGE_KEYS.FCM_TOKEN);
export const setFcmToken    = (t) => AsyncStorage.setItem(STORAGE_KEYS.FCM_TOKEN, t);
export const removeFcmToken = () => AsyncStorage.removeItem(STORAGE_KEYS.FCM_TOKEN);

// ── Session bundle ───────────────────────────────────────────────────────────
// The wholesaler has no equivalent object — its screens call setToken / setUser
// individually. The Retailer app's auth screens have always spoken in terms of
// one atomic session, so it is kept as a named export here rather than being
// scattered across four screens. Lives in this module because it is purely a
// storage concern.
export const session = {
  /** Persist token + user atomically. Either may be omitted. */
  async save(token, user) {
    const ops = [AsyncStorage.setItem(STORAGE_KEYS.IS_LOGGED_IN, 'true')];
    if (token) ops.push(AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token));
    if (user)  ops.push(AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user)));
    await Promise.all(ops);
  },

  /** Drop the whole session — token, cached user and the logged-in flag. */
  async clear() {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_DATA,
      STORAGE_KEYS.IS_LOGGED_IN,
    ]);
  },

  getUser,
};
