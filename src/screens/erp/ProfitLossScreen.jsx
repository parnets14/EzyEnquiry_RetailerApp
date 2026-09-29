/**
 * src/screens/erp/ProfitLossScreen.jsx  (Retailer app)
 *
 * Profit & Loss dashboard — revenue, COGS, operating costs and net profit, with
 * a category breakdown and a multi-series trend.
 * Points at GET /api/retailer/erp/profit-loss (profitLossController.getProfitLoss).
 *
 * Backend contract:
 *   query  → { from_date, to_date, group_by: day|week|month|year }
 *   returns→ { period, group_by, totalSales, totalPurchase, totalExpenses,
 *              operatingExpenses, marketingCost, totalSalary,
 *              grossProfit, netProfit, expenseBreakdown:[{category,total,count}],
 *              trend:[{month,sales,purchase,expenses,profit}] }
 *
 * NOTE the backend's P&L formula (requirement §15):
 *   grossProfit = totalSales - totalPurchase
 *   netProfit   = grossProfit - operatingExpenses - totalSalary - marketingCost
 * Marketing is split out of totalExpenses, so the two must not be double-counted.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { SCREENS } from '../../constants';
import { erpApi } from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  ErpHeader, ErpSummaryStrip, ErpTabs, ErpCard, ErpSectionLabel, ErpInfoRow,
  ErpLoading, ErpError, ErpEmpty, ERP,
} from '../../components/erp';

const RANGE_TABS = ['Month', 'Quarter', 'Year', 'All'];
const GROUP_TABS = ['Month', 'Week', 'Day'];

function rangeFor(tab) {
  const now = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  if (tab === 'Quarter') {
    const from = new Date(now); from.setMonth(from.getMonth() - 3);
    return { from_date: iso(from), to_date: iso(now) };
  }
  if (tab === 'Year')  return { from_date: `${now.getFullYear()}-01-01`, to_date: iso(now) };
  if (tab === 'All')   return { from_date: '2000-01-01', to_date: iso(now) };
  return { from_date: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to_date: iso(now) };
}

export default function ProfitLossScreen({ navigation }) {
  const [range, setRange]     = useState('Month');
  const [groupBy, setGroupBy] = useState('month');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await erpApi.profitLoss({ ...rangeFor(range), group_by: groupBy });
      setData(res?.data ?? res ?? {});
    } catch (e) {
      setError(e?.message || 'Failed to load profit & loss');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [range, groupBy]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const d = data || {};
  const breakdown = Array.isArray(d.expenseBreakdown) ? d.expenseBreakdown : [];
  const trend     = Array.isArray(d.trend) ? d.trend : [];

  const totalSales    = d.totalSales    || 0;
  const totalPurchase = d.totalPurchase || 0;
  const grossProfit   = d.grossProfit   ?? (totalSales - totalPurchase);
  const netProfit     = d.netProfit     ?? 0;
  const operating     = d.operatingExpenses || 0;
  const marketing     = d.marketingCost || 0;
  const salary        = d.totalSalary   || 0;
  const totalExpenses = d.totalExpenses || 0;

  const grossMargin = totalSales ? (grossProfit / totalSales) * 100 : 0;
  const netMargin   = totalSales ? (netProfit / totalSales) * 100 : 0;
  const profitable  = netProfit >= 0;

  // Trend scaling across all three series so bars stay comparable.
  const maxTrend = trend.reduce(
    (m, t) => Math.max(m, t.sales || 0, t.purchase || 0, t.expenses || 0), 0,
  ) || 1;

  const maxCat = breakdown.reduce((m, r) => Math.max(m, r.total || 0), 0) || 1;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader
        title="Profit & Loss"
        subtitle="Revenue, cost & margin"
        onBack={() => navigation.goBack()}
        actions={[{ key: 'expense', icon: 'receipt-outline', onPress: () => navigation.navigate(SCREENS.EXPENSE_LIST) }]}>
        <ErpSummaryStrip items={[
          { label: 'Sales',      value: formatCurrency(totalSales) },
          { label: 'Net profit', value: formatCurrency(netProfit), color: profitable ? '#4ADE80' : '#FCA5A5' },
          { label: 'Margin',     value: `${netMargin.toFixed(1)}%`, color: profitable ? '#4ADE80' : '#FCA5A5' },
        ]} />
      </ErpHeader>

      <ErpTabs tabs={RANGE_TABS} active={range} onChange={setRange} />
      <ErpTabs
        tabs={GROUP_TABS}
        active={GROUP_TABS.find(g => g.toLowerCase() === groupBy) || 'Month'}
        onChange={t => setGroupBy(t.toLowerCase())}
      />

      {loading && !data ? (
        <ErpLoading label="Calculating…" />
      ) : error ? (
        <ErpError message={error} onRetry={load} />
      ) : (
        <ScrollView
          contentContainerStyle={st.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        >
          {d.period ? (
            <Text style={st.period}>{formatDate(d.period.from)} → {formatDate(d.period.to)}</Text>
          ) : null}

          {/* ── Headline result ── */}
          <View style={[st.heroCard, { backgroundColor: profitable ? '#0F5132' : '#7F1D1D' }]}>
            <Text style={st.heroLabel}>Net profit</Text>
            <Text style={st.heroValue}>{formatCurrency(netProfit)}</Text>
            <View style={st.heroRow}>
              <View style={st.heroPill}>
                <Text style={st.heroPillTxt}>Margin {netMargin.toFixed(1)}%</Text>
              </View>
              <View style={st.heroPill}>
                <Text style={st.heroPillTxt}>{profitable ? 'Profitable' : 'Loss'}</Text>
              </View>
            </View>
          </View>

          {/* ── The formula, laid out top-down ── */}
          <ErpCard>
            <ErpSectionLabel>How it's calculated</ErpSectionLabel>
            <ErpInfoRow label="Sales revenue"   value={formatCurrency(totalSales)} color="#059669" />
            <ErpInfoRow label="Less: purchase"  value={`-${formatCurrency(totalPurchase)}`} color="#2563EB" />
            <ErpInfoRow label="Gross profit"    value={formatCurrency(grossProfit)} bold />
            <ErpInfoRow label="Less: operating" value={`-${formatCurrency(operating)}`} color="#DC2626" />
            {marketing > 0 ? <ErpInfoRow label="Less: marketing" value={`-${formatCurrency(marketing)}`} color="#DC2626" /> : null}
            {salary > 0 ? <ErpInfoRow label="Less: salaries" value={`-${formatCurrency(salary)}`} color="#DC2626" /> : null}
            <ErpInfoRow
              label="Net profit"
              value={formatCurrency(netProfit)}
              color={profitable ? '#059669' : '#DC2626'}
              bold
              last
            />
          </ErpCard>

          {/* ── Margin summary ── */}
          <ErpCard>
            <ErpSectionLabel>Margins</ErpSectionLabel>
            <ErpInfoRow label="Gross margin" value={`${grossMargin.toFixed(1)}%`} />
            <ErpInfoRow label="Net margin"   value={`${netMargin.toFixed(1)}%`} color={profitable ? '#059669' : '#DC2626'} />
            <ErpInfoRow label="Total expenses" value={formatCurrency(totalExpenses)} />
            <ErpInfoRow label="Expense categories" value={String(breakdown.length)} last />
          </ErpCard>

          {/* ── Expense breakdown ── */}
          <ErpCard>
            <ErpSectionLabel>Where the money went</ErpSectionLabel>
            {breakdown.length === 0 ? (
              <ErpEmpty icon="pie-chart-outline" title="No expenses in range" />
            ) : (
              breakdown.map((r, i) => (
                <View key={r.category || i} style={[st.catRow, i === breakdown.length - 1 && { marginBottom: 0 }]}>
                  <View style={st.catHead}>
                    <Text style={st.catName} numberOfLines={1}>{r.category || 'Uncategorised'}</Text>
                    <Text style={st.catAmt}>{formatCurrency(r.total || 0)}</Text>
                  </View>
                  <View style={st.barTrack}>
                    <View style={[st.barFill, { width: `${Math.max(4, ((r.total || 0) / maxCat) * 100)}%` }]} />
                  </View>
                </View>
              ))
            )}
          </ErpCard>

          {/* ── Trend ── */}
          <ErpCard>
            <ErpSectionLabel>Sales vs purchase vs expense</ErpSectionLabel>
            {trend.length === 0 ? (
              <ErpEmpty icon="stats-chart-outline" title="No trend data" />
            ) : (
              <>
                <View style={st.legendRow}>
                  <Legend color="#059669" label="Sales" />
                  <Legend color="#2563EB" label="Purchase" />
                  <Legend color="#DC2626" label="Expense" />
                </View>
                {trend.map((t, i) => (
                  <View key={t.month || i} style={st.trendRow}>
                    <Text style={st.trendPeriod} numberOfLines={1}>{t.month || '—'}</Text>
                    <View style={st.trendBars}>
                      <View style={[st.tBar, { backgroundColor: '#059669', width: `${Math.max(2, ((t.sales || 0) / maxTrend) * 100)}%` }]} />
                      <View style={[st.tBar, { backgroundColor: '#2563EB', width: `${Math.max(2, ((t.purchase || 0) / maxTrend) * 100)}%` }]} />
                      <View style={[st.tBar, { backgroundColor: '#DC2626', width: `${Math.max(2, ((t.expenses || 0) / maxTrend) * 100)}%` }]} />
                    </View>
                    <Text style={[st.trendAmt, { color: (t.profit || 0) >= 0 ? '#059669' : '#DC2626' }]}>
                      {formatCurrency(t.profit || 0)}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </ErpCard>

          <TouchableOpacity style={st.linkRow} onPress={() => navigation.navigate(SCREENS.EXPENSE_REPORT)} activeOpacity={0.8}>
            <Ionicons name="bar-chart-outline" size={16} color={Colors.primary} />
            <Text style={st.linkTxt}>Open expense report</Text>
            <Ionicons name="chevron-forward" size={15} color={Colors.primary} />
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Legend({ color, label }) {
  return (
    <View style={st.legendItem}>
      <View style={[st.legendDot, { backgroundColor: color }]} />
      <Text style={st.legendTxt}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  content: { padding: 16, paddingBottom: 40 },
  period: { fontSize: 11.5, color: ERP.muted, marginBottom: 10 },

  heroCard: { borderRadius: 18, padding: 20, marginBottom: 12, ...Shadows.md },
  heroLabel: { fontSize: 12, color: 'rgba(255,255,255,0.72)', fontWeight: '600' },
  heroValue: { fontSize: 30, fontWeight: '800', color: '#FFF', marginTop: 6, letterSpacing: -0.8 },
  heroRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  heroPill: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 4 },
  heroPillTxt: { fontSize: 11, fontWeight: '700', color: '#FFF' },

  catRow: { marginBottom: 12 },
  catHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  catName: { fontSize: 12.5, fontWeight: '700', color: ERP.text, flex: 1, marginRight: 10 },
  catAmt: { fontSize: 12.5, fontWeight: '800', color: Colors.primary },
  barTrack: { height: 7, borderRadius: 4, backgroundColor: '#EEF1F6', overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4, backgroundColor: Colors.primary },

  legendRow: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: 10.5, color: ERP.muted, fontWeight: '600' },

  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  trendPeriod: { fontSize: 10.5, color: ERP.muted, width: 62 },
  trendBars: { flex: 1, gap: 2 },
  tBar: { height: 5, borderRadius: 3 },
  trendAmt: { fontSize: 11, fontWeight: '700', width: 74, textAlign: 'right' },

  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7, justifyContent: 'center',
    backgroundColor: '#FFF', borderRadius: 14, paddingVertical: 14, ...Shadows.sm,
  },
  linkTxt: { fontSize: 13, fontWeight: '700', color: Colors.primary },
});
