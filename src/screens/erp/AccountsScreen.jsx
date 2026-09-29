/**
 * src/screens/erp/AccountsScreen.jsx  (Retailer app)
 *
 * Three books in one screen:
 *   Company ledger — GET /api/retailer/erp/accounts/company   (accountsController.getCompanyLedger)
 *   Cash book      — GET /api/retailer/erp/accounts/cash-book (getCashBook)
 *   Bank book      — GET /api/retailer/erp/accounts/bank-book (getBankBook)
 *
 * Two DIFFERENT row shapes come back, so the renderer normalises them:
 *   company ledger → { date, type, ref, party, narration, debit, credit, balance }
 *   cash/bank book → { date, type, description, debit, credit, balance }
 * Both carry debit/credit/balance, so one table body handles both; only the
 * "description" line differs (party+ref vs description).
 *
 * Convention (matching the backend): debit = money in, credit = money out,
 * balance = running debit − credit.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList, RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { erpApi } from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  ErpHeader, ErpSummaryStrip, ErpTabs, ErpLoading, ErpError, ErpEmpty, ERP,
} from '../../components/erp';

const BOOK_TABS = ['Company Ledger', 'Cash Book', 'Bank Book'];
const RANGE_TABS = ['Month', 'Quarter', 'Year'];

function rangeFor(tab) {
  const now = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  if (tab === 'Quarter') {
    const from = new Date(now); from.setMonth(from.getMonth() - 3);
    return { from_date: iso(from), to_date: iso(now) };
  }
  if (tab === 'Year') return { from_date: `${now.getFullYear()}-01-01`, to_date: iso(now) };
  return { from_date: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to_date: iso(now) };
}

const TYPE_META = {
  Receipt: { color: '#059669', icon: 'arrow-down-circle-outline' },
  Payment: { color: '#DC2626', icon: 'arrow-up-circle-outline' },
  Expense: { color: '#EA580C', icon: 'receipt-outline' },
  Invoice: { color: '#2563EB', icon: 'document-text-outline' },
  Sale:    { color: '#2563EB', icon: 'trending-up-outline' },
};

export default function AccountsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [book, setBook]       = useState('Company Ledger');
  const [range, setRange]     = useState('Month');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = rangeFor(range);
      const res = book === 'Company Ledger'
        ? await erpApi.companyLedger(params)
        : book === 'Cash Book'
          ? await erpApi.cashBook(params)
          : await erpApi.bankBook(params);
      setData(res?.data ?? res ?? {});
    } catch (e) {
      setError(e?.message || 'Failed to load accounts');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [book, range]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const d = data || {};
  // Company ledger uses `ledger`; cash/bank books use `entries`.
  const rows = Array.isArray(d.ledger) ? d.ledger
    : Array.isArray(d.entries) ? d.entries
    : [];

  const totalIn  = d.totalDebit  ?? d.totalIn  ?? 0;
  const totalOut = d.totalCredit ?? d.totalOut ?? 0;
  const closing  = d.closingBalance ?? 0;

  const renderRow = ({ item, index }) => {
    const meta = TYPE_META[item.type] || { color: ERP.muted, icon: 'ellipsis-horizontal-outline' };
    const isIn = (item.debit || 0) > 0;
    return (
      <View style={st.row}>
        <View style={[st.rowIcon, { backgroundColor: `${meta.color}18` }]}>
          <Ionicons name={meta.icon} size={14} color={meta.color} />
        </View>

        <View style={st.rowBody}>
          <Text style={st.rowDesc} numberOfLines={1}>
            {item.description || [item.party, item.ref].filter(Boolean).join(' · ') || item.type || 'Entry'}
          </Text>
          {item.narration ? <Text style={st.rowNarr} numberOfLines={1}>{item.narration}</Text> : null}
          <Text style={st.rowDate}>{formatDate(item.date)}</Text>
        </View>

        <View style={st.rowAmt}>
          <Text style={[st.rowAmtVal, { color: isIn ? '#059669' : '#DC2626' }]}>
            {isIn ? '+' : '−'}{formatCurrency(isIn ? item.debit : item.credit)}
          </Text>
          <Text style={st.rowBal}>{formatCurrency(item.balance || 0)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader
        title="Accounts"
        subtitle="Ledgers & books"
        onBack={() => navigation.goBack()}>
        <ErpSummaryStrip items={[
          { label: 'Money in',  value: formatCurrency(totalIn),  color: '#4ADE80' },
          { label: 'Money out', value: formatCurrency(totalOut), color: '#FCA5A5' },
          { label: 'Balance',   value: formatCurrency(closing) },
        ]} />
      </ErpHeader>

      <ErpTabs tabs={BOOK_TABS} active={book} onChange={setBook} />
      <ErpTabs tabs={RANGE_TABS} active={range} onChange={setRange} />

      {loading && !data ? (
        <ErpLoading label="Loading ledger…" />
      ) : error ? (
        <ErpError message={error} onRetry={load} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(i, idx) => `${i.ref || i.description || 'row'}-${idx}`}
          renderItem={renderRow}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          ListHeaderComponent={
            rows.length ? (
              <View style={st.headRow}>
                <Text style={[st.headTxt, { flex: 1 }]}>Entry</Text>
                <Text style={[st.headTxt, { width: 84, textAlign: 'right' }]}>Amount</Text>
                <Text style={[st.headTxt, { width: 78, textAlign: 'right' }]}>Balance</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <ErpEmpty
              icon="book-outline"
              title="No entries in range"
              subtitle={
                book === 'Cash Book'
                  ? 'Cash receipts, payments and expenses will appear here.'
                  : book === 'Bank Book'
                    ? 'Non-cash receipts and payments will appear here.'
                    : 'Sales, purchases, payments and expenses roll up into this ledger.'
              }
            />
          }
        />
      )}

      {rows.length > 0 ? (
        <View style={[st.footerBar, { bottom: 16 + insets.bottom }]}>
          <Text style={st.footerLbl}>Closing balance</Text>
          <Text style={[st.footerVal, { color: closing >= 0 ? '#059669' : '#DC2626' }]}>
            {formatCurrency(closing)}
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  list: { padding: 14, paddingBottom: 90 },

  headRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4,
    paddingBottom: 8, gap: 8,
  },
  headTxt: { fontSize: 10, fontWeight: '800', color: ERP.muted, textTransform: 'uppercase', letterSpacing: 0.5 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF',
    borderRadius: 12, padding: 12, marginBottom: 8, ...Shadows.sm,
  },
  rowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowDesc: { fontSize: 12.5, fontWeight: '700', color: ERP.text },
  rowNarr: { fontSize: 10.5, color: ERP.muted },
  rowDate: { fontSize: 10, color: ERP.faint },

  rowAmt: { alignItems: 'flex-end', minWidth: 84 },
  rowAmtVal: { fontSize: 12.5, fontWeight: '800' },
  rowBal: { fontSize: 10.5, color: ERP.muted, marginTop: 2 },

  footerBar: {
    position: 'absolute', left: 16, right: 16, bottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.secondary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14,
    ...Shadows.md,
  },
  footerLbl: { fontSize: 12.5, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  footerVal: { fontSize: 17, fontWeight: '800' },
});
