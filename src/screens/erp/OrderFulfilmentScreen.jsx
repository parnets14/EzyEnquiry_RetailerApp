/**
 * src/screens/erp/OrderFulfilmentScreen.jsx  (Retailer app)
 *
 * ORDERS I AM SELLING — the product-owner side of the order lifecycle.
 *
 *   GET   /api/retailer/erp/orders                 list (scoped to orders I sell)
 *   PATCH /api/retailer/erp/orders/:id/status      accept / reject
 *   → navigates to OrderPackScreen to send part or all of an order
 *
 * ── WHY THIS IS SEPARATE FROM THE ORDERS TAB ─────────────────────────────────
 * The Orders tab (screens/orders/OrdersScreen.jsx) is the BUYER's view: things
 * this retailer purchased from someone else, read-only plus cancel. This screen
 * is the mirror image — orders raised against products THIS retailer sells, the
 * ones it is responsible for accepting and shipping. The backend keeps them
 * apart by company: an order's `company_id` is its SELLER, so a purchase this
 * retailer placed never appears here.
 *
 * ── THE FLOW THIS DRIVES ─────────────────────────────────────────────────────
 *   New            → Accept (or Reject)
 *   Accepted       → Pack & Dispatch  (partial allowed: send 50 of 100)
 *   Dispatched     → send the remainder, or wait for the buyer's delivery OTP
 *   Delivered      → done
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { erpApi } from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { SCREENS } from '../../constants';
import {
  ErpHeader, ErpSearchBox, ErpTabs, ErpBadge, ErpMetaChip,
  ErpLoading, ErpError, ErpEmpty, ERP,
} from '../../components/erp';

const PAGE_SIZE = 20;

// Every status the Order model can hold for a seller-side order, in lifecycle
// order. 'All' is the unfiltered default. Tabs map 1:1 to `?status=`, so adding
// one here needs no backend change — but it MUST match the stored string exactly
// or the tab returns an empty list.
const TABS = ['All', 'New', 'Accepted', 'Packing', 'Dispatched', 'Out for Delivery', 'Delivered', 'Cancelled'];

const STATUS_STYLE = {
  New:               { color: '#1D4ED8', bg: '#DBEAFE' },
  Accepted:          { color: '#7C3AED', bg: '#EDE9FE' },
  Packing:           { color: '#B45309', bg: '#FEF3C7' },
  Dispatched:        { color: '#0891B2', bg: '#CFFAFE' },
  'Out for Delivery':{ color: '#0891B2', bg: '#CFFAFE' },
  Delivered:         { color: '#047857', bg: '#DCFCE7' },
  Cancelled:         { color: '#B91C1C', bg: '#FEE2E2' },
};

const styleFor = (status) => STATUS_STYLE[status] || { color: ERP.muted, bg: '#F1F3F7' };

const unitOf = (o) => (o?.unit || '').trim();
const qtyText = (n, o) => `${n} ${unitOf(o)}`.trim();

export default function OrderFulfilmentScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [orders,     setOrders]     = useState([]);
  const [counts,     setCounts]     = useState({});
  const [tab,        setTab]        = useState('All');
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore,setLoadingMore]= useState(false);
  const [error,      setError]      = useState('');
  const [busyId,     setBusyId]     = useState(null);

  const load = useCallback(async (page = 1, append = false) => {
    if (page === 1) { append ? setRefreshing(true) : setLoading(true); }
    else setLoadingMore(true);
    setError('');
    try {
      const res  = await erpApi.listSellerOrders({
        page, limit: PAGE_SIZE,
        ...(tab !== 'All'      && { status: tab }),
        ...(search.trim()      && { search: search.trim() }),
      });
      const data = res?.data ?? res;
      const list = data?.orders ?? [];
      setOrders(prev => (append && page > 1) ? [...prev, ...list] : list);
      setCounts(data?.counts || {});
    } catch (e) {
      setError(e?.message || 'Could not load your orders.');
      if (!append) setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [tab, search]);

  useEffect(() => { load(1); }, [load]);

  // Refresh on focus so an order packed on the next screen shows its new progress.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { load(1); });
    return unsub;
  }, [navigation, load]);

  const changeStatus = async (order, action) => {
    setBusyId(order._id);
    try {
      await erpApi.updateSellerOrderStatus(order._id, action);
      await load(1);
    } catch (e) {
      const TITLES = {
        accept: 'Could not accept order',
        reject: 'Could not reject order',
        cancel: 'Could not cancel order',
      };
      Alert.alert(TITLES[action] || 'Could not update order', e?.message || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = (order) => {
    Alert.alert(
      'Reject this order?',
      `${order.order_code || 'This order'} from ${order.customer_name || 'the customer'} will be cancelled.`,
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => changeStatus(order, 'reject') },
      ],
    );
  };

  // Accepting reserves the stock. Without this escape hatch a mis-tapped Accept
  // would hold those units forever, so cancelling an accepted-but-unshipped
  // order is what hands them back to available.
  const confirmCancel = (order) => {
    Alert.alert(
      'Cancel this order?',
      `${order.order_code || 'This order'} will be cancelled and the reserved stock released.`,
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Cancel order', style: 'destructive', onPress: () => changeStatus(order, 'cancel') },
      ],
    );
  };

  const openPack = (order) => navigation.navigate(SCREENS.ORDER_PACK, { orderId: order._id });

  const renderCard = ({ item }) => {
    const p = item.progress || {};
    const remaining = Number(p.remaining_qty) || 0;
    const dispatched = Number(p.dispatched_qty) || 0;
    const ordered = Number(p.ordered_qty) || 0;
    const canAccept = item.status === 'New';
    const canPack = remaining > 0 && ['Accepted', 'Packing', 'Dispatched', 'Out for Delivery'].includes(item.status);
    // Only while nothing has shipped — once a dispatch exists the stock is gone
    // and an invoice is raised, so the backend rejects it too (409).
    const canCancel = dispatched === 0 && ['Accepted', 'Packing'].includes(item.status);
    const busy = busyId === item._id;
    const ss = styleFor(item.status);
    const pct = ordered > 0 ? Math.min(100, Math.round((dispatched / ordered) * 100)) : 0;
    const packs = Array.isArray(item.packages) ? item.packages : [];

    return (
      <View style={st.card}>
        <View style={st.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={st.code}>{item.order_code || '—'}</Text>
            <Text style={st.customer} numberOfLines={1}>{item.customer_name || '—'}</Text>
            <Text style={st.product} numberOfLines={1}>
              {item.product_name || '—'}{item.product_code ? ` · ${item.product_code}` : ''}
            </Text>
          </View>
          <ErpBadge label={item.status} color={ss.color} bg={ss.bg} dot />
        </View>

        <View style={st.metaRow}>
          <ErpMetaChip icon="cube-outline" label={qtyText(ordered, item)} />
          <ErpMetaChip icon="pricetag-outline" label={formatCurrency(item.total_amount || 0)} />
          {item.created_at ? <ErpMetaChip icon="calendar-outline" label={formatDate(item.created_at)} /> : null}
        </View>

        {/* Fulfilment progress — the "100 ordered, 50 sent" line */}
        {ordered > 0 ? (
          <View style={st.progressBlock}>
            <View style={st.progressHead}>
              <Text style={st.progressLabel}>
                {dispatched} of {ordered} sent
                {remaining > 0 ? `  ·  ${remaining} ${unitOf(item)} pending` : ''}
              </Text>
              <Text style={[st.progressPct, remaining <= 0 && { color: '#10B981' }]}>{pct}%</Text>
            </View>
            <View style={st.progressTrack}>
              <View style={[st.progressFill, { width: `${pct}%`, backgroundColor: remaining <= 0 ? '#10B981' : Colors.primary }]} />
            </View>
          </View>
        ) : null}

        {/* Pack history — each entry is one invoice + one dispatch */}
        {packs.length > 0 ? (
          <View style={st.packList}>
            {packs.map((pk, i) => (
              <View key={pk._id || i} style={st.packRow}>
                <View style={st.packDot} />
                <Text style={st.packText} numberOfLines={1}>
                  Pack {pk.pack_no || i + 1} · {pk.qty} {unitOf(item)}
                  {pk.invoice_number ? `  ·  ${pk.invoice_number}` : ''}
                  {pk.dispatch_code ? `  ·  ${pk.dispatch_code}` : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Actions */}
        {canAccept || canPack || canCancel ? (
          <View style={st.actionRow}>
            {canAccept ? (
              <>
                <TouchableOpacity
                  style={[st.btn, st.btnGhost, busy && st.btnOff]}
                  onPress={() => confirmReject(item)}
                  disabled={busy}
                  activeOpacity={0.85}>
                  <Text style={st.btnGhostText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.btn, st.btnAccept, busy && st.btnOff]}
                  onPress={() => changeStatus(item, 'accept')}
                  disabled={busy}
                  activeOpacity={0.85}>
                  {busy ? <ActivityIndicator size="small" color="#FFF" /> : (
                    <>
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                      <Text style={st.btnAcceptText}>Accept order</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {canCancel ? (
                  <TouchableOpacity
                    style={[st.btn, st.btnGhost, busy && st.btnOff]}
                    onPress={() => confirmCancel(item)}
                    disabled={busy}
                    activeOpacity={0.85}>
                    <Text style={st.btnGhostText}>Cancel</Text>
                  </TouchableOpacity>
                ) : null}
                {canPack ? (
                  <TouchableOpacity style={[st.btn, st.btnPrimary]} onPress={() => openPack(item)} activeOpacity={0.85}>
                    <Ionicons name="cube-outline" size={16} color="#FFF" />
                    <Text style={st.btnPrimaryText}>
                      {dispatched > 0 ? `Send remaining ${remaining}` : `Pack & Dispatch`}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  const tabsWithCounts = TABS.map(t => (t === 'All' || counts[t] ? `${t}` : t));

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader
        title="Orders I am Selling"
        subtitle={loading ? 'Loading…' : `${counts.All ?? orders.length} orders to fulfil`}
        onBack={() => navigation.goBack()}
      >
        <ErpSearchBox
          value={search}
          onChangeText={setSearch}
          placeholder="Search order no, customer, product…"
        />
      </ErpHeader>

      <ErpTabs tabs={tabsWithCounts} active={tab} onChange={setTab} />

      {loading && orders.length === 0 ? (
        <ErpLoading label="Loading orders…" />
      ) : error && orders.length === 0 ? (
        <ErpError message={error} onRetry={() => load(1)} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => String(item._id)}
          renderItem={renderCard}
          contentContainerStyle={[st.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(1, true)}
              colors={[Colors.primary]} tintColor={Colors.primary} />
          }
          onEndReached={() => { if (!loadingMore && orders.length >= PAGE_SIZE) load(Math.ceil(orders.length / PAGE_SIZE) + 1, true); }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 18 }} /> : null}
          ListEmptyComponent={
            <ErpEmpty
              icon="cube-outline"
              title="No orders here"
              subtitle={
                tab === 'New'
                  ? 'Nothing waiting for your approval.'
                  : 'Orders raised against products you sell will appear here.'
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  list: { padding: 12 },

  card: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border, ...Shadows.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  code: { fontSize: 11, fontWeight: '800', color: ERP.muted, letterSpacing: 0.4 },
  customer: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginTop: 2 },
  product: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 2 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },

  /* Progress */
  progressBlock: { marginTop: 12 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  progressLabel: { fontSize: 11.5, color: Colors.textSecondary, flex: 1 },
  progressPct: { fontSize: 11.5, fontWeight: '800', color: Colors.primary },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: '#E7EAF0', overflow: 'hidden' },
  progressFill: { height: 7, borderRadius: 4 },

  /* Pack history */
  packList: { marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 8, gap: 5 },
  packRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  packDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary },
  packText: { flex: 1, fontSize: 11.5, color: Colors.textSecondary },

  /* Actions */
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 42, borderRadius: 11,
  },
  btnOff: { opacity: 0.6 },
  btnGhost: { backgroundColor: '#FFF', borderWidth: 1, borderColor: Colors.border },
  btnGhostText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  btnAccept: { backgroundColor: '#10B981' },
  btnAcceptText: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  btnPrimary: { backgroundColor: Colors.primary },
  btnPrimaryText: { fontSize: 13, fontWeight: '800', color: '#FFF' },
});
