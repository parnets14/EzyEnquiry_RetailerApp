/**
 * src/screens/erp/PurchaseEntryScreen.jsx  (Retailer app)
 *
 * "Buy Item" — record a SINGLE-product purchase into inventory.
 *   POST /api/retailer/erp/purchases   (purchaseController.createPurchase)
 *
 * Body → { supplier_name, product_id, product_code, product_name, qty, rate,
 *          gst_percent, purchase_date, notes }
 *
 * Structure matches the wholesaler (`purchase/PurchaseEntryScreen.jsx`) exactly:
 *   [ Catalog picker (accent button) + "Selected: code · name" + hint ]
 *   [ Supplier Name *                                                  ]
 *   [ Purchase Date  (full-width row) + Today button                   ]
 *   [ Quantity | Rate  (2-column row)  +  GST %                        ]
 *   [ Dark summary: Quantity / Rate / Amount / GST / Total             ]
 *   [ Confirm Purchase  (orange full-width button)                     ]
 *
 * The backend accepts either `items[]` (multi-line) or a flat `{qty, rate}` —
 * the wholesaler uses the flat form, so we do too. One product per record.
 *
 * Route params: `{ product }` is optional. The Product Details screen's "Buy Item"
 * button passes it so the product arrives pre-selected; opening this screen any
 * other way leaves the form blank.
 *
 * Note: the retailer's `myProductApi.list()` IS its catalog (the wholesaler's
 * items live in a separate admin catalog, hence its `listCatalog` call).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { erpApi, myProductApi } from '../../utils/api';
import { formatCurrency } from '../../utils/formatters';
import {
  ErpHeader, ErpCard, ErpField, ErpInput, ERP,
} from '../../components/erp';

const numOnly = v => String(v ?? '').replace(/[^0-9.]/g, '');
const todayIsoOf = () => new Date().toISOString().slice(0, 10);

/* Accepts either shape that can arrive in `route.params.product`:
 *   - a mapped marketplace product — `{ id, productCode, name, _raw }` (what the
 *     Product Details screen holds after `mapMarketplaceProduct`), or
 *   - a raw catalog row — `{ _id, code, name, purchase_price }` (what the in-screen
 *     picker holds).
 * Returns null when there is nothing usable, so the caller can no-op. */
function normalizeIncomingProduct(p) {
  if (!p) return null;
  const raw = p._raw || p;
  const id = p.id || raw._id || raw.id;
  if (!id) return null;
  return {
    id,
    code: p.productCode || raw.code || '',
    name: p.name || raw.name || '',
    gst: raw.gst_percent ?? p.gstPercent ?? 18,
    // The marketplace DTO deliberately hides seller cost, so this is usually
    // empty and the user types the rate in. Only a raw catalog row carries one.
    rate: raw.purchase_price || raw.purchase_rate || raw.cost_price || '',
  };
}

export default function PurchaseEntryScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  /* ── Catalog picker ── */
  const [pickerOpen,    setPickerOpen]    = useState(false);
  const [catalog,       setCatalog]       = useState([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [pickerSearch,  setPickerSearch]  = useState('');

  const [form, setForm] = useState({
    supplier_name: '',
    purchase_date: todayIsoOf(),
    product_id:    null,
    product_code:  '',
    product_name:  '',
    qty:           '',
    rate:          '',
    gst_percent:   '18',
    notes:         '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  /* Auto-select the product when this screen is opened from a product detail page
   * — "Buy Item" there passes `route.params.product`, so the user lands here with
   * the product already filled in instead of having to search the catalog again.
   * Opening this screen from anywhere else (e.g. the purchase list FAB) passes no
   * params and the form stays blank, exactly as before. */
  useEffect(() => {
    const incoming = normalizeIncomingProduct(route.params?.product);
    if (!incoming) return;
    setForm(f => ({
      ...f,
      product_id:   incoming.id,
      product_code: incoming.code,
      product_name: incoming.name,
      gst_percent:  String(incoming.gst ?? 18),
      rate: incoming.rate !== '' && incoming.rate != null ? String(incoming.rate) : f.rate,
    }));
  }, [route.params?.product]);

  /* Load the catalog lazily on first picker open (the wholesaler loads eagerly,
   * but the retailer's list call is heavier — same result, one less startup call). */
  const openPicker = () => {
    setPickerOpen(true);
    if (catalogLoaded) return;
    myProductApi.list({ limit: 300 })
      .then(res => {
        const d = res?.data ?? res;
        setCatalog(Array.isArray(d) ? d : d?.products ?? []);
      })
      .catch(() => setCatalog([]))
      .finally(() => setCatalogLoaded(true));
  };

  const pickProduct = (p) => {
    setForm(f => ({
      ...f,
      product_id:   p._id,
      product_code: p.code || '',
      product_name: p.name || '',
      // Purchase side → the buying price, not the selling price.
      rate:         String(p.purchase_price || p.purchase_rate || p.cost_price || ''),
      gst_percent:  String(p.gst_percent ?? 18),
    }));
    setPickerOpen(false);
    setPickerSearch('');
  };

  /* ── Live maths — must match the backend exactly:
   *    amount = qty * rate, gst = round(amount * pct / 100)                */
  const qty      = parseFloat(form.qty) || 0;
  const rate     = parseFloat(form.rate) || 0;
  const gstPct   = parseFloat(form.gst_percent);
  const amount   = +(qty * rate).toFixed(2);
  const gstAmt   = Math.round(amount * (isNaN(gstPct) ? 18 : gstPct) / 100);
  const total    = amount + gstAmt;

  const filteredCatalog = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(p =>
      (p.name || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q));
  }, [catalog, pickerSearch]);

  const handleSave = async () => {
    if (!form.product_id)           { Alert.alert('Required', 'Select a product from the catalog.'); return; }
    if (!form.supplier_name.trim()) { Alert.alert('Required', 'Enter supplier name.'); return; }
    if (qty <= 0)  { Alert.alert('Required', 'Quantity must be greater than 0.'); return; }
    if (rate <= 0) { Alert.alert('Required', 'Rate must be greater than 0.'); return; }

    setSaving(true);
    try {
      await erpApi.createPurchase({
        supplier_name: form.supplier_name.trim(),
        purchase_date: form.purchase_date || undefined,
        product_id:    form.product_id,
        product_code:  form.product_code || '',
        product_name:  form.product_name.trim(),
        qty,
        rate,
        gst_percent:   isNaN(gstPct) ? 18 : gstPct,
        notes:         form.notes.trim(),
        auto_receive:  true,   // the wholesaler always books stock in on save
      });
      Alert.alert('Success', 'Purchase recorded and stock added.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Failed', err?.message || 'Could not record purchase.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader
        title="Buy / New Purchase"
        subtitle="Purchase into inventory"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[st.container, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>

          {/* ── Product + supplier + date ── */}
          <ErpCard>
            <ErpField label="Select Product from Catalog" required>
              <TouchableOpacity style={st.pickBtn} onPress={openPicker} activeOpacity={0.8}>
                <Text
                  style={[st.pickBtnText, !form.product_name && st.pickBtnPlaceholder]}
                  numberOfLines={1}>
                  {form.product_name || 'Tap to choose a product…'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.primary} />
              </TouchableOpacity>
            </ErpField>

            {form.product_name ? (
              <Text style={st.pickSelected} numberOfLines={1}>
                Selected: {form.product_code ? `${form.product_code} · ` : ''}{form.product_name}
              </Text>
            ) : (
              <Text style={st.pickHint}>Choose a product to continue.</Text>
            )}

            <ErpField label="Supplier Name" required>
              <ErpInput
                value={form.supplier_name}
                onChangeText={v => set('supplier_name', v)}
                placeholder="Supplier / vendor name"
              />
            </ErpField>

            <ErpField label="Purchase Date">
              <View style={st.dateRow}>
                <TouchableOpacity style={st.dateInput} onPress={() => setCalendarOpen(true)} activeOpacity={0.8}>
                  <Text style={st.dateInputText}>{form.purchase_date || 'Select date'}</Text>
                  <Ionicons name="calendar-outline" size={16} color={ERP.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={st.todayBtn}
                  onPress={() => set('purchase_date', todayIsoOf())}
                  activeOpacity={0.8}>
                  <Text style={st.todayBtnText}>Today</Text>
                </TouchableOpacity>
              </View>
            </ErpField>
          </ErpCard>

          {/* ── Quantity + Rate + GST ── */}
          <ErpCard>
            <View style={st.row}>
              <View style={st.col}>
                <ErpField label="Quantity">
                  <ErpInput
                    value={form.qty}
                    onChangeText={v => set('qty', numOnly(v))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                  />
                </ErpField>
              </View>
              <View style={st.col}>
                <ErpField label="Rate">
                  <ErpInput
                    value={form.rate}
                    onChangeText={v => set('rate', numOnly(v))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                  />
                </ErpField>
              </View>
            </View>

            <ErpField label="GST %">
              <ErpInput
                value={form.gst_percent}
                onChangeText={v => set('gst_percent', numOnly(v))}
                keyboardType="decimal-pad"
                placeholder="18"
              />
            </ErpField>
          </ErpCard>

          {/* ── Live calculation summary (dark card, orange total) ── */}
          <View style={st.summary}>
            <Row label="Quantity" value={`${qty}`} />
            <Row label="Rate"     value={formatCurrency(rate)} />
            <Row label="Amount"   value={formatCurrency(amount)} />
            <Row label={`GST (${isNaN(gstPct) ? 18 : gstPct}%)`} value={formatCurrency(gstAmt)} />
            <View style={st.divider} />
            <Row label="Total" value={formatCurrency(total)} big />
          </View>

          {/* ── Notes ── */}
          <ErpCard>
            <ErpField label="Notes">
              <ErpInput
                value={form.notes}
                onChangeText={v => set('notes', v)}
                placeholder="Optional remarks"
                multiline
                style={st.textarea}
              />
            </ErpField>
          </ErpCard>

          {/* Inside the ScrollView — a pinned footer outside it gets no bottom
              inset and is clipped. See the safe-area rule in the skill. */}
          <TouchableOpacity
            style={[st.saveBtn, saving && st.saveBtnOff]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}>
            <Text style={st.saveBtnText}>{saving ? 'Saving…' : 'Confirm Purchase'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Product picker modal ── */}
      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={st.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setPickerOpen(false)} activeOpacity={1} />
          <View style={[st.modalSheet, { paddingBottom: insets.bottom + 14 }]}>
            <View style={st.modalHandle} />
            <View style={st.modalHead}>
              <Text style={st.modalTitle}>Select Product</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)}>
                <Ionicons name="close" size={22} color={ERP.muted} />
              </TouchableOpacity>
            </View>

            <View style={st.modalSearch}>
              <Ionicons name="search" size={16} color={ERP.muted} />
              <TextInput
                style={st.modalSearchInput}
                placeholder="Search catalog…"
                placeholderTextColor={ERP.faint}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {!catalogLoaded ? (
              <Text style={st.modalEmpty}>Loading catalog…</Text>
            ) : (
              <FlatList
                data={filteredCatalog}
                keyExtractor={p => String(p._id)}
                style={st.modalList}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Text style={st.modalEmpty}>No products found.</Text>}
                renderItem={({ item }) => (
                  <TouchableOpacity style={st.pickRow} onPress={() => pickProduct(item)} activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.pickRowName} numberOfLines={1}>{item.name}</Text>
                      <Text style={st.pickRowMeta} numberOfLines={1}>
                        {item.code || '—'} · {formatCurrency(item.purchase_price || item.purchase_rate || item.cost_price || 0)}/{item.unit || 'unit'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#B0B5C3" />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ── Calendar ── */}
      <CalendarModal
        visible={calendarOpen}
        value={form.purchase_date}
        onClose={() => setCalendarOpen(false)}
        onSelect={(d) => { set('purchase_date', d); setCalendarOpen(false); }}
      />
    </SafeAreaView>
  );
}

function Row({ label, value, big }) {
  return (
    <View style={st.sumRow}>
      <Text style={[st.sumLabel, big && st.sumLabelBig]}>{label}</Text>
      <Text style={[st.sumValue, big && st.sumValueBig]}>{value}</Text>
    </View>
  );
}

/* ── Lightweight in-app calendar (no native dependency) ───────────────────
 * Matches the wholesaler's CalendarModal: month nav, weekday header,
 * 7-column day grid, today ring + selected fill. */
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const pad2 = n => String(n).padStart(2, '0');
const toISO = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

function CalendarModal({ visible, value, onClose, onSelect }) {
  const parsed = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (m) return { y: +m[1], mo: +m[2] - 1, d: +m[3] };
    const t = new Date();
    return { y: t.getFullYear(), mo: t.getMonth(), d: t.getDate() };
  })();

  const [viewYear, setViewYear] = useState(parsed.y);
  const [viewMonth, setViewMonth] = useState(parsed.mo);

  // Re-sync the visible month each time the picker re-opens.
  useEffect(() => {
    if (visible) { setViewYear(parsed.y); setViewMonth(parsed.mo); }
  }, [visible]);   // eslint-disable-line react-hooks/exhaustive-deps

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const goPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const goNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const today = new Date();
  const todayIso = toISO(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={st.calOverlay}>
        <TouchableOpacity style={st.calDismiss} onPress={onClose} activeOpacity={1} />
        <View style={st.calCard}>
          <View style={st.calHeader}>
            <TouchableOpacity onPress={goPrev} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={22} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={st.calTitle}>{MONTHS[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={goNext} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-forward" size={22} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={st.calWeekRow}>
            {WEEKDAYS.map(w => <Text key={w} style={st.calWeekday}>{w}</Text>)}
          </View>

          <View style={st.calGrid}>
            {cells.map((d, i) => {
              if (d == null) return <View key={`e${i}`} style={st.calCell} />;
              const iso = toISO(viewYear, viewMonth, d);
              const isSel = iso === value;
              const isToday = iso === todayIso;
              return (
                <TouchableOpacity key={iso} style={st.calCell} onPress={() => onSelect(iso)} activeOpacity={0.7}>
                  <View style={[st.calDay, isSel && st.calDaySel, !isSel && isToday && st.calDayToday]}>
                    <Text style={[st.calDayText, isSel && st.calDayTextSel]}>{d}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={st.calClose} onPress={onClose} activeOpacity={0.8}>
            <Text style={st.calCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  container: { padding: 16 },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },

  /* Catalog picker — accent-bordered button */
  pickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12, backgroundColor: Colors.primaryBg,
  },
  pickBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.primary },
  pickBtnPlaceholder: { color: ERP.muted, fontWeight: '500' },
  pickSelected: { fontSize: 12, fontWeight: '700', color: Colors.primary, marginTop: 6, marginBottom: 6 },
  pickHint: { fontSize: 11.5, color: ERP.muted, marginTop: 6, marginBottom: 6 },

  /* Purchase date */
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateInput: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 13, backgroundColor: '#F8FAFC',
  },
  dateInputText: { fontSize: 14, color: ERP.text, fontWeight: '600' },
  todayBtn: {
    backgroundColor: Colors.primaryBg, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.primary,
  },
  todayBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },

  /* Live summary — dark navy card with an orange total */
  summary: { backgroundColor: Colors.secondary, borderRadius: 14, padding: 18, marginBottom: 16 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  sumLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  sumValue: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  sumLabelBig: { fontSize: 15, color: '#FFF', fontWeight: '800' },
  sumValueBig: { fontSize: 20, fontWeight: '900', color: '#FDBA74' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 8 },

  textarea: { height: 74, textAlignVertical: 'top', paddingTop: 11 },

  saveBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnOff: { opacity: 0.6 },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  /* Calendar modal */
  calOverlay: { flex: 1, backgroundColor: 'rgba(15,22,40,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  calDismiss: { ...StyleSheet.absoluteFillObject },
  calCard: { width: '100%', maxWidth: 360, backgroundColor: '#FFF', borderRadius: 18, padding: 16, ...Shadows.lg },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calTitle: { fontSize: 16, fontWeight: '800', color: ERP.text },
  calWeekRow: { flexDirection: 'row', marginBottom: 6 },
  calWeekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: ERP.muted },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calDay: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  calDaySel: { backgroundColor: Colors.primary },
  calDayToday: { borderWidth: 1.5, borderColor: Colors.primary },
  calDayText: { fontSize: 14, color: ERP.text, fontWeight: '600' },
  calDayTextSel: { color: '#FFF', fontWeight: '800' },
  calClose: { marginTop: 10, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: ERP.bg },
  calCloseText: { fontSize: 14, fontWeight: '700', color: ERP.muted },

  /* Pickers */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,22,40,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 16, ...Shadows.lg,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 10 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: ERP.text },
  modalSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 12, marginBottom: 10,
  },
  modalSearchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: ERP.text },
  modalList: { maxHeight: 380 },
  modalEmpty: { textAlign: 'center', color: ERP.muted, padding: 20, fontSize: 13 },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  pickRowName: { fontSize: 14, fontWeight: '700', color: ERP.text },
  pickRowMeta: { fontSize: 11.5, color: ERP.muted, marginTop: 2 },
});
