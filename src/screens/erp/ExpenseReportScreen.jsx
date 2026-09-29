/**
 * src/screens/erp/ExpenseReportScreen.jsx  (Retailer app)
 *
 * Expense report, laid out like the wholesaler's `expense/ExpenseReportScreen.jsx`:
 * a total banner, then a *By Period* breakdown and a *By Category* breakdown,
 * each drawn as labelled bars.
 *
 * Backend contract:
 *   GET /api/retailer/erp/reports/expenses  (reportController.getExpenseReport)
 *     query  → { from_date, to_date, group_by: day|week|month|year }
 *     returns→ { rows:[{category,total,count}]    ← category-wise
 *                trend:[{period,total,count}]     ← time-wise (day/week/month/year)
 *                totals:{total,count}, group_by, period:{from,to} }
 *
 * NOTE: `rows` is the CATEGORY breakdown and `trend` is the PERIOD breakdown —
 * easy to swap. One request returns both, so no client-side aggregation is
 * needed. Bars are plain Views — no charting dependency.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { SCREENS } from '../../constants';
import { erpApi } from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getCatConfig } from './expenseCategories';
import {
  ErpHeader, ErpSummaryStrip, ErpTabs, ErpCard, ErpSectionLabel,
  ErpLoading, ErpError, ErpEmpty, ERP,
} from '../../components/erp';

/** Wholesaler's tabs: Daily / Monthly / Yearly, mapped to a date window + group_by. */
const PERIOD_TABS = [
  { key: 'day',   label: 'Daily' },
  { key: 'month', label: 'Monthly' },
  { key: 'year',  label: 'Yearly' },
];

const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function rangeFor(groupBy) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (groupBy) {
    case 'day':   return { from_date: fmt(new Date(y, m, now.getDate() - 6)), to_date: fmt(now), group_by: 'day' };
    case 'year':  return { from_date: `${y - 4}-01-01`,                      to_date: fmt(now), group_by: 'year' };
    default:      return { from_date: `${y}-01-01`,                          to_date: fmt(now), group_by: 'month' };
  }
}

const TAB_LABEL = PERIOD_TABS.map(t => t.label);

export default function ExpenseReportScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [groupBy, setGroupBy] = useState('month');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await erpApi.expenseReport(rangeFor(groupBy));
      setData(res?.data ?? res ?? {});
    } catch (e) {
      setError(e?.message || 'Failed to load report');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [groupBy]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  // `rows` = category-wise, `trend` = period-wise. Don't mix them up.
  const cats   = Array.isArray(data?.rows)  ? data.rows  : [];
  const trend  = Array.isArray(data?.trend) ? data.trend : [];
  const totals = data?.totals || { total: 0, count: 0 };

  const maxTrend = trend.reduce((mx, r) => Math.max(mx, r.total || 0), 0) || 1;
  const maxCat   = cats.reduce((mx, r) => Math.max(mx, r.total || 0), 0) || 1;

  const avg = totals.count ? totals.total / totals.count : 0;

  const activeLabel = (PERIOD_TABS.find(t => t.key === groupBy) || PERIOD_TABS[1]).label;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader
        title="Expense Report"
        subtitle="Period & category breakdown"
        onBack={() => navigation.goBack()}
        actions={[{ key: 'list', icon: 'list-outline', onPress: () => navigation.navigate(SCREENS.EXPENSE_LIST) }]}>
        <ErpSummaryStrip items={[
          { label: 'Total',   value: formatCurrency(totals.total || 0) },
          { label: 'Entries', value: totals.count || 0 },
          { label: 'Average', value: formatCurrency(avg) },
        ]} />
      </ErpHeader>

      <ErpTabs
        tabs={TAB_LABEL}
        active={activeLabel}
        onChange={label => {
          const t = PERIOD_TABS.find(x => x.label === label);
          if (t) setGroupBy(t.key);
        }}
      />

      {loading && !data ? (
        <ErpLoading label="Building report…" />
      ) : error ? (
        <ErpError message={error} onRetry={load} />
      ) : (
        <ScrollView
          contentContainerStyle={[st.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        >
          {/* ── Total banner (wholesaler's totalBox) ───────────────────── */}
          <View style={st.totalBox}>
            <Text style={st.totalLabel}>Total Expenses</Text>
            <Text style={st.totalValue}>{formatCurrency(totals.total || 0)}</Text>
            <Text style={st.totalSub}>
              {totals.count || 0} {totals.count === 1 ? 'entry' : 'entries'}
              {data?.period?.from ? `  ·  ${formatDate(data.period.from)} → ${formatDate(data.period.to)}` : ''}
            </Text>
          </View>

          {/* ── By period (backend `trend`) ────────────────────────────── */}
          <ErpCard>
            <ErpSectionLabel>By period ({groupBy})</ErpSectionLabel>
            {trend.length === 0 ? (
              <ErpEmpty icon="bar-chart-outline" title="No expenses in this period" subtitle="Try a wider period." />
            ) : (
              trend.map((r, i) => {
                const w = Math.max(3, Math.min(((r.total || 0) / maxTrend) * 100, 100));
                return (
                  <View key={r.period || i} style={[st.row, i === trend.length - 1 && st.rowLast]}>
                    <View style={st.rowTop}>
                      <Text style={st.rowLabel} numberOfLines={1}>{r.period || '—'}</Text>
                      <Text style={st.rowAmt}>{formatCurrency(r.total || 0)}</Text>
                    </View>
                    <View style={st.barTrack}>
                      <View style={[st.barFill, { width: `${w}%` }]} />
                    </View>
                    <Text style={st.rowSub}>{r.count || 0} {r.count === 1 ? 'entry' : 'entries'}</Text>
                  </View>
                );
              })
            )}
          </ErpCard>

          {/* ── By category (backend `rows`) ───────────────────────────── */}
          <ErpCard>
            <ErpSectionLabel>By category</ErpSectionLabel>
            {cats.length === 0 ? (
              <ErpEmpty icon="pie-chart-outline" title="No expenses in range" subtitle="Try a wider period." />
            ) : (
              cats.map((c, i) => {
                const cfg = getCatConfig(c.category);
                return (
                  <View key={c.category || i} style={[st.row, i === cats.length - 1 && st.rowLast]}>
                    <View style={st.rowTop}>
                      <View style={st.catLabelWrap}>
                        <View style={[st.catDot, { backgroundColor: cfg.bg }]}>
                          <Ionicons name={cfg.icon} size={12} color={cfg.color} />
                        </View>
                        <Text style={st.rowLabel} numberOfLines={1}>{c.category || 'Uncategorised'}</Text>
                      </View>
                      <Text style={st.rowAmt}>{formatCurrency(c.total || 0)}</Text>
                    </View>
                    <View style={st.barTrack}>
                      <View style={[st.barFill, { width: `${Math.max(3, ((c.total || 0) / maxCat) * 100)}%`, backgroundColor: cfg.color }]} />
                    </View>
                    <Text style={st.rowSub}>
                      {c.count || 0} {c.count === 1 ? 'entry' : 'entries'}
                      {totals.total ? `  ·  ${Math.round(((c.total || 0) / totals.total) * 100)}% of spend` : ''}
                    </Text>
                  </View>
                );
              })
            )}
          </ErpCard>

          <View style={st.linkRowWrap}>
            <Text style={st.linkHint}>Tap a category on the list screen to filter entries.</Text>
            <View style={st.linkRow}>
              <Ionicons name="list-outline" size={16} color={Colors.primary} />
              <Text style={st.linkTxt}>View all expense entries</Text>
              <Ionicons name="chevron-forward" size={15} color={Colors.primary} />
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  content: { padding: 16 },

  totalBox: {
    backgroundColor: Colors.secondary, borderRadius: 16,
    padding: 16, alignItems: 'center', marginBottom: 12, ...Shadows.md,
  },
  totalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12.5, fontWeight: '600' },
  totalValue: { color: '#FFF', fontSize: 26, fontWeight: '800', marginTop: 4 },
  totalSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 5, textAlign: 'center' },

  row: { marginBottom: 14 },
  rowLast: { marginBottom: 0 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  catLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1, marginRight: 10 },
  catDot: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 13, fontWeight: '700', color: ERP.text, flexShrink: 1 },
  rowAmt: { fontSize: 13, fontWeight: '800', color: Colors.error },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#EEF1F6', overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  rowSub: { fontSize: 10.5, color: ERP.muted, marginTop: 4 },

  linkRowWrap: { gap: 8 },
  linkHint: { fontSize: 11, color: ERP.muted, textAlign: 'center' },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7, justifyContent: 'center',
    backgroundColor: '#FFF', borderRadius: 14, paddingVertical: 14, ...Shadows.sm,
  },
  linkTxt: { fontSize: 13, fontWeight: '700', color: Colors.primary },
});
