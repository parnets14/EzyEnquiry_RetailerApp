/**
 * src/screens/erp/PartyLedgerScreen.jsx  (Retailer app)
 *
 * Running statement for one customer or one supplier.
 *   GET /api/retailer/erp/accounts/customer/:id  (accountsController.getCustomerLedger)
 *   GET /api/retailer/erp/accounts/supplier/:id  (getSupplierLedger)
 *
 * Route params → { partyId, partyName, kind: 'customer' | 'supplier' }
 * Registered under SCREENS.CUSTOMER_LEDGER; `kind` defaults to 'customer'.
 *
 * Row shape → { ref, date, type, debit, credit, balance }
 * debit = what the party owes (invoice/bill), credit = what they've settled.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList, RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { erpApi } from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  ErpHeader, ErpSummaryStrip, ErpCard, ErpSectionLabel, ErpInfoRow,
  ErpLoading, ErpError, ErpEmpty, ERP,
} from '../../components/erp';

const TYPE_META = {
  Invoice: { color: '#2563EB', icon: 'document-text-outline' },
  Sale:    { color: '#2563EB', icon: 'trending-up-outline' },
  Payment: { color: '#059669', icon: 'arrow-down-circle-outline' },
  Purchase:{ color: '#EA580C', icon: 'cart-outline' },
  Bill:    { color: '#EA580C', icon: 'receipt-outline' },
};

export default function PartyLedgerScreen({ navigation, route }) {
  const { partyId, partyName, kind = 'customer' } = route?.params || {};

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    if (!partyId) { setError('No party selected.'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const res = kind === 'supplier'
        ? await erpApi.supplierLedger(partyId)
        : await erpApi.customerLedger(partyId);
      setData(res?.data ?? res ?? {});
    } catch (e) {
      setError(e?.message || 'Failed to load ledger');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [partyId, kind]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const d = data || {};
  const party = d.customer || d.supplier || {};
  const rows = Array.isArray(d.ledger) ? d.ledger : [];
  const closing = d.closingBalance ?? 0;

  const totalDebit  = rows.reduce((s, r) => s + (r.debit  || 0), 0);
  const totalCredit = rows.reduce((s, r) => s + (r.credit || 0), 0);

  const renderRow = ({ item }) => {
    const meta = TYPE_META[item.type] || { color: ERP.muted, icon: 'ellipsis-horizontal-outline' };
    const isDebit = (item.debit || 0) > 0;
    return (
      <View style={st.row}>
        <View style={[st.rowIcon, { backgroundColor: `${meta.color}18` }]}>
          <Ionicons name={meta.icon} size={14} color={meta.color} />
        </View>
        <View style={st.rowBody}>
          <Text style={st.rowDesc} numberOfLines={1}>{item.ref || item.type || 'Entry'}</Text>
          <Text style={st.rowDate}>{formatDate(item.date)}</Text>
        </View>
        <View style={st.rowAmt}>
          <Text style={[st.rowAmtVal, { color: isDebit ? '#DC2626' : '#059669' }]}>
            {isDebit ? '+' : '−'}{formatCurrency(isDebit ? item.debit : item.credit)}
          </Text>
          <Text style={st.rowBal}>{formatCurrency(item.balance || 0)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader
        title={kind === 'supplier' ? 'Supplier Ledger' : 'Customer Ledger'}
        subtitle={partyName || party.name || undefined}
        onBack={() => navigation.goBack()}>
        <ErpSummaryStrip items={[
          { label: 'Billed',  value: formatCurrency(totalDebit),  color: '#FCA5A5' },
          { label: 'Settled', value: formatCurrency(totalCredit), color: '#4ADE80' },
          { label: 'Balance', value: formatCurrency(closing) },
        ]} />
      </ErpHeader>

      {loading && !data ? (
        <ErpLoading label="Loading ledger…" />
      ) : error ? (
        <ErpError message={error} onRetry={load} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(i, idx) => `${i.ref || i.type}-${idx}`}
          renderItem={renderRow}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          ListHeaderComponent={
            <View>
              <ErpCard>
                <ErpSectionLabel>{kind === 'supplier' ? 'Supplier' : 'Customer'}</ErpSectionLabel>
                <ErpInfoRow label="Name"   value={party.name || partyName || '—'} />
                {party.mobile ? <ErpInfoRow label="Mobile" value={party.mobile} /> : null}
                {party.city ? <ErpInfoRow label="City" value={party.city} /> : null}
                <ErpInfoRow
                  label="Closing balance"
                  value={formatCurrency(closing)}
                  color={closing > 0 ? '#DC2626' : '#059669'}
                  bold
                  last
                />
              </ErpCard>

              {rows.length ? (
                <View style={st.headRow}>
                  <Text style={[st.headTxt, { flex: 1 }]}>Entry</Text>
                  <Text style={[st.headTxt, { width: 84, textAlign: 'right' }]}>Amount</Text>
                  <Text style={[st.headTxt, { width: 78, textAlign: 'right' }]}>Balance</Text>
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <ErpEmpty
              icon="book-outline"
              title="No transactions yet"
              subtitle={`Invoices and payments for this ${kind} will appear here.`}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  list: { padding: 14, paddingBottom: 40 },

  headRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 8, gap: 8 },
  headTxt: { fontSize: 10, fontWeight: '800', color: ERP.muted, textTransform: 'uppercase', letterSpacing: 0.5 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF',
    borderRadius: 12, padding: 12, marginBottom: 8, ...Shadows.sm,
  },
  rowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowDesc: { fontSize: 12.5, fontWeight: '700', color: ERP.text },
  rowDate: { fontSize: 10, color: ERP.faint },
  rowAmt: { alignItems: 'flex-end', minWidth: 84 },
  rowAmtVal: { fontSize: 12.5, fontWeight: '800' },
  rowBal: { fontSize: 10.5, color: ERP.muted, marginTop: 2 },
});
