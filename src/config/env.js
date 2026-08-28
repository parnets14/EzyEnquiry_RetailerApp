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

// ─── Override for physical device testing or production ────────────────────────
// Set to your LAN IP during development with a real device.
// Set to your production HTTPS URL for release builds.
// Set to null to use the emulator defaults below.
const API_HOST_OVERRIDE = __DEV__
  ? 'http://192.168.1.45:5000'   // Developer LAN IP (change to yours)
  : null;                         // Production: configure below or use env injection

// ─── Production host (used when override is null and not in __DEV__) ──────────
const PRODUCTION_HOST = 'https://api.ezyenquiry.com'; // Replace with real prod URL

const DEFAULT_HOST = Platform.select({
  android: 'http://10.0.2.2:5000',  // Android emulator → host machine
  default: 'http://localhost:5000',
});

export const API_HOST = API_HOST_OVERRIDE
  || (__DEV__ ? DEFAULT_HOST : PRODUCTION_HOST);

// All backend routes are namespaced under /api
export const API_BASE_URL = `${API_HOST}/api`;

// Retailer app auth endpoints
export const RETAILER_AUTH_BASE = `${API_BASE_URL}/retailer/auth`;
