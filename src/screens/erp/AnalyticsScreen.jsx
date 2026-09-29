/**
 * src/screens/erp/AnalyticsScreen.jsx  (Retailer app)
 *
 * Product analytics: best sellers, slow movers and a 12-month sales trend.
 *   GET /api/retailer/erp/reports/analytics  (reportController.getAnalytics)
 *     → {
 *         topProducts:  [{ _id, product_name, total_qty, total_revenue }]   // top 10 by qty
 *         slowProducts: [{ _id, product_name, available_stock, updated_at }] // stale stock, oldest-updated first
 *         trend:        [{ month, sales }]                                  // 12 periods, oldest → newest
 *       }
 *
 * Bars are plain Views (flex width) — the app has no charting dependency, and
 * the other ERP screens (P&L, expense report) already draw them the same way.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { SCREENS } from '../../constants';
import { erpApi } from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  ErpHeader, ErpSummaryStrip, ErpCard, ErpSectionLabel, ErpLoading, ErpError,
  ErpEmpty, ErpMetaChip, ERP,
} from '../../components/erp';

const MEDALS = ['#F59E0B', '#94A3B8', '#B45309'];

export default function AnalyticsScreen({ navigation }) {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await erpApi.analytics();
      setData(res?.data ?? res ?? {});
    } catch (e) {
      setError(e?.message || 'Failed to load analytics');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const top   = useMemo(() => (Array.isArray(data?.topProducts)  ? data.topProducts  : []), [data]);
  const slow  = useMemo(() => (Array.isArray(data?.slowProducts) ? data.slowProducts : []), [data]);
  const trend = useMemo(() => (Array.isArray(data?.trend)        ? data.trend        : []), [data]);

  const topRevenue = useMemo(() => top.reduce((s, p) => s + (p.total_revenue || 0), 0), [top]);
  const topQty     = useMemo(() => top.reduce((s, p) => s + (p.total_qty || 0), 0), [top]);
  const trendMax   = useMemo(() => trend.reduce((m, t) => Math.max(m, t.sales || 0), 0), [trend]);
  const slowUnits  = useMemo(() => slow.reduce((s, p) => s + (p.available_stock || 0), 0), [slow]);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {/* Blue OS status bar to match the navy ErpHeader. */}
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} translucent={false} />

      <ErpHeader
        title="Analytics"
        subtitle="What's selling, what's stuck"
        onBack={() => navigation.goBack()}
        actions={[{ key: 'reports', icon: 'document-text-outline', onPress: () => navigation.navigate(SCREENS.REPORT_CENTER) }]}>
        <ErpSummaryStrip items={[
          { label: 'Top revenue', value: formatCurrency(topRevenue) },
          { label: 'Units sold',  value: topQty },
          { label: 'Slow units',  value: slowUnits, color: '#FCD34D' },
        ]} />
      </ErpHeader>

      {loading && !data ? (
        <ErpLoading label="Crunching numbers…" />
      ) : error ? (
        <ErpError message={error} onRetry={load} />
      ) : (
        <ScrollView
          contentContainerStyle={st.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}>

          {/* ── Sales trend ─────────────────────────────────────────────── */}
          <ErpCard>
            <ErpSectionLabel>Sales trend</ErpSectionLabel>
            {trend.length ? (
              <>
                <View style={st.chart}>
                  {trend.map((t, i) => {
                    const h = trendMax > 0 ? Math.max(4, Math.round(((t.sales || 0) / trendMax) * 96)) : 4;
                    const isLast = i === trend.length - 1;
                    return (
                      <View key={`${t.month}-${i}`} style={st.barCol}>
                        <Text style={st.barVal} numberOfLines={1}>
                          {t.sales >= 1000 ? `${Math.round(t.sales / 1000)}k` : Math.round(t.sales || 0)}
                        </Text>
                        <View style={[st.bar, { height: h }, isLast && st.barLast]} />
                        <Text style={st.barLbl} numberOfLines={1}>
                          {String(t.month || '').split(' ')[0]}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <View style={st.legendRow}>
                  <View style={[st.legendDot, { backgroundColor: Colors.primary }]} />
                  <Text style={st.legendTxt}>Monthly sales</Text>
                  <View style={[st.legendDot, { backgroundColor: Colors.secondary, marginLeft: 12 }]} />
                  <Text style={st.legendTxt}>Latest period</Text>
                </View>
              </>
            ) : (
              <Text style={st.hint}>No sales recorded yet.</Text>
            )}
          </ErpCard>

          {/* ── Top products ────────────────────────────────────────────── */}
          <ErpCard>
            <ErpSectionLabel>Best sellers</ErpSectionLabel>
            {top.length ? top.map((p, i) => (
              <View key={p._id || `top-${i}`} style={[st.line, i === top.length - 1 && st.lineLast]}>
                <View style={[st.rank, { backgroundColor: MEDALS[i] || '#E5E7EB' }]}>
                  <Text style={[st.rankTxt, !MEDALS[i] && { color: ERP.muted }]}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={st.lineTitle} numberOfLines={1}>{p.product_name || 'Unnamed product'}</Text>
                  <Text style={st.lineSub} numberOfLines={1}>{p.total_qty ?? 0} units sold</Text>
                </View>
                <Text style={st.lineValue}>{formatCurrency(p.total_revenue || 0)}</Text>
              </View>
            )) : <Text style={st.hint}>No product sales yet.</Text>}
          </ErpCard>

          {/* ── Slow movers ─────────────────────────────────────────────── */}
          <ErpCard>
            <ErpSectionLabel>Slow movers</ErpSectionLabel>
            <Text style={st.hint}>Stock on hand, least recently updated first.</Text>
            {slow.length ? slow.map((p, i) => (
              <View key={p._id || `slow-${i}`} style={[st.line, i === slow.length - 1 && st.lineLast]}>
                <View style={[st.rank, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="hourglass-outline" size={13} color="#B45309" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={st.lineTitle} numberOfLines={1}>{p.product_name || 'Unnamed product'}</Text>
                  {p.updated_at ? (
                    <View style={{ flexDirection: 'row' }}>
                      <ErpMetaChip icon="time-outline" label={`Updated ${formatDate(p.updated_at)}`} />
                    </View>
                  ) : null}
                </View>
                <Text style={st.lineValue}>{p.available_stock ?? 0} in stock</Text>
              </View>
            )) : <ErpEmpty icon="checkmark-circle-outline" title="No stale stock" subtitle="Every product has moved recently." />}
          </ErpCard>

          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  content: { padding: 14, paddingBottom: 32 },

  chart: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    height: 132, gap: 4,
  },
  barCol: { flex: 1, alignItems: 'center', gap: 3 },
  bar: { width: '70%', borderRadius: 4, backgroundColor: Colors.primary, minHeight: 4 },
  barLast: { backgroundColor: Colors.secondary },
  barVal: { fontSize: 8, color: ERP.faint, fontWeight: '700' },
  barLbl: { fontSize: 8.5, color: ERP.muted, fontWeight: '600' },

  legendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  legendTxt: { fontSize: 10.5, color: ERP.muted, fontWeight: '600' },

  line: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: ERP.border,
  },
  lineLast: { borderBottomWidth: 0 },
  rank: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rankTxt: { fontSize: 11.5, fontWeight: '800', color: '#FFF' },
  lineTitle: { fontSize: 13, fontWeight: '700', color: ERP.text },
  lineSub: { fontSize: 10.5, color: ERP.muted },
  lineValue: { fontSize: 12.5, fontWeight: '800', color: Colors.primary, flexShrink: 0 },

  hint: { fontSize: 11.5, color: ERP.faint, marginBottom: 6 },
});
