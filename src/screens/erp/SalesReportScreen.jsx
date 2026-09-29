/**
 * src/screens/erp/SalesReportScreen.jsx  (Retailer app)
 *
 * Period breakdown (daily / weekly / monthly / yearly) with summary cards and
 * proportional bars. Ported from the wholesaler's SalesReportScreen — same period
 * ranges and grouping, backed by /api/retailer/erp/reports/sales.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { erpApi } from '../../utils/api';
import { formatCurrency } from '../../utils/formatters';
import { ErpHeader, ErpTabs, ErpCard, ErpLoading, ErpError, ERP } from '../../components/erp';

const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// period → { from, to, group_by } — identical windows to the wholesaler screen
function rangeFor(key) {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
  switch (key) {
    case 'day':   return { from: fmt(new Date(y, m, now.getDate() - 6)), to: fmt(now), group_by: 'day' };
    case 'week':  return { from: fmt(new Date(y, m - 2, 1)),             to: fmt(now), group_by: 'week' };
    case 'month': return { from: `${y}-01-01`,                           to: fmt(now), group_by: 'month' };
    case 'year':  return { from: `${y - 4}-01-01`,                       to: fmt(now), group_by: 'year' };
    default:      return { from: `${y}-01-01`, to: fmt(now), group_by: 'month' };
  }
}

const TABS  = ['Daily', 'Weekly', 'Monthly', 'Yearly'];
const KEYS  = { Daily: 'day', Weekly: 'week', Monthly: 'month', Yearly: 'year' };

export default function SalesReportScreen({ navigation }) {
  const [tab,        setTab]        = useState('Monthly');
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await erpApi.reportSales(rangeFor(KEYS[tab]));
      setData(r?.data ?? r ?? {});
    } catch (e) {
      setError(e?.message || 'Failed to load sales report');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const rows   = data?.rows || [];
  const grand  = rows.reduce((s, r) => s + (r.total_sales || 0), 0);
  const gstSum = rows.reduce((s, r) => s + (r.total_gst || 0), 0);
  const orders = rows.reduce((s, r) => s + (r.order_count || 0), 0);
  const maxVal = Math.max(...rows.map(r => r.total_sales || 0), 1);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader title="Sales Report" subtitle="Revenue by period" onBack={() => navigation.goBack()} />
      <ErpTabs tabs={TABS} active={tab} onChange={setTab} />

      {loading && !data ? <ErpLoading label="Loading report…" /> : error ? (
        <ErpError message={error} onRetry={load} />
      ) : (
        <ScrollView
          contentContainerStyle={st.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              colors={[Colors.primary]}
            />
          }>

          <View style={st.sumRow}>
            <SumCard label="Total Sales" value={formatCurrency(grand)}  color="#059669" />
            <SumCard label="Orders"      value={String(orders)}         color={Colors.secondary} />
            <SumCard label="GST"         value={formatCurrency(gstSum)} color="#D97706" />
          </View>

          <ErpCard>
            <Text style={st.cardTitle}>Breakdown</Text>
            {rows.length === 0 ? (
              <Text style={st.empty}>No sales in this period.</Text>
            ) : rows.map((r, i) => {
              const w = Math.min(((r.total_sales || 0) / maxVal) * 100, 100);
              return (
                <View key={i} style={st.row}>
                  <View style={st.rowTop}>
                    <Text style={st.rowPeriod}>{r.period}</Text>
                    <Text style={st.rowAmt}>{formatCurrency(r.total_sales || 0)}</Text>
                  </View>
                  <View style={st.barTrack}>
                    <View style={[st.barFill, { width: `${w}%` }]} />
                  </View>
                  <Text style={st.rowSub}>
                    {r.order_count || 0} orders · GST {formatCurrency(r.total_gst || 0)}
                  </Text>
                </View>
              );
            })}
          </ErpCard>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function SumCard({ label, value, color }) {
  return (
    <View style={st.sumCard}>
      <Text style={[st.sumVal, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={st.sumLbl}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  content: { padding: 14, paddingBottom: 40 },

  sumRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  sumCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 13,
    alignItems: 'center', ...Shadows.sm,
  },
  sumVal: { fontSize: 16, fontWeight: '800' },
  sumLbl: { fontSize: 10.5, color: ERP.muted, marginTop: 3 },

  cardTitle: { fontSize: 14, fontWeight: '800', color: ERP.text, marginBottom: 12 },
  empty: { fontSize: 13, color: ERP.muted, textAlign: 'center', paddingVertical: 16 },
  row: { marginBottom: 14 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  rowPeriod: { fontSize: 13, fontWeight: '700', color: ERP.text },
  rowAmt: { fontSize: 13, fontWeight: '800', color: '#059669' },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#EEF1F6', overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  rowSub: { fontSize: 11, color: ERP.muted, marginTop: 4 },
});
