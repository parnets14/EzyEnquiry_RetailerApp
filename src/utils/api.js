import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_HOST, API_BASE_URL, RETAILER_AUTH_BASE } from '../config/env';
import { STORAGE_KEYS } from '../constants';

const DEFAULT_TIMEOUT = 20000; // 20 s
const RETAILER_BASE   = `${API_BASE_URL}/retailer`;

// ─── Low-level fetch helper ───────────────────────────────────────────────────
async function request(url, { method = 'GET', body, auth = false, timeout = DEFAULT_TIMEOUT } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Request timed out. Please check your connection and try again.');
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
    throw error;
  }

  return json?.data !== undefined ? json.data : json;
}

// ─── Multipart upload helper ──────────────────────────────────────────────────
async function uploadMultipart(url, form, timeoutMs = 30000) {
  const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body: form, signal: controller.signal });
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
    throw error;
  }
  return json?.data !== undefined ? json.data : json;
}

// ─── Query string helper ──────────────────────────────────────────────────────
function toQuery(params = {}) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authApi = {
  checkMobile(mobile) {
    return request(`${RETAILER_AUTH_BASE}/check-mobile`, { method: 'POST', body: { mobile } });
  },
  sendOtp(mobile, purpose = 'login') {
    return request(`${RETAILER_AUTH_BASE}/send-otp`, { method: 'POST', body: { mobile, purpose } });
  },
  verifyOtp(mobile, otp, purpose = 'login') {
    return request(`${RETAILER_AUTH_BASE}/verify-otp`, { method: 'POST', body: { mobile, otp, purpose } });
  },
  login(identifier, password) {
    return request(`${RETAILER_AUTH_BASE}/login`, { method: 'POST', body: { identifier, password } });
  },
  register(payload) {
    return request(`${RETAILER_AUTH_BASE}/register`, { method: 'POST', body: payload });
  },
  me() {
    return request(`${RETAILER_AUTH_BASE}/me`, { auth: true });
  },
  logout() {
    return request(`${RETAILER_AUTH_BASE}/logout`, { method: 'POST', auth: true });
  },

  /** Upload KYC documents — authenticated multipart POST */
  async uploadDocs(fieldName, file) {
    const form = new FormData();
    form.append(fieldName, {
      uri:  file.uri,
      type: file.type  || 'image/jpeg',
      name: file.name  || `${fieldName}.jpg`,
    });
    return uploadMultipart(`${RETAILER_BASE}/kyc/documents`, form);
  },
};

// ─── Retailer dashboard API ───────────────────────────────────────────────────
export const dashboardApi = {
  get() {
    return request(`${RETAILER_BASE}/dashboard`, { auth: true });
  },
};

// ─── Products API ─────────────────────────────────────────────────────────────
export const productApi = {
  /**
   * Search retailer-visible products (marketplace DTO, no internal prices).
   * params: { search, code, design, size, finish, color, category, brand, location, page, limit }
   */
  search(params = {}) {
    return request(`${RETAILER_BASE}/products${toQuery(params)}`, { auth: true });
  },
  get(id) {
    return request(`${RETAILER_BASE}/products/${id}`, { auth: true });
  },
};

// ─── Enquiry API ──────────────────────────────────────────────────────────────
export const enquiryApi = {
  list(params = {}) {
    return request(`${RETAILER_BASE}/enquiries${toQuery(params)}`, { auth: true });
  },
  create(body) {
    return request(`${RETAILER_BASE}/enquiries`, { method: 'POST', auth: true, body });
  },
  get(id) {
    return request(`${RETAILER_BASE}/enquiries/${id}`, { auth: true });
  },
  cancel(id, reason = '') {
    return request(`${RETAILER_BASE}/enquiries/${id}/cancel`, { method: 'PATCH', auth: true, body: { reason } });
  },

  // Messages
  listMessages(enquiryId) {
    return request(`${RETAILER_BASE}/enquiries/${enquiryId}/messages`, { auth: true });
  },
  sendMessage(enquiryId, message, clientMessageId = '') {
    return request(`${RETAILER_BASE}/enquiries/${enquiryId}/messages`, {
      method: 'POST', auth: true, body: { message, client_message_id: clientMessageId },
    });
  },

  // Offers
  listOffers(enquiryId) {
    return request(`${RETAILER_BASE}/enquiries/${enquiryId}/offers`, { auth: true });
  },
  respondToOffer(enquiryId, offerId, action) {
    return request(`${RETAILER_BASE}/enquiries/${enquiryId}/offers/${offerId}`, {
      method: 'PATCH', auth: true, body: { action },
    });
  },
};

// ─── Order API ────────────────────────────────────────────────────────────────
export const orderApi = {
  list(params = {}) {
    return request(`${RETAILER_BASE}/orders${toQuery(params)}`, { auth: true });
  },
  create(body) {
    return request(`${RETAILER_BASE}/orders`, { method: 'POST', auth: true, body });
  },
  get(id) {
    return request(`${RETAILER_BASE}/orders/${id}`, { auth: true });
  },
  cancel(id, reason = '') {
    return request(`${RETAILER_BASE}/orders/${id}/cancel`, { method: 'PATCH', auth: true, body: { reason } });
  },
  tracking(id) {
    return request(`${RETAILER_BASE}/orders/${id}/tracking`, { auth: true });
  },
};

// ─── Notification API ─────────────────────────────────────────────────────────
export const notificationApi = {
  list(params = {}) {
    return request(`${RETAILER_BASE}/notifications${toQuery(params)}`, { auth: true });
  },
  markRead(id) {
    return request(`${RETAILER_BASE}/notifications/${id}/read`, { method: 'PATCH', auth: true });
  },
  markAllRead() {
    return request(`${RETAILER_BASE}/notifications/read-all`, { method: 'PATCH', auth: true });
  },
};

// ─── Profile / company / account API ─────────────────────────────────────────
export const profileApi = {
  getProfile() {
    return request(`${RETAILER_BASE}/profile`, { auth: true });
  },
  updateProfile(body) {
    return request(`${RETAILER_BASE}/profile`, { method: 'PUT', auth: true, body });
  },
  getCompany() {
    return request(`${RETAILER_BASE}/company`, { auth: true });
  },
  updateCompany(body) {
    return request(`${RETAILER_BASE}/company`, { method: 'PUT', auth: true, body });
  },
  changePassword(currentPassword, newPassword) {
    return request(`${RETAILER_BASE}/change-password`, {
      method: 'PATCH', auth: true,
      body: { current_password: currentPassword, new_password: newPassword },
    });
  },

  // Delivery addresses
  listAddresses() {
    return request(`${RETAILER_BASE}/addresses`, { auth: true });
  },
  addAddress(body) {
    return request(`${RETAILER_BASE}/addresses`, { method: 'POST', auth: true, body });
  },
  updateAddress(id, body) {
    return request(`${RETAILER_BASE}/addresses/${id}`, { method: 'PUT', auth: true, body });
  },
  deleteAddress(id) {
    return request(`${RETAILER_BASE}/addresses/${id}`, { method: 'DELETE', auth: true });
  },

  // KYC
  getKycDocuments() {
    return request(`${RETAILER_BASE}/kyc/documents`, { auth: true });
  },
};

// ─── Subscription API ─────────────────────────────────────────────────────────
export const subscriptionApi = {
  current() {
    return request(`${RETAILER_BASE}/subscription/current`, { auth: true });
  },
  plans() {
    return request(`${RETAILER_BASE}/subscription/plans`, { auth: true });
  },
};

// ─── Media URL helper ─────────────────────────────────────────────────────────
export function mediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_HOST}${path.startsWith('/') ? '' : '/'}${path}`;
}

// ─── Session helpers ──────────────────────────────────────────────────────────
export const session = {
  async save(token, user) {
    const ops = [AsyncStorage.setItem(STORAGE_KEYS.IS_LOGGED_IN, 'true')];
    if (token) ops.push(AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token));
    if (user)  ops.push(AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user)));
    await Promise.all(ops);
  },
  async clear() {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_DATA,
      STORAGE_KEYS.IS_LOGGED_IN,
    ]);
  },
  async getUser() {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    return raw ? JSON.parse(raw) : null;
  },
};

export { API_BASE_URL };
