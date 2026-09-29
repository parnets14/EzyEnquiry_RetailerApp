/**
 * src/screens/erp/PaymentListScreen.jsx  (Retailer app)
 *
 * Receivables and Payables — two screens built from one implementation, because
 * the two flows are structurally identical (list → open → record a payment).
 *
 *   GET  /api/retailer/erp/payments/receivables        (paymentController.listReceivables)
 *   GET  /api/retailer/erp/payments/payables           (paymentController.listPayables)
 *   POST /api/retailer/erp/payments/receivables/:id/collect
 *   POST /api/retailer/erp/payments/payables/:id/pay
 *
 * Both collect/pay bodies → { amount, mode, reference, notes }
 * The backend computes the new status itself:
 *   outstanding <= 0 → 'Received' / 'Paid', otherwise 'Partial'
 * and syncs the linked Sale + Invoice. We never send a status.
 *
 * Direction matters and is easy to get backwards:
 *   Receivable = a CUSTOMER owes the retailer  (money in)
 *   Payable    = the retailer owes a SUPPLIER  (money out)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { erpApi } from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  ErpHeader, ErpSummaryStrip, ErpTabs, ErpCard, ErpSectionLabel, ErpField,
  ErpInput, ErpPicker, ErpLoading, ErpError, ErpEmpty, ErpPrimaryAction,
  ErpBadge, ErpInfoRow, ERP,
} from '../../components/erp';

const MODES = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card', 'Other'];
const STATUS_TABS = ['All', 'Pending', 'Partial'];

/** Per-kind config — the only thing that differs between the two screens. */
const CONFIG = {
  receivable: {
    title: 'Receivables',
    subtitle: 'Money customers owe you',
    emptyTitle: 'Nothing outstanding',
    emptySubtitle: 'When customers owe you money it will show up here.',
    personLabel: 'Customer',
    actionVerb: 'Collect',
    pastVerb: 'Collected',
    accent: '#059669',
    tabKey: 'receivable',
    list: erpApi.listReceivables,
    submit: erpApi.collectReceivable,
    amountOf: r => r.outstanding || 0,
    nameOf: r => r.customer_name,
    codeOf: r => r.rcv_code,
    paidOf: r => r.received || 0,
  },
  payable: {
    title: 'Payables',
    subtitle: 'Money you owe suppliers',
    emptyTitle: 'Nothing to pay',
    emptySubtitle: 'Supplier bills awaiting payment will show up here.',
    personLabel: 'Supplier',
    actionVerb: 'Pay',
    pastVerb: 'Paid',
    accent: '#EA580C',
    tabKey: 'payable',
    list: erpApi.listPayables,
    submit: erpApi.payPayable,
    amountOf: p => p.outstanding || 0,
    nameOf: p => p.supplier_name,
    codeOf: p => p.pay_code,
    paidOf: p => p.paid || 0,
  },
};

export function PaymentReceivableScreen({ navigation }) {
  return <PaymentLedgerList kind="receivable" navigation={navigation} />;
}

export function PaymentPayableScreen({ navigation }) {
  return <PaymentLedgerList kind="payable" navigation={navigation} />;
}

function PaymentLedgerList({ kind, navigation }) {
  const cfg = CONFIG[kind];

  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');
  const [tab,        setTab]        = useState('All');
  const [settleFor,  setSettleFor]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await cfg.list(tab === 'All' ? { limit: 200 } : { status: tab, limit: 200 });
      const data = res?.data ?? res;
      const key = kind === 'receivable' ? 'receivables' : 'payables';
      setRows(Array.isArray(data?.[key]) ? data[key] : []);
    } catch (e) {
      setError(e?.message || `Failed to load ${cfg.title.toLowerCase()}`);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [tab, cfg, kind]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const totals = useMemo(() => ({
    outstanding: rows.reduce((s, r) => s + cfg.amountOf(r), 0),
    settled:     rows.reduce((s, r) => s + cfg.paidOf(r), 0),
    count:       rows.length,
  }), [rows, cfg]);

  const renderItem = ({ item }) => {
    const outstanding = cfg.amountOf(item);
    const settled = outstanding <= 0;
    const overdue = item.due_date && !settled && new Date(item.due_date) < new Date();
    const badge = settled
      ? { label: kind === 'receivable' ? 'Received' : 'Paid', color: '#059669', bg: '#ECFDF5' }
      : overdue
        ? { label: 'Overdue', color: '#DC2626', bg: '#FEF2F2' }
        : { label: item.status || 'Pending', color: '#D97706', bg: '#FFF7ED' };

    return (
      <TouchableOpacity
        style={st.card}
        onPress={() => !settled && setSettleFor(item)}
        activeOpacity={settled ? 1 : 0.85}
      >
        <View style={[st.cardAccent, { backgroundColor: badge.color }]} />
        <View style={st.cardBody}>
          <View style={st.cardTop}>
            <Text style={st.name} numberOfLines={1}>{cfg.nameOf(item) || '—'}</Text>
            <ErpBadge label={badge.label} color={badge.color} bg={badge.bg} dot />
          </View>

          <View style={st.amtRow}>
            <View>
              <Text style={[st.outAmt, { color: settled ? '#059669' : cfg.accent }]}>
                {formatCurrency(outstanding)}
              </Text>
              <Text style={st.outLbl}>Outstanding</Text>
            </View>
            <View style={st.amtRight}>
              <Text style={st.subAmt}>{formatCurrency(cfg.paidOf(item))}</Text>
              <Text style={st.outLbl}>Settled</Text>
            </View>
            <View style={st.amtRight}>
              <Text style={st.subAmt}>{formatCurrency(item.invoice_amount || 0)}</Text>
              <Text style={st.outLbl}>Total</Text>
            </View>
          </View>

          <View style={st.metaRow}>
            {cfg.codeOf(item) ? <Text style={st.code}>{cfg.codeOf(item)}</Text> : null}
            {item.due_date ? (
              <Text style={[st.due, overdue && { color: '#DC2626', fontWeight: '700' }]}>
                Due {formatDate(item.due_date)}
              </Text>
            ) : null}
          </View>
        </View>
        {!settled ? <Ionicons name="chevron-forward" size={16} color="#B0B5C3" style={{ alignSelf: 'center' }} /> : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader
        title={cfg.title}
        subtitle={cfg.subtitle}
        onBack={() => navigation.goBack()}>
        <ErpSummaryStrip items={[
          { label: 'Outstanding', value: formatCurrency(totals.outstanding) },
          { label: 'Settled',     value: formatCurrency(totals.settled), color: '#4ADE80' },
          { label: 'Open items',  value: totals.count },
        ]} />
      </ErpHeader>

      <ErpTabs tabs={STATUS_TABS} active={tab} onChange={setTab} />

      {loading && !rows.length ? (
        <ErpLoading label={`Loading ${cfg.title.toLowerCase()}…`} />
      ) : error ? (
        <ErpError message={error} onRetry={load} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={i => i._id}
          renderItem={renderItem}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          ListHeaderComponent={
            rows.length ? <Text style={st.hint}>Tap a row to record a payment.</Text> : null
          }
          ListEmptyComponent={
            <ErpEmpty icon="wallet-outline" title={cfg.emptyTitle} subtitle={cfg.emptySubtitle} />
          }
        />
      )}

      <SettleSheet
        item={settleFor}
        cfg={cfg}
        onClose={() => setSettleFor(null)}
        onDone={() => { setSettleFor(null); load(); }}
      />
    </SafeAreaView>
  );
}

/* ── Record a payment ───────────────────────────────────────────────────── */
function SettleSheet({ item, cfg, onClose, onDone }) {
  const insets = useSafeAreaInsets();
  const outstanding = item ? cfg.amountOf(item) : 0;

  const [amount, setAmount]       = useState('');
  const [mode, setMode]           = useState('Cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes]         = useState('');
  const [modeOpen, setModeOpen]   = useState(false);
  const [saving, setSaving]       = useState(false);

  // Pre-fill the full outstanding each time a new row is opened.
  useEffect(() => {
    if (item) {
      setAmount(String(outstanding || ''));
      setMode('Cash'); setReference(''); setNotes('');
    }
  }, [item, outstanding]);

  if (!item) return null;

  const amt = parseFloat(amount || 0);
  const remaining = Math.max(outstanding - amt, 0);
  const invalid = !amt || amt <= 0 || amt > outstanding;

  const submit = async () => {
    if (invalid) {
      Alert.alert('Check the amount', `Enter an amount between 1 and ${outstanding}.`);
      return;
    }
    setSaving(true);
    try {
      await cfg.submit(item._id, {
        amount: amt, mode, reference: reference.trim(), notes: notes.trim(),
      });
      Alert.alert(
        'Payment recorded',
        `${formatCurrency(amt)} ${cfg.pastVerb.toLowerCase()}.${remaining > 0 ? ` ${formatCurrency(remaining)} still outstanding.` : ' Fully settled.'}`,
        [{ text: 'OK', onPress: onDone }],
      );
    } catch (e) {
      Alert.alert('Could not record payment', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={st.safe} edges={['top']}>
        <ErpHeader title={`${cfg.actionVerb} payment`} subtitle={cfg.nameOf(item)} onBack={onClose} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[st.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <ErpCard>
              <ErpSectionLabel>{cfg.personLabel}</ErpSectionLabel>
              <ErpInfoRow label="Name"        value={cfg.nameOf(item) || '—'} />
              <ErpInfoRow label="Total"       value={formatCurrency(item.invoice_amount || 0)} />
              <ErpInfoRow label="Already settled" value={formatCurrency(cfg.paidOf(item))} color="#059669" />
              <ErpInfoRow label="Outstanding" value={formatCurrency(outstanding)} bold />
              {item.due_date ? <ErpInfoRow label="Due date" value={formatDate(item.due_date)} last /> : null}
            </ErpCard>

            <ErpCard>
              <ErpSectionLabel>Payment</ErpSectionLabel>
              <ErpField label="Amount" required>
                <ErpInput
                  value={amount}
                  onChangeText={v => setAmount(String(v).replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
              </ErpField>

              <View style={st.quickRow}>
                <TouchableOpacity style={st.quickBtn} onPress={() => setAmount(String(outstanding))} activeOpacity={0.8}>
                  <Text style={st.quickTxt}>Full {formatCurrency(outstanding)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.quickBtn} onPress={() => setAmount(String(Math.round(outstanding / 2)))} activeOpacity={0.8}>
                  <Text style={st.quickTxt}>Half</Text>
                </TouchableOpacity>
              </View>

              <ErpField label="Mode">
                <ErpPicker value={mode} onPress={() => setModeOpen(true)} />
              </ErpField>
              <ErpField label="Reference">
                <ErpInput value={reference} onChangeText={setReference} placeholder="Cheque / UTR no." />
              </ErpField>
              <ErpField label="Notes">
                <ErpInput value={notes} onChangeText={setNotes} placeholder="Optional" />
              </ErpField>
            </ErpCard>

            {amt > 0 ? (
              <ErpCard>
                <ErpSectionLabel>After this payment</ErpSectionLabel>
                <View style={st.afterRow}>
                  <Text style={st.afterLbl}>Remaining outstanding</Text>
                  <Text style={[st.afterVal, { color: remaining > 0 ? cfg.accent : '#059669' }]}>
                    {formatCurrency(remaining)}
                  </Text>
                </View>
                <Text style={st.afterNote}>
                  {remaining > 0 ? 'This will be recorded as a partial payment.' : 'This settles the item in full.'}
                </Text>
              </ErpCard>
            ) : null}
          </ScrollView>

          {/* Pinned action bar — pad past the home indicator / Android nav bar */}
          <View style={[st.footer, { paddingBottom: insets.bottom + 16 }]}>
            <ErpPrimaryAction
              label={saving ? 'Recording…' : `${cfg.actionVerb} ${formatCurrency(amt || 0)}`}
              icon="checkmark"
              onPress={submit}
              disabled={saving || invalid}
            />
          </View>
        </KeyboardAvoidingView>

        <Modal visible={modeOpen} animationType="slide" transparent onRequestClose={() => setModeOpen(false)}>
          <View style={st.backdrop}>
            <View style={st.sheet}>
              <View style={st.sheetHead}>
                <Text style={st.sheetTitle}>Payment mode</Text>
                <TouchableOpacity onPress={() => setModeOpen(false)}>
                  <Ionicons name="close" size={22} color={ERP.muted} />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {MODES.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={st.option}
                    onPress={() => { setMode(m); setModeOpen(false); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[st.optionTxt, m === mode && st.optionTxtOn]}>{m}</Text>
                    {m === mode ? <Ionicons name="checkmark" size={18} color={Colors.primary} /> : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  list: { padding: 14, paddingBottom: 40 },
  content: { padding: 16, paddingBottom: 24 },
  footer: { padding: 16, backgroundColor: ERP.bg },
  hint: { fontSize: 11, color: ERP.muted, marginBottom: 10 },

  card: {
    flexDirection: 'row', alignItems: 'stretch', backgroundColor: '#FFF',
    borderRadius: 14, marginBottom: 10, overflow: 'hidden', ...Shadows.sm,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 13, gap: 9 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontSize: 14, fontWeight: '800', color: ERP.text, flex: 1 },

  amtRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 18 },
  amtRight: { alignItems: 'flex-end' },
  outAmt: { fontSize: 17, fontWeight: '800' },
  subAmt: { fontSize: 13, fontWeight: '700', color: ERP.text },
  outLbl: { fontSize: 9.5, color: ERP.muted, marginTop: 2 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  code: { fontSize: 10.5, fontWeight: '700', color: Colors.primary, backgroundColor: Colors.primaryBg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  due: { fontSize: 11, color: ERP.muted },

  quickRow: { flexDirection: 'row', gap: 8, marginTop: -6, marginBottom: 12 },
  quickBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, backgroundColor: Colors.primaryBg },
  quickTxt: { fontSize: 11.5, fontWeight: '800', color: Colors.primary },

  afterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  afterLbl: { fontSize: 12.5, color: ERP.muted },
  afterVal: { fontSize: 17, fontWeight: '800' },
  afterNote: { fontSize: 11, color: ERP.muted, marginTop: 6 },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,22,40,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '55%', paddingBottom: 18, ...Shadows.lg },
  sheetHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: ERP.text },
  option: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  optionTxt: { fontSize: 14.5, color: ERP.text },
  optionTxtOn: { fontWeight: '800', color: Colors.primary },
});
