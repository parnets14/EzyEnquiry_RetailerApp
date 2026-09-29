/**
 * src/screens/erp/PurchaseListScreen.jsx  (Retailer app)
 *
 * Purchases — List / Report toggle, exactly matching the wholesaler
 * (`purchase/PurchaseListScreen.jsx`).
 *
 *   GET /api/retailer/erp/purchases         → purchaseController.listPurchases
 *   GET /api/retailer/erp/reports/purchases → reportController.getPurchaseReport
 *   GET /api/retailer/erp/reports/suppliers → reportController.getSupplierReport
 *
 * Structure matches the wholesaler exactly:
 *   [ Header: back · "Purchases" · + button                        ]
 *   [ List | Report  toggle                                        ]
 *   List   → simple 2-line cards (product + amount, then
 *            "supplier · qty · date"). No tabs, no search, no FAB,
 *            no detail sheet, no status workflow.
 *   Report → Daily / Monthly / Yearly / Supplier-wise + total card
 *            and horizontal bars.
 *
 * REPORT SHAPE TRAP (see the skill):
 *   `getPurchaseReport` returns BOTH breakdowns in ONE call —
 *     rows  → SUPPLIER-wise  [{ supplier_name, count, total }]
 *     trend → PERIOD-wise    [{ period, count, total }]
 *   So Daily/Monthly/Yearly reads `trend`; Supplier-wise reads `rows`.
 *   The supplier tab uses `reportSuppliers` because it also carries
 *   `outstanding`, which the plain breakdown does not.
 *
 * A multi-line bill is stored as ONE ROW PER PRODUCT sharing a `bill_code`,
 * so each line is its own purchase record — same as the wholesaler.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList, RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { SCREENS } from '../../constants';
import { erpApi } from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  ErpHeader, ErpCard, ErpSectionLabel, ErpLoading, ErpError,
  ErpEmpty, ERP,
} from '../../components/erp';

/* ── Report period helpers — mirrors the wholesaler's rangeFor() ────────── */
const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function rangeFor(key) {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
  switch (key) {
    case 'day':   return { from_date: fmt(new Date(y, m, now.getDate() - 6)), to_date: fmt(now), group_by: 'day' };
    case 'year':  return { from_date: `${y - 4}-01-01`,                       to_date: fmt(now), group_by: 'year' };
    default:      return { from_date: `${y}-01-01`,                           to_date: fmt(now), group_by: 'month' };
  }
}
const PERIOD_TABS = [
  { key: 'day',      label: 'Daily' },
  { key: 'month',    label: 'Monthly' },
  { key: 'year',     label: 'Yearly' },
  { key: 'supplier', label: 'Supplier-wise' },
];

export default function PurchaseListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [mode,       setMode]       = useState('list');   // 'list' | 'report'
  const [purchases,  setPurchases]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  // report state
  const [period,   setPeriod]   = useState('month');
  const [report,   setReport]   = useState(null);
  const [rLoading, setRLoading] = useState(false);
  const [rError,   setRError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await erpApi.listPurchases({ limit: 100 });
      const data = res?.data ?? res;
      setPurchases(Array.isArray(data) ? data : data?.purchases ?? []);
    } catch (e) {
      setError(e?.message || 'Failed to load purchases');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  const loadReport = useCallback(async () => {
    setRLoading(true); setRError('');
    try {
      if (period === 'supplier') {
        // Supplier-wise: the dedicated report also carries outstanding + last_date.
        const res = await erpApi.reportSuppliers({});
        const data = res?.data ?? res ?? {};
        setReport({ kind: 'supplier', rows: data.rows || [], totals: data.totals || {} });
      } else {
        // Daily / Monthly / Yearly all come from the `trend` array of ONE call.
        const res = await erpApi.reportPurchases(rangeFor(period));
        const data = res?.data ?? res ?? {};
        setReport({ kind: 'period', rows: data.trend || [], totals: data.totals || {} });
      }
    } catch (e) {
      setRError(e?.message || 'Could not load report');
      setReport(null);
    } finally {
      setRLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (mode === 'report') loadReport(); }, [mode, loadReport]);

  const onRefresh = () => {
    if (mode === 'report') { loadReport(); return; }
    setRefreshing(true); load();
  };

  /* ── List row — 2 lines, exactly like the wholesaler's card ── */
  const renderPurchase = ({ item }) => (
    <View style={st.card}>
      <View style={st.cardTop}>
        <Text style={st.pName} numberOfLines={1}>
          {item.product_name || item.product_code || 'Item'}
        </Text>
        <Text style={st.pAmt}>{formatCurrency(item.total_amount ?? item.amount ?? 0)}</Text>
      </View>
      <Text style={st.pSub} numberOfLines={1}>
        {item.supplier_name || 'Supplier'} · {item.qty} {item.unit || ''} ·{' '}
        {formatDate(item.purchase_date || item.created_at)}
      </Text>
    </View>
  );

  /* ── Report view ── */
  const rows   = report?.rows || [];
  const maxVal = Math.max(...rows.map(r => r.total || 0), 1);

  const renderReport = () => (
    <ScrollView
      contentContainerStyle={[st.reportList, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}>

      {/* Period chips */}
      <View style={st.tabs}>
        {PERIOD_TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[st.tab, period === t.key && st.tabActive]}
            onPress={() => setPeriod(t.key)}
            activeOpacity={0.85}>
            <Text style={[st.tabText, period === t.key && st.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {rLoading ? (
        <ErpLoading label="Loading report…" />
      ) : rError ? (
        <ErpError message={rError} onRetry={loadReport} />
      ) : (
        <>
          <ErpCard style={st.sumCard}>
            <Text style={st.sumLbl}>Total Purchase</Text>
            <Text style={st.sumVal}>
              {formatCurrency(report?.totals?.total || rows.reduce((s, r) => s + (r.total || 0), 0))}
            </Text>
          </ErpCard>

          <ErpCard>
            <ErpSectionLabel>{report?.kind === 'supplier' ? 'By Supplier' : 'By Period'}</ErpSectionLabel>
            {rows.length === 0 ? (
              <Text style={st.empty}>No data.</Text>
            ) : rows.map((r, i) => {
              const label = report?.kind === 'supplier'
                ? (r.supplier_name || r._id || 'Supplier')
                : (r.period || '—');
              const w = Math.min(((r.total || 0) / maxVal) * 100, 100);
              return (
                <View key={`${label}-${i}`} style={st.repRow}>
                  <View style={st.repTop}>
                    <Text style={st.repLabel} numberOfLines={1}>{label}</Text>
                    <Text style={st.repAmt}>{formatCurrency(r.total || 0)}</Text>
                  </View>
                  <View style={st.barTrack}><View style={[st.barFill, { width: `${w}%` }]} /></View>
                  <Text style={st.repSub}>{r.count || 0} purchase(s)</Text>
                </View>
              );
            })}
          </ErpCard>
        </>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader
        title="Purchases"
        subtitle="Supplier bills & stock in"
        onBack={() => navigation.goBack()}
        actions={[
          { key: 'add', icon: 'add', onPress: () => navigation.navigate(SCREENS.PURCHASE_ENTRY) },
        ]}
      />

      {/* List / Report toggle — mirrors the wholesaler's modeRow */}
      <View style={st.modeRow}>
        {[{ key: 'list', label: 'List' }, { key: 'report', label: 'Report' }].map(m => (
          <TouchableOpacity
            key={m.key}
            style={[st.modeBtn, mode === m.key && st.modeOn]}
            onPress={() => setMode(m.key)}
            activeOpacity={0.85}>
            <Text style={[st.modeText, mode === m.key && st.modeTextOn]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'report' ? renderReport() : (
        loading && !purchases.length ? (
          <ErpLoading label="Loading purchases…" />
        ) : error ? (
          <ErpError message={error} onRetry={load} />
        ) : (
          <FlatList
            data={purchases}
            keyExtractor={(i, idx) => i._id || String(idx)}
            renderItem={renderPurchase}
            contentContainerStyle={[st.list, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
            ListEmptyComponent={
              <ErpEmpty
                icon="cart-outline"
                title="No purchases yet"
                subtitle="Tap + to record a supplier bill."
              />
            }
          />
        )
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  list: { padding: 12 },
  reportList: { padding: 16 },

  /* List / Report toggle */
  modeRow: {
    flexDirection: 'row', backgroundColor: '#FFF', padding: 8, gap: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  modeBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: '#F1F5F9' },
  modeOn: { backgroundColor: Colors.primary },
  modeText: { fontSize: 13, fontWeight: '700', color: ERP.muted },
  modeTextOn: { color: '#FFF' },

  /* Purchase card — 2 lines */
  card: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pName: { fontSize: 14, fontWeight: '700', color: ERP.text, flex: 1, marginRight: 8 },
  pAmt: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  pSub: { fontSize: 12, color: ERP.muted, marginTop: 4 },

  /* Report */
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  tab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#F1F5F9' },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: ERP.muted },
  tabTextActive: { color: '#FFF' },

  sumCard: { alignItems: 'center' },
  sumLbl: { fontSize: 12, color: ERP.muted },
  sumVal: { fontSize: 22, fontWeight: '800', color: Colors.primary, marginTop: 4 },
  empty: { fontSize: 13, color: ERP.muted, textAlign: 'center', paddingVertical: 16 },

  repRow: { marginBottom: 14 },
  repTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  repLabel: { fontSize: 13, fontWeight: '700', color: ERP.text, flex: 1, marginRight: 8 },
  repAmt: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#EEF1F6', overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  repSub: { fontSize: 11, color: ERP.muted, marginTop: 4 },
});
