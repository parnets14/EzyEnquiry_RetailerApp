/**
 * utils/api.js — DEPRECATED COMPATIBILITY SHIM
 *
 * This file used to be an 843-line monolith holding both the HTTP client and
 * every endpoint in the app. That has been split up to mirror the wholesaler
 * app's architecture:
 *
 *     services/api.js          ← the HTTP client (get/post/patch/put/delete/upload)
 *     services/<domain>Service.js  ← one file per domain
 *     hooks/                   ← useAuth / useFetch / useEnquiries / useOrders /
 *                                useNotifications / usePermissions
 *     utils/storage.js         ← token + session persistence
 *
 * Nothing here does any work any more — every export is an alias pointing at the
 * new home. It exists only so the ~56 screens that still say
 * `import { enquiryApi } from '../../utils/api'` keep working while they are
 * migrated one at a time.
 *
 * MIGRATION: replace the import with the specific service, e.g.
 *
 *     - import { enquiryApi } from '../../utils/api';
 *     + import { enquiryService } from '../../services/enquiryService';
 *
 *     - const data = await enquiryApi.list({ limit: 100 });
 *     + const data = await enquiryService.list({ limit: 100 });
 *
 * When the last screen has moved, delete this file.
 */

// ─── Client-level helpers (now in services/api.js) ───────────────────────────
export { setUnauthorizedHandler, warmUp, mediaUrl, BASE_URL, RETAILER_BASE, RETAILER_AUTH_BASE } from '../services/api';

// ─── Storage / session (now in utils/storage.js) ─────────────────────────────
export { session, getToken, setToken, removeToken, getUser, setUser, removeUser } from './storage';

// ─── Domain services, exposed under their legacy names ───────────────────────
export { authService as authApi }                 from '../services/authService';
export { dashboardService as dashboardApi }       from '../services/dashboardService';
export { productService as productApi }           from '../services/productService';
export { customerService as customerApi }         from '../services/customerService';
export { enquiryService as enquiryApi }           from '../services/enquiryService';
export { orderService as orderApi }               from '../services/orderService';
export { invoiceService as invoiceApi }           from '../services/invoiceService';
export { paymentService as paymentApi }           from '../services/paymentService';
export { myProductService as myProductApi }       from '../services/myProductService';
export { notificationService as notificationApi } from '../services/notificationService';
export { profileService as profileApi }           from '../services/profileService';
export { subscriptionService as subscriptionApi } from '../services/subscriptionService';
export { catalogService as catalogApi }           from '../services/catalogService';
export { staffService as staffApi }               from '../services/staffService';

// The whole ERP surface was one flat object; it is now split per domain and
// re-assembled by the facade, so the legacy call sites are untouched.
export { erpService as erpApi }                   from '../services/erpService';

// ─── Constants kept for the screens that still import them from here ─────────
export { API_BASE_URL } from '../config/env';
