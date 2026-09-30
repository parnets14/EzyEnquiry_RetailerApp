/**
 * Backend API base URL configuration.
 *
 * Pick ONE of the two hosts below and assign it to `API_HOST` at the bottom.
 *
 * ── Why this file matters ─────────────────────────────────────────────────────
 * If `API_HOST` points at a machine that isn't reachable, EVERY request aborts
 * after `DEFAULT_TIMEOUT` (see src/utils/api.js) and the app surfaces a generic
 *   "The server is taking too long to respond…" / "Unable to reach the server…"
 * Those messages are misleading — they look like a phone/Wi-Fi problem, but they
 * almost always mean the configured host is wrong or the local server is down.
 *
 * ── Option A: PRODUCTION (default) ────────────────────────────────────────────
 * The Render deployment. Works from any network — no Wi-Fi matching, no LAN IP,
 * no running local server. This is what the wholesaler app uses, so both apps
 * talk to the same database.
 *
 * ── Option B: LOCAL DEV SERVER ────────────────────────────────────────────────
 * Only use this while actively developing against a backend running on your PC.
 * Requirements — all three, or you get the timeout above:
 *   1. The backend is running (`npm run dev` in EzyEnquiry-backend, port 5000).
 *   2. `LOCAL_HOST` below is THIS machine's current LAN IP — it changes when you
 *      switch networks, so re-check it with `ipconfig` before trusting it.
 *   3. The phone is on the same Wi-Fi, and the router is NOT using AP isolation.
 * Android emulator note: `localhost` refers to the emulator itself; use the
 * special alias 10.0.2.2 to reach the host machine.
 */

// ─── Option A: production backend (Render) ────────────────────────────────────
// Keep in sync with wholesalerapp/src/services/api.js BASE_URL.
const PRODUCTION_HOST = 'https://ezyenquiry-backend.onrender.com';

// ─── Option B: local dev server ───────────────────────────────────────────────
// Replace with your machine's LAN IPv4 (Windows: `ipconfig` → IPv4 Address).
// NOTE: 192.168.1.45 is a STALE value from a previous network — it is not this
// machine's address and produces a timeout. Update before enabling.
// Kept intentionally unused so switching hosts is a one-line comment swap.
// eslint-disable-next-line no-unused-vars
const LOCAL_HOST = 'https://ezyenquiry-backend.onrender.com';

// ─── Active host ──────────────────────────────────────────────────────────────
export const API_HOST = PRODUCTION_HOST;
// export const API_HOST = LOCAL_HOST;

// All backend routes are namespaced under /api
export const API_BASE_URL = `${API_HOST}/api`;

// Retailer app auth endpoints
export const RETAILER_AUTH_BASE = `${API_BASE_URL}/retailer/auth`;
