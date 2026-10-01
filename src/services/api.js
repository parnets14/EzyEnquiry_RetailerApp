// src/services/api.js
//
// Thin HTTP client for the Retailer app.
//
// The SURFACE mirrors wholesalerapp/src/services/api.js exactly —
//     api.get(path, { params })   api.post(path, data)   api.patch(path, data)
//     api.put(path, data)         api.delete(path, { params })   api.upload(path, form)
// — so every domain service in this folder reads like its wholesaler twin and
// the two codebases stay legible side by side.
//
// The TRANSPORT deliberately does NOT mirror the wholesaler, because all ~56
// screens in this app are written against these semantics:
//
//   • unwraps the `{ success, data }` envelope → resolves to `data`
//   • 45 s timeout — the Render free tier cold-starts for 30-60 s, and the
//     wholesaler's 20 s window aborts perfectly healthy first requests
//   • treats `success: false` on a 2xx response as an error
//   • central 401 handling: an expired/invalid token clears the stored session
//     exactly once and hands control back to AuthContext (see
//     setUnauthorizedHandler) instead of leaving the user stranded on a
//     dead authenticated stack
//   • `/auth/*` 401s are ordinary login/OTP failures and never kill a session
//
// Endpoints are retailer-scoped: every path is prefixed with
// `${API_BASE_URL}/retailer`, so a service writes `api.get('/enquiries')` where
// the wholesaler writes the same call against a different mount point.
import { API_HOST, API_BASE_URL, RETAILER_AUTH_BASE } from '../config/env';
import { getToken, session } from '../utils/storage';

// ── Base URLs ────────────────────────────────────────────────────────────────
export const BASE_URL = API_BASE_URL;
export const RETAILER_BASE = `${API_BASE_URL}/retailer`;
// Re-exported rather than recomputed — config/env.js already owns this value.
export { RETAILER_AUTH_BASE };

// 45 s — sized to survive a Render cold start (see the header note).
const DEFAULT_TIMEOUT = 45000;
const UPLOAD_TIMEOUT = 60000;

// ─── Global 401 handling ──────────────────────────────────────────────────────
// A JWT that expires (or is rejected for any other reason) makes EVERY
// authenticated request fail with 401 "Invalid or expired token". Without a
// central handler the stale token stays in AsyncStorage, the cached user keeps
// the app on the authenticated stack, and every screen just shows the raw error
// forever — the user is stuck and has to reinstall/clear data to recover.
//
// So: when any request 401s, clear the stored session exactly once and tell the
// app to drop back to Login. AuthContext subscribes via setUnauthorizedHandler.
let onUnauthorized = null;
// Guards against a fan-out of parallel 401s each triggering a logout/navigation.
let handlingUnauthorized = false;

export function setUnauthorizedHandler(fn) {
  onUnauthorized = typeof fn === 'function' ? fn : null;
}

async function notifyUnauthorized() {
  if (handlingUnauthorized) return;
  handlingUnauthorized = true;
  try {
    await session.clear();
  } catch { /* best-effort */ }
  try {
    if (onUnauthorized) onUnauthorized();
  } catch { /* best-effort */ }
  // Release on the next tick so a burst of sibling 401s is deduped but a later,
  // genuine expiry (after re-login) is still caught.
  setTimeout(() => { handlingUnauthorized = false; }, 0);
}

// 401 bodies that mean "the session is gone" — as opposed to a 401 that is a
// legitimate business response (e.g. a wrong OTP/password on the login screen,
// which must NOT wipe the session or bounce the user around mid-auth-flow).
const SESSION_DEAD_MESSAGES = [
  'invalid or expired token',
  'no token provided',
  'user not found',
  'staff member not found',
  'account deactivated',
  'token has expired',
];

function isSessionDead(json, url) {
  // Never treat an auth-endpoint 401 as a dead session — those are ordinary
  // login/OTP failures and the screens handle them inline.
  if (/\/auth\/(login|register|verify|otp|forgot|reset)/i.test(url)) return false;
  const msg = String(json?.message || '').toLowerCase();
  if (!msg) return true; // bare 401 with no message → still assume the session is gone
  return SESSION_DEAD_MESSAGES.some(m => msg.includes(m));
}

// ─── URL building ────────────────────────────────────────────────────────────
function toQuery(params = {}) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Absolute URLs (http…) pass through untouched; everything else is retailer-scoped. */
function buildUrl(path, params) {
  const base = /^https?:\/\//i.test(path) ? path : `${RETAILER_BASE}${path}`;
  return `${base}${toQuery(params)}`;
}

async function authHeader() {
  const token = await getToken().catch(() => null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Low-level request ───────────────────────────────────────────────────────
async function request(method, path, body, params, timeout = DEFAULT_TIMEOUT) {
  const url = buildUrl(path, params);
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',    // prevent 304 stale responses
    ...(await authHeader()),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      // The backend is deployed on Render, whose free instances spin down when
      // idle and take 30-60 s to cold-start. A 20 s timeout therefore aborted
      // perfectly healthy first requests and reported a connection problem.
      // `DEFAULT_TIMEOUT` is sized to survive that; if we still time out, say so
      // usefully instead of blaming the user's connection.
      throw new Error(
        'The server is taking too long to respond. It may be waking up — please try again in a moment.',
      );
    }
    throw new Error('Unable to reach the server. Please check your connection.');
  }
  clearTimeout(timer);

  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }

  if (!res.ok || (json && json.success === false)) {
    const message = json?.message || `Request failed (${res.status}).`;
    const error = new Error(message);
    error.status = res.status;
    error.data = json;
    // Expired/invalid session → clear it once and fall back to Login.
    if (res.status === 401 && isSessionDead(json, url)) {
      notifyUnauthorized();
    }
    throw error;
  }

  return json?.data !== undefined ? json.data : json;
}

// ─── Multipart upload ────────────────────────────────────────────────────────
// Do NOT set Content-Type — RN/fetch adds the multipart boundary itself.
async function upload(path, form, timeoutMs = UPLOAD_TIMEOUT, method = 'POST') {
  const url = buildUrl(path);
  const headers = { ...(await authHeader()) };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url, { method, headers, body: form, signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Upload timed out. Please check your connection and try again.');
    throw new Error('Unable to reach the server. Please check your connection.');
  }
  clearTimeout(timer);

  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }

  if (!res.ok || (json && json.success === false)) {
    const message = json?.message || `Upload failed (${res.status}).`;
    const error = new Error(message);
    error.status = res.status;
    error.data = json;
    if (res.status === 401 && isSessionDead(json, url)) {
      notifyUnauthorized();
    }
    throw error;
  }
  return json?.data !== undefined ? json.data : json;
}

// ─── Public surface (identical to the wholesaler's api object) ───────────────
const api = {
  get:    (path, opts = {}) => request('GET',    path, null, opts.params),
  post:   (path, data)      => request('POST',   path, data),
  patch:  (path, data)      => request('PATCH',  path, data),
  put:    (path, data)      => request('PUT',    path, data),
  delete: (path, opts = {}) => request('DELETE', path, null, opts.params),
  upload,
};

export default api;

// ─── Backend warm-up ─────────────────────────────────────────────────────────
/**
 * Fire-and-forget ping of the backend's /health route.
 *
 * The production backend runs on Render, whose free instances spin down after
 * inactivity and need 30-60 s to cold-start. Without this, the FIRST real
 * request after an idle period (usually the login OTP call) eats the whole
 * cold start and can still hit the timeout.
 *
 * Calling this at app launch starts the wake-up while the user is still typing
 * their mobile number, so the login request lands on an already-warm server.
 *
 * Note: /health sits at the HOST root, NOT under /api.
 * Never throws and never blocks — a failure here is irrelevant.
 */
export function warmUp() {
  try {
    fetch(`${API_HOST}/health`).catch(() => { /* offline / unreachable is fine */ });
  } catch { /* ignore */ }
}

// ─── Media URL helper ────────────────────────────────────────────────────────
export function mediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_HOST}${path.startsWith('/') ? '' : '/'}${path}`;
}
