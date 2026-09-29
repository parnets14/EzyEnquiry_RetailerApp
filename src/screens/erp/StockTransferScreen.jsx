/**
 * src/screens/erp/StockTransferScreen.jsx  (Retailer app)
 *
 * Warehouse-to-warehouse stock transfers.
 *   GET   /api/retailer/erp/stock-transfers             (listStockTransfers)
 *   POST  /api/retailer/erp/stock-transfers             (createStockTransfer)
 *   PATCH /api/retailer/erp/stock-transfers/:id/status  (updateTransferStatus)
 *
 * Create body → { from_warehouse, to_warehouse, product_id, quantity, notes }
 * Status enum → Pending | In Transit | Completed | Cancelled
 *
 * Structure matches the wholesaler (`inventory/StockTransferScreen.jsx`) exactly:
 * FORM-FIRST, single scroll view —
 *   [ Product picker              ]
 *   [ From → To row               ]
 *   [ Quantity + Note             ]
 *   [ Transfer Stock  (button)    ]
 *   [ Recent Transfers + log rows ]
 * No summary strip, no status tabs, no FAB, no create modal.
 *
 * The backend moves stock at CREATE time (deducts source, credits destination)
 * and reverses it if the transfer is later CANCELLED — the status is a real
 * state transition. The wholesaler never surfaces that transition in its UI, so
 * neither do we: the log below is read-only, exactly like the wholesaler's.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { erpApi, myProductApi } from '../../utils/api';
import {
  ErpHeader, ErpCard, ErpSectionLabel, ErpField, ErpInput, ErpPicker,
  ErpLoading, ErpPrimaryAction, ErpBadge, ERP,
} from '../../components/erp';

const STATUS_META = {
  Pending:      { color: '#D97706', bg: '#FFFBEB' },
  'In Transit': { color: '#2563EB', bg: '#EFF6FF' },
  Completed:    { color: '#059669', bg: '#ECFDF5' },
  Cancelled:    { color: '#DC2626', bg: '#FEF2F2' },
};

const numOnly = v => String(v ?? '').replace(/[^0-9.]/g, '');

export default function StockTransferScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const preset = route?.params?.product || null;

  const [product, setProduct] = useState(preset || null);
  const [from,    setFrom]    = useState(null);
  const [to,      setTo]      = useState(null);
  const [qty,     setQty]     = useState('');
  const [note,    setNote]    = useState('');
  const [saving,  setSaving]  = useState(false);

  const [products,   setProducts]   = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');

  // 'product' | 'from' | 'to' | null
  const [picker, setPicker] = useState(null);

  const [transfers,  setTransfers]  = useState([]);
  const [loadingLog, setLoadingLog] = useState(true);

  /* ── Load warehouses once ─────────────────────────────────────────────── */
  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      myProductApi.list({ limit: 300 }),
      erpApi.listWarehouses(),
    ]).then(([pR, wR]) => {
      if (!alive) return;
      if (pR.status === 'fulfilled') {
        const d = pR.value?.data ?? pR.value;
        setProducts(Array.isArray(d) ? d : d?.products ?? []);
      }
      if (wR.status === 'fulfilled') {
        const d = wR.value?.data ?? wR.value;
        setWarehouses(Array.isArray(d) ? d : d?.warehouses ?? []);
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  /* ── Recent transfer log (matches the wholesaler's short inline log) ──── */
  const loadLog = useCallback(async () => {
    setLoadingLog(true);
    try {
      const res = await erpApi.listTransfers({ limit: 20 });
      const data = res?.data ?? res;
      setTransfers(Array.isArray(data?.transfers) ? data.transfers : []);
    } catch {
      setTransfers([]);
    } finally {
      setLoadingLog(false);
    }
  }, []);
  useEffect(() => { loadLog(); }, [loadLog]);

  const submit = async () => {
    if (!product?._id) { Alert.alert('Product', 'Please choose a product.'); return; }
    if (!from?._id)    { Alert.alert('Source', 'Select the source warehouse.'); return; }
    if (!to?._id)      { Alert.alert('Destination', 'Select the destination warehouse.'); return; }
    if (from._id === to._id) { Alert.alert('Warehouses', 'Source and destination must differ.'); return; }
    const q = parseFloat(qty);
    if (!q || q <= 0)  { Alert.alert('Quantity', 'Enter a valid quantity.'); return; }

    setSaving(true);
    try {
      await erpApi.createTransfer({
        from_warehouse: from._id,
        to_warehouse:   to._id,
        product_id:     product._id,
        quantity:       q,
        notes:          note.trim(),
      });
      Alert.alert('Success', 'Stock transfer created.', [
        { text: 'OK', onPress: () => { setQty(''); setNote(''); loadLog(); } },
      ]);
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Could not create transfer.');
    } finally {
      setSaving(false);
    }
  };

  const pickerTitle = picker === 'product'
    ? 'Select Product'
    : picker === 'from' ? 'Source Warehouse' : 'Destination Warehouse';

  const onPick = (opt) => {
    if (picker === 'product') setProduct({ _id: opt._id, name: opt.name, code: opt.code, unit: opt.unit });
    else if (picker === 'from') setFrom({ _id: opt._id, name: opt.name });
    else if (picker === 'to')   setTo({ _id: opt._id, name: opt.name });
    setPicker(null);
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <KeyboardAvoidingView style={st.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ErpHeader
          title="Stock Transfer"
          subtitle="Warehouse to warehouse"
          onBack={() => navigation.goBack()}
        />

        {loading ? <ErpLoading label="Loading…" /> : (
          <ScrollView
            contentContainerStyle={[st.container, { paddingBottom: insets.bottom + 32 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {/* ── Transfer form ── */}
            <ErpCard>
              <ErpSectionLabel>Product</ErpSectionLabel>
              <ErpField label="Product" required>
                <ErpPicker
                  value={product ? `${product.name}${product.code ? ` (${product.code})` : ''}` : ''}
                  onPress={() => setPicker('product')}
                  placeholder="Select a product"
                />
              </ErpField>

              {/* From → To side by side with an arrow between */}
              <View style={st.whRow}>
                <View style={st.whCol}>
                  <ErpField label="From" required>
                    <ErpPicker value={from?.name} onPress={() => setPicker('from')} placeholder="Source" />
                  </ErpField>
                </View>
                <View style={st.arrowWrap}>
                  <Ionicons name="arrow-forward" size={18} color={Colors.primary} />
                </View>
                <View style={st.whCol}>
                  <ErpField label="To" required>
                    <ErpPicker value={to?.name} onPress={() => setPicker('to')} placeholder="Destination" />
                  </ErpField>
                </View>
              </View>

              <ErpField label="Quantity" required>
                <ErpInput
                  value={qty}
                  onChangeText={v => setQty(numOnly(v))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                />
              </ErpField>

              <ErpField label="Note (optional)">
                <ErpInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="e.g. Rebalancing stock"
                />
              </ErpField>
            </ErpCard>

            {/* Same guard the create modal had: a transfer needs two warehouses. */}
            {warehouses.length < 2 ? (
              <View style={st.warnBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#D97706" />
                <Text style={st.warnTxt}>
                  You need at least two warehouses to transfer stock. Create another from the Inventory screen.
                </Text>
              </View>
            ) : null}

            <View style={st.btnWrap}>
              <ErpPrimaryAction
                label={saving ? 'Transferring…' : 'Transfer Stock'}
                icon="git-compare-outline"
                onPress={submit}
                disabled={saving || warehouses.length < 2}
              />
            </View>

            {/* ── Recent Transfers (read-only log) ── */}
            <Text style={st.logTitle}>Recent Transfers</Text>
            {loadingLog ? (
              <ActivityIndicator color={Colors.primary} style={st.logSpin} />
            ) : transfers.length === 0 ? (
              <Text style={st.logEmpty}>No transfers yet.</Text>
            ) : (
              transfers.map(t => {
                const meta = STATUS_META[t.status] || STATUS_META.Pending;
                return (
                  <View key={t._id} style={st.logRow}>
                    <View style={st.logBody}>
                      <Text style={st.logProduct} numberOfLines={1}>{t.product_name || 'Product'}</Text>
                      <Text style={st.logRoute} numberOfLines={1}>
                        {t.from_warehouse_name || 'Source'} → {t.to_warehouse_name || 'Dest'}
                      </Text>
                    </View>
                    <View style={st.logRight}>
                      <Text style={st.logQty}>{t.quantity}</Text>
                      <ErpBadge label={t.status} {...meta} />
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {/* ── Picker sheet (product / warehouse) ── */}
        <Modal visible={!!picker} animationType="slide" transparent onRequestClose={() => setPicker(null)}>
          <View style={st.backdrop}>
            <View style={[st.sheet, { paddingBottom: insets.bottom + 14 }]}>
              <View style={st.sheetHead}>
                <Text style={st.sheetTitle}>{pickerTitle}</Text>
                <TouchableOpacity onPress={() => setPicker(null)}>
                  <Ionicons name="close" size={22} color={ERP.muted} />
                </TouchableOpacity>
              </View>

              {picker === 'product' ? (
                <View style={st.searchWrap}>
                  <Ionicons name="search" size={17} color={ERP.muted} />
                  <TextInput
                    style={st.searchInput}
                    placeholder="Search…"
                    placeholderTextColor={ERP.faint}
                    value={search}
                    onChangeText={t => setSearch(t)}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              ) : null}

              <FlatList
                data={visiblePickerData(picker, products, warehouses, search)}
                keyExtractor={(o, i) => String(o._id || i)}
                keyboardShouldPersistTaps="handled"
                style={st.sheetList}
                renderItem={({ item }) => (
                  <TouchableOpacity style={st.option} onPress={() => onPick(item)} activeOpacity={0.8}>
                    <View style={st.flex}>
                      <Text style={st.optionTxt} numberOfLines={1}>{item.name}</Text>
                      {item.code || item.city ? (
                        <Text style={st.optionSub} numberOfLines={1}>
                          {[item.code, item.city].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#B0B5C3" />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={st.optEmpty}>
                    <Text style={st.optEmptyTxt}>Nothing to choose from yet.</Text>
                  </View>
                }
              />
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* Filter helper — keeps the picker list in sync with the search box. */
function visiblePickerData(picker, products, warehouses, search) {
  if (picker !== 'product') return warehouses;
  const q = (search || '').trim().toLowerCase();
  if (!q) return products;
  return products.filter(p =>
    String(p.name || '').toLowerCase().includes(q) ||
    String(p.code || '').toLowerCase().includes(q)
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  flex: { flex: 1 },
  container: { padding: 16 },
  warnBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12, marginTop: 4, marginBottom: 12,
  },
  warnTxt: { flex: 1, fontSize: 11.5, color: '#92400E', lineHeight: 16 },

  whRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  whCol: { flex: 1 },
  arrowWrap: { paddingBottom: 20 },

  btnWrap: { marginTop: 4, marginBottom: 22 },

  logTitle: { fontSize: 14, fontWeight: '800', color: ERP.text, marginBottom: 10 },
  logSpin: { marginVertical: 16 },
  logEmpty: { fontSize: 12.5, color: ERP.muted, textAlign: 'center', paddingVertical: 16 },
  logRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    borderRadius: 12, padding: 12, marginBottom: 8, ...Shadows.sm,
  },
  logBody: { flex: 1, marginRight: 10 },
  logProduct: { fontSize: 13, fontWeight: '700', color: ERP.text },
  logRoute: { fontSize: 11, color: ERP.muted, marginTop: 2 },
  logRight: { alignItems: 'flex-end', gap: 4 },
  logQty: { fontSize: 14, fontWeight: '800', color: ERP.text },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,22,40,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    maxHeight: '72%', ...Shadows.lg,
  },
  sheetHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: ERP.text },
  sheetList: { maxHeight: 380 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 12, marginHorizontal: 18, marginTop: 12, marginBottom: 4,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: ERP.text },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  optionTxt: { fontSize: 14, color: ERP.text, fontWeight: '600' },
  optionSub: { fontSize: 11, color: ERP.muted, marginTop: 2 },
  optEmpty: { padding: 28, alignItems: 'center' },
  optEmptyTxt: { fontSize: 12.5, color: ERP.muted },
});
