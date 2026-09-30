/**
 * src/screens/erp/DispatchTrackingScreen.jsx  (Retailer app)
 *
 * Outbound dispatch management — wholesaler parity for the retailer app.
 *
 *   GET    /api/retailer/erp/dispatches                     listDispatches
 *   GET    /api/retailer/erp/dispatches/:id                 getDispatch
 *   PATCH  /api/retailer/erp/dispatches/:id/intransit       markInTransit
 *   PATCH  /api/retailer/erp/dispatches/:id/deliver         markDelivered
 *   POST   /api/retailer/erp/dispatches/upload-pod          uploadPod
 *
 * ── SCOPE (important) ────────────────────────────────────────────────────────
 * These are dispatches the retailer OWNS as the seller: orders raised against
 * products the retailer sells. `Dispatch.company_id` is the seller's company,
 * so a retailer's own marketplace PURCHASES never appear here — those are
 * dispatched by their seller and the retailer cannot see that dispatch record.
 *
 * Consequently the list is legitimately empty until the retailer ships
 * something themselves; the empty state says so rather than looking broken.
 *
 * ── STATUS FLOW ──────────────────────────────────────────────────────────────
 *   Dispatched ──▶ In Transit ──▶ Delivered
 * `createDispatch` sets Dispatched and reduces physical stock; `markDelivered`
 * auto-creates the Sale + Receivable on the backend.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, FlatList, Image, Modal, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { SCREENS } from '../../constants';
import { erpApi, mediaUrl } from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  ErpHeader, ErpSummaryStrip, ErpSearchBox, ErpTabs, ErpCard, ErpSectionLabel,
  ErpInfoRow, ErpBadge, ErpMetaChip, ErpLoading, ErpError, ErpEmpty, ErpPrimaryAction, ERP,
} from '../../components/erp';

// Ionicons equivalents of the wholesaler's MaterialCommunityIcons glyphs.
const STATUS_META = {
  Dispatched:   { bg: '#FFF7ED', color: '#EA580C', icon: 'cube-outline' },
  'In Transit': { bg: '#EFF6FF', color: '#2563EB', icon: 'navigate-outline' },
  Delivered:    { bg: '#ECFDF5', color: '#059669', icon: 'checkmark-circle-outline' },
  Returned:     { bg: '#FEF2F2', color: '#DC2626', icon: 'return-down-back-outline' },
};
const metaOf = s => STATUS_META[s] || STATUS_META.Dispatched;

const FILTER_TABS = ['All', 'Dispatched', 'In Transit', 'Delivered'];
const imgSrc = u => (u ? mediaUrl(u) : null);

/* ══════════════════════════════════════════════════════════════════════════
   DETAIL MODAL
   ══════════════════════════════════════════════════════════════════════════ */
function DispatchDetailModal({ dispatchId, onClose, onChanged }) {
  const [d,        setD]        = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    if (!dispatchId) return;
    setLoading(true);
    try {
      const res = await erpApi.getDispatch(dispatchId);
      setD(res?.data ?? res);
    } catch (e) {
      Alert.alert('Could not load', e?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [dispatchId]);

  useEffect(() => { load(); }, [load]);

  const markInTransit = async () => {
    setUpdating(true);
    try {
      await erpApi.dispatchInTransit(dispatchId);
      Alert.alert('Updated', 'Marked as In Transit.');
      onChanged?.(); onClose();
    } catch (e) {
      Alert.alert('Could not update', e?.message || 'Please try again.');
    } finally { setUpdating(false); }
  };

  const doDeliver = async (podUrl) => {
    setUpdating(true);
    try {
      await erpApi.dispatchDeliver(dispatchId, podUrl ? { pod_image_url: podUrl } : {});
      Alert.alert('Delivered', 'Marked as delivered. The sale and receivable were created automatically.');
      onChanged?.(); onClose();
    } catch (e) {
      Alert.alert('Could not update', e?.message || 'Please try again.');
    } finally { setUpdating(false); }
  };

  /** Pick a photo, upload it, then mark delivered with the returned URL. */
  const attachPodAndDeliver = async () => {
    let file;
    try {
      const results = await pick({ allowMultiSelection: false, type: [types.images], mode: 'import' });
      if (!results || results.length === 0) return;
      file = results[0];
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      Alert.alert('Could not pick image', err?.message || 'Please try again.');
      return;
    }
    setUpdating(true);
    try {
      const res = await erpApi.uploadDispatchPod({ uri: file.uri, name: file.name, type: file.type });
      const url = res?.url || res?.data?.url;
      if (!url) throw new Error('The upload did not return an image URL.');
      await doDeliver(url);
    } catch (err) {
      Alert.alert('Upload failed', err?.message || 'Could not upload the proof of delivery.');
      setUpdating(false);
    }
  };

  const markDelivered = () => {
    Alert.alert('Mark Delivered', 'Attach a proof of delivery (photo of the signed challan)?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Skip', onPress: () => doDeliver(null) },
      { text: 'Add Photo', onPress: attachPodAndDeliver },
    ]);
  };

  const meta  = metaOf(d?.status);
  const order = d?.order_id;
  const pod   = imgSrc(d?.pod_image_url);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={st.safe} edges={['top']}>
        <ErpHeader title="Dispatch Detail" subtitle={d?.dispatch_code || ''} onBack={onClose} />

        {loading ? (
          <ErpLoading label="Loading dispatch…" />
        ) : !d ? (
          <ErpEmpty icon="alert-circle-outline" title="Dispatch not found" />
        ) : (
          <ScrollView contentContainerStyle={st.modalContent} showsVerticalScrollIndicator={false}>
            <ErpCard>
              <View style={st.detailTop}>
                <View style={{ flex: 1 }}>
                  <Text style={st.detailCode}>{d.dispatch_code || '—'}</Text>
                  <Text style={st.detailDate}>{formatDate(d.dispatch_date || d.created_at) || '—'}</Text>
                </View>
                <ErpBadge label={d.status} color={meta.color} bg={meta.bg} dot />
              </View>
              {d.invoice_number ? (
                <View style={{ marginTop: 10 }}>
                  <ErpMetaChip icon="receipt-outline" label={`Invoice ${d.invoice_number}`} />
                </View>
              ) : null}
            </ErpCard>

            {order ? (
              <ErpCard>
                <ErpSectionLabel>Order</ErpSectionLabel>
                <ErpInfoRow label="Order #"   value={order.order_code || '—'} />
                <ErpInfoRow label="Customer"  value={d.customer_name || order.customer_name || '—'} />
                <ErpInfoRow label="Product"   value={order.product_name || '—'} />
                <ErpInfoRow label="Quantity"  value={`${d.qty || order.qty || 0} ${d.unit || order.unit || ''}`} />
                <ErpInfoRow label="Order value" value={formatCurrency(order.total_amount || 0)} />
                {order.delivery_address || d.delivery_address ? (
                  <ErpInfoRow label="Delivery address" value={order.delivery_address || d.delivery_address} last />
                ) : null}
              </ErpCard>
            ) : null}

            <ErpCard>
              <ErpSectionLabel>Transport</ErpSectionLabel>
              <ErpInfoRow label="Transporter" value={d.transport_name || '—'} />
              <ErpInfoRow label="Vehicle #"   value={d.vehicle_number || '—'} />
              <ErpInfoRow label="LR number"   value={d.lr_number || '—'} />
              <ErpInfoRow label="Driver"      value={d.driver_name || '—'} />
              {d.driver_mobile ? <ErpInfoRow label="Driver mobile" value={d.driver_mobile} last /> : null}
            </ErpCard>

            <ErpCard>
              <ErpSectionLabel>Dates</ErpSectionLabel>
              <ErpInfoRow label="Dispatch date"     value={formatDate(d.dispatch_date) || '—'} />
              <ErpInfoRow label="Expected delivery" value={formatDate(d.expected_delivery) || '—'} />
              {d.delivered_date ? (
                <ErpInfoRow label="Delivered on" value={formatDate(d.delivered_date)} last />
              ) : null}
            </ErpCard>

            {pod ? (
              <ErpCard>
                <ErpSectionLabel>Proof of delivery</ErpSectionLabel>
                <Image source={{ uri: pod }} style={st.podImg} resizeMode="cover" />
                {d.pod_remarks ? <Text style={st.podNote}>{d.pod_remarks}</Text> : null}
              </ErpCard>
            ) : null}

            {d.sale ? (
              <ErpCard>
                <ErpSectionLabel>Linked sale</ErpSectionLabel>
                <ErpInfoRow label="Sale #"         value={d.sale.sale_code || '—'} />
                <ErpInfoRow label="Payment status" value={d.sale.payment_status || '—'} />
                <ErpInfoRow label="Grand total"    value={formatCurrency(d.sale.grand_total || 0)} />
                {d.sale.outstanding > 0 ? (
                  <ErpInfoRow label="Outstanding" value={formatCurrency(d.sale.outstanding)} color="#DC2626" last />
                ) : null}
              </ErpCard>
            ) : null}

            {d.status === 'Dispatched' ? (
              <TouchableOpacity style={[st.actionBtn, { backgroundColor: '#2563EB' }]}
                onPress={markInTransit} disabled={updating} activeOpacity={0.88}>
                <Ionicons name="navigate-outline" size={18} color="#FFF" />
                <Text style={st.actionTxt}>{updating ? 'Updating…' : 'Mark In Transit'}</Text>
              </TouchableOpacity>
            ) : null}

            {d.status === 'In Transit' ? (
              <TouchableOpacity style={[st.actionBtn, { backgroundColor: '#059669' }]}
                onPress={markDelivered} disabled={updating} activeOpacity={0.88}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                <Text style={st.actionTxt}>{updating ? 'Updating…' : 'Mark Delivered'}</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ══════════════════════════════════════════════════════════════════════════ */
export default function DispatchTrackingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [dispatches, setDispatches] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');
  const [tab,        setTab]        = useState('All');
  const [search,     setSearch]     = useState('');
  const [detailId,   setDetailId]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = {};
      if (tab !== 'All')        params.status = tab;
      if (search.trim())        params.search = search.trim();
      const res  = await erpApi.listDispatches(params);
      const data = res?.data ?? res;
      setDispatches(Array.isArray(data) ? data : data?.dispatches ?? []);
    } catch (e) {
      setError(e?.message || 'Failed to load dispatches');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [tab, search]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const counts = useMemo(() => ({
    total:      dispatches.length,
    dispatched: dispatches.filter(d => d.status === 'Dispatched').length,
    transit:    dispatches.filter(d => d.status === 'In Transit').length,
    delivered:  dispatches.filter(d => d.status === 'Delivered').length,
  }), [dispatches]);

  const renderItem = ({ item }) => {
    const meta  = metaOf(item.status);
    const order = item.order_id;
    const code  = item.dispatch_code || (item._id ? `…${String(item._id).slice(-6)}` : '—');

    return (
      <TouchableOpacity style={st.card} onPress={() => setDetailId(item._id)} activeOpacity={0.85}>
        <View style={[st.cardAccent, { backgroundColor: meta.color }]} />
        <View style={st.cardBody}>
          <View style={st.cardTop}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={st.cardName} numberOfLines={1}>
                {item.customer_name || order?.customer_name || '—'}
              </Text>
              <Text style={st.cardCode} numberOfLines={1}>{code}</Text>
            </View>
            <ErpBadge label={item.status} color={meta.color} bg={meta.bg} dot />
          </View>

          {order?.product_name ? (
            <View style={st.productRow}>
              <Ionicons name="cube-outline" size={12} color={ERP.muted} />
              <Text style={st.productTxt} numberOfLines={1}>{order.product_name}</Text>
              {order.qty > 0 ? <Text style={st.productQty}>· {order.qty} {order.unit || ''}</Text> : null}
            </View>
          ) : null}

          <View style={st.chipRow}>
            {item.vehicle_number ? <ErpMetaChip icon="car-outline" label={item.vehicle_number} /> : null}
            {item.transport_name ? <ErpMetaChip icon="business-outline" label={item.transport_name} /> : null}
            {item.lr_number      ? <ErpMetaChip icon="document-text-outline" label={`LR ${item.lr_number}`} /> : null}
          </View>

          <View style={st.datesRow}>
            <View style={st.dateItem}>
              <Text style={st.dateLabel}>Dispatched</Text>
              <Text style={st.dateValue}>{formatDate(item.dispatch_date) || '—'}</Text>
            </View>
            <View style={st.dateSep} />
            <View style={st.dateItem}>
              <Text style={st.dateLabel}>{item.delivered_date ? 'Delivered' : 'Expected'}</Text>
              <Text style={st.dateValue}>
                {formatDate(item.delivered_date || item.expected_delivery) || '—'}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader
        title="Dispatch"
        subtitle="Shipments you send out"
        onBack={() => navigation.goBack()}
        actions={[{ key: 'add', icon: 'add', onPress: () => navigation.navigate(SCREENS.DISPATCH_ENTRY) }]}>
        <ErpSummaryStrip items={[
          { label: 'Total',      value: counts.total },
          { label: 'Dispatched', value: counts.dispatched, color: '#FDBA74' },
          { label: 'In Transit', value: counts.transit,    color: '#93C5FD' },
          { label: 'Delivered',  value: counts.delivered,  color: '#6EE7B7' },
        ]} />
        <ErpSearchBox
          value={search}
          onChangeText={setSearch}
          placeholder="Search code, vehicle, LR, customer…"
        />
      </ErpHeader>

      <ErpTabs tabs={FILTER_TABS} active={tab} onChange={setTab} />

      {loading && !dispatches.length ? (
        <ErpLoading label="Loading dispatches…" />
      ) : error ? (
        <ErpError message={error} onRetry={load} />
      ) : (
        <FlatList
          data={dispatches}
          keyExtractor={i => i._id}
          renderItem={renderItem}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          ListEmptyComponent={
            <ErpEmpty
              icon="car-outline"
              title={search || tab !== 'All' ? 'No matches' : 'Nothing dispatched yet'}
              subtitle={
                search || tab !== 'All'
                  ? 'Try a different filter or search term.'
                  : 'Dispatches you raise for your own orders appear here. Orders you buy from a seller are shipped by them — track those from Order Tracking.'
              }
            />
          }
        />
      )}

      <View style={[st.fabWrap, { bottom: 18 + insets.bottom }]}>
        <ErpPrimaryAction label="New Dispatch" icon="add" onPress={() => navigation.navigate(SCREENS.DISPATCH_ENTRY)} />
      </View>

      {detailId ? (
        <DispatchDetailModal
          dispatchId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      ) : null}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  list: { padding: 14, paddingBottom: 100 },
  modalContent: { padding: 14, paddingBottom: 40 },

  card: {
    flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 14,
    marginBottom: 10, overflow: 'hidden', ...Shadows.sm,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 13, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  cardName: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  cardCode: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', marginTop: 2 },

  productRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  productTxt: { fontSize: 12, color: Colors.textPrimary, fontWeight: '600', flexShrink: 1 },
  productQty: { fontSize: 11, color: Colors.textSecondary },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  datesRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FC', borderRadius: 10, padding: 8 },
  dateItem: { flex: 1, alignItems: 'center' },
  dateLabel: { fontSize: 9, color: Colors.textTertiary, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  dateValue: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  dateSep: { width: 1, height: 24, backgroundColor: Colors.borderLight },

  detailTop: { flexDirection: 'row', alignItems: 'center' },
  detailCode: { fontSize: 17, fontWeight: '800', color: Colors.secondary },
  detailDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  podImg: { width: '100%', height: 190, borderRadius: 12, marginTop: 4, backgroundColor: '#F1F5F9' },
  podNote: { fontSize: 12, color: Colors.textSecondary, marginTop: 8 },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 15, borderRadius: 14, marginTop: 4,
  },
  actionTxt: { color: '#FFF', fontWeight: '800', fontSize: 15 },

  fabWrap: { position: 'absolute', left: 16, right: 16, bottom: 18 },
});
