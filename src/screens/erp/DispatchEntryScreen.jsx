/**
 * src/screens/erp/DispatchEntryScreen.jsx  (Retailer app)
 *
 * Raise a dispatch against one of the retailer's own orders.
 *
 *   GET  /api/retailer/erp/dispatches/dispatchable-orders   order picker source
 *   POST /api/retailer/erp/dispatches                       createDispatch
 *
 * ── FIELD NAMES (this is where the wholesaler app is wrong) ──────────────────
 * The Dispatch schema uses `vehicle_number`, `lr_number` and `expected_delivery`.
 * The wholesaler's DispatchEntryScreen posts `vehicle_no`, `lr_no` and
 * `expected_delivery_date` instead; `createDispatch` spreads `req.body` into
 * `Dispatch.create`, and Mongoose drops keys that are not on the schema — so
 * those three fields are silently discarded there. This screen sends the
 * schema-correct names.
 *
 * ── WHY THERE IS AN ORDER PICKER ─────────────────────────────────────────────
 * `createDispatch` requires a valid `order_id` and rejects the call otherwise
 * ("order_id is required"). The wholesaler's FAB navigates to its entry screen
 * with no params, so that path always fails. Here the order is chosen
 * explicitly from the list of orders that are both dispatchable and not yet
 * dispatched.
 *
 * No date-picker dependency exists in this app, so dates are YYYY-MM-DD text
 * fields — the same convention as ExpenseEntryScreen and PurchaseEntryScreen.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { erpApi } from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  ErpHeader, ErpCard, ErpSectionLabel, ErpField, ErpInput, ErpPicker,
  ErpLoading, ErpError, ErpEmpty, ErpPrimaryAction, ERP,
} from '../../components/erp';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date().toISOString().slice(0, 10);

export default function DispatchEntryScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const presetOrderId = route?.params?.orderId || '';

  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loadErr,  setLoadErr]  = useState('');
  const [picking,  setPicking]  = useState(false);

  const [orderId,  setOrderId]  = useState(presetOrderId);
  const [vehicle,  setVehicle]  = useState('');
  const [transport,setTransport]= useState('');
  const [lr,       setLr]       = useState('');
  const [driver,   setDriver]   = useState('');
  const [mobile,   setMobile]   = useState('');
  const [dispatchDate, setDispatchDate] = useState(today());
  const [expected, setExpected] = useState('');

  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [errField, setErrField] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true); setLoadErr('');
    try {
      const res  = await erpApi.dispatchableOrders();
      const data = res?.data ?? res;
      const list = Array.isArray(data) ? data : data?.orders ?? [];
      setOrders(list);
      // Keep the preset only if it is actually dispatchable.
      if (presetOrderId && !list.some(o => o._id === presetOrderId)) setOrderId('');
    } catch (e) {
      setLoadErr(e?.message || 'Could not load your orders.');
    } finally {
      setLoading(false);
    }
  }, [presetOrderId]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const selected = orders.find(o => o._id === orderId) || null;

  const fail = (field, msg) => { setErrField(field); setError(msg); };
  const clear = () => { if (error) { setError(''); setErrField(''); } };

  const save = async () => {
    if (!orderId)          { fail('order',   'Select the order this dispatch is for'); return; }
    if (!vehicle.trim())   { fail('vehicle', 'Vehicle number is required'); return; }
    if (!transport.trim()) { fail('transport','Transport name is required'); return; }
    if (!lr.trim())        { fail('lr',      'LR number is required'); return; }
    if (!driver.trim())    { fail('driver',  'Driver name is required'); return; }
    if (!/^\d{10}$/.test(mobile.trim())) { fail('mobile', 'Enter a 10-digit driver mobile number'); return; }
    if (dispatchDate && !DATE_RE.test(dispatchDate)) { fail('dispatchDate', 'Use YYYY-MM-DD'); return; }
    if (expected && !DATE_RE.test(expected))         { fail('expected',     'Use YYYY-MM-DD'); return; }

    setSaving(true);
    try {
      // Schema-correct keys — see the file header note.
      await erpApi.createDispatch({
        order_id:       orderId,
        vehicle_number: vehicle.trim().toUpperCase(),
        transport_name: transport.trim(),
        lr_number:      lr.trim(),
        driver_name:    driver.trim(),
        driver_mobile:  mobile.trim(),
        dispatch_date:  dispatchDate || today(),
        ...(expected ? { expected_delivery: expected } : {}),
      });
      Alert.alert('Dispatch created', 'Physical stock has been reduced for this order.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Could not create dispatch', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader
        title="New Dispatch"
        subtitle="Send out one of your orders"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {loading ? (
          <ErpLoading label="Loading your orders…" />
        ) : loadErr ? (
          <ErpError message={loadErr} onRetry={loadOrders} />
        ) : (
          <ScrollView contentContainerStyle={[st.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <ErpCard>
              <ErpSectionLabel>Order</ErpSectionLabel>
              <ErpField label="Order" required error={errField === 'order' ? error : ''}>
                <ErpPicker
                  value={selected ? `${selected.order_code} · ${selected.customer_name || 'Customer'}` : ''}
                  placeholder={orders.length ? 'Select an order' : 'No dispatchable orders'}
                  onPress={() => setPicking(true)}
                  error={errField === 'order'}
                />
              </ErpField>

              {selected ? (
                <View style={st.orderPreview}>
                  <Text style={st.orderPreviewTxt} numberOfLines={2}>
                    {[selected.product_name, selected.qty ? `${selected.qty} ${selected.unit || ''}` : null]
                      .filter(Boolean).join(' · ') || 'Order details'}
                  </Text>
                  <Text style={st.orderPreviewAmt}>
                    {formatCurrency(selected.total_amount || 0)}
                    {selected.created_at ? `  ·  ${formatDate(selected.created_at)}` : ''}
                  </Text>
                </View>
              ) : null}

              {!orders.length ? (
                <Text style={st.hint}>
                  You have no orders ready to dispatch. An order must be in an
                  Accepted/Packing state and must not already have a dispatch.
                </Text>
              ) : null}
            </ErpCard>

            <ErpCard>
              <ErpSectionLabel>Vehicle &amp; transport</ErpSectionLabel>
              <ErpField label="Vehicle number" required error={errField === 'vehicle' ? error : ''}>
                <ErpInput
                  value={vehicle}
                  onChangeText={t => { setVehicle(t); clear(); }}
                  placeholder="e.g. GJ05AB1234"
                  autoCapitalize="characters"
                />
              </ErpField>
              <ErpField label="Transport name" required error={errField === 'transport' ? error : ''}>
                <ErpInput
                  value={transport}
                  onChangeText={t => { setTransport(t); clear(); }}
                  placeholder="Transport company"
                />
              </ErpField>
              <ErpField label="LR number" required error={errField === 'lr' ? error : ''}>
                <ErpInput
                  value={lr}
                  onChangeText={t => { setLr(t); clear(); }}
                  placeholder="Lorry receipt number"
                />
              </ErpField>
            </ErpCard>

            <ErpCard>
              <ErpSectionLabel>Driver</ErpSectionLabel>
              <ErpField label="Driver name" required error={errField === 'driver' ? error : ''}>
                <ErpInput value={driver} onChangeText={t => { setDriver(t); clear(); }} placeholder="Full name" />
              </ErpField>
              <ErpField label="Driver mobile" required error={errField === 'mobile' ? error : ''}>
                <ErpInput
                  value={mobile}
                  onChangeText={t => { setMobile(t.replace(/\D/g, '')); clear(); }}
                  placeholder="10-digit mobile"
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </ErpField>
            </ErpCard>

            <ErpCard>
              <ErpSectionLabel>Dates</ErpSectionLabel>
              <ErpField label="Dispatch date" error={errField === 'dispatchDate' ? error : ''}>
                <ErpInput
                  value={dispatchDate}
                  onChangeText={t => { setDispatchDate(t); clear(); }}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numbers-and-punctuation"
                />
              </ErpField>
              <ErpField label="Expected delivery" error={errField === 'expected' ? error : ''}>
                <ErpInput
                  value={expected}
                  onChangeText={t => { setExpected(t); clear(); }}
                  placeholder="YYYY-MM-DD (optional)"
                  keyboardType="numbers-and-punctuation"
                />
              </ErpField>
            </ErpCard>

            <ErpPrimaryAction
              label={saving ? 'Saving…' : 'Create Dispatch'}
              icon="checkmark-circle-outline"
              onPress={save}
              disabled={saving}
            />
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* ── Order picker ─────────────────────────────────────────────────── */}
      <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
        <SafeAreaView style={st.safe} edges={['top']}>
          <ErpHeader title="Select Order" subtitle={`${orders.length} dispatchable`} onBack={() => setPicking(false)} />
          <FlatList
            data={orders}
            keyExtractor={i => i._id}
            contentContainerStyle={st.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <ErpEmpty
                icon="cube-outline"
                title="No dispatchable orders"
                subtitle="Orders appear here once they are accepted or packing and have no dispatch yet."
              />
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={st.pickRow}
                activeOpacity={0.85}
                onPress={() => { setOrderId(item._id); clear(); setPicking(false); }}>
                <View style={{ flex: 1 }}>
                  <Text style={st.pickTitle} numberOfLines={1}>{item.order_code}</Text>
                  <Text style={st.pickSub} numberOfLines={1}>
                    {[item.customer_name, item.product_name].filter(Boolean).join(' · ') || '—'}
                  </Text>
                  <Text style={st.pickMeta} numberOfLines={1}>
                    {[item.qty ? `${item.qty} ${item.unit || ''}` : null, item.status, formatCurrency(item.total_amount || 0)]
                      .filter(Boolean).join('  ·  ')}
                  </Text>
                </View>
                {item._id === orderId ? (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                ) : (
                  <Ionicons name="chevron-forward" size={16} color="#B0B5C3" />
                )}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  content: { padding: 14, paddingBottom: 40 },
  list: { padding: 14 },

  orderPreview: {
    backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, marginTop: -2,
  },
  orderPreviewTxt: { fontSize: 12.5, fontWeight: '700', color: Colors.textPrimary },
  orderPreviewAmt: { fontSize: 11.5, color: Colors.textSecondary, marginTop: 3 },
  hint: { fontSize: 11.5, color: Colors.textSecondary, lineHeight: 17, marginTop: 6 },

  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF', borderRadius: 12, padding: 13, marginBottom: 8, ...Shadows.sm,
  },
  pickTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  pickSub:   { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  pickMeta:  { fontSize: 11, color: Colors.textTertiary, marginTop: 3 },
});
