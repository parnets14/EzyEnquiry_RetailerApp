/**
 * src/screens/erp/InventoryScreen.jsx  (Retailer app)
 *
 * Stock list rebuilt to match the wholesaler's `inventory/InventoryScreen.jsx`
 * (825 lines): warehouse filter picker in the header, a Stock In / Stock Out /
 * Transfer action row, 8 status tabs, infinite-scroll pagination, a scrolling
 * summary-card strip, and a stock detail modal with the full bucket breakdown
 * plus Movement History.
 *
 * Kept from the retailer's earlier version: the Ionicons / Colors / erp component
 * kit, the `ErpPrimaryAction` bottom bar (this app doesn't use the wholesaler's
 * FAB), and the `bucket()` colour mapping.
 *
 * Backend (shared `inventoryController`, mounted at /api/retailer/erp):
 *   GET /inventory          → { inventory, pagination }
 *                             query { warehouse_id, search, stock_status, page, limit }
 *   GET /inventory/summary  → totals incl. total_picking / total_packed
 *   GET /inventory/:id      → flattened record + `movements[]` (30 latest)
 *   GET /warehouses         → warehouse list for the picker
 *
 * NOTE: `stock_status` accepts all|available|low|out|reserved|picking|packed|blocked.
 * `picking` and `packed` were only added to the shared controller on 2026-09-29 —
 * before that they silently returned every row.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { SCREENS } from '../../constants';
import { erpApi } from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  ErpHeader, ErpSearchBox, ErpTabs, ErpLoading, ErpError, ErpEmpty,
  ErpBadge, ErpMetaChip, ERP,
} from '../../components/erp';

/* Status tabs — `key` is what goes to the API; label is what the user sees. */
const TABS = [
  { key: 'all',       label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'reserved',  label: 'Reserved' },
  { key: 'picking',   label: 'Picking' },
  { key: 'packed',    label: 'Packed' },
  { key: 'low',       label: 'Low Stock' },
  { key: 'out',       label: 'Out of Stock' },
  { key: 'blocked',   label: 'Blocked' },
];
const TAB_LABELS = TABS.map(t => t.label);

const LIMIT = 30;

/** Colour-bucket a row from its available stock vs its alert threshold.
 *  Mirrors the wholesaler's `getStockStatus()` exactly — same three verdicts, same
 *  colours, same uppercase labels, and the same `low_stock_alert || 50` fallback
 *  (so a product with no explicit threshold still flags Low below 50). */
function bucket(item) {
  const avail = item.available_stock ?? item.current_stock ?? 0;
  if (avail <= 0) return { key: 'out', label: 'OUT OF STOCK', color: '#DC2626', bg: '#FEF2F2' };
  if (avail <= (item.low_stock_alert || 50)) {
    return { key: 'low', label: 'LOW STOCK', color: '#D97706', bg: '#FFFBEB' };
  }
  return { key: 'ok', label: 'AVAILABLE', color: '#059669', bg: '#ECFDF5' };
}

const MOVEMENT_STYLE = {
  'Stock In':  { bg: '#ECFDF5', color: '#059669', sign: '+' },
  'Reversal':  { bg: '#EFF6FF', color: '#2563EB', sign: '' },
  'Stock Out': { bg: '#FEF2F2', color: '#DC2626', sign: '−' },
};

/** Bucket inventory rows into the six stock counters + dispatched.
 *  Labels/colours mirror the wholesaler's `BucketRow` list one-for-one. */
function bucketsOf(d) {
  return [
    { label: 'Physical Stock',     value: d.physical_stock   ?? d.current_stock ?? 0, color: '#374151' },
    { label: 'Available Stock',    value: d.available_stock  ?? d.current_stock ?? 0, color: '#059669' },
    { label: 'Reserved / Hold',    value: d.reserved_stock   || 0, color: '#D97706' },
    { label: 'Picking',            value: d.picking_stock    || 0, color: '#7C3AED' },
    { label: 'Packed',             value: d.packed_stock     || 0, color: '#0891B2' },
    { label: 'Blocked',            value: d.blocked_stock    || 0, color: '#DC2626' },
    { label: 'Dispatched (total)', value: d.dispatched_qty   || 0, color: '#6B7280' },
  ];
}

/* ── Summary card (scrolling strip) ─────────────────────────────────────── */
function SummaryCard({ icon, iconBg, iconColor, label, value, onPress }) {
  return (
    <TouchableOpacity style={st.sumCard} onPress={onPress} activeOpacity={0.82} disabled={!onPress}>
      <View style={[st.sumIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <Text style={st.sumValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={st.sumLabel} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ── Inventory row ──────────────────────────────────────────────────────── */
function InventoryCard({ item, onPress }) {
  const b = bucket(item);
  const chips = bucketsOf(item)
    // Physical/Available always show; the rest only when non-zero (wholesaler rule).
    .filter((x, i) => i < 2 || x.value > 0);

  return (
    <TouchableOpacity style={st.card} onPress={onPress} activeOpacity={0.82}>
      <View style={[st.cardAccent, { backgroundColor: b.color }]} />
      <View style={st.cardBody}>
        <View style={st.cardTop}>
          <View style={st.cardTitleWrap}>
            <Text style={st.name} numberOfLines={1}>{item.product_name || 'Unnamed product'}</Text>
            {item.product_code ? <Text style={st.code}>{item.product_code}</Text> : null}
          </View>
          <ErpBadge label={b.label} color={b.color} bg={b.bg} dot />
        </View>

        {item.warehouse_name ? (
          <View style={st.whRow}>
            <Ionicons name="business-outline" size={11} color={ERP.muted} />
            <Text style={st.whText} numberOfLines={1}>{item.warehouse_name}</Text>
            {item.warehouse_city ? <Text style={st.whText}> · {item.warehouse_city}</Text> : null}
          </View>
        ) : null}

        <View style={st.qtyGrid}>
          {chips.map(c => (
            <View key={c.label} style={[st.qtyChip, c.label === 'Available' && st.qtyChipHL]}>
              <Text style={[st.qtyVal, { color: c.color }]}>{c.value}</Text>
              <Text style={st.qtyLbl}>{c.label}</Text>
            </View>
          ))}
        </View>

        <View style={st.chipRow}>
          {item.category_name ? <ErpMetaChip label={item.category_name} /> : null}
          {item.brand_name ? <ErpMetaChip label={item.brand_name} /> : null}
          {item.unit ? <ErpMetaChip label={item.unit} /> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#B0B5C3" style={st.cardArrow} />
    </TouchableOpacity>
  );
}

/* ── Stock detail modal ─────────────────────────────────────────────────── */
function DetailModal({ visible, itemId, onClose }) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible || !itemId) return;
    let alive = true;
    setLoading(true); setData(null); setFailed(false);
    erpApi.getInventoryItem(itemId)
      .then(r => { if (alive) setData(r?.data ?? r); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [visible, itemId]);

  if (!visible) return null;

  const movs = Array.isArray(data?.movements) ? data.movements : [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={st.safe} edges={['top']}>
        <ErpHeader title="Stock Detail" subtitle={data?.product_name} onBack={onClose} />

        {loading ? (
          <ErpLoading label="Loading stock detail…" />
        ) : failed ? (
          <ErpError message="Could not load inventory detail." onRetry={() => setData(null)} />
        ) : !data ? (
          <ErpEmpty icon="cube-outline" title="No data" subtitle="Could not load inventory detail." />
        ) : (
          <ScrollView contentContainerStyle={[st.modalContent, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
            {/* Product */}
            <View style={st.detailCard}>
              <Text style={st.detailName}>{data.product_name || '—'}</Text>
              {data.product_code ? <Text style={st.detailCode}>{data.product_code}</Text> : null}
              <View style={st.chipRow}>
                {[data.category_name, data.brand_name, data.size, data.finish, data.unit]
                  .filter(Boolean)
                  .map(t => <ErpMetaChip key={t} label={t} />)}
              </View>
            </View>

            {/* Warehouse */}
            {data.warehouse_name ? (
              <View style={st.whCard}>
                <View style={st.whCardIcon}>
                  <Ionicons name="business-outline" size={18} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.whCardName}>{data.warehouse_name}</Text>
                  {data.warehouse_city ? <Text style={st.whCardCity}>{data.warehouse_city}</Text> : null}
                </View>
              </View>
            ) : null}

            {/* Stock summary */}
            <View style={st.detailCard}>
              <Text style={st.detailSection}>Stock summary</Text>
              {bucketsOf(data).map(b => (
                <View key={b.label} style={st.bucketRow}>
                  <View style={st.bucketLeft}>
                    <View style={[st.bucketDot, { backgroundColor: b.color }]} />
                    <Text style={st.bucketLabel}>{b.label}</Text>
                  </View>
                  <Text style={[st.bucketValue, { color: b.color }]}>{b.value}</Text>
                </View>
              ))}

              <View style={st.divider} />

              <View style={st.bucketRow}>
                <Text style={[st.bucketLabel, { fontWeight: '800' }]}>Low stock alert at</Text>
                <Text style={[st.bucketValue, { color: '#D97706' }]}>
                  {data.low_stock_alert ?? 50} units
                </Text>
              </View>
              {data.purchase_rate > 0 ? (
                <View style={st.bucketRow}>
                  <Text style={st.bucketLabel}>Purchase rate</Text>
                  <Text style={[st.bucketValue, { color: Colors.primary }]}>
                    {formatCurrency(data.purchase_rate)}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Movement history */}
            {movs.length > 0 ? (
              <View style={st.detailCard}>
                <Text style={st.detailSection}>Movement history</Text>
                {movs.slice(0, 15).map((m, i) => {
                  const cfg = MOVEMENT_STYLE[m.movement_type] || MOVEMENT_STYLE['Stock Out'];
                  return (
                    <View key={m._id || i} style={[st.movRow, i === Math.min(movs.length, 15) - 1 && { borderBottomWidth: 0 }]}>
                      <View style={[st.movBadge, { backgroundColor: cfg.bg }]}>
                        <Text style={[st.movType, { color: cfg.color }]}>
                          {cfg.sign}{m.quantity} {m.unit || ''}
                        </Text>
                      </View>
                      <View style={st.movInfo}>
                        <Text style={st.movNote} numberOfLines={1}>
                          {m.notes || m.reference_type || '—'}
                        </Text>
                        <Text style={st.movDate}>{formatDate(m.movement_date)}</Text>
                      </View>
                      <View style={st.movStock}>
                        <Text style={st.movStockVal}>{m.new_stock ?? '—'}</Text>
                        <Text style={st.movStockLbl}>closing</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

/* ── Main screen ────────────────────────────────────────────────────────── */
export default function InventoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [items,      setItems]      = useState([]);
  const [summary,    setSummary]    = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');
  const [tab,        setTab]        = useState('all');
  const [search,     setSearch]     = useState('');
  const [warehouse,  setWarehouse]  = useState('all');
  const [whPicker,   setWhPicker]   = useState(false);
  const [detailId,   setDetailId]   = useState(null);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchTimer = useRef(null);

  const loadSummary = useCallback(async () => {
    try {
      const r = await erpApi.inventorySummary();
      setSummary(r?.data ?? r ?? {});
    } catch (_) { /* summary is optional chrome */ }
  }, []);

  const loadWarehouses = useCallback(async () => {
    try {
      const r = await erpApi.listWarehouses({ limit: 100 });
      const d = r?.data ?? r;
      setWarehouses(Array.isArray(d?.warehouses) ? d.warehouses : (Array.isArray(d) ? d : []));
    } catch (_) { /* picker just stays with "All" */ }
  }, []);

  const loadInventory = useCallback(async (pg = 1, append = false, q = search) => {
    if (pg === 1) { setLoading(true); setError(''); }
    else setLoadingMore(true);

    try {
      const params = { page: pg, limit: LIMIT };
      if (tab !== 'all')            params.stock_status = tab;
      if (warehouse !== 'all')      params.warehouse_id = warehouse;
      if (q.trim())                 params.search       = q.trim();

      const res  = await erpApi.listInventory(params);
      const data = res?.data ?? res;
      const list = Array.isArray(data?.inventory) ? data.inventory : [];
      const pag  = data?.pagination;

      setItems(prev => (append ? [...prev, ...list] : list));
      setHasMore(pag?.totalPages ? pg < pag.totalPages : list.length === LIMIT);
      setPage(pg);
    } catch (e) {
      if (!append) setError(e?.message || 'Failed to load inventory');
    } finally {
      setLoading(false); setLoadingMore(false); setRefreshing(false);
    }
  }, [tab, warehouse, search]);

  useEffect(() => { loadSummary(); loadWarehouses(); }, [loadSummary, loadWarehouses]);

  // Re-query from page 1 whenever the tab or warehouse changes.
  useEffect(() => { loadInventory(1, false, search); }, [tab, warehouse]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadInventory(1, false, search), 380);
    return () => clearTimeout(searchTimer.current);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = () => { setRefreshing(true); loadSummary(); loadInventory(1, false, search); };
  const onEndReached = () => { if (!loadingMore && hasMore && items.length) loadInventory(page + 1, true, search); };

  const whName = warehouse === 'all'
    ? 'All WH'
    : (warehouses.find(w => w._id === warehouse)?.name || 'WH');

  /* Summary strip — matches the wholesaler's 7 cards exactly (Products, Available,
     Reserved, Packed, Low Stock, Out of Stock, + Stock Value). The wholesaler has NO
     "Picking" card here, so we don't add one. Stock Value only renders when > 0. */
  const summaryCards = useMemo(() => {
    const s = summary || {};
    const cards = [
      { key: 'all',       icon: 'layers-outline',           bg: '#EDE8FF', color: '#7C3AED', label: 'Products',   value: s.total_products ?? 0 },
      { key: 'available', icon: 'checkmark-circle-outline', bg: '#DCFCE7', color: '#059669', label: 'Available',  value: s.total_available ?? 0 },
      { key: 'reserved',  icon: 'lock-closed-outline',      bg: '#FEF3C7', color: '#D97706', label: 'Reserved',   value: s.total_reserved ?? 0 },
      { key: 'packed',    icon: 'archive-outline',          bg: '#EFF6FF', color: '#2563EB', label: 'Packed',     value: s.total_packed ?? 0 },
      { key: 'low',       icon: 'alert-circle-outline',     bg: '#FFFBEB', color: '#D97706', label: 'Low Stock',  value: s.low_stock ?? 0 },
      { key: 'out',       icon: 'close-circle-outline',     bg: '#FEF2F2', color: '#DC2626', label: 'Out of Stock', value: s.out_of_stock ?? 0 },
    ];
    if (s.total_stock_value > 0) {
      cards.push({ key: null, icon: 'cash-outline', bg: '#F0FDF4', color: '#059669', label: 'Stock Value', value: formatCurrency(s.total_stock_value) });
    }
    return cards;
  }, [summary]);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader
        title="Inventory"
        subtitle="Stock management"
        onBack={() => navigation.goBack()}>
        {/* Warehouse selector — sits in the header's top row, right of the title,
            exactly where the wholesaler puts it. */}
        <TouchableOpacity style={st.whBtn} onPress={() => setWhPicker(true)} activeOpacity={0.85}>
          <Ionicons name="business-outline" size={14} color="#FFF" />
          <Text style={st.whBtnTxt} numberOfLines={1}>{whName}</Text>
          <Ionicons name="chevron-down" size={13} color="#FFF" />
        </TouchableOpacity>

        {/* Stock action row — Stock In / Stock Out / Transfer (wholesaler order) */}
        <View style={st.actions}>
          <TouchableOpacity style={st.actBtn} activeOpacity={0.85}
            onPress={() => navigation.navigate(SCREENS.STOCK_ADJUST, { mode: 'in' })}>
            <Ionicons name="arrow-down-circle-outline" size={16} color="#059669" />
            <Text style={[st.actText, { color: '#059669' }]}>Stock In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.actBtn} activeOpacity={0.85}
            onPress={() => navigation.navigate(SCREENS.STOCK_ADJUST, { mode: 'out' })}>
            <Ionicons name="arrow-up-circle-outline" size={16} color="#DC2626" />
            <Text style={[st.actText, { color: '#DC2626' }]}>Stock Out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.actBtn} activeOpacity={0.85}
            onPress={() => navigation.navigate(SCREENS.STOCK_TRANSFER)}>
            <Ionicons name="swap-horizontal-outline" size={16} color="#2563EB" />
            <Text style={[st.actText, { color: '#2563EB' }]}>Transfer</Text>
          </TouchableOpacity>
        </View>

        <ErpSearchBox value={search} onChangeText={setSearch} placeholder="Search product, code…" />

        {/* Scrolling summary strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.sumStrip}>
          {summaryCards.map(c => (
            <SummaryCard
              key={c.label}
              icon={c.icon} iconBg={c.bg} iconColor={c.color}
              label={c.label} value={c.value}
              onPress={c.key ? () => setTab(c.key) : undefined}
            />
          ))}
        </ScrollView>
      </ErpHeader>

      <ErpTabs tabs={TAB_LABELS} active={(TABS.find(t => t.key === tab) || TABS[0]).label}
        onChange={label => {
          const t = TABS.find(x => x.label === label);
          if (t) setTab(t.key);
        }} />

      {loading && !items.length ? (
        <ErpLoading label="Loading inventory…" />
      ) : error ? (
        <ErpError message={error} onRetry={() => loadInventory(1, false, search)} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i._id}
          renderItem={({ item }) => <InventoryCard item={item} onPress={() => setDetailId(item._id)} />}
          contentContainerStyle={[st.list, { paddingBottom: insets.bottom + 30 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            <ErpEmpty
              icon="cube-outline"
              title="No inventory found"
              subtitle="Try changing the filter or warehouse, or record a purchase to add stock."
            />
          }
        />
      )}

      {/* Warehouse picker */}
      <Modal visible={whPicker} transparent animationType="fade" onRequestClose={() => setWhPicker(false)}>
        <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={() => setWhPicker(false)}>
          <View style={[st.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <Text style={st.sheetTitle}>Select warehouse</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {[{ _id: 'all', name: 'All Warehouses' }, ...warehouses].map(w => {
                const on = warehouse === w._id;
                return (
                  <TouchableOpacity
                    key={w._id}
                    style={[st.pickerItem, on && st.pickerItemOn]}
                    onPress={() => { setWarehouse(w._id); setWhPicker(false); }}
                    activeOpacity={0.85}>
                    <Ionicons name="business-outline" size={16} color={on ? '#FFF' : Colors.primary} />
                    <Text style={[st.pickerTxt, on && st.pickerTxtOn]} numberOfLines={1}>{w.name}</Text>
                    {on ? <Ionicons name="checkmark" size={16} color="#FFF" /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={st.manageRow}
              onPress={() => { setWhPicker(false); navigation.navigate(SCREENS.WAREHOUSE_LIST); }}>
              <Ionicons name="settings-outline" size={16} color={Colors.primary} />
              <Text style={st.manageTxt}>Manage warehouses</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <DetailModal visible={!!detailId} itemId={detailId} onClose={() => setDetailId(null)} />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  list: { padding: 14 },

  /* Header action row */
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: '#FFF', borderRadius: 10, paddingVertical: 9,
  },
  actText: { fontSize: 12, fontWeight: '800' },

  whBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    marginTop: 10, backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, maxWidth: '60%',
  },
  whBtnTxt: { color: '#FFF', fontSize: 11.5, fontWeight: '700' },

  /* Summary strip */
  sumStrip: { paddingTop: 12, paddingBottom: 2, gap: 8 },
  sumCard: {
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 12,
    padding: 10, alignItems: 'center', minWidth: 82,
  },
  sumIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  sumValue: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  sumLabel: { fontSize: 9, color: 'rgba(255,255,255,0.72)', fontWeight: '700', marginTop: 1 },

  /* Row card */
  card: {
    flexDirection: 'row', alignItems: 'stretch', backgroundColor: '#FFF',
    borderRadius: 14, marginBottom: 10, overflow: 'hidden', ...Shadows.sm,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 13, gap: 8 },
  cardArrow: { alignSelf: 'center', marginRight: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitleWrap: { flex: 1 },
  name: { fontSize: 14, fontWeight: '800', color: ERP.text },
  code: { fontSize: 10.5, color: ERP.muted, fontWeight: '600', marginTop: 2 },

  whRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  whText: { fontSize: 10.5, color: ERP.muted, fontWeight: '600', flexShrink: 1 },

  qtyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  qtyChip: { alignItems: 'center', backgroundColor: '#F8F9FC', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, minWidth: 58 },
  qtyChipHL: { backgroundColor: '#F0FDF4' },
  qtyVal: { fontSize: 13.5, fontWeight: '800' },
  qtyLbl: { fontSize: 8.5, color: ERP.muted, fontWeight: '600', marginTop: 1 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  /* Warehouse picker */
  backdrop: { flex: 1, backgroundColor: 'rgba(15,22,40,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, ...Shadows.lg },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: ERP.text, marginBottom: 12 },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 13, borderRadius: 12, marginBottom: 6, backgroundColor: '#F4F5F8',
  },
  pickerItemOn: { backgroundColor: Colors.primary },
  pickerTxt: { flex: 1, fontSize: 13.5, fontWeight: '600', color: ERP.text },
  pickerTxtOn: { color: '#FFF' },
  manageRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 13, borderRadius: 12, marginTop: 6, backgroundColor: '#EEF1F6',
  },
  manageTxt: { flex: 1, fontSize: 13.5, fontWeight: '700', color: Colors.primary },

  /* Detail modal */
  modalContent: { padding: 16, gap: 12 },
  detailCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, ...Shadows.sm },
  detailName: { fontSize: 17, fontWeight: '800', color: ERP.text },
  detailCode: { fontSize: 12.5, color: ERP.muted, fontWeight: '600', marginTop: 3, marginBottom: 10 },
  detailSection: {
    fontSize: 10.5, fontWeight: '800', color: ERP.muted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },

  whCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderRadius: 16, padding: 16, ...Shadows.sm },
  whCardIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  whCardName: { fontSize: 13.5, fontWeight: '700', color: ERP.text },
  whCardCity: { fontSize: 11.5, color: ERP.muted, marginTop: 2 },

  bucketRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  bucketLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bucketDot: { width: 8, height: 8, borderRadius: 4 },
  bucketLabel: { fontSize: 12.5, color: ERP.text },
  bucketValue: { fontSize: 14, fontWeight: '800' },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 8 },

  movRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  movBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, minWidth: 54, alignItems: 'center' },
  movType: { fontSize: 11.5, fontWeight: '800' },
  movInfo: { flex: 1 },
  movNote: { fontSize: 11.5, color: ERP.text, fontWeight: '600' },
  movDate: { fontSize: 10, color: ERP.muted, marginTop: 2 },
  movStock: { alignItems: 'flex-end' },
  movStockVal: { fontSize: 12.5, fontWeight: '800', color: ERP.text },
  movStockLbl: { fontSize: 9, color: ERP.muted },
});
