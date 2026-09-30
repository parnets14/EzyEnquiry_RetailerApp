/**
 * src/screens/erp/SalesEntryScreen.jsx  (Retailer app)
 *
 * Record a sale: customer name, one or more product lines, a percentage
 * discount, and computed GST + grand total.
 *
 * Ported from `wholesalerapp/src/screens/sales/SalesEntryScreen.jsx`. The money
 * maths is deliberately identical (discount applied BEFORE GST, GST apportioned
 * per line by line share) so both apps produce the same totals for the same input.
 *
 * Product source: the retailer's own catalogue (`myProductApi.list`), not the
 * wholesaler's `listCatalog` service.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { erpApi, myProductApi, staffApi } from '../../utils/api';
import { formatCurrency } from '../../utils/formatters';
import {
  ErpHeader, ErpCard, ErpSectionLabel, ErpField, ErpInput,
  ErpPrimaryAction, ErpLoading, ERP,
} from '../../components/erp';

const numOnly = (v) => String(v).replace(/[^0-9.]/g, '');

const emptyItem = () => ({
  product_id: null,
  product_name: '',
  product_code: '',
  qty: '',
  rate: '',
  gst_rate: '18',
});

export default function SalesEntryScreen({ navigation }) {
  const [customerName, setCustomerName] = useState('');
  const [discountPct,  setDiscountPct]  = useState('0');
  const [items,        setItems]        = useState([emptyItem()]);
  const [saving,       setSaving]       = useState(false);
  const insets = useSafeAreaInsets();

  // Customer picker (sourced from the ERP customers created via Add Customer)
  const [customers,        setCustomers]        = useState([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customerPicker,   setCustomerPicker]   = useState(false);
  const [customerSearch,   setCustomerSearch]   = useState('');
  const [customerId,       setCustomerId]       = useState('');

  // Product picker
  const [catalog,        setCatalog]        = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [pickerFor,      setPickerFor]      = useState(null);
  const [pickerSearch,   setPickerSearch]   = useState('');

  // Sales staff assignment — mirrors the wholesaler's OrderEntry "Assign to
  // Sales Staff". Optional: a sale saves fine without one.
  const [staff,         setStaff]         = useState([]);
  const [staffLoading,  setStaffLoading]  = useState(true);
  const [staffPicker,   setStaffPicker]   = useState(false);
  const [staffSearch,   setStaffSearch]   = useState('');
  const [assignedStaff, setAssignedStaff] = useState(null);   // { _id, name, designation, mobile }

  // Load the FULL product catalogue. The backend caps listMyProducts at 100 per
  // page, so page through until a page returns fewer than the page size.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      try {
        const PAGE = 100;
        const MAX_PAGES = 50; // hard stop (~5000 products) to avoid runaway loops
        let page = 1;
        let all = [];
        while (page <= MAX_PAGES) {
          const res = await myProductApi.list({ limit: PAGE, page });
          const data = res?.data ?? res;
          const batch = Array.isArray(data) ? data : data?.products ?? [];
          all = all.concat(batch);
          if (batch.length < PAGE) break;
          page += 1;
        }
        if (!cancelled) setCatalog(all);
      } catch {
        if (!cancelled) setCatalog([]);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load ERP customers so the sale can be linked to one added via "Add Customer".
  // Page through so the dropdown always shows the full directory (no silent cap).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCustomersLoading(true);
      try {
        const PAGE = 200;
        const MAX_PAGES = 25; // hard stop (~5000 customers)
        let page = 1;
        let all = [];
        while (page <= MAX_PAGES) {
          const res = await erpApi.listErpCustomers({ limit: PAGE, page });
          const data = res?.data ?? res;
          const batch = Array.isArray(data) ? data : data?.customers ?? [];
          all = all.concat(batch);
          if (batch.length < PAGE) break;
          page += 1;
        }
        if (!cancelled) setCustomers(all);
      } catch {
        if (!cancelled) setCustomers([]);
      } finally {
        if (!cancelled) setCustomersLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load the retailer's own staff so a sale can be credited to whoever handled
  // it. Deactivated staff are filtered out — you shouldn't be able to assign new
  // work to someone whose login is off.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStaffLoading(true);
      try {
        const res = await staffApi.list({ limit: 200 });
        const data = res?.data ?? res;
        const batch = Array.isArray(data) ? data : data?.staff ?? [];
        if (!cancelled) setStaff(batch.filter(s => s.is_active !== false));
      } catch {
        if (!cancelled) setStaff([]);
      } finally {
        if (!cancelled) setStaffLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const addItem    = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (i) => setItems(prev => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  const updateItem = (i, key, v) => setItems(prev => prev.map((it, idx) => (idx === i ? { ...it, [key]: v } : it)));

  const pickProduct = (p) => {
    const idx = pickerFor;
    if (idx == null) return;
    const rate = p.selling_price || p.wholesale_rate || p.retail_price || p.mrp || 0;
    setItems(prev => prev.map((it, i) => (i === idx ? {
      ...it,
      product_id:   p._id,
      product_name: p.name || '',
      product_code: p.code || '',
      rate:         String(rate || ''),
      gst_rate:     String(p.gst_percent ?? 18),
    } : it)));
    setPickerFor(null);
    setPickerSearch('');
  };

  const filteredCatalog = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q));
  }, [catalog, pickerSearch]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.mobile || '').includes(q) ||
      (c.gst_number || '').toLowerCase().includes(q));
  }, [customers, customerSearch]);

  const filteredStaff = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.mobile || '').includes(q) ||
      (s.designation || '').toLowerCase().includes(q));
  }, [staff, staffSearch]);

  // ── Totals (identical maths to the wholesaler form) ──
  let subtotal = 0;
  items.forEach(it => { subtotal += parseFloat(it.qty || 0) * parseFloat(it.rate || 0); });

  const discPct = Math.min(Math.max(parseFloat(discountPct) || 0, 0), 100);
  const discAmt = +(subtotal * discPct / 100).toFixed(2);
  const taxable = Math.max(subtotal - discAmt, 0);

  let totalGST = 0;
  items.forEach(it => {
    const line  = parseFloat(it.qty || 0) * parseFloat(it.rate || 0);
    const share = subtotal > 0 ? line / subtotal : 0;
    totalGST += Math.round((taxable * share) * (parseFloat(it.gst_rate) || 0) / 100);
  });
  const grandTotal = Math.max(taxable + totalGST, 0);

  const handleSave = async () => {
    if (!customerName.trim()) { Alert.alert('Missing details', 'Please enter a customer name.'); return; }
    const valid = items.filter(it => it.product_id && parseFloat(it.qty) > 0);
    if (!valid.length) { Alert.alert('Missing details', 'Select at least one product and enter a quantity.'); return; }

    setSaving(true);
    try {
      await erpApi.createSale({
        customer_name: customerName.trim(),
        customer_id:   customerId || undefined,
        items: valid.map(it => ({
          product_id:   it.product_id,
          product_name: it.product_name,
          product_code: it.product_code,
          qty:          parseFloat(it.qty),
          rate:         parseFloat(it.rate),
          gst_rate:     parseFloat(it.gst_rate),
        })),
        discount_percent: discPct,
        discount:         discAmt,
        date:             new Date().toISOString(),
        // Optional — the backend validates this against the company's own staff.
        ...(assignedStaff ? { sales_staff_id: assignedStaff._id, sales_staff_name: assignedStaff.name } : {}),
      });
      Alert.alert('Sale recorded', 'The sale has been saved.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader title="New Sale" subtitle="Record a sale" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[st.container, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <ErpCard>
            <ErpField label="Customer name" required>
              <TouchableOpacity
                style={[st.pickBtn, !customerName && st.pickBtnEmpty]}
                onPress={() => { setCustomerPicker(true); setCustomerSearch(''); }}
                activeOpacity={0.8}>
                <Text
                  style={[st.pickTxt, !customerName && { color: ERP.faint, fontWeight: '500' }]}
                  numberOfLines={1}>
                  {customerName || 'Select a customer…'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.primary} />
              </TouchableOpacity>
            </ErpField>
          </ErpCard>

          <ErpSectionLabel>Products</ErpSectionLabel>

          {items.map((item, i) => (
            <ErpCard key={i}>
              <Text style={st.itemTitle}>Product {i + 1}</Text>

              <ErpField label="Product" required>
                <TouchableOpacity
                  style={[st.pickBtn, !item.product_name && st.pickBtnEmpty]}
                  onPress={() => { setPickerFor(i); setPickerSearch(''); }}
                  activeOpacity={0.8}>
                  <Text
                    style={[st.pickTxt, !item.product_name && { color: ERP.faint, fontWeight: '500' }]}
                    numberOfLines={1}>
                    {item.product_name || 'Tap to select a product…'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={Colors.primary} />
                </TouchableOpacity>
                {item.product_code ? <Text style={st.pickMeta}>Code: {item.product_code}</Text> : null}
              </ErpField>

              <View style={st.row}>
                <ErpField label="Qty" half>
                  <ErpInput value={item.qty} onChangeText={v => updateItem(i, 'qty', numOnly(v))} keyboardType="decimal-pad" placeholder="0" />
                </ErpField>
                <ErpField label="Rate" half>
                  <ErpInput value={item.rate} onChangeText={v => updateItem(i, 'rate', numOnly(v))} keyboardType="decimal-pad" placeholder="0" />
                </ErpField>
              </View>

              <ErpField label="GST %">
                <ErpInput value={item.gst_rate} onChangeText={v => updateItem(i, 'gst_rate', numOnly(v))} keyboardType="decimal-pad" placeholder="18" />
              </ErpField>

              {items.length > 1 ? (
                <TouchableOpacity style={st.removeBtn} onPress={() => removeItem(i)}>
                  <Ionicons name="trash-outline" size={14} color={Colors.error} />
                  <Text style={st.removeTxt}>Remove product</Text>
                </TouchableOpacity>
              ) : null}
            </ErpCard>
          ))}

          <TouchableOpacity style={st.addBtn} onPress={addItem} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={17} color={Colors.primary} />
            <Text style={st.addTxt}>Add product</Text>
          </TouchableOpacity>

          <ErpCard>
            <ErpField label="Discount (%)">
              <ErpInput
                value={discountPct}
                onChangeText={v => setDiscountPct(numOnly(v))}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </ErpField>
          </ErpCard>

          <ErpCard>
            <ErpField label="Assign to Sales Staff">
              <TouchableOpacity
                style={[st.pickBtn, !assignedStaff && st.pickBtnEmpty]}
                onPress={() => { setStaffPicker(true); setStaffSearch(''); }}
                activeOpacity={0.8}>
                <Text style={[st.pickTxt, !assignedStaff && st.pickTxtEmpty]} numberOfLines={1}>
                  {assignedStaff ? assignedStaff.name : 'Tap to assign a staff member…'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={ERP.faint} />
              </TouchableOpacity>
            </ErpField>
            {assignedStaff ? (
              <TouchableOpacity
                style={st.removeBtn}
                onPress={() => setAssignedStaff(null)}
                activeOpacity={0.8}>
                <Ionicons name="close-circle-outline" size={14} color={Colors.error} />
                <Text style={st.removeTxt}>Clear assignment</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={st.pickMeta}>
              Who handled this sale. Optional — leave blank for a counter sale.
            </Text>
          </ErpCard>

          <ErpCard>
            <ErpSectionLabel>Summary</ErpSectionLabel>
            <Row label="Subtotal" value={formatCurrency(subtotal)} />
            <Row label={`Discount (${discPct}%)`} value={`-${formatCurrency(discAmt)}`} color={Colors.error} />
            <Row label="GST" value={formatCurrency(totalGST)} />
            <Row label="Grand total" value={formatCurrency(grandTotal)} bold last />
          </ErpCard>

          <View style={{ marginTop: 4, marginBottom: 30 }}>
            <ErpPrimaryAction label={saving ? 'Saving…' : 'Save Sale'} icon="checkmark" onPress={handleSave} disabled={saving} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Product picker sheet ── */}
      <Modal visible={pickerFor != null} animationType="slide" transparent onRequestClose={() => setPickerFor(null)}>
        <View style={st.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setPickerFor(null)} activeOpacity={1} />
          <View style={st.sheet}>
            <View style={st.handle} />
            <Text style={st.sheetTitle}>Select product</Text>

            <View style={st.sheetSearch}>
              <Ionicons name="search" size={17} color={ERP.muted} style={{ marginLeft: 10 }} />
              <TextInput
                style={st.sheetSearchInput}
                placeholder="Search name or code…"
                placeholderTextColor={ERP.faint}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                autoFocus
                autoCapitalize="none"
              />
            </View>

            {catalogLoading ? <ErpLoading label="Loading products…" /> : (
              <FlatList
                data={filteredCatalog}
                keyExtractor={p => p._id}
                style={{ maxHeight: 380 }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={st.sheetEmpty}>
                    No products found. Add one from the Products screen first.
                  </Text>
                }
                renderItem={({ item: p }) => {
                  const rate = p.selling_price || p.wholesale_rate || p.retail_price || p.mrp || 0;
                  return (
                    <TouchableOpacity style={st.pickRow} onPress={() => pickProduct(p)} activeOpacity={0.7}>
                      <View style={{ flex: 1 }}>
                        <Text style={st.pickRowName}>{p.name}</Text>
                        <Text style={st.pickRowMeta}>
                          {p.code || '—'} · {formatCurrency(rate)}/{p.unit || 'unit'} · GST {p.gst_percent ?? 18}%
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={ERP.faint} />
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ── Customer picker sheet ── */}
      <Modal visible={customerPicker} animationType="slide" transparent onRequestClose={() => setCustomerPicker(false)}>
        <View style={st.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setCustomerPicker(false)} activeOpacity={1} />
          <View style={st.sheet}>
            <View style={st.handle} />
            <Text style={st.sheetTitle}>Select customer</Text>

            <View style={st.sheetSearch}>
              <Ionicons name="search" size={17} color={ERP.muted} style={{ marginLeft: 10 }} />
              <TextInput
                style={st.sheetSearchInput}
                placeholder="Search name, mobile or GSTIN…"
                placeholderTextColor={ERP.faint}
                value={customerSearch}
                onChangeText={setCustomerSearch}
                autoFocus
                autoCapitalize="none"
              />
            </View>

            {customersLoading ? (
              <ErpLoading label="Loading customers…" />
            ) : (
              <FlatList
                data={filteredCustomers}
                keyExtractor={c => c._id}
                style={{ maxHeight: 380 }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={st.sheetEmpty}>No customers found. Add one from the Customers screen first.</Text>
                }
                renderItem={({ item: c }) => (
                  <TouchableOpacity
                    style={st.pickRow}
                    onPress={() => { setCustomerName(c.name); setCustomerId(c._id); setCustomerPicker(false); }}
                    activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.pickRowName}>{c.name}</Text>
                      <Text style={st.pickRowMeta}>
                        {[c.mobile, c.city].filter(Boolean).join(' · ') || 'No contact details'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={ERP.faint} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ── Sales staff picker sheet ── */}
      <Modal visible={staffPicker} animationType="slide" transparent onRequestClose={() => setStaffPicker(false)}>
        <View style={st.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setStaffPicker(false)} activeOpacity={1} />
          <View style={st.sheet}>
            <View style={st.handle} />
            <Text style={st.sheetTitle}>Assign to Sales Staff</Text>

            <View style={st.sheetSearch}>
              <Ionicons name="search" size={17} color={ERP.muted} style={{ marginLeft: 10 }} />
              <TextInput
                style={st.sheetSearchInput}
                placeholder="Search name, mobile or designation…"
                placeholderTextColor={ERP.faint}
                value={staffSearch}
                onChangeText={setStaffSearch}
                autoFocus
                autoCapitalize="none"
              />
            </View>

            {staffLoading ? (
              <ErpLoading label="Loading staff…" />
            ) : (
              <FlatList
                data={filteredStaff}
                keyExtractor={s => s._id}
                style={{ maxHeight: 380 }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={st.sheetEmpty}>
                    No staff found. Add one from the Staff screen first.
                  </Text>
                }
                renderItem={({ item: s }) => (
                  <TouchableOpacity
                    style={st.pickRow}
                    onPress={() => {
                      setAssignedStaff({ _id: s._id, name: s.name, designation: s.designation, mobile: s.mobile });
                      setStaffPicker(false);
                    }}
                    activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.pickRowName}>{s.name}</Text>
                      <Text style={st.pickRowMeta}>
                        {[s.designation, s.mobile].filter(Boolean).join(' · ') || 'No designation set'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={ERP.faint} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ label, value, bold, color, last }) {
  return (
    <View style={[st.totalRow, last && { borderTopWidth: 1, borderTopColor: ERP.border, paddingTop: 9, marginTop: 4 }]}>
      <Text style={[st.totalLabel, bold && st.totalLabelBold]}>{label}</Text>
      <Text style={[st.totalValue, bold && st.totalValueBold, color && { color }]}>{value}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  container: { padding: 14, paddingBottom: 20 },

  itemTitle: { fontSize: 12, fontWeight: '800', color: Colors.primary, marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },

  pickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 12, height: 46, backgroundColor: '#FFF',
  },
  pickBtnEmpty: { borderColor: ERP.border },
  pickTxt: { flex: 1, fontSize: 14, fontWeight: '700', color: ERP.text, marginRight: 8 },
  pickTxtEmpty: { color: ERP.muted, fontWeight: '500' },
  pickMeta: { fontSize: 11.5, color: ERP.muted, marginTop: 5 },

  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end', paddingVertical: 4 },
  removeTxt: { color: Colors.error, fontSize: 12, fontWeight: '700' },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed',
    borderRadius: 12, paddingVertical: 13, marginBottom: 14, backgroundColor: Colors.primaryBg,
  },
  addTxt: { color: Colors.primary, fontWeight: '800', fontSize: 13 },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  totalLabel: { fontSize: 13, color: ERP.muted },
  totalLabelBold: { fontSize: 14.5, fontWeight: '800', color: ERP.text },
  totalValue: { fontSize: 13, fontWeight: '600', color: ERP.text },
  totalValueBold: { fontSize: 17, fontWeight: '800', color: Colors.primary },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 28 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: ERP.text, marginBottom: 10 },
  sheetSearch: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: ERP.border, borderRadius: 10, marginBottom: 10, height: 42,
  },
  sheetSearchInput: { flex: 1, fontSize: 14, color: ERP.text, paddingHorizontal: 10, paddingVertical: 0 },
  sheetEmpty: { textAlign: 'center', color: ERP.muted, padding: 22, fontSize: 13 },
  pickRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: ERP.border,
  },
  pickRowName: { fontSize: 14, fontWeight: '700', color: ERP.text },
  pickRowMeta: { fontSize: 11.5, color: ERP.muted, marginTop: 2 },
});
