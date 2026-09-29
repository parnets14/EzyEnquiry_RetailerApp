/**
 * src/screens/erp/StockAdjustScreen.jsx  (Retailer app)
 *
 * Manual stock in / stock out — matches the wholesaler's
 * `inventory/StockAdjustScreen.jsx` form for form.
 * Points at PATCH /api/retailer/erp/inventory/adjust (inventoryController.adjustStock).
 *
 * Backend contract:
 *   body → { product_id, warehouse_id, adjustment (SIGNED), reason,
 *            reference_type, reference_id, purchase_rate, low_stock_alert }
 *   `adjustment` is signed: positive = stock in, negative = stock out.
 *   `reason` is free text and lands in the movement log's `notes` — the wholesaler
 *   composes it as "<ReasonCode> — <note>", which is what we do too.
 *   A stock-out larger than available_stock is rejected by the backend with a
 *   clear message — we surface that verbatim rather than guessing.
 *
 * MODE-DEPENDENT FIELDS (mirrors the wholesaler exactly):
 *   Stock In  → Quantity, Purchase rate (optional), Low-stock alert (optional), Reason/Note
 *   Stock Out → Quantity, REASON CODE (required, chips), Note (optional)
 *   The rate/alert inputs are Stock-In only — setting a purchase rate while dumping
 *   damaged stock makes no sense, and the wholesaler hides them there.
 *
 * Reachable as:
 *   navigation.navigate(SCREENS.STOCK_ADJUST)               → blank form
 *   navigation.navigate(SCREENS.STOCK_ADJUST, { item })     → preselected row
 *   navigation.navigate(SCREENS.STOCK_ADJUST, { mode:'in' })→ stock-in preset
 */
import React, { useEffect, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { erpApi, myProductApi } from '../../utils/api';
import {
  ErpHeader, ErpCard, ErpSectionLabel, ErpField, ErpInput, ErpPicker,
  ErpPrimaryAction, ErpLoading, ERP,
} from '../../components/erp';

/* Structured reason codes for a Stock Out — the wholesaler's exact list.
   A Stock Out MUST carry one of these (the note is optional extra detail). */
const OUT_REASONS = ['Damage', 'Breakage', 'Audit Correction', 'Return', 'Lost', 'Other'];

const numOnly = v => String(v ?? '').replace(/[^0-9.]/g, '');

export default function StockAdjustScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const preset = route?.params?.item || null;

  const [mode, setMode]         = useState(route?.params?.mode === 'out' ? 'out' : 'in');
  const [product, setProduct]   = useState(
    preset ? { _id: preset.product_id?._id || preset.product_id, name: preset.product_name, unit: preset.unit } : null,
  );
  const [warehouse, setWarehouse] = useState(
    preset?.warehouse_id ? { _id: preset.warehouse_id?._id || preset.warehouse_id, name: preset.warehouse_name } : null,
  );
  const [qty, setQty]           = useState('');
  const [reasonCode, setReasonCode] = useState('');   // Stock Out only — required
  const [reason, setReason]     = useState('');        // free-text note (both modes)
  const [rate, setRate]         = useState(preset?.purchase_rate ? String(preset.purchase_rate) : '');
  const [alertAt, setAlertAt]   = useState(preset?.low_stock_alert ? String(preset.low_stock_alert) : '');

  const [products, setProducts]   = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loadingOpts, setLoadingOpts] = useState(true);
  const [picker, setPicker]     = useState(null); // 'product' | 'warehouse'
  const [saving, setSaving]     = useState(false);
  const [errors, setErrors]     = useState({});

  const isIn = mode === 'in';

  useEffect(() => {
    setLoadingOpts(true);
    Promise.allSettled([
      myProductApi.list({ limit: 300 }),
      erpApi.listWarehouses(),
    ]).then(([pR, wR]) => {
      if (pR.status === 'fulfilled') {
        const d = pR.value?.data ?? pR.value;
        setProducts(Array.isArray(d) ? d : d?.products ?? []);
      }
      if (wR.status === 'fulfilled') {
        const d = wR.value?.data ?? wR.value;
        setWarehouses(Array.isArray(d) ? d : d?.warehouses ?? []);
      }
      setLoadingOpts(false);
    });
  }, []);

  const available = preset?.available_stock ?? preset?.current_stock ?? null;

  /* Switching mode clears a reason code that no longer applies. */
  const switchMode = (m) => {
    setMode(m);
    setErrors({});
    if (m === 'in') setReasonCode('');
  };

  const validate = () => {
    const e = {};
    if (!product?._id) e.product = 'Select a product';
    if (!qty || Number(qty) <= 0) e.qty = 'Enter a quantity greater than 0';
    if (mode === 'out' && available != null && Number(qty) > available) {
      e.qty = `Only ${available} available`;
    }
    // Stock Out must say WHY — same rule as the wholesaler.
    if (mode === 'out' && !reasonCode) e.reasonCode = 'Select a reason for removing stock';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const signed = isIn ? Number(qty) : -Number(qty);

      /* Compose the same way the wholesaler does: "<code> — <note>" for Stock Out,
         the note alone (or a default) for Stock In. */
      const composedReason = isIn
        ? (reason.trim() || 'Stock In')
        : ([reasonCode, reason.trim()].filter(Boolean).join(' — '));

      await erpApi.adjustStock({
        product_id:       product._id,
        warehouse_id:     warehouse?._id || null,
        adjustment:       signed,
        reason:           composedReason,
        reference_type:   'manual',
        // Rate / threshold are Stock-In concerns only (wholesaler behaviour).
        ...(isIn && rate    ? { purchase_rate:   Number(rate) }    : {}),
        ...(isIn && alertAt ? { low_stock_alert: Number(alertAt) } : {}),
      });
      Alert.alert(
        'Stock updated',
        `${isIn ? 'Added' : 'Removed'} ${qty} ${product.unit || 'units'} · ${product.name}`,
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      Alert.alert('Could not adjust stock', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const options = picker === 'product' ? products : warehouses;

  const pickerTitle = picker === 'product' ? 'Select product' : 'Select warehouse';

  const onPick = (opt) => {
    if (picker === 'product')   { setProduct({ _id: opt._id, name: opt.name, unit: opt.unit }); setErrors(p => ({ ...p, product: '' })); }
    if (picker === 'warehouse') setWarehouse({ _id: opt._id, name: opt.name });
    setPicker(null);
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader
        title="Stock Adjustment"
        subtitle="Stock in / stock out"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[st.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Direction toggle ── */}
          <View style={st.toggle}>
            <TouchableOpacity
              style={[st.toggleBtn, isIn && st.toggleIn]}
              onPress={() => switchMode('in')}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-down-circle-outline" size={18} color={isIn ? '#FFF' : '#059669'} />
              <Text style={[st.toggleTxt, isIn && st.toggleTxtOn]}>Stock In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.toggleBtn, !isIn && st.toggleOut]}
              onPress={() => switchMode('out')}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-up-circle-outline" size={18} color={!isIn ? '#FFF' : '#DC2626'} />
              <Text style={[st.toggleTxt, !isIn && st.toggleTxtOn]}>Stock Out</Text>
            </TouchableOpacity>
          </View>

          {loadingOpts ? <ErpLoading label="Loading products…" /> : (
            <>
              <ErpCard>
                <ErpSectionLabel>What &amp; where</ErpSectionLabel>
                <ErpField label="Product" required error={errors.product}>
                  <ErpPicker
                    value={product?.name}
                    onPress={() => setPicker('product')}
                    placeholder="Select a product"
                    error={errors.product}
                  />
                </ErpField>
                <ErpField label="Warehouse (optional)">
                  <ErpPicker
                    value={warehouse?.name}
                    onPress={() => setPicker('warehouse')}
                    placeholder="Default / Main"
                  />
                </ErpField>
                {available != null ? (
                  <View style={st.availBox}>
                    <Ionicons name="information-circle-outline" size={15} color={Colors.primary} />
                    <Text style={st.availTxt}>
                      Currently available: <Text style={st.availVal}>{available}</Text> {product?.unit || ''}
                    </Text>
                  </View>
                ) : null}
              </ErpCard>

              <ErpCard>
                <ErpSectionLabel>Quantity</ErpSectionLabel>
                <ErpField
                  label={isIn ? 'Quantity to add' : 'Quantity to remove'}
                  required
                  error={errors.qty}
                >
                  <ErpInput
                    value={qty}
                    onChangeText={v => { setQty(numOnly(v)); if (errors.qty) setErrors(p => ({ ...p, qty: '' })); }}
                    keyboardType="decimal-pad"
                    placeholder="0"
                  />
                </ErpField>

                {/* Stock In only: purchase rate + low-stock threshold */}
                {isIn ? (
                  <View style={st.splitRow}>
                    <ErpField label="Purchase rate" half>
                      <ErpInput value={rate} onChangeText={v => setRate(numOnly(v))} keyboardType="decimal-pad" placeholder="Optional" />
                    </ErpField>
                    <ErpField label="Low-stock alert at" half>
                      <ErpInput value={alertAt} onChangeText={v => setAlertAt(numOnly(v))} keyboardType="decimal-pad" placeholder="Optional" />
                    </ErpField>
                  </View>
                ) : null}

                {/* Stock Out only: structured reason chips (required) */}
                {!isIn ? (
                  <ErpField label="Reason" required error={errors.reasonCode}>
                    <View style={st.reasonWrap}>
                      {OUT_REASONS.map(rc => {
                        const on = reasonCode === rc;
                        return (
                          <TouchableOpacity
                            key={rc}
                            style={[st.reasonChip, on && st.reasonChipOn]}
                            onPress={() => { setReasonCode(rc); if (errors.reasonCode) setErrors(p => ({ ...p, reasonCode: '' })); }}
                            activeOpacity={0.8}
                          >
                            <Text style={[st.reasonChipTxt, on && st.reasonChipTxtOn]}>{rc}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ErpField>
                ) : null}

                <ErpField label={isIn ? 'Reason / note' : 'Note (optional)'}>
                  <ErpInput
                    value={reason}
                    onChangeText={setReason}
                    placeholder={isIn ? 'e.g. New purchase' : 'Extra detail (optional)'}
                  />
                </ErpField>
              </ErpCard>

              {product && qty && Number(qty) > 0 ? (
                <ErpCard>
                  <ErpSectionLabel>Summary</ErpSectionLabel>
                  <View style={st.sumRow}>
                    <Text style={st.sumLbl}>{product.name}</Text>
                    <Text style={[st.sumVal, { color: isIn ? '#059669' : '#DC2626' }]}>
                      {isIn ? '+' : '−'}{qty} {product.unit || ''}
                    </Text>
                  </View>
                  <Text style={st.sumMeta}>
                    {[isIn ? (reason.trim() || 'Stock In') : reasonCode, warehouse?.name].filter(Boolean).join(' · ')}
                  </Text>
                  {available != null ? (
                    <Text style={st.sumAfter}>
                      New available: {isIn ? available + Number(qty) : available - Number(qty)}
                    </Text>
                  ) : null}
                </ErpCard>
              ) : null}
            </>
          )}

          {/* Kept INSIDE the ScrollView (not a pinned footer): a footer outside the
              scroll view gets no bottom inset and is clipped by the home indicator /
              Android nav bar, and it fights KeyboardAvoidingView. Same fix as
              ExpenseEntryScreen — pad via insets.bottom on the content container. */}
          <ErpPrimaryAction
            label={saving ? 'Saving…' : isIn ? 'Add stock' : 'Remove stock'}
            icon={isIn ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
            onPress={save}
            disabled={saving || loadingOpts}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Generic option picker (product / warehouse) ── */}
      <Modal visible={!!picker} animationType="slide" transparent onRequestClose={() => setPicker(null)}>
        <View style={st.backdrop}>
          <View style={[st.sheet, { paddingBottom: insets.bottom + 14 }]}>
            <View style={st.sheetHead}>
              <Text style={st.sheetTitle}>{pickerTitle}</Text>
              <TouchableOpacity onPress={() => setPicker(null)}>
                <Ionicons name="close" size={22} color={ERP.muted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(o, i) => String(o._id || i)}
              renderItem={({ item }) => (
                <TouchableOpacity style={st.option} onPress={() => onPick(item)} activeOpacity={0.8}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.optionTxt} numberOfLines={1}>{item.name}</Text>
                    {picker === 'product' && (item.code || item.unit) ? (
                      <Text style={st.optionSub} numberOfLines={1}>
                        {[item.code, item.unit].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                    {picker === 'warehouse' && item.city ? (
                      <Text style={st.optionSub} numberOfLines={1}>{item.city}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#B0B5C3" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={st.optEmpty}>
                  <Text style={st.optEmptyTxt}>
                    {picker === 'product'
                      ? 'No products yet. Add a product first.'
                      : 'No warehouses yet. Create one from the Inventory screen.'}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  content: { padding: 16, paddingBottom: 24 },

  toggle: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: '#FFF', borderRadius: 13, paddingVertical: 13,
    borderWidth: 1.5, borderColor: Colors.border, ...Shadows.sm,
  },
  toggleIn:  { backgroundColor: '#059669', borderColor: '#059669' },
  toggleOut: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  toggleTxt: { fontSize: 13.5, fontWeight: '800', color: ERP.text },
  toggleTxtOn: { color: '#FFF' },

  availBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryBg, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9,
  },
  availTxt: { fontSize: 12, color: ERP.text },
  availVal: { fontWeight: '800', color: Colors.primary },

  splitRow: { flexDirection: 'row', justifyContent: 'space-between' },

  /* Stock Out reason chips — mirrors the wholesaler's reasonWrap */
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: {
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18,
    backgroundColor: '#FFF', borderWidth: 1, borderColor: Colors.border,
  },
  reasonChipOn: { backgroundColor: '#FEF2F2', borderColor: '#DC2626' },
  reasonChipTxt: { fontSize: 12.5, fontWeight: '600', color: ERP.muted },
  reasonChipTxtOn: { color: '#DC2626', fontWeight: '800' },

  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sumLbl: { fontSize: 13.5, fontWeight: '700', color: ERP.text, flex: 1, marginRight: 10 },
  sumVal: { fontSize: 17, fontWeight: '800' },
  sumMeta: { fontSize: 11.5, color: ERP.muted, marginTop: 5 },
  sumAfter: { fontSize: 12, fontWeight: '700', color: ERP.text, marginTop: 7 },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,22,40,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '70%', paddingBottom: 14, ...Shadows.lg },
  sheetHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: ERP.text },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  optionTxt: { fontSize: 14, color: ERP.text, fontWeight: '600' },
  optionSub: { fontSize: 11, color: ERP.muted, marginTop: 2 },
  optEmpty: { padding: 28, alignItems: 'center' },
  optEmptyTxt: { fontSize: 12.5, color: ERP.muted, textAlign: 'center' },
});
