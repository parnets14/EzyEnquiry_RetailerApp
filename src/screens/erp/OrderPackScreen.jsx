/**
 * src/screens/erp/OrderPackScreen.jsx  (Retailer app)
 *
 * PACK & DISPATCH — send part (or all) of an order and raise its invoice.
 *
 *   GET  /api/retailer/erp/orders/:id        order + remaining qty
 *   POST /api/retailer/erp/orders/:id/pack   packOrder  → invoice + dispatch
 *
 * ── WHY THIS SCREEN EXISTS ───────────────────────────────────────────────────
 * The customer ordered 100. You are sending 50 today. This is that form.
 *
 * POST /orders/:id/pack does the whole job server-side for just the packed
 * quantity: it raises an Invoice for 50, creates the Dispatch with the vehicle
 * details, deducts stock, books the Sale + Receivable, and appends a package
 * record to the order. Open this screen again for the remaining 50 and it
 * repeats — a second package, a second invoice, a second dispatch.
 *
 * This is why the plain "New Dispatch" screen cannot do this: `createDispatch`
 * raises NO invoice and rejects a second dispatch for the same order with 409.
 * Packing is the only path that satisfies "create a dispatch ⇒ invoice is
 * created automatically".
 *
 * The invoice preview below is client-side arithmetic that mirrors the server's
 * exactly (amount = qty × rate, gst = amount × pct / 100, total = amount + gst).
 * The server recomputes and is authoritative — this is only so the seller can
 * see what they are about to raise before committing.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { erpApi } from '../../utils/api';
import { formatCurrency } from '../../utils/formatters';
import {
  ErpHeader, ErpCard, ErpSectionLabel, ErpField, ErpInput, ErpInfoRow,
  ErpLoading, ErpError, ERP,
} from '../../components/erp';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const todayIso = () => new Date().toISOString().slice(0, 10);
const numOnly = (v) => String(v ?? '').replace(/[^0-9.]/g, '');
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** "600 of 1000 sent" progress bar. */
function PackProgress({ ordered, dispatched }) {
  const pct = ordered > 0 ? Math.min(100, Math.round((dispatched / ordered) * 100)) : 0;
  const done = pct >= 100;
  return (
    <View style={st.progressWrap}>
      <View style={st.progressTrack}>
        <View style={[st.progressFill, { width: `${pct}%`, backgroundColor: done ? '#10B981' : Colors.primary }]} />
      </View>
      <Text style={st.progressText}>{pct}% sent</Text>
    </View>
  );
}

export default function OrderPackScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const orderId = route?.params?.orderId;

  const [order,   setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');

  const [qty,       setQty]       = useState('');
  const [vehicle,   setVehicle]   = useState('');
  const [driver,    setDriver]    = useState('');
  const [mobile,    setMobile]    = useState('');
  const [transport, setTransport] = useState('');
  const [lr,        setLr]        = useState('');
  const [dispatchDate, setDispatchDate] = useState(todayIso());
  const [expectedDays, setExpectedDays] = useState('');

  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [errField, setErrField] = useState('');

  const load = useCallback(async () => {
    if (!orderId) { setLoadErr('No order selected.'); setLoading(false); return; }
    setLoading(true); setLoadErr('');
    try {
      const res  = await erpApi.getSellerOrder(orderId);
      const data = res?.data ?? res;
      const o    = data?.order ?? data;
      setOrder(o);
      // Default to the full outstanding quantity — the common case is "send the rest".
      const remaining = Number(o?.progress?.remaining_qty ?? o?.qty ?? 0);
      setQty(remaining > 0 ? String(remaining) : '');
    } catch (e) {
      setLoadErr(e?.message || 'Could not load this order.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const fail = (field, msg) => { setErrField(field); setError(msg); };
  const clear = () => { if (error) { setError(''); setErrField(''); } };

  /* ── Derived numbers ── */
  const ordered    = Number(order?.qty) || 0;
  const dispatched = Number(order?.dispatched_qty) || 0;
  const remaining  = Math.max(0, round2(ordered - dispatched));
  const rate       = Number(order?.rate) || 0;
  const gstPct     = Number(order?.gst_percent);
  const gstUsed    = Number.isNaN(gstPct) ? 18 : gstPct;

  const packQty  = parseFloat(qty) || 0;
  const amount   = round2(packQty * rate);
  const gstAmt   = round2(amount * gstUsed / 100);
  const total    = round2(amount + gstAmt);
  const overQty  = packQty > remaining;

  const setQuickQty = (value) => { clear(); setQty(String(round2(value))); };

  const submit = async () => {
    if (!(packQty > 0))            { fail('qty', 'Enter how much you are sending'); return; }
    if (overQty)                   { fail('qty', `Only ${remaining} ${order?.unit || ''} left to send`.trim()); return; }
    if (!vehicle.trim())           { fail('vehicle', 'Vehicle number is required'); return; }
    if (!driver.trim())            { fail('driver', 'Driver name is required'); return; }
    if (!/^\d{10}$/.test(mobile.trim())) { fail('mobile', 'Enter a 10-digit driver mobile number'); return; }
    if (dispatchDate && !DATE_RE.test(dispatchDate)) { fail('dispatchDate', 'Use YYYY-MM-DD'); return; }
    if (expectedDays && !/^\d+$/.test(expectedDays.trim())) { fail('expectedDays', 'Enter a number of days'); return; }

    setSaving(true);
    try {
      const res  = await erpApi.packOrder(orderId, {
        pack_qty:       packQty,
        vehicle_number: vehicle.trim().toUpperCase(),
        driver_name:    driver.trim(),
        driver_mobile:  mobile.trim(),
        transport_name: transport.trim(),
        lr_number:      lr.trim(),
        dispatch_date:  dispatchDate || todayIso(),
        ...(expectedDays ? { expected_delivery_days: Number(expectedDays) } : {}),
      });
      const data     = res?.data ?? res;
      const invoice  = data?.invoice;
      const dispatch = data?.dispatch;
      const left     = Math.max(0, round2(remaining - packQty));

      Alert.alert(
        'Dispatch created',
        [
          `${packQty} ${order?.unit || ''} sent.`.trim(),
          invoice?.invoice_no ? `Invoice ${invoice.invoice_no} raised automatically.` : null,
          dispatch?.dispatch_code ? `Dispatch ${dispatch.dispatch_code}.` : null,
          left > 0 ? `${left} ${order?.unit || ''} still pending — open this order again to send it.` : 'Order fully dispatched.',
        ].filter(Boolean).join('\n'),
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      Alert.alert('Could not create dispatch', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <ErpHeader
      title="Pack & Dispatch"
      subtitle={order?.order_code ? `${order.order_code} · send part or all` : 'Send part or all'}
      onBack={() => navigation.goBack()}
    />
  );

  if (loading) {
    return <SafeAreaView style={st.safe} edges={['top']}>{header}<ErpLoading label="Loading order…" /></SafeAreaView>;
  }
  if (loadErr || !order) {
    return <SafeAreaView style={st.safe} edges={['top']}>{header}<ErpError message={loadErr || 'Order not found.'} onRetry={load} /></SafeAreaView>;
  }

  const fullySent = remaining <= 0;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {header}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[st.container, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>

          {/* ── The order ── */}
          <ErpCard>
            <ErpSectionLabel>ORDER</ErpSectionLabel>
            <ErpInfoRow label="Customer"  value={order.customer_name || '—'} bold />
            <ErpInfoRow label="Product"   value={order.product_name || '—'} />
            {order.product_code ? <ErpInfoRow label="Code" value={order.product_code} /> : null}
            <ErpInfoRow label="Ordered"   value={`${ordered} ${order.unit || ''}`.trim()} />
            <ErpInfoRow label="Already sent" value={`${dispatched} ${order.unit || ''}`.trim()} />
            <ErpInfoRow
              label="Still to send"
              value={`${remaining} ${order.unit || ''}`.trim()}
              bold
              color={remaining > 0 ? Colors.primary : '#10B981'}
              last
            />
            <PackProgress ordered={ordered} dispatched={dispatched} />
          </ErpCard>

          {fullySent ? (
            <ErpCard style={st.doneCard}>
              <Ionicons name="checkmark-circle" size={22} color="#10B981" />
              <Text style={st.doneText}>This order is fully dispatched. Nothing left to send.</Text>
            </ErpCard>
          ) : (
            <>
              {/* ── How much are you sending ── */}
              <ErpCard>
                <ErpSectionLabel>HOW MUCH ARE YOU SENDING?</ErpSectionLabel>

                <ErpField label={`Quantity to send (of ${remaining} ${order.unit || ''})`.trim()} required error={errField === 'qty' ? error : ''}>
                  <ErpInput
                    value={qty}
                    onChangeText={(v) => { clear(); setQty(numOnly(v)); }}
                    keyboardType="decimal-pad"
                    placeholder="0"
                  />
                </ErpField>

                <View style={st.quickRow}>
                  <TouchableOpacity style={st.quickChip} onPress={() => setQuickQty(remaining)} activeOpacity={0.8}>
                    <Text style={st.quickChipText}>Send all {remaining}</Text>
                  </TouchableOpacity>
                  {remaining > 1 ? (
                    <TouchableOpacity style={st.quickChip} onPress={() => setQuickQty(remaining / 2)} activeOpacity={0.8}>
                      <Text style={st.quickChipText}>Half {round2(remaining / 2)}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {overQty ? (
                  <Text style={st.warnText}>
                    Only {remaining} {order.unit || ''} left on this order.
                  </Text>
                ) : packQty > 0 && packQty < remaining ? (
                  <Text style={st.partialNote}>
                    Partial dispatch — {round2(remaining - packQty)} {order.unit || ''} will stay pending
                    and can be sent later from this same screen.
                  </Text>
                ) : null}
              </ErpCard>

              {/* ── Vehicle / transport ── */}
              <ErpCard>
                <ErpSectionLabel>VEHICLE &amp; TRANSPORT</ErpSectionLabel>

                <ErpField label="Vehicle number" required error={errField === 'vehicle' ? error : ''}>
                  <ErpInput value={vehicle} onChangeText={(v) => { clear(); setVehicle(v); }} placeholder="e.g. MH12AB1234" autoCapitalize="characters" />
                </ErpField>

                <View style={st.row}>
                  <View style={st.col}>
                    <ErpField label="Driver name" required error={errField === 'driver' ? error : ''}>
                      <ErpInput value={driver} onChangeText={(v) => { clear(); setDriver(v); }} placeholder="Driver" />
                    </ErpField>
                  </View>
                  <View style={st.col}>
                    <ErpField label="Driver mobile" required error={errField === 'mobile' ? error : ''}>
                      <ErpInput value={mobile} onChangeText={(v) => { clear(); setMobile(numOnly(v)); }} keyboardType="number-pad" maxLength={10} placeholder="10-digit" />
                    </ErpField>
                  </View>
                </View>

                <ErpField label="Transport name">
                  <ErpInput value={transport} onChangeText={(v) => { clear(); setTransport(v); }} placeholder="Transporter / lorry agency" />
                </ErpField>

                <ErpField label="LR number">
                  <ErpInput value={lr} onChangeText={(v) => { clear(); setLr(v); }} placeholder="Lorry receipt no." />
                </ErpField>

                <View style={st.row}>
                  <View style={st.col}>
                    <ErpField label="Dispatch date" error={errField === 'dispatchDate' ? error : ''}>
                      <ErpInput value={dispatchDate} onChangeText={(v) => { clear(); setDispatchDate(v); }} placeholder="YYYY-MM-DD" />
                    </ErpField>
                  </View>
                  <View style={st.col}>
                    <ErpField label="Delivery in (days)" error={errField === 'expectedDays' ? error : ''}>
                      <ErpInput value={expectedDays} onChangeText={(v) => { clear(); setExpectedDays(numOnly(v)); }} keyboardType="number-pad" placeholder="e.g. 3" />
                    </ErpField>
                  </View>
                </View>
              </ErpCard>

              {/* ── Auto-invoice preview ── */}
              <View style={st.summary}>
                <Text style={st.summaryTitle}>INVOICE WILL BE CREATED AUTOMATICALLY</Text>
                <View style={st.sumRow}>
                  <Text style={st.sumLabel}>Quantity</Text>
                  <Text style={st.sumValue}>{packQty} {order.unit || ''}</Text>
                </View>
                <View style={st.sumRow}>
                  <Text style={st.sumLabel}>Rate</Text>
                  <Text style={st.sumValue}>{formatCurrency(rate)}</Text>
                </View>
                <View style={st.sumRow}>
                  <Text style={st.sumLabel}>Amount</Text>
                  <Text style={st.sumValue}>{formatCurrency(amount)}</Text>
                </View>
                <View style={st.sumRow}>
                  <Text style={st.sumLabel}>GST ({gstUsed}%)</Text>
                  <Text style={st.sumValue}>{formatCurrency(gstAmt)}</Text>
                </View>
                <View style={st.sumDivider} />
                <View style={st.sumRow}>
                  <Text style={st.sumLabelBig}>Invoice total</Text>
                  <Text style={st.sumValueBig}>{formatCurrency(total)}</Text>
                </View>
                <Text style={st.summaryNote}>
                  One invoice and one dispatch are raised for exactly this quantity. Send the rest
                  later and they get their own invoice.
                </Text>
              </View>

              <TouchableOpacity
                style={[st.saveBtn, (saving || packQty <= 0) && st.saveBtnOff]}
                onPress={submit}
                disabled={saving || packQty <= 0}
                activeOpacity={0.85}>
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="cube-outline" size={18} color="#FFF" />
                    <Text style={st.saveBtnText}>Create Dispatch &amp; Invoice</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  container: { padding: 16 },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },

  /* Progress */
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  progressTrack: {
    flex: 1, height: 8, borderRadius: 4, backgroundColor: '#E7EAF0', overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 4 },
  progressText: { fontSize: 11.5, fontWeight: '700', color: ERP.muted, minWidth: 62, textAlign: 'right' },

  /* Quick quantity chips */
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  quickChip: {
    backgroundColor: Colors.primaryBg, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.primary,
  },
  quickChipText: { fontSize: 12.5, fontWeight: '700', color: Colors.primary },

  warnText: { fontSize: 12, color: '#B91C1C', marginTop: 8, fontWeight: '600' },
  partialNote: { fontSize: 12, color: Colors.textSecondary, marginTop: 8, lineHeight: 18 },

  /* Fully dispatched state */
  doneCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doneText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },

  /* Invoice preview — dark navy card, orange total (matches PurchaseEntry) */
  summary: { backgroundColor: Colors.secondary, borderRadius: 14, padding: 18, marginBottom: 16 },
  summaryTitle: {
    fontSize: 10.5, fontWeight: '800', color: '#FDBA74',
    letterSpacing: 0.6, marginBottom: 12,
  },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  sumLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  sumValue: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  sumDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 8 },
  sumLabelBig: { fontSize: 15, color: '#FFF', fontWeight: '800' },
  sumValueBig: { fontSize: 20, fontWeight: '900', color: '#FDBA74' },
  summaryNote: { fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 17, marginTop: 12 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
    ...Shadows.sm,
  },
  saveBtnOff: { opacity: 0.55 },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
