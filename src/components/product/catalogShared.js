// src/components/product/catalogShared.js
//
// Shared config + helpers for the two wholesaler-parity catalogue surfaces:
//   - screens/products/SearchScreen.jsx      (Search tab)
//   - screens/products/MyProductsScreen.jsx  (Home → Marketplace → Products)
//
// Both show the SAME product set from the same endpoint (productApi.search), so the
// card, the filter sheet and these helpers live here rather than being duplicated.

import { mediaUrl } from '../../utils/api';

// ── Filter sheet config ───────────────────────────────────────
export const FILTER_KEYS = [
  { key: 'size',     label: 'Size'     },
  { key: 'finish',   label: 'Finish'   },
  { key: 'material', label: 'Material' },
  { key: 'color',    label: 'Color'    },
  { key: 'category', label: 'Category' },
  { key: 'brand',    label: 'Brand'    },
];

export const EMPTY_FILTERS = {
  size: '', finish: '', material: '', color: '', category: '', brand: '',
};

// filterOptions keys aren't always key + 's' (category → categories).
export const OPT_KEY = {
  size: 'sizes', finish: 'finishes', material: 'materials',
  color: 'colors', category: 'categories', brand: 'brands',
};

export const STATUS_BADGE = {
  out_of_stock: { label: 'Out of Stock', bg: '#FEF2F2', color: '#DC2626' },
  discontinued: { label: 'Discontinued', bg: '#F3F4F6', color: '#6B7280' },
};

// ── Helpers ───────────────────────────────────────────────────

// Product images come back as relative paths (/uploads/images/x.jpg); the
// device can't resolve those, so prefix the API host.
export const resolveImg = (u) => (!u ? null : /^https?:/.test(u) ? u : mediaUrl(u));

export const money = (n) =>
  (n == null || n === '' || Number(n) === 0) ? '—' : '₹' + Number(n).toLocaleString('en-IN');

/**
 * Which catalogue a product came from. The retailer needs to tell these apart,
 * because browsing is shared across all three creators:
 *   can_manage      → the retailer's OWN listing  → editable / deletable
 *   created_by_type → Admin | Wholesaler | Retailer
 *
 * `can_manage` (not `added_by_type`) is what marks ownership: another retailer's
 * listing also reports added_by_type 'Retailer' but is NOT editable here.
 */
export function sourceOf(item) {
  if (!item) return { key: 'seller', label: 'Seller', bg: '#F3F4F6', color: '#6B7280' };
  if (item.can_manage === true) {
    return { key: 'mine', label: 'My Product', bg: '#DCFCE7', color: '#047857' };
  }
  switch (item.added_by_type) {
    case 'Admin':
      return { key: 'admin', label: 'Admin Catalog', bg: '#DBEAFE', color: '#1D4ED8' };
    case 'Wholesaler':
      return { key: 'wholesaler', label: 'Wholesaler', bg: '#FEF3C7', color: '#B45309' };
    case 'Retailer':
      return { key: 'retailer', label: 'Retailer', bg: '#E0E7FF', color: '#4338CA' };
    // The backend falls back to the literal 'Unknown' when the owner company's
    // biz_type cannot be inferred (retailerMarketplaceController.productResponse).
    // Label it explicitly so it never masquerades as a generic seller listing.
    case 'Unknown':
      return { key: 'unknown', label: 'Unverified', bg: '#F3F4F6', color: '#6B7280' };
    default:
      return { key: 'seller', label: 'Seller', bg: '#F3F4F6', color: '#6B7280' };
  }
}

export const isMine = (item) => item?.can_manage === true;

// Unique spec values from a catalogue page, for the filter sheet.
export const pickDistinct = (list, getter) =>
  [...new Set((Array.isArray(list) ? list : [])
    .map(getter)
    .filter(Boolean)
    .map(String))].sort();
