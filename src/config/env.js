import { Platform } from 'react-native';

/**
 * Backend API base URL configuration.
 *
 * Networking notes for React Native:
 *  - Android emulator: `localhost` refers to the emulator itself, so the host
 *    machine is reachable at the special IP 10.0.2.2.
 *  - Physical device: use your computer's LAN IP (e.g. http://192.168.1.5:5000)
 *    and make sure the phone is on the same Wi-Fi network.
 *
 * For production, set API_HOST_OVERRIDE to your production HTTPS URL.
 * Example: const API_HOST_OVERRIDE = 'https://api.ezyenquiry.com';
 */

// ─── Production backend (Render) ──────────────────────────────────────────────
const PRODUCTION_HOST = 'https://ezyenquiry-backend.onrender.com';

export const API_HOST = PRODUCTION_HOST;

// All backend routes are namespaced under /api
export const API_BASE_URL = `${API_HOST}/api`;

// Retailer app auth endpoints
export const RETAILER_AUTH_BASE = `${API_BASE_URL}/retailer/auth`;
