/**
 * src/screens/erp/expenseCategories.js  (Retailer app)
 *
 * The wholesaler's 12 canonical expense categories, translated to Ionicons.
 *
 * The wholesaler (`wholesalerapp/src/screens/expense/ExpenseListScreen.jsx`) is the
 * source of truth for this list, but it uses MaterialCommunityIcons names
 * (`lightning-bolt`, `warehouse`, `tools`, …) which DO NOT EXIST in Ionicons —
 * a straight copy renders blank boxes. Every `icon` below was validated against
 * `node_modules/react-native-vector-icons/dist/glyphmaps/Ionicons.json`.
 *
 * Shared by ExpenseEntryScreen (tile grid), ExpenseListScreen (per-row colour)
 * and ExpenseReportScreen (category bars) so the three screens never drift.
 */

export const EXPENSE_CATEGORIES = [
  { key: 'Rent',            color: '#EA580C', bg: '#FFF7ED', icon: 'home-outline' },
  { key: 'Salary',          color: '#9C27B0', bg: '#F3E8FF', icon: 'cash-outline' },
  { key: 'Electricity',     color: '#CA8A04', bg: '#FEFCE8', icon: 'flash-outline' },
  { key: 'Internet',        color: '#2563EB', bg: '#EFF6FF', icon: 'wifi-outline' },
  { key: 'Fuel',            color: '#B45309', bg: '#FEF3C7', icon: 'car-outline' },
  { key: 'Marketing',       color: '#F59E0B', bg: '#FFFBEB', icon: 'megaphone-outline' },
  { key: 'Office Expense',  color: '#475569', bg: '#F1F5F9', icon: 'business-outline' },
  { key: 'Maintenance',     color: '#DC2626', bg: '#FEF2F2', icon: 'construct-outline' },
  { key: 'Transport',       color: '#0D9488', bg: '#F0FDFA', icon: 'car-sport-outline' },
  { key: 'Warehouse Rent',  color: '#7C3AED', bg: '#F5F3FF', icon: 'cube-outline' },
  { key: 'Packaging',       color: '#059669', bg: '#ECFDF5', icon: 'archive-outline' },
  { key: 'Miscellaneous',   color: '#6B7280', bg: '#F3F4F6', icon: 'ellipsis-horizontal-circle-outline' },
];

const FALLBACK = EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];

/** Config for a stored category string; unknown values get the Miscellaneous look. */
export function getCatConfig(category) {
  return EXPENSE_CATEGORIES.find(c => c.key === category) || FALLBACK;
}

/** Category keys only — used for the list filter tabs. */
export const CATEGORY_KEYS = EXPENSE_CATEGORIES.map(c => c.key);
