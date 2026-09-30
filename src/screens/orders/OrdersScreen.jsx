// src/screens/orders/OrdersScreen.jsx
// Retailer Orders — structural parity with wholesalerapp/src/screens/order/OrderListScreen.jsx.
//
// Layout matches the wholesaler exactly:
//   - "Create Order" button pinned at the top
//   - horizontally scrollable status pills, each with a live count badge
//   - a short 3-row card: order code + status chip / customer / amount + date
//   - pull-to-refresh, empty state per tab
//
// ONE DELIBERATE DIFFERENCE — the status vocabulary.
// The wholesaler's 7 tabs are New, Accepted, Processing, Ready, Dispatched,
// Delivered, Cancelled. The retailer's backend does NOT speak that vocabulary:
// `retailerMarketplaceController.ANDROID_STATUS` normalises every order into a
// 6-stage set — New, Accepted, Packing, Dispatched, Out for Delivery, Delivered,
// Cancelled — and `listOrders` filters SERVER-SIDE through STATUS_GROUPS. Asking
// for `status=Processing` or `status=Ready` therefore returns zero rows, so
// those tabs would be permanently empty and `Packing` / `Out for Delivery`
// orders would be unreachable. The retailer's tabs are its real statuses, in the
// wholesaler's pill-with-count layout. See SKILL.md → "Orders screen".
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Shadows } from '../../theme/spacing';
import EmptyState from '../../components/common/EmptyState';
import { orderApi } from '../../utils/api';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { SCREENS } from '../../constants';

// The retailer's real statuses, in lifecycle order.
const TABS = ['New', 'Accepted', 'Packing', 'Dispatched', 'Out for Delivery', 'Delivered', 'Cancelled'];
// Compact labels so all seven pills fit without truncation.
const TAB_LABELS = { 'Out for Delivery': 'On Way' };

// Mirrors the wholesaler's STATUS_META palette, keyed by the retailer's statuses.
const STATUS_META = {
  New:                { bg: '#EFF6FF', text: '#2563EB', icon: 'add-circle-outline' },
  Accepted:           { bg: '#F5F3FF', text: '#7C3AED', icon: 'checkmark-circle-outline' },
  Packing:            { bg: '#FFF7ED', text: '#D97706', icon: 'cube-outline' },
  Dispatched:         { bg: '#EFF6FF', text: '#0369A1', icon: 'car-outline' },
  'Out for Delivery': { bg: '#ECFEFF', text: '#0891B2', icon: 'navigate-outline' },
  Delivered:          { bg: '#F0FDF4', text: '#059669', icon: 'checkmark-done' },
  Cancelled:          { bg: '#FEF2F2', text: '#DC2626', icon: 'close-circle-outline' },
};

// Map the backend order DTO onto the flat card fields.
// NOTE field names differ from the wholesaler's: the retailer's DTO nests the
// amount under `total_amount`, and the counterparty under `seller`.
//
// The wholesaler's middle row shows the CUSTOMER — it is the seller there.
// The retailer is the BUYER, and `createOrder` sets `customer_name` to the
// retailer's OWN company name (retailerMarketplaceController line ~1321), so
// rendering `customer.name` would print the retailer to itself. The meaningful
// counterparty for a buyer-side order is the seller, so that row shows the
// seller, with the customer name as a fallback for legacy/edge records.
function mapOrder(o) {
  return {
    id: o.id,
    orderCode: o.order_code,
    status: o.status,
    partyName: o.seller?.name || o.customer?.name || o.created_by?.company || '—',
    total: o.total_amount,
    createdAt: o.created_at,
  };
}

export default function OrdersScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [tabIdx, setTabIdx]   = useState(0);
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Load ALL orders once; the pills then filter client-side exactly like the
  // wholesaler's screen does. This also keeps every count badge accurate.
  const load = useCallback(async () => {
    setError('');
    try {
      const data = await orderApi.list({ limit: 100 });
      setOrders((data?.orders || []).map(mapOrder));
    } catch (err) {
      setError(err.message || 'Could not load orders.');
    }
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]);

  const onRefresh = async () => { setLoading(true); await load(); setLoading(false); };

  const activeStatus = TABS[tabIdx];
  const filtered     = orders.filter(o => o.status === activeStatus);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Create Order — the wholesaler's OrderEntry equivalent is the retailer's
          Sales Entry ("New Sale" on the dashboard). The retailer has no separate
          order-entry screen: marketplace orders are created from an accepted
          quotation (QuotationConfirmScreen → OrderSuccess), so this button opens
          the manual sale entry instead. */}
      <TouchableOpacity
        style={[styles.createBtn, { marginTop: insets.top + 12 }]}
        onPress={() => navigation.navigate(SCREENS.SALES_ENTRY)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={18} color="#FFF" />
        <Text style={styles.createBtnText}>Create Order</Text>
      </TouchableOpacity>

      {/* Status pills with count badges */}
      <View style={styles.tabBarWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TABS}
          keyExtractor={t => t}
          contentContainerStyle={styles.tabList}
          renderItem={({ item: tab, index }) => {
            const active = index === tabIdx;
            const count  = orders.filter(o => o.status === tab).length;
            return (
              <TouchableOpacity
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTabIdx(index)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {TAB_LABELS[tab] || tab}
                </Text>
                {count > 0 && (
                  <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {loading && orders.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.loadingText}>Loading orders…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh}><Text style={styles.retryText}>Tap to retry</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} colors={[Colors.primary]} />}
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status] || STATUS_META.New;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate(SCREENS.ORDER_DETAILS, { orderId: item.id })}
                activeOpacity={0.78}
              >
                {/* Top: order code + status */}
                <View style={styles.cardTop}>
                  <View style={styles.orderCodeWrap}>
                    <Ionicons name="receipt-outline" size={14} color={Colors.primary} />
                    <Text style={styles.orderCode}>
                      {item.orderCode || 'ORD-' + String(item.id || '').slice(-6)}
                    </Text>
                  </View>
                  <View style={[styles.chip, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={11} color={meta.text} />
                    <Text style={[styles.chipText, { color: meta.text }]}>
                      {TAB_LABELS[item.status] || item.status}
                    </Text>
                  </View>
                </View>

                {/* Counterparty — the seller this order was placed with */}
                <View style={styles.customerRow}>
                  <Ionicons name="storefront-outline" size={13} color={Colors.textSecondary} />
                  <Text style={styles.customerName} numberOfLines={1}>{item.partyName}</Text>
                </View>

                {/* Footer: amount + date */}
                <View style={styles.cardFooter}>
                  <Text style={styles.amount}>{formatCurrency(item.total || 0)}</Text>
                  <View style={styles.dateRow}>
                    <Ionicons name="calendar-outline" size={12} color={Colors.textDisabled} />
                    <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              iconName="cube-outline"
              title={`No ${TAB_LABELS[activeStatus] || activeStatus} orders`}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.secondary, marginHorizontal: 12, marginBottom: 0,
    borderRadius: 12, paddingVertical: 13,
  },
  createBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },

  tabBarWrap: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: Colors.border, marginTop: 12 },
  tabList: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F4F6FA' },
  tabActive:          { backgroundColor: Colors.secondary },
  tabText:            { ...Typography.caption, fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive:      { color: '#FFF' },
  tabBadge:           { backgroundColor: Colors.border, borderRadius: 8, minWidth: 18, paddingHorizontal: 4, alignItems: 'center' },
  tabBadgeActive:     { backgroundColor: 'rgba(255,255,255,0.3)' },
  tabBadgeText:       { fontSize: 9, fontWeight: '800', color: Colors.textSecondary },
  tabBadgeTextActive: { color: '#FFF' },

  list: { padding: 12, paddingBottom: 32 },

  card: {
    backgroundColor: '#FFF', borderRadius: 14, marginBottom: 10,
    padding: 14, borderWidth: 1, borderColor: Colors.border,
    gap: 8, ...Shadows.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderCodeWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderCode: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  chipText: { fontSize: 11, fontWeight: '700' },

  customerRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  customerName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, flex: 1 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8 },
  amount:   { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  dateRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 12, color: Colors.textDisabled },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  loadingText: { ...Typography.body2, color: Colors.textSecondary },
  errorText: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  retryText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },
});
