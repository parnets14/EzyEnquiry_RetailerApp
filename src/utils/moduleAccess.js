/**
 * moduleAccess.js
 *
 * Single source of truth for "which modules can this signed-in account see?"
 * in the Retailer App.
 *
 * Two kinds of accounts sign in to this app:
 *   • Retailer owner  — full access to every module.
 *   • RetailerStaff   — access limited to the modules the owner ticked for them
 *                       (staff_app_access). An EMPTY list means "no restriction"
 *                       → all modules, which keeps backwards compatibility with
 *                       staff created before this feature existed.
 *
 * Module keys MUST match the backend list in
 *   EzyEnquiry-backend/src/controllers/Retailer Management/retailerStaffController.js
 * (getAvailableModules) — those are the same keys the API guard `requireRetailerModule`
 * enforces, so hiding a tile here also prevents a guaranteed 403.
 */

export const RETAILER_MODULES = [
  'dashboard',
  'products',
  'enquiries',
  'orders',
  'invoices',
  'customers',
  'notifications',
  'reports',
  // ── ERP modules (added 2026-09-29, served by /api/retailer/erp/*) ──
  'sales',
  'purchases',
  'inventory',
  'expenses',
  'payments',
  'accounts',
  'profit_loss',
  'leads',
  'dispatches',
  'documents',
];

/** Normalise the access list off a user object coming from any login path. */
export function getStaffAccess(user) {
  if (!user) return null;
  // Staff login stores it as `staffAppAccess`; owner accounts have no such field.
  const raw =
    user.staffAppAccess ??
    user.staff_app_access ??
    user.staff?.staffAppAccess ??
    user.staff?.staff_app_access;

  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return null;
}

/** True when this account is a staff member (not the retailer owner). */
export function isStaffAccount(user) {
  return (
    user?.accountType === 'retailer_staff' ||
    user?.role === 'RetailerStaff' ||
    !!getStaffAccess(user)
  );
}

/**
 * Decide whether the account may see `moduleKey`.
 * Owners → always true. Staff with an empty list → true (unrestricted).
 */
export function canAccess(user, moduleKey) {
  if (!moduleKey) return true;
  if (!isStaffAccount(user)) return true;          // owner / unknown → full access
  const access = getStaffAccess(user);
  if (!access || access.length === 0) return true; // unrestricted staff
  return access.includes(moduleKey);
}

/** Convenience factory: `const can = makeCan(user); can('products')` */
export function makeCan(user) {
  return (moduleKey) => canAccess(user, moduleKey);
}
