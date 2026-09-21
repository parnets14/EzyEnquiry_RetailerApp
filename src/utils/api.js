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
async function uploadMultipart(url, form, timeoutMs = 30000, method = 'POST') {
  const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

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

  /** Upload one KYC document — authenticated multipart POST */
  async uploadDocs(fieldName, file) {
    const form = new FormData();
    form.append(fieldName, {
      uri:  file.uri,
      type: file.type  || 'image/jpeg',
      name: file.name  || `${fieldName}.jpg`,
    });
    return uploadMultipart(`${RETAILER_BASE}/kyc/documents`, form);
  },

  /** Upload all documents selected during registration in one request. */
  async uploadRegistrationDocs(documents = {}) {
    const form = new FormData();
    let count = 0;
    for (const document of Object.values(documents)) {
      if (!document?.field || !document?.file?.uri) continue;
      form.append(document.field, {
        uri: document.file.uri,
        type: document.file.type || 'application/octet-stream',
        name: document.file.name || `${document.field}.jpg`,
      });
      count += 1;
    }
    if (!count) return { uploaded: [], documents: [] };
    return uploadMultipart(`${RETAILER_BASE}/kyc/documents`, form, 60000);
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
   * params: { search, code, design, size, finish, color, material, tile_type,
   *   application, manufacturer, collection, category, sub_category, brand,
   *   location, featured, new_arrival, page, limit }
   */
  search(params = {}) {
    return request(`${RETAILER_BASE}/products${toQuery(params)}`, { auth: true });
  },
  get(id) {
    return request(`${RETAILER_BASE}/products/${id}`, { auth: true });
  },
};

// ─── Customer API ─────────────────────────────────────────────────────────────
// Customers belong to the product-owner (Admin) company. Pass that company's id
// so the dropdown reads, and new customers are added to, the correct catalogue.
export const customerApi = {
  list(companyId, params = {}) {
    return request(`${RETAILER_BASE}/customers${toQuery({ company_id: companyId, ...params })}`, { auth: true });
  },
  create(companyId, body = {}) {
    return request(`${RETAILER_BASE}/customers`, {
      method: 'POST', auth: true, body: { company_id: companyId, ...body },
    });
  },
  update(id, companyId, body = {}) {
    return request(`${RETAILER_BASE}/customers/${id}`, {
      method: 'PUT', auth: true, body: { company_id: companyId, ...body },
    });
  },
  remove(id, companyId) {
    return request(`${RETAILER_BASE}/customers/${id}${toQuery({ company_id: companyId })}`, {
      method: 'DELETE', auth: true,
    });
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

  // Dispatches for an order (partial dispatch support). Falls back gracefully
  // to tracking() if the backend has not yet exposed a dedicated endpoint.
  async dispatches(id) {
    try {
      return await request(`${RETAILER_BASE}/orders/${id}/dispatches`, { auth: true });
    } catch (err) {
      if (err.status === 404) {
        const t = await orderApi.tracking(id);
        return { dispatches: t?.dispatch ? [t.dispatch] : [] };
      }
      throw err;
    }
  },

  // ── Delivery OTP ──────────────────────────────────────────────────────────
  // Retailer requests / re-sends the delivery OTP to their registered mobile.
  requestDeliveryOtp(id, dispatchId) {
    return request(`${RETAILER_BASE}/orders/${id}/delivery-otp`, {
      method: 'POST', auth: true, body: { dispatch_id: dispatchId },
    });
  },
  // Retailer confirms delivery by entering the OTP (self-confirm path).
  confirmDeliveryOtp(id, dispatchId, otp) {
    return request(`${RETAILER_BASE}/orders/${id}/delivery-otp/verify`, {
      method: 'POST', auth: true, body: { dispatch_id: dispatchId, otp },
    });
  },
};

// ─── Invoice API ──────────────────────────────────────────────────────────────
// One invoice is raised per dispatch (for the dispatched quantity).
export const invoiceApi = {
  list(params = {}) {
    return request(`${RETAILER_BASE}/invoices${toQuery(params)}`, { auth: true });
  },
  get(id) {
    return request(`${RETAILER_BASE}/invoices/${id}`, { auth: true });
  },
  // Invoices for a specific order
  byOrder(orderId) {
    return request(`${RETAILER_BASE}/orders/${orderId}/invoices`, { auth: true });
  },
};

// ─── Payment API ──────────────────────────────────────────────────────────────
export const paymentApi = {
  // Initiate an online payment against an invoice → returns gateway order details.
  initiate(invoiceId, method = 'Online') {
    return request(`${RETAILER_BASE}/invoices/${invoiceId}/pay`, {
      method: 'POST', auth: true, body: { method },
    });
  },
  // Confirm the gateway result (called after the gateway SDK returns).
  confirm(invoiceId, payload) {
    return request(`${RETAILER_BASE}/invoices/${invoiceId}/pay/confirm`, {
      method: 'POST', auth: true, body: payload,
    });
  },
};

// ─── Retailer's own products API ───────────────────────────────────────────────
export const myProductApi = {
  list(params = {}) {
    return request(`${RETAILER_BASE}/my-products${toQuery(params)}`, { auth: true });
  },
  get(id) {
    return request(`${RETAILER_BASE}/my-products/${id}`, { auth: true });
  },
  remove(id) {
    return request(`${RETAILER_BASE}/my-products/${id}`, { method: 'DELETE', auth: true });
  },
  /**
   * Create a product owned by the retailer.
   * fields: plain object of product fields (brand/category/sub_category by NAME).
   * images: array of { uri, type, name } picked from the device.
   */
  create(fields = {}, images = []) {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        form.append(key, typeof value === 'boolean' ? String(value) : value);
      }
    });
    images.forEach((img, idx) => {
      form.append('file', {
        uri: img.uri,
        type: img.type || 'image/jpeg',
        name: img.name || `product_${idx}.jpg`,
      });
    });
    return uploadMultipart(`${RETAILER_BASE}/my-products`, form);
  },
  /** Update a retailer-owned product and keep only the supplied existing image URLs. */
  update(id, fields = {}, images = [], existingImageUrls = []) {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        form.append(key, typeof value === 'boolean' ? String(value) : value);
      }
    });
    form.append('image_urls', JSON.stringify(existingImageUrls));
    images.forEach((img, idx) => {
      form.append('file', {
        uri: img.uri,
        type: img.type || 'image/jpeg',
        name: img.name || `product_${idx}.jpg`,
      });
    });
    return uploadMultipart(`${RETAILER_BASE}/my-products/${id}`, form, 30000, 'PUT');
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
  remove(id) {
    return request(`${RETAILER_BASE}/notifications/${id}`, { method: 'DELETE', auth: true });
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

// ─── Catalog API (categories, sub-categories, brands for Add Product dropdowns) ─
export const catalogApi = {
  /** GET /api/retailer/catalog/categories */
  categories() {
    return request(`${RETAILER_BASE}/catalog/categories`, { auth: true });
  },
  /** GET /api/retailer/catalog/sub-categories?category_id=xxx */
  subCategories(categoryId = '') {
    const q = categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : '';
    return request(`${RETAILER_BASE}/catalog/sub-categories${q}`, { auth: true });
  },
  /** GET /api/retailer/catalog/brands */
  brands() {
    return request(`${RETAILER_BASE}/catalog/brands`, { auth: true });
  },
  /** POST /api/retailer/catalog/categories */
  createCategory(body) {
    return request(`${RETAILER_BASE}/catalog/categories`, { method: 'POST', auth: true, body });
  },
  /** DELETE /api/retailer/catalog/categories/:id */
  deleteCategory(id) {
    return request(`${RETAILER_BASE}/catalog/categories/${id}`, { method: 'DELETE', auth: true });
  },
  /** POST /api/retailer/catalog/sub-categories */
  createSubCategory(body) {
    return request(`${RETAILER_BASE}/catalog/sub-categories`, { method: 'POST', auth: true, body });
  },
  /** DELETE /api/retailer/catalog/sub-categories/:id */
  deleteSubCategory(id) {
    return request(`${RETAILER_BASE}/catalog/sub-categories/${id}`, { method: 'DELETE', auth: true });
  },
  /** POST /api/retailer/catalog/brands */
  createBrand(body) {
    return request(`${RETAILER_BASE}/catalog/brands`, { method: 'POST', auth: true, body });
  },
  /** DELETE /api/retailer/catalog/brands/:id */
  deleteBrand(id) {
    return request(`${RETAILER_BASE}/catalog/brands/${id}`, { method: 'DELETE', auth: true });
  },
};

// ─── Staff Management API ─────────────────────────────────────────────────────
export const staffApi = {
  /** GET /api/retailer/staff/modules — labelled list for access checkboxes */
  getModules() {
    return request(`${RETAILER_BASE}/staff/modules`, { auth: true });
  },
  /** GET /api/retailer/staff */
  list(params = {}) {
    return request(`${RETAILER_BASE}/staff${toQuery(params)}`, { auth: true });
  },
  /** GET /api/retailer/staff/:id */
  get(id) {
    return request(`${RETAILER_BASE}/staff/${id}`, { auth: true });
  },
  /** POST /api/retailer/staff */
  create(body) {
    return request(`${RETAILER_BASE}/staff`, { method: 'POST', auth: true, body });
  },
  /** PUT /api/retailer/staff/:id */
  update(id, body) {
    return request(`${RETAILER_BASE}/staff/${id}`, { method: 'PUT', auth: true, body });
  },
  /** PATCH /api/retailer/staff/:id/toggle */
  toggle(id) {
    return request(`${RETAILER_BASE}/staff/${id}/toggle`, { method: 'PATCH', auth: true });
  },
  /** DELETE /api/retailer/staff/:id */
  remove(id) {
    return request(`${RETAILER_BASE}/staff/${id}`, { method: 'DELETE', auth: true });
  },
};

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
