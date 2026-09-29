/**
 * HomeScreen.jsx
 *
 * Retailer home / dashboard — wholesaler parity.
 *
 * ── DATA ─────────────────────────────────────────────────────────────────────
 * Everything comes from ONE call: `erpApi.erpDashboard()`
 * (`GET /api/retailer/erp/dashboard`). The wholesaler home fans out across five
 * calls (reports/dashboard + enquiries + inventory/summary + payments/payables +
 * reports/profit-loss); a retailer token can't reach any of them (they sit in
 * ERP_ROUTE_PREFIXES behind `denyRetailerErpAccess`), so the backend aggregates
 * the same figures — from the same company-scoped models — into one payload with
 * wholesaler-compatible key names.
 *
 * `dashboardApi.get()` (the old marketplace-only dashboard) is still fetched as a
 * FALLBACK so the header counts still render if the ERP endpoint is unreachable.
 *
 * ── ROUTE READINESS ──────────────────────────────────────────────────────────
 * The ERP screens land module by module. `READY_ROUTES` lists the routes actually
 * registered in AppNavigator; tapping a tile whose screen isn't built yet shows a
 * friendly "coming soon" notice instead of throwing. Remove a screen from
 * `SOON` automatically by registering it — nothing else needs to change.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Dimensions, RefreshControl, ScrollView, StatusBar, StyleSheet,
  Text, TouchableOpacity, View, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi, erpApi } from '../../utils/api';
import { getGreeting, formatCurrency } from '../../utils/formatters';
import { makeCan } from '../../utils/moduleAccess';
import { SCREENS } from '../../constants';

const { width: SW } = Dimensions.get('window');

/* ── Layout constants ── */
const H_PAD   = 16;
const GAP     = 12;
const CARD_W  = (SW - H_PAD * 2 - GAP) / 2;
const FULL_W  = SW - H_PAD * 2;

/* ── Palette (retailer brand) ── */
const NAVY      = Colors.secondary;      // #1A2340
const ORANGE    = Colors.primary;        // #F4500A
const ORANGE_LT = Colors.primaryBg;      // #FFF3EE
const BG        = Colors.background;     // #F7F8FA
const WHITE     = '#FFFFFF';
const TEXT      = Colors.textPrimary;
const TEXT_2    = Colors.textSecondary;
const TEXT_3    = Colors.textTertiary;
const BORDER    = Colors.border;

const CARD_SHADOW = {
  shadowColor:   Colors.shadowColor,
  shadowOpacity: 0.06,
  shadowOffset:  { width: 0, height: 6 },
  shadowRadius:  16,
  elevation:     4,
};

/**
 * Routes registered in AppNavigator. Tiles pointing anywhere else are shown but
 * press-disabled with a "coming soon" notice, so the dashboard can present the
 * full wholesaler module map before every module screen exists.
 */
const READY_ROUTES = new Set([
  SCREENS.SEARCH, SCREENS.SEARCH_RESULTS, SCREENS.ADD_PRODUCT, SCREENS.CATEGORIES_BRANDS,
  SCREENS.MY_PRODUCTS, SCREENS.PRODUCT_DETAILS,
  SCREENS.ENQUIRIES, SCREENS.ENQUIRY_DETAILS, SCREENS.CREATE_ENQUIRY, SCREENS.NEGOTIATION,
  // NOTE: QUOTATION_DETAILS / PAYMENTS / PAYMENT are deliberately absent — the
  // constants exist but no screen is registered for them, and nothing navigates
  // to them. Listing them here would claim a route is "ready" when it isn't.
  SCREENS.QUOTATIONS, SCREENS.QUOTATION_CONFIRM,
  SCREENS.ORDERS, SCREENS.ORDER_DETAILS, SCREENS.ORDER_TRACKING, SCREENS.DISPATCH_DETAILS,
  SCREENS.INVOICES, SCREENS.INVOICE_DETAILS,
  SCREENS.NOTIFICATIONS, SCREENS.NOTIFICATION_SETTINGS,
  SCREENS.STAFF_LIST, SCREENS.STAFF_ADD_EDIT,
  SCREENS.COMPANY_DETAILS, SCREENS.DOCUMENTS, SCREENS.SUBSCRIPTION, SCREENS.HELP_SUPPORT,
  SCREENS.CHANGE_PASSWORD, SCREENS.PROFILE,
  SCREENS.SALES_LIST, SCREENS.SALES_ENTRY, SCREENS.SALES_REPORT,
  SCREENS.EXPENSE_LIST, SCREENS.EXPENSE_ENTRY, SCREENS.EXPENSE_REPORT,
  SCREENS.PROFIT_LOSS,
  SCREENS.INVENTORY, SCREENS.STOCK_ADJUST, SCREENS.STOCK_TRANSFER, SCREENS.WAREHOUSE_LIST,
  SCREENS.PURCHASE_LIST, SCREENS.PURCHASE_ENTRY, SCREENS.SUPPLIER_LIST,
  SCREENS.PAYMENT_RECEIVABLE, SCREENS.PAYMENT_PAYABLE, SCREENS.ACCOUNTS, SCREENS.CUSTOMER_LEDGER,
  SCREENS.CUSTOMER_LIST, SCREENS.LEAD_LIST, SCREENS.REPORT_CENTER, SCREENS.ANALYTICS,
  SCREENS.DISPATCH_TRACKING, SCREENS.DISPATCH_ENTRY,
  SCREENS.DOCUMENT_REPOSITORY,
  SCREENS.STONE_CALC,
]);

/* ============================================================
   HELPERS
============================================================ */

function todayLabel() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function initials(name) {
  if (!name) return 'EE';
  const parts = String(name).trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'EE';
}

const ENQ_STATUS = {
  New:         { color: '#2563EB', bg: '#EFF6FF' },
  Viewed:      { color: '#6B7280', bg: '#F3F4F6' },
  Replied:     { color: '#D97706', bg: '#FFF7ED' },
  Negotiation: { color: '#7C3AED', bg: '#F5F3FF' },
  Confirmed:   { color: '#059669', bg: '#ECFDF5' },
  Cancelled:   { color: '#DC2626', bg: '#FEF2F2' },
};

/* ============================================================
   PRESENTATIONAL PIECES
============================================================ */

function SectionHeader({ title, action, onAction }) {
  return (
    <View style={st.sectionHeader}>
      <View style={st.sectionTitleWrap}>
        <View style={st.sectionAccent} />
        <Text style={st.sectionTitle}>{title}</Text>
      </View>
      {action ? (
        <TouchableOpacity style={st.viewAllBtn} onPress={onAction} activeOpacity={0.7}>
          <Text style={st.viewAllText}>{action}</Text>
          <Ionicons name="chevron-forward" size={14} color={ORANGE} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function StatCard({ icon, iconBg, iconColor, label, value, sub, subColor, onPress, wide }) {
  return (
    <TouchableOpacity
      style={[st.statCard, wide ? { width: FULL_W } : { width: CARD_W }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={st.statTop}>
        <View style={[st.statIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={19} color={iconColor} />
        </View>
        {sub ? (
          <View style={[st.statPill, { backgroundColor: `${subColor}14` }]}>
            <Text style={[st.statPillText, { color: subColor }]}>{sub}</Text>
          </View>
        ) : null}
      </View>
      <Text style={st.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function QuickAction({ icon, iconColor, bg, label, onPress, soon }) {
  return (
    <TouchableOpacity style={st.quickAction} onPress={onPress} activeOpacity={0.7}>
      <View style={[st.quickIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={23} color={iconColor} />
        {soon ? <View style={st.soonDot} /> : null}
      </View>
      <Text style={st.quickLabel} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

function PrimaryBtn({ icon, color, bg, label, onPress, soon }) {
  return (
    <TouchableOpacity style={st.primaryBtn} onPress={onPress} activeOpacity={0.85}>
      <View style={[st.primaryIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={color} />
        {soon ? <View style={st.soonDot} /> : null}
      </View>
      <Text style={st.primaryLabel} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

function AlertRow({ icon, iconColor, bg, accent, title, sub, onPress }) {
  return (
    <TouchableOpacity
      style={[st.alertRow, { backgroundColor: bg, borderLeftColor: accent }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[st.alertIcon, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={st.alertContent}>
        <Text style={st.alertTitle}>{title}</Text>
        <Text style={st.alertSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={iconColor} />
    </TouchableOpacity>
  );
}

function EnqCard({ item, onPress, isLast }) {
  const meta = ENQ_STATUS[item.status] || ENQ_STATUS.New;
  const code    = item.enq_code || `#${String(item._id || '').slice(-6)}`;
  const party   = item.retailer_name || item.customer_name || 'Customer';
  const product = item.product_name || item.product_code || 'Product';
  const qty     = item.qty ?? item.quantity ?? 0;

  return (
    <TouchableOpacity
      style={[st.enquiryCard, isLast && { borderBottomWidth: 0 }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[st.enqAvatar, { backgroundColor: meta.bg }]}>
        <Text style={[st.enqAvatarText, { color: meta.color }]}>{initials(party)}</Text>
      </View>
      <View style={st.enquiryBody}>
        <View style={st.enquiryTop}>
          <Text style={st.customerName} numberOfLines={1}>{party}</Text>
          <View style={[st.statusChip, { backgroundColor: meta.bg }]}>
            <View style={[st.statusDot, { backgroundColor: meta.color }]} />
            <Text style={[st.statusText, { color: meta.color }]}>{item.status || 'New'}</Text>
          </View>
        </View>
        <View style={st.enquiryMeta}>
          <Text style={st.enquiryCode}>{code}</Text>
          <View style={st.metaDot} />
          <Ionicons name="cube-outline" size={11} color={TEXT_3} />
          <Text style={st.metaText} numberOfLines={1}>{product}</Text>
          <View style={st.metaDot} />
          <Text style={st.metaText}>Qty {qty}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#C7CCD6" />
    </TouchableOpacity>
  );
}

/* ============================================================
   MAIN
============================================================ */

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();

  const ownerName     = user?.name || user?.company?.owner_name || 'there';
  const companyName   = user?.company?.name || user?.company_name || '';
  const planName      = user?.subscription_plan || user?.company?.subscription_plan || 'Free';
  const companyStatus = user?.company_status || user?.company?.status || '';

  const can = makeCan(user);

  const [data, setData]       = useState(null);   // ERP dashboard payload
  const [legacy, setLegacy]   = useState(null);   // old marketplace dashboard (fallback)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    setError('');
    const [erpR, legacyR] = await Promise.allSettled([
      erpApi.erpDashboard(),
      dashboardApi.get(),
    ]);
    if (erpR.status === 'fulfilled') {
      setData(erpR.value || {});
    } else if (legacyR.status === 'rejected') {
      setError(erpR.reason?.message || 'Could not load dashboard.');
    }
    if (legacyR.status === 'fulfilled') setLegacy(legacyR.value || {});
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  /** Navigate only when the target screen is actually registered. */
  const go = useCallback((screen, params) => {
    if (!screen) return;
    if (!READY_ROUTES.has(screen)) {
      Alert.alert('Coming soon', 'This module is being built and will be available shortly.');
      return;
    }
    navigation.navigate(screen, params);
  }, [navigation]);

  /* ── Derived values (ERP payload first, legacy counts as fallback) ── */
  const d       = data || {};
  const counts  = d.counts || legacy?.counts || {};
  const orders  = d.orders || {};

  const todaySales   = d.todaySales   ?? 0;
  const todayOrders  = orders.todayTotal ?? d.todayOrders ?? 0;
  const pendingOrder = orders.pending    ?? d.pendingOrders ?? counts.in_progress ?? 0;
  const paymentDue   = d.paymentDue   ?? counts.pending_amount ?? 0;
  const payableDue   = d.payableDue   ?? 0;
  const marketDue    = d.marketplaceDue ?? 0;

  const lowStock     = d.lowStockCount    ?? 0;
  const outOfStock   = d.outOfStockCount  ?? 0;

  const monthSales    = d.monthSales    ?? 0;
  const monthPurchase = d.monthPurchase ?? 0;
  const monthExpense  = d.monthExpense  ?? 0;
  const monthProfit   = d.monthProfit   ?? (monthSales - monthPurchase - monthExpense);

  const totalEnquiries = d.totalEnquiries ?? counts.enquiries ?? 0;
  const newEnquiries   = d.newEnquiries   ?? 0;
  const unread         = counts.unread_notifications || 0;

  const recentEnquiries = d.recentEnquiries || [];

  const initialsText = initials(ownerName);

  /* ── KPI cards (mirrors wholesaler DashboardScreen) ── */
  const KPIS = [
    { icon: 'cash-outline',         iconBg: Colors.successBg, iconColor: Colors.success, label: "Today's Sales",  value: formatCurrency(todaySales),  sub: 'Revenue', subColor: Colors.success, onPress: () => go(SCREENS.SALES_LIST) },
    { icon: 'cart-outline',         iconBg: ORANGE_LT,        iconColor: ORANGE,          label: "Today's Orders", value: String(todayOrders),          sub: 'Orders',  subColor: ORANGE,         onPress: () => go(SCREENS.ORDERS) },
    { icon: 'time-outline',         iconBg: Colors.warningBg, iconColor: Colors.warningText, label: 'Pending Orders', value: String(pendingOrder),      sub: 'Pending', subColor: Colors.warningText, onPress: () => go(SCREENS.ORDERS) },
    { icon: 'card-outline',         iconBg: Colors.errorBg,   iconColor: Colors.error,    label: 'Receivable',     value: formatCurrency(paymentDue),  sub: 'They owe', subColor: Colors.error,   onPress: () => go(SCREENS.PAYMENT_RECEIVABLE) },
    { icon: 'wallet-outline',       iconBg: Colors.warningBg, iconColor: '#EA580C',       label: 'Payable',        value: formatCurrency(payableDue),  sub: 'You owe',  subColor: '#EA580C',      onPress: () => go(SCREENS.PAYMENT_PAYABLE) },
  ];

  /* ── Quick add ── */
  const PRIMARY_ACTIONS = [
    { icon: 'add-circle-outline', color: ORANGE,    bg: ORANGE_LT,         label: 'Add Product',   module: 'products',  screen: SCREENS.ADD_PRODUCT },
    { icon: 'arrow-undo-outline', color: '#2563EB', bg: '#EFF6FF',         label: 'Reply Enquiry', module: 'enquiries', screen: SCREENS.ENQUIRIES },
    { icon: 'cart-outline',       color: '#059669', bg: '#ECFDF5',         label: 'New Sale',      module: 'sales',     screen: SCREENS.SALES_ENTRY },
    { icon: 'archive-outline',    color: '#7C3AED', bg: '#F5F3FF',         label: 'Stock Entry',   module: 'inventory', screen: SCREENS.STOCK_ADJUST },
  ].filter(a => can(a.module));

  /* ── Module map (grouped, exactly like the wholesaler dashboard) ── */
  const MODULE_GROUPS = [
    {
      // Wholesaler Marketplace = Products, Enquiries, Orders, Dispatch — EXACTLY
      // these 4 (`dashboard/DashboardScreen.jsx` lines 326-332). Do NOT add tiles.
      //
      // Invoices deliberately NOT here — the wholesaler keeps it in the Finance
      // group, so listing it in both places duplicated the tile.
      //
      // Quotes was REMOVED (2026-09-29) to match the wholesaler. It was a
      // duplicate, not a loss: `EnquiriesScreen` is itself titled
      // "My Quotations" and both screens call the same `enquiryApi.list()` and
      // render the same enquiry records. The wholesaler has no Quotes tile and
      // nothing navigates to its QuotationListScreen either.
      // `QuotationsScreen` + `SCREENS.QUOTATIONS` are left registered in
      // AppNavigator so the route still works if deep-linked, but the dashboard
      // no longer surfaces a second entry point to the same data.
      title: 'Marketplace',
      items: [
        { icon: 'cube-outline',                 iconColor: ORANGE,    bg: ORANGE_LT,  label: 'Products',  module: 'products',  screen: SCREENS.MY_PRODUCTS },
        { icon: 'chatbubble-ellipses-outline',  iconColor: '#2563EB', bg: '#EFF6FF',  label: 'Enquiries', module: 'enquiries', screen: SCREENS.ENQUIRIES },
        { icon: 'list-outline',                 iconColor: '#0891B2', bg: '#ECFEFF',  label: 'Orders',    module: 'orders',    screen: SCREENS.ORDERS },
        // Dispatch = OUTBOUND shipments the retailer raises for its own orders
        // (module key 'dispatches'). Inbound shipments raised by a seller are
        // reached from the Orders tile → Order Details → Dispatch Details.
        { icon: 'car-outline',                  iconColor: '#7C3AED', bg: '#F5F3FF',  label: 'Dispatch',  module: 'dispatches', screen: SCREENS.DISPATCH_TRACKING },
      ],
    },
    {
      // Wholesaler = Inventory + Purchase only. Two things to know here:
      //
      // 1. Transfer / Adjust Stock / Warehouse are NOT dashboard tiles in the
      //    wholesaler — they're action buttons INSIDE InventoryScreen
      //    (`inventory/InventoryScreen.jsx` lines 461-471, 593). The retailer's
      //    InventoryScreen already has all four entry points
      //    (STOCK_TRANSFER:207, STOCK_ADJUST:106/158/214, WAREHOUSE_LIST:157),
      //    so the Transfer tile here was a duplicate of an existing path.
      //
      // 2. Suppliers has NO tile here — the user wants this group to match the
      //    wholesaler exactly (wholesaler = Inventory + Purchase only).
      //    SupplierListScreen and its backend (`/api/retailer/erp/suppliers`,
      //    full CRUD) still exist and stay wired — reachable from the Profile
      //    menu ("Billing & Finance" → Suppliers), so it is NOT orphaned.
      //    (Previously reachable via a `people-outline` action in the Purchase
      //    list header; that was removed when the Purchase list was matched to
      //    the wholesaler, whose header is back · title · + only.)
      title: 'Inventory & Purchase',
      items: [
        { icon: 'business-outline',  iconColor: '#0891B2', bg: '#ECFEFF', label: 'Inventory', module: 'inventory', screen: SCREENS.INVENTORY },
        { icon: 'cart-outline',      iconColor: '#DC2626', bg: '#FEF2F2', label: 'Purchase',  module: 'purchases', screen: SCREENS.PURCHASE_LIST },
      ],
    },
    {
      // Matches the wholesaler's dashboard Finance group EXACTLY — 4 tiles:
      // Sales, Invoices, Expense, Profit & Loss (wholesaler
      // `dashboard/DashboardScreen.jsx` lines 341-349).
      //
      // Do NOT add tiles here. The wholesaler keeps Payments / Receivable /
      // Payable / Ledger / Accounts out of the dashboard entirely — they live in
      // its "Payments & Finance" section on the More screen
      // (`settings/MoreMenuScreen.jsx`). Retailer equivalents are reached the same
      // way: Payments → More/"Payments & Finance", Accounts → More. Adding them
      // here made the two dashboards diverge.
      title: 'Finance',
      items: [
        { icon: 'trending-up',             iconColor: '#059669', bg: '#ECFDF5', label: 'Sales',         module: 'sales',       screen: SCREENS.SALES_LIST },
        { icon: 'receipt-outline',         iconColor: '#E67E22', bg: '#FDF0E4', label: 'Invoices',      module: 'invoices',    screen: SCREENS.INVOICES },
        { icon: 'document-text-outline',   iconColor: '#DC2626', bg: '#FEF2F2', label: 'Expense',       module: 'expenses',    screen: SCREENS.EXPENSE_LIST },
        { icon: 'stats-chart-outline',     iconColor: '#059669', bg: '#ECFDF5', label: 'Profit & Loss', module: 'profit_loss', screen: SCREENS.PROFIT_LOSS },
      ],
    },
    {
      title: 'CRM',
      items: [
        { icon: 'people-outline',  iconColor: '#7C3AED', bg: '#F5F3FF', label: 'Customers', module: 'customers', screen: SCREENS.CUSTOMER_LIST },
        { icon: 'locate-outline',  iconColor: '#DB2777', bg: '#FDF2F8', label: 'Leads',     module: 'leads',     screen: SCREENS.LEAD_LIST },
      ],
    },
    {
      title: 'Tools',
      items: [
        // Client-side only (AsyncStorage) — no backend route, so no `module` key.
        { icon: 'calculator-outline', iconColor: ORANGE, bg: ORANGE_LT, label: 'Stone Calc', screen: SCREENS.STONE_CALC },
      ],
    },
    {
      title: 'More',
      items: [
        { icon: 'bar-chart-outline',   iconColor: '#2563EB', bg: '#EFF6FF', label: 'Reports',   module: 'reports',     screen: SCREENS.REPORT_CENTER },
        { icon: 'pie-chart-outline',   iconColor: '#DB2777', bg: '#FDF2F8', label: 'Analytics', module: 'reports',     screen: SCREENS.ANALYTICS },
        { icon: 'person-outline',      iconColor: '#6D28D9', bg: '#F5F3FF', label: 'Staff',     module: 'staff',       screen: SCREENS.STAFF_LIST },
        // Documents = the free-form repository (typed uploads, tabs, list),
        // matching the wholesaler's Documents tile. The retailer-only KYC
        // verification screen lives under Profile → KYC Verification.
        { icon: 'folder-outline',      iconColor: '#0891B2', bg: '#ECFEFF', label: 'Documents', module: 'documents',   screen: SCREENS.DOCUMENT_REPOSITORY },
      ],
    },
  ];

  const visibleGroups = MODULE_GROUPS
    .map(g => ({
      ...g,
      items: g.items.filter(a => !a.module || can(a.module)),
    }))
    .filter(g => g.items.length > 0);

  const showPL = can('profit_loss') || can('sales');

  /* ── Loading / error ── */
  if (loading && !data) {
    return (
      <SafeAreaView style={st.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={st.loadingWrap}>
          <ActivityIndicator color={ORANGE} size="large" />
          <Text style={st.loadingText}>Loading dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!data && error) {
    return (
      <SafeAreaView style={st.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={st.loadingWrap}>
          <Ionicons name="cloud-offline-outline" size={44} color={TEXT_3} />
          <Text style={st.errorText}>{error}</Text>
          <TouchableOpacity
            style={st.retryBtn}
            onPress={() => { setLoading(true); load().then(() => setLoading(false)); }}
          >
            <Text style={st.retryTxt}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ORANGE]} tintColor={ORANGE} />}
      >
        {/* ═══ HEADER ═══ */}
        <View style={st.header}>
          <View style={st.headerCircle1} />
          <View style={st.headerCircle2} />

          <View style={st.headerTop}>
            <View style={st.avatarWrap}>
              <View style={st.avatar}>
                <Text style={st.avatarText}>{initialsText}</Text>
              </View>
              <View style={st.headerText}>
                <Text style={st.greeting}>{getGreeting()} 👋</Text>
                <Text style={st.name} numberOfLines={1}>{ownerName}</Text>
                {companyName ? (
                  <View style={st.compBadge}>
                    <Ionicons name="business" size={9} color="#FFF" />
                    <Text style={st.compText} numberOfLines={1}>{companyName}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <TouchableOpacity
              style={st.bell}
              onPress={() => go(SCREENS.NOTIFICATIONS)}
              activeOpacity={0.8}
            >
              <Ionicons name="notifications-outline" size={21} color="#FFFFFF" />
              {unread > 0 && (
                <View style={st.bellDot}>
                  <Text style={st.bellDotTxt}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={st.dateRow}>
            <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.65)" />
            <Text style={st.dateText}>{todayLabel()}</Text>
            <View style={st.planPill}>
              <Text style={st.planTxt}>{companyStatus ? `${planName} · ${companyStatus}` : planName}</Text>
            </View>
          </View>

          {/* Summary strip */}
          <View style={st.headerSummary}>
            <TouchableOpacity style={st.summaryItem} activeOpacity={0.8} onPress={() => go(SCREENS.ENQUIRIES)}>
              <Text style={st.summaryValue}>{totalEnquiries}</Text>
              <Text style={st.summaryLabel}>Enquiries</Text>
            </TouchableOpacity>
            <View style={st.summaryDivider} />
            <TouchableOpacity style={st.summaryItem} activeOpacity={0.8} onPress={() => go(SCREENS.ORDERS)}>
              <Text style={st.summaryValue}>{pendingOrder}</Text>
              <Text style={st.summaryLabel}>Pending Orders</Text>
            </TouchableOpacity>
            <View style={st.summaryDivider} />
            <TouchableOpacity style={st.summaryItem} activeOpacity={0.8} onPress={() => go(SCREENS.INVENTORY)}>
              <Text style={st.summaryValue}>{lowStock}</Text>
              <Text style={st.summaryLabel}>Low Stock</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ═══ KPI CARDS ═══ */}
        <View style={st.statGrid}>
          {KPIS.map((k, i) => (
            <StatCard key={k.label} {...k} wide={i === KPIS.length - 1 && KPIS.length % 2 === 1} />
          ))}
        </View>

        {/* ═══ THIS MONTH ═══ */}
        {showPL ? (
          <View style={st.block}>
            <SectionHeader title="This Month" action="Details" onAction={() => go(SCREENS.PROFIT_LOSS)} />
            <View style={st.plCard}>
              <View style={st.plRow}>
                <View style={st.plItem}>
                  <Text style={[st.plValue, { color: Colors.success }]}>{formatCurrency(monthSales)}</Text>
                  <Text style={st.plLabel}>Sales</Text>
                </View>
                <View style={st.plDivider} />
                <View style={st.plItem}>
                  <Text style={[st.plValue, { color: '#2563EB' }]}>{formatCurrency(monthPurchase)}</Text>
                  <Text style={st.plLabel}>Purchase</Text>
                </View>
                <View style={st.plDivider} />
                <View style={st.plItem}>
                  <Text style={[st.plValue, { color: Colors.error }]}>{formatCurrency(monthExpense)}</Text>
                  <Text style={st.plLabel}>Expense</Text>
                </View>
              </View>
              <View style={st.plProfitRow}>
                <Text style={st.plProfitLabel}>Net Profit</Text>
                <Text style={[st.plProfitValue, { color: monthProfit >= 0 ? Colors.success : Colors.error }]}>
                  {formatCurrency(monthProfit)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* ═══ QUICK ADD ═══ */}
        {PRIMARY_ACTIONS.length > 0 ? (
          <View style={st.block}>
            <SectionHeader title="Quick Add" />
            <View style={st.primaryRow}>
              {PRIMARY_ACTIONS.map(a => (
                <PrimaryBtn
                  key={a.label}
                  {...a}
                  soon={!READY_ROUTES.has(a.screen)}
                  onPress={() => go(a.screen)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* ═══ MODULES ═══ */}
        {visibleGroups.map(group => (
          <View style={st.block} key={group.title}>
            <SectionHeader title={group.title} />
            <View style={st.quickCard}>
              <View style={st.quickGrid}>
                {group.items.map(action => (
                  <QuickAction
                    key={action.label}
                    {...action}
                    soon={!READY_ROUTES.has(action.screen)}
                    onPress={() => go(action.screen)}
                  />
                ))}
              </View>
            </View>
          </View>
        ))}

        {/* ═══ ALERTS ═══ */}
        {(lowStock > 0 || outOfStock > 0 || paymentDue > 0 || payableDue > 0 || marketDue > 0) ? (
          <View style={st.block}>
            <SectionHeader title="Alerts" />
            {lowStock > 0 ? (
              <AlertRow icon="alert-circle-outline" iconColor="#D97706" bg="#FFFBEB" accent="#F59E0B"
                title={`Low Stock — ${lowStock} product${lowStock > 1 ? 's' : ''}`} sub="Tap to view and restock"
                onPress={() => go(SCREENS.INVENTORY)} />
            ) : null}
            {outOfStock > 0 ? (
              <AlertRow icon="close-circle-outline" iconColor="#DC2626" bg="#FEF2F2" accent="#F87171"
                title={`Out of Stock — ${outOfStock} product${outOfStock > 1 ? 's' : ''}`} sub="Immediate restocking needed"
                onPress={() => go(SCREENS.INVENTORY)} />
            ) : null}
            {paymentDue > 0 ? (
              <AlertRow icon="time-outline" iconColor={ORANGE} bg={ORANGE_LT} accent={ORANGE}
                title={`Receivable — ${formatCurrency(paymentDue)}`} sub="Money your customers owe you"
                onPress={() => go(SCREENS.PAYMENT_RECEIVABLE)} />
            ) : null}
            {payableDue > 0 ? (
              <AlertRow icon="wallet-outline" iconColor="#EA580C" bg="#FFF7ED" accent="#EA580C"
                title={`Payable — ${formatCurrency(payableDue)}`} sub="Money you owe suppliers"
                onPress={() => go(SCREENS.PAYMENT_PAYABLE)} />
            ) : null}
            {marketDue > 0 ? (
              <AlertRow icon="card-outline" iconColor="#7C3AED" bg="#F5F3FF" accent="#8B5CF6"
                title={`Marketplace Due — ${formatCurrency(marketDue)}`} sub="Unpaid wholesaler invoices"
                onPress={() => go(SCREENS.INVOICES)} />
            ) : null}
          </View>
        ) : null}

        {/* ═══ RECENT ENQUIRIES ═══ */}
        <View style={st.block}>
          <SectionHeader title="Recent Enquiries" action="View All" onAction={() => go(SCREENS.ENQUIRIES)} />

          <View style={st.enquirySummary}>
            {[
              { label: 'Total',  value: totalEnquiries, color: NAVY,          bg: Colors.secondaryBg },
              { label: 'New',    value: newEnquiries,   color: '#2563EB',     bg: '#EFF6FF' },
              { label: 'Orders', value: d.totalOrders ?? counts.orders ?? 0, color: ORANGE, bg: ORANGE_LT },
              { label: 'Done',   value: d.deliveredOrders ?? counts.delivered ?? 0, color: Colors.success, bg: Colors.successBg },
            ].map(item => (
              <View key={item.label} style={[st.enquirySummaryItem, { backgroundColor: item.bg }]}>
                <Text style={[st.enquirySummaryValue, { color: item.color }]}>{item.value}</Text>
                <Text style={[st.enquirySummaryLabel, { color: item.color }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={st.listCard}>
            {recentEnquiries.length === 0 ? (
              <View style={st.emptyState}>
                <View style={st.emptyIconWrap}>
                  <Ionicons name="chatbubble-ellipses-outline" size={28} color={ORANGE} />
                </View>
                <Text style={st.emptyTitle}>No enquiries yet</Text>
                <Text style={st.emptySubtitle}>Your enquiries will appear here.</Text>
              </View>
            ) : (
              recentEnquiries.slice(0, 4).map((item, idx, arr) => (
                <EnqCard
                  key={item._id || item.id || idx}
                  item={item}
                  isLast={idx === arr.length - 1}
                  onPress={() => go(SCREENS.ENQUIRY_DETAILS, { enquiryId: item._id || item.id })}
                />
              ))
            )}
          </View>
        </View>

        {/* Two dashboard cards were removed from this area on request: the
            "Recent Orders" list and the owner-only "Team" card. Nothing is
            orphaned — Orders live in the module grid's Orders/Dispatch tiles,
            and staff management in the "Staff" tile (SCREENS.STAFF_LIST). */}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ============================================================
   STYLES
============================================================ */

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scrollContent: { paddingBottom: 32 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  loadingText: { fontSize: 13, color: TEXT_2 },
  errorText: { fontSize: 13, color: TEXT_2, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10, backgroundColor: ORANGE_LT },
  retryTxt: { fontSize: 13, fontWeight: '700', color: ORANGE },

  /* ── Header ── */
  header: {
    backgroundColor: NAVY,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 74,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerCircle1: { position: 'absolute', width: 240, height: 240, borderRadius: 120, right: -90, top: -110, backgroundColor: 'rgba(244,80,10,0.12)' },
  headerCircle2: { position: 'absolute', width: 150, height: 150, borderRadius: 75, right: 40, top: 30, backgroundColor: 'rgba(255,255,255,0.04)' },

  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatarWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 46, height: 46, borderRadius: 14, marginRight: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  headerText: { flex: 1 },
  greeting: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.70)', marginBottom: 2 },
  name: { fontSize: 19, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.1 },
  compBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginTop: 6, alignSelf: 'flex-start', maxWidth: '100%' },
  compText: { fontSize: 9.5, fontWeight: '700', color: '#FFF' },

  bell: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', marginLeft: 12 },
  bellDot: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: NAVY, paddingHorizontal: 3 },
  bellDotTxt: { fontSize: 8.5, fontWeight: '800', color: '#FFF' },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14 },
  dateText: { fontSize: 11, color: 'rgba(255,255,255,0.65)' },
  planPill: { marginLeft: 8, backgroundColor: 'rgba(244,80,10,0.22)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  planTxt: { fontSize: 9.5, fontWeight: '700', color: '#FFC7A8' },

  headerSummary: { flexDirection: 'row', alignItems: 'center', marginTop: 20, padding: 15, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 19, fontWeight: '800', color: '#FFFFFF', marginBottom: 3 },
  summaryLabel: { fontSize: 9.5, color: 'rgba(255,255,255,0.62)' },
  summaryDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.16)' },

  /* ── KPI grid ── */
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: H_PAD, marginTop: -50, zIndex: 5 },
  statCard: { minHeight: 118, backgroundColor: WHITE, borderRadius: 20, padding: 16, ...CARD_SHADOW },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  statPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9 },
  statPillText: { fontSize: 9.5, fontWeight: '700' },
  statValue: { marginTop: 16, fontSize: 21, fontWeight: '800', color: TEXT, letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontWeight: '600', color: TEXT_2, marginTop: 3 },

  /* ── Block + section header ── */
  block: { marginTop: 26, paddingHorizontal: H_PAD },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitleWrap: { flexDirection: 'row', alignItems: 'center' },
  sectionAccent: { width: 4, height: 20, borderRadius: 3, backgroundColor: ORANGE, marginRight: 9 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: TEXT },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingLeft: 8 },
  viewAllText: { fontSize: 12, fontWeight: '700', color: ORANGE },

  /* ── P&L card ── */
  plCard: { backgroundColor: WHITE, borderRadius: 20, padding: 16, ...CARD_SHADOW },
  plRow: { flexDirection: 'row', alignItems: 'center' },
  plItem: { flex: 1, alignItems: 'center' },
  plValue: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  plLabel: { fontSize: 10.5, fontWeight: '600', color: TEXT_2, marginTop: 3 },
  plDivider: { width: 1, height: 32, backgroundColor: BORDER },
  plProfitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  plProfitLabel: { fontSize: 12.5, fontWeight: '700', color: TEXT },
  plProfitValue: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },

  /* ── Quick add ── */
  primaryRow: { flexDirection: 'row', gap: 10 },
  primaryBtn: { flex: 1, backgroundColor: WHITE, borderRadius: 18, paddingVertical: 14, alignItems: 'center', ...CARD_SHADOW },
  primaryIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  primaryLabel: { fontSize: 10.5, fontWeight: '700', color: TEXT, textAlign: 'center', lineHeight: 13.5, maxWidth: 74 },

  /* ── Module grid ── */
  quickCard: { backgroundColor: WHITE, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 6, ...CARD_SHADOW },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  quickAction: { width: '25%', minHeight: 88, alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6 },
  quickIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickLabel: { fontSize: 10.5, lineHeight: 13.5, fontWeight: '700', color: TEXT, textAlign: 'center', maxWidth: 72 },
  soonDot: { position: 'absolute', top: 4, right: 4, width: 9, height: 9, borderRadius: 5, backgroundColor: ORANGE, borderWidth: 1.5, borderColor: WHITE },

  /* ── Alerts ── */
  alertRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderRadius: 16, marginBottom: 10, paddingHorizontal: 13, ...CARD_SHADOW },
  alertIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: 12.5, fontWeight: '800', color: TEXT, marginBottom: 3 },
  alertSub: { fontSize: 10.5, color: TEXT_2 },

  /* ── Enquiry summary ── */
  enquirySummary: { flexDirection: 'row', gap: 9, marginBottom: 13 },
  enquirySummaryItem: { flex: 1, minHeight: 66, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  enquirySummaryValue: { fontSize: 20, fontWeight: '800' },
  enquirySummaryLabel: { fontSize: 9.5, fontWeight: '700', marginTop: 3, opacity: 0.9 },

  /* ── Lists ── */
  listCard: { backgroundColor: WHITE, borderRadius: 20, overflow: 'hidden', ...CARD_SHADOW },
  enquiryCard: { minHeight: 74, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  enqAvatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  enqAvatarText: { fontSize: 13, fontWeight: '800' },
  enquiryBody: { flex: 1 },
  enquiryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  customerName: { fontSize: 13.5, fontWeight: '700', color: TEXT, flex: 1, marginRight: 8 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '700' },
  enquiryMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  enquiryCode: { fontSize: 9.5, fontWeight: '700', color: TEXT_3, letterSpacing: 0.3 },
  metaText: { fontSize: 10, color: TEXT_2, flexShrink: 1 },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#C5C8D0' },

  /* ── Empty ── */
  emptyState: { minHeight: 170, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24 },
  emptyIconWrap: { width: 58, height: 58, borderRadius: 18, backgroundColor: ORANGE_LT, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: TEXT, marginBottom: 5 },
  emptySubtitle: { fontSize: 11, color: TEXT_2, textAlign: 'center', lineHeight: 16 },

});
