import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_HOST, API_BASE_URL, RETAILER_AUTH_BASE } from '../config/env';
import { STORAGE_KEYS } from '../constants';

const DEFAULT_TIMEOUT = 20000; // 20 s
const RETAILER_BASE   = `${API_BASE_URL}/retailer`;

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
    // Expired/invalid session → clear it once and fall back to Login.
    if (res.status === 401 && auth && isSessionDead(json, url)) {
      notifyUnauthorized();
    }
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
    error.data = json;
    if (res.status === 401 && isSessionDead(json, url)) {
      notifyUnauthorized();
    }
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
      if (value === undefined || value === null || value === '') return;
      if (typeof value === 'boolean') form.append(key, String(value));
      else if (typeof value === 'object') form.append(key, JSON.stringify(value)); // e.g. attributes {}
      else form.append(key, value);
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
      if (value === undefined || value === null) return;
      if (typeof value === 'boolean') form.append(key, String(value));
      else if (typeof value === 'object') form.append(key, JSON.stringify(value)); // e.g. attributes {}
      else form.append(key, value);
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
  /** Register (or refresh) the device FCM push token with the backend. */
  registerFcmToken(token, deviceInfo = '') {
    return request(`${RETAILER_AUTH_BASE}/fcm-token`, {
      method: 'POST', auth: true, body: { token, deviceInfo },
    });
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
  /**
   * GET /api/retailer/staff/:id/incentive
   * Current-month sales + earned incentive for one staff member.
   * Sales are matched on the staff name recorded against orders (see the
   * controller) — `basis` in the response says how it was derived.
   */
  incentive(id) {
    return request(`${RETAILER_BASE}/staff/${id}/incentive`, { auth: true });
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

// ─── ERP API ──────────────────────────────────────────────────────────────────
// Backed by /api/retailer/erp/* (routes/Retailer Management/retailerErpRoutes.js).
//
// These modules deliberately do NOT reuse the wholesaler's /api/sales, /api/expenses
// endpoints: the backend blocks retailer tokens from every ERP_ROUTE_PREFIXES entry
// (server.js -> denyRetailerErpAccess), and the ERP route files additionally gate
// writes with `allow('Company Owner', …)`. The retailer ERP surface re-mounts the
// same company-scoped controllers behind a retailer module guard instead.
//
// Every method takes plain object args and returns the unwrapped `data` payload.
const ERP = `${RETAILER_BASE}/erp`;

export const erpApi = {
  // ── Dashboard ──
  // One aggregated payload: KPI cards, this-month P&L, stock buckets, totals,
  // recent enquiries/orders and the 6-month trend. Replaces the wholesaler's
  // five-call fan-out, which a retailer token cannot reach.
  erpDashboard: () => request(`${ERP}/dashboard`, { auth: true }),

  // ── Sales ──
  listSales:        (params) => request(`${ERP}/sales${toQuery(params)}`, { auth: true }),
  getSale:          (id)     => request(`${ERP}/sales/${id}`, { auth: true }),
  createSale:       (body)   => request(`${ERP}/sales`, { method: 'POST', auth: true, body }),
  recordSalePayment:(id, b)  => request(`${ERP}/sales/${id}/payment`, { method: 'PATCH', auth: true, body: b }),
  salesReport:      (params) => request(`${ERP}/sales/report${toQuery(params)}`, { auth: true }),

  // ── Expenses ──
  listExpenses:  (params) => request(`${ERP}/expenses${toQuery(params)}`, { auth: true }),
  createExpense: (body)   => request(`${ERP}/expenses`, { method: 'POST', auth: true, body }),
  updateExpense: (id, b)  => request(`${ERP}/expenses/${id}`, { method: 'PUT', auth: true, body: b }),
  deleteExpense: (id)     => request(`${ERP}/expenses/${id}`, { method: 'DELETE', auth: true }),
  expenseReport: (params) => request(`${ERP}/reports/expenses${toQuery(params)}`, { auth: true }),

  // ── Profit & Loss ──
  profitLoss: (params) => request(`${ERP}/profit-loss${toQuery(params)}`, { auth: true }),

  // ── Purchases & suppliers ──
  listPurchases:     (params) => request(`${ERP}/purchases${toQuery(params)}`, { auth: true }),
  getPurchase:       (id)     => request(`${ERP}/purchases/${id}`, { auth: true }),
  createPurchase:    (body)   => request(`${ERP}/purchases`, { method: 'POST', auth: true, body }),
  updatePurchase:    (id, b)  => request(`${ERP}/purchases/${id}`, { method: 'PUT', auth: true, body: b }),
  deletePurchase:    (id)     => request(`${ERP}/purchases/${id}`, { method: 'DELETE', auth: true }),
  purchaseStatus:    (id, b)  => request(`${ERP}/purchases/${id}/status`, { method: 'PATCH', auth: true, body: b }),
  purchasePayment:   (id, b)  => request(`${ERP}/purchases/${id}/payment`, { method: 'PATCH', auth: true, body: b }),
  listSuppliers:     (params) => request(`${ERP}/suppliers${toQuery(params)}`, { auth: true }),
  createSupplier:    (body)   => request(`${ERP}/suppliers`, { method: 'POST', auth: true, body }),
  updateSupplier:    (id, b)  => request(`${ERP}/suppliers/${id}`, { method: 'PUT', auth: true, body: b }),
  deleteSupplier:    (id)     => request(`${ERP}/suppliers/${id}`, { method: 'DELETE', auth: true }),

  // ── Inventory ──
  listInventory:    (params) => request(`${ERP}/inventory${toQuery(params)}`, { auth: true }),
  getInventoryItem: (id)     => request(`${ERP}/inventory/${id}`, { auth: true }),
  inventorySummary: ()       => request(`${ERP}/inventory/summary`, { auth: true }),
  inventoryMovements:(params)=> request(`${ERP}/inventory/movements${toQuery(params)}`, { auth: true }),
  adjustStock:      (body)   => request(`${ERP}/inventory/adjust`, { method: 'PATCH', auth: true, body }),
  blockStock:       (body)   => request(`${ERP}/inventory/block`, { method: 'PATCH', auth: true, body }),

  // ── Warehouses ──
  listWarehouses:   (params) => request(`${ERP}/warehouses${toQuery(params)}`, { auth: true }),
  createWarehouse:  (body)   => request(`${ERP}/warehouses`, { method: 'POST', auth: true, body }),
  updateWarehouse:  (id, b)  => request(`${ERP}/warehouses/${id}`, { method: 'PUT', auth: true, body: b }),
  deleteWarehouse:  (id)     => request(`${ERP}/warehouses/${id}`, { method: 'DELETE', auth: true }),
  warehouseStock:   (id)     => request(`${ERP}/warehouses/${id}/stock`, { auth: true }),

  // ── Stock transfers ──
  listTransfers:    (params) => request(`${ERP}/stock-transfers${toQuery(params)}`, { auth: true }),
  createTransfer:   (body)   => request(`${ERP}/stock-transfers`, { method: 'POST', auth: true, body }),
  transferStatus:   (id, b)  => request(`${ERP}/stock-transfers/${id}/status`, { method: 'PATCH', auth: true, body: b }),

  // ── Payments ──
  listReceivables:  (params) => request(`${ERP}/payments/receivables${toQuery(params)}`, { auth: true }),
  listPayables:     (params) => request(`${ERP}/payments/payables${toQuery(params)}`, { auth: true }),
  listTransactions: (params) => request(`${ERP}/payments/transactions${toQuery(params)}`, { auth: true }),
  collectReceivable:(id, b)  => request(`${ERP}/payments/receivables/${id}/collect`, { method: 'POST', auth: true, body: b }),
  payPayable:       (id, b)  => request(`${ERP}/payments/payables/${id}/pay`, { method: 'POST', auth: true, body: b }),

  // ── Accounts / ledgers ──
  companyLedger:   (params) => request(`${ERP}/accounts/company${toQuery(params)}`, { auth: true }),
  cashBook:        (params) => request(`${ERP}/accounts/cash-book${toQuery(params)}`, { auth: true }),
  bankBook:        (params) => request(`${ERP}/accounts/bank-book${toQuery(params)}`, { auth: true }),
  // Ledger routes carry the id BOTH as a path segment and as a query param —
  // the shared controller historically read `req.query.customer_id`, so sending
  // both makes the call work regardless of which form the backend resolves.
  customerLedger:  (id, p)  => request(`${ERP}/accounts/customer/${id}${toQuery({ customer_id: id, ...p })}`, { auth: true }),
  supplierLedger:  (id, p)  => request(`${ERP}/accounts/supplier/${id}${toQuery({ supplier_id: id, ...p })}`, { auth: true }),

  // ── Leads ──
  listLeads:   (params) => request(`${ERP}/leads${toQuery(params)}`, { auth: true }),
  createLead:  (body)   => request(`${ERP}/leads`, { method: 'POST', auth: true, body }),
  updateLead:  (id, b)  => request(`${ERP}/leads/${id}`, { method: 'PUT', auth: true, body: b }),
  convertLead: (id, b)  => request(`${ERP}/leads/${id}/convert`, { method: 'PATCH', auth: true, body: b }),
  deleteLead:  (id)     => request(`${ERP}/leads/${id}`, { method: 'DELETE', auth: true }),

  // ── Lead follow-ups (per-lead scheduling, mirrors wholesaler parity) ──
  listFollowups:   (params) => request(`${ERP}/followups${toQuery(params)}`, { auth: true }),
  createFollowup:  (body)   => request(`${ERP}/followups`, { method: 'POST', auth: true, body }),
  updateFollowup:  (id, b)  => request(`${ERP}/followups/${id}`, { method: 'PUT', auth: true, body: b }),
  deleteFollowup:  (id)     => request(`${ERP}/followups/${id}`, { method: 'DELETE', auth: true }),

  // ── ERP customers (distinct from the marketplace customerApi above) ──
  listErpCustomers:   (params) => request(`${ERP}/erp-customers${toQuery(params)}`, { auth: true }),
  createErpCustomer:  (body)   => request(`${ERP}/erp-customers`, { method: 'POST', auth: true, body }),
  updateErpCustomer:  (id, b)  => request(`${ERP}/erp-customers/${id}`, { method: 'PUT', auth: true, body: b }),
  deleteErpCustomer:  (id)     => request(`${ERP}/erp-customers/${id}`, { method: 'DELETE', auth: true }),

  // ── Dispatch ──
  // Dispatch is the retailer's own final stock-out step (create → In Transit →
  // Delivered). Creating one reduces physical stock; marking delivered
  // auto-creates the Sale + Receivable on the backend.
  listDispatches:    (params) => request(`${ERP}/dispatches${toQuery(params)}`, { auth: true }),
  getDispatch:       (id)     => request(`${ERP}/dispatches/${id}`, { auth: true }),
  /**
   * Orders this retailer can still dispatch, for the entry form's order picker.
   * Returns { orders, counts }. Orders that already have a dispatch are excluded
   * because createDispatch rejects them with 409.
   */
  dispatchableOrders: ()      => request(`${ERP}/dispatches/dispatchable-orders`, { auth: true }),
  createDispatch:    (body)   => request(`${ERP}/dispatches`, { method: 'POST', auth: true, body }),
  dispatchInTransit: (id)     => request(`${ERP}/dispatches/${id}/intransit`, { method: 'PATCH', auth: true }),
  dispatchDeliver:   (id, b)  => request(`${ERP}/dispatches/${id}/deliver`, { method: 'PATCH', auth: true, body: b }),
  updateDispatch:    (id, b)  => request(`${ERP}/dispatches/${id}`, { method: 'PUT', auth: true, body: b }),

  /**
   * Upload a proof-of-delivery image and return `{ url }`.
   * `file` is a picker result: { uri, type, name }. The backend multer field is
   * literally "pod" — the name below must match `podUpload` in
   * middleware/podUpload.js or the request 400s with "No image received."
   */
  uploadDispatchPod(file) {
    const form = new FormData();
    form.append('pod', {
      uri:  file.uri,
      type: file.type || 'image/jpeg',
      name: file.name || 'pod.jpg',
    });
    return uploadMultipart(`${ERP}/dispatches/upload-pod`, form, 60000);
  },

  // ── Documents (repository) ──
  // Wholesaler parity: a free-form document store — GST certificate, purchase /
  // sales bills, catalogues, price lists — with typed filter tabs, open and
  // delete. Distinct from the KYC flow (authApi.uploadDocs), which feeds the
  // company's verification record and is reviewed by the CRM.
  // Backed by the shared documentController, scoped to req.user.company_id.
  listDocuments:  (params) => request(`${ERP}/documents${toQuery(params)}`, { auth: true }),
  deleteDocument: (id)     => request(`${ERP}/documents/${id}`, { method: 'DELETE', auth: true }),

  /**
   * Upload one document. `file` is a picker result: { uri, type, name }.
   * The backend multer field is literally "file" (see `uploadDocs` in
   * middleware/upload.js) — renaming it 400s with "No files uploaded.".
   * `entity_type` is required by the controller and groups the file under the
   * company's document set; `doc_type` is the free-text tag shown in the tabs.
   */
  uploadDocument(file, docType = 'Other') {
    const form = new FormData();
    form.append('file', {
      uri:  file.uri,
      type: file.type || 'application/octet-stream',
      name: file.name || `doc_${Date.now()}`,
    });
    form.append('entity_type', 'company');
    form.append('doc_type', docType);
    return uploadMultipart(`${ERP}/documents`, form, 60000);
  },

  // ── Reports ──
  reportSales:     (params) => request(`${ERP}/reports/sales${toQuery(params)}`, { auth: true }),
  reportPurchases: (params) => request(`${ERP}/reports/purchases${toQuery(params)}`, { auth: true }),
  reportCustomers: (params) => request(`${ERP}/reports/customers${toQuery(params)}`, { auth: true }),
  reportSuppliers: (params) => request(`${ERP}/reports/suppliers${toQuery(params)}`, { auth: true }),
  reportInventory: (params) => request(`${ERP}/reports/inventory${toQuery(params)}`, { auth: true }),
  analytics:       (params) => request(`${ERP}/reports/analytics${toQuery(params)}`, { auth: true }),

  // Authenticated download URL for PDF/Excel export. The token is appended as a
  // query param because Linking.openURL (used to open the file) cannot set an
  // Authorization header. Mirrors the wholesaler's reportsService.reportExportUrl.
  // type ∈ sales | purchases | expenses | inventory (what the controller supports).
  reportExportUrl: async (type, { format = 'excel', from_date, to_date, group_by } = {}) => {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const qs = new URLSearchParams({ format });
    if (from_date) qs.append('from_date', from_date);
    if (to_date)   qs.append('to_date', to_date);
    if (group_by)  qs.append('group_by', group_by);
    if (token)     qs.append('token', token);
    return `${ERP}/reports/${type}/export?${qs.toString()}`;
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
