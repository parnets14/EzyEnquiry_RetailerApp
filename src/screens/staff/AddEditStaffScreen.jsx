import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  StatusBar, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Modal, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { staffApi, myProductApi } from '../../utils/api';

// ─── Retailer App modules ─────────────────────────────────────
const RETAILER_MODULES = [
  { key: 'dashboard',     label: 'Dashboard',    description: 'Summary stats',           icon: 'home-outline',          color: '#2980B9' },
  { key: 'products',      label: 'Products',     description: 'Browse catalogue',         icon: 'cube-outline',          color: '#27AE60' },
  { key: 'enquiries',     label: 'Enquiries',    description: 'Create & track enquiries', icon: 'document-text-outline', color: '#8E44AD' },
  { key: 'orders',        label: 'Orders',       description: 'Place & track orders',     icon: 'clipboard-outline',     color: '#F39C12' },
  { key: 'invoices',      label: 'Invoices',     description: 'View & pay invoices',      icon: 'receipt-outline',       color: '#C0392B' },
  { key: 'customers',     label: 'Customers',    description: 'Manage customers',         icon: 'people-outline',        color: '#16A085' },
  { key: 'notifications', label: 'Notifications',description: 'In-app notifications',     icon: 'notifications-outline', color: '#E74C3C' },
  { key: 'reports',       label: 'Reports',      description: 'Sales & order reports',    icon: 'bar-chart-outline',     color: '#1A2340' },
];
const ALL_KEYS = RETAILER_MODULES.map(m => m.key);

const fmt = n => Number(n) > 0 ? `\u20B9${Number(n).toLocaleString('en-IN')}` : '\u2014';

// ── Shared UI ─────────────────────────────────────────────────
function SH({ icon, title, color = Colors.secondary }) {
  return (
    <View style={st.sh}>
      <View style={[st.shBar, { backgroundColor: color }]} />
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[st.shTitle, { color }]}>{title}</Text>
    </View>
  );
}

function Field({ label, required, hint, error, children }) {
  return (
    <View style={st.field}>
      <Text style={st.fLabel}>{label}{required && <Text style={{ color: Colors.error }}> *</Text>}</Text>
      {children}
      {!!hint  && <Text style={st.hint}>{hint}</Text>}
      {!!error && <Text style={st.err}>{error}</Text>}
    </View>
  );
}

function Inp({ value, onChangeText, placeholder, keyboardType, editable = true, maxLength }) {
  return (
    <TextInput
      style={[st.input, !editable && st.inputDis]}
      value={value} onChangeText={onChangeText}
      placeholder={placeholder} placeholderTextColor={Colors.textTertiary}
      keyboardType={keyboardType || 'default'} editable={editable}
      maxLength={maxLength} autoCapitalize="none"
    />
  );
}

// ── Module checkbox row ───────────────────────────────────────
function ModRow({ mod, checked, onToggle }) {
  return (
    <TouchableOpacity style={[st.modRow, checked && st.modRowOn]} onPress={onToggle} activeOpacity={0.8}>
      <View style={[st.modIcon, { backgroundColor: mod.color + '18' }]}>
        <Ionicons name={mod.icon} size={15} color={mod.color} />
      </View>
      <View style={st.modMeta}>
        <Text style={[st.modName, checked && { color: Colors.textPrimary }]}>{mod.label}</Text>
        <Text style={st.modDesc} numberOfLines={1}>{mod.description}</Text>
      </View>
      <View style={[st.cb, checked && st.cbOn]}>
        {checked && <Ionicons name="checkmark" size={11} color="#FFF" />}
      </View>
    </TouchableOpacity>
  );
}

// ── Product picker bottom sheet ───────────────────────────────
function ProductPicker({ products, selectedIds, onDone }) {
  const [vis, setVis] = useState(false);
  const [sel, setSel] = useState(() => new Set(selectedIds));
  const [q,   setQ]   = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => { if (vis) setSel(new Set(selectedIds)); }, [vis]);

  const filtered = q.trim()
    ? products.filter(p => (p.name || '').toLowerCase().includes(q.toLowerCase()) ||
        (p.code || '').toLowerCase().includes(q.toLowerCase()))
    : products;

  const toggle = id => setSel(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const names = products
    .filter(p => selectedIds.includes(p.id || p._id))
    .map(p => p.name).join(', ');

  return (
    <View style={st.field}>
      <Text style={st.fLabel}>Products with Discount Access</Text>
      <TouchableOpacity style={st.prodTrig} onPress={() => setVis(true)} activeOpacity={0.8}>
        <Text style={[st.prodTrigTxt, !names && { color: Colors.textTertiary }]} numberOfLines={2}>
          {names || 'All products (no restriction)'}
        </Text>
        <Ionicons name="chevron-down" size={15} color={Colors.textTertiary} />
      </TouchableOpacity>
      <Text style={st.hint}>Leave empty = discount applies to all products</Text>

      <Modal visible={vis} transparent animationType="slide" onRequestClose={() => setVis(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback onPress={() => setVis(false)}>
            <View style={st.sheetOverlay}>
              <TouchableWithoutFeedback>
                <View style={st.sheet}>
                  <View style={st.sheetHandle} />
                  <View style={st.sheetHead}>
                    <Text style={st.sheetTitle}>Select Products</Text>
                    <TouchableOpacity onPress={() => setSel(new Set())} style={{ paddingHorizontal: 10 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary }}>Clear</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setVis(false)} style={st.sheetClose}>
                      <Ionicons name="close" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={st.sheetSearch}>
                    <Ionicons name="search-outline" size={14} color={Colors.textTertiary} />
                    <TextInput style={st.sheetSI} value={q} onChangeText={setQ} autoFocus
                      placeholder="Search products…" placeholderTextColor={Colors.textTertiary} />
                  </View>
                  <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                    {filtered.map(p => {
                      const id = p.id || p._id;
                      const on = sel.has(id);
                      return (
                        <TouchableOpacity key={id}
                          style={[st.prodRow, on && st.prodRowOn]} onPress={() => toggle(id)}>
                          <View style={{ flex: 1 }}>
                            <Text style={st.prodName} numberOfLines={1}>{p.name}</Text>
                            {p.code ? <Text style={st.prodCode}>{p.code}</Text> : null}
                          </View>
                          <View style={[st.cb, on && st.cbOn]}>
                            {on && <Ionicons name="checkmark" size={11} color="#FFF" />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                    {filtered.length === 0 && (
                      <View style={{ padding: 24, alignItems: 'center' }}>
                        <Text style={{ color: Colors.textTertiary, fontSize: 13 }}>No products found</Text>
                      </View>
                    )}
                  </ScrollView>
                  <View style={[st.sheetDoneRow, { paddingBottom: Math.max(insets.bottom, 14) }]}>
                    <TouchableOpacity style={st.sheetDoneBtn}
                      onPress={() => { onDone([...sel]); setVis(false); }}>
                      <Ionicons name="checkmark" size={15} color="#FFF" />
                      <Text style={st.sheetDoneTxt}>
                        Done{sel.size > 0 ? ` (${sel.size} selected)` : ' — All products'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Screen
// ═══════════════════════════════════════════════════════════════
export default function AddEditStaffScreen({ navigation, route }) {
  const editStaff = route?.params?.staff || null;
  const isEdit    = !!editStaff;

  // Profile
  const [name,        setName]        = useState(editStaff?.name        || '');
  const [mobile,      setMobile]      = useState(editStaff?.mobile      || '');
  const [email,       setEmail]       = useState(editStaff?.email       || '');
  const [designation, setDesignation] = useState(editStaff?.designation || '');

  // App Access — collapsed by default, nothing pre-selected
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessKeys, setAccessKeys] = useState(() => new Set(editStaff?.staff_app_access || []));

  // Salary
  const bd = editStaff?.salary_breakdown || {};
  const [fixedSalary,        setFixedSalary]        = useState(bd.fixed_salary        > 0 ? String(bd.fixed_salary)        : '');
  const [incentiveValue,     setIncentiveValue]     = useState(bd.incentive_value     > 0 ? String(bd.incentive_value)     : '');
  const [maxDiscountPct,     setMaxDiscountPct]     = useState(bd.max_discount_percent > 0 ? String(bd.max_discount_percent) : '');
  const [discountProductIds, setDiscountProductIds] = useState(bd.discount_product_ids || []);

  // Products for discount picker
  const [products, setProducts] = useState([]);

  // UI
  const [saving,       setSaving]       = useState(false);
  const [initialising, setInitialising] = useState(isEdit);
  const [errors,       setErrors]       = useState({});

  // Load products
  useEffect(() => {
    myProductApi.list({ limit: 200 })
      .then(d => setProducts(d?.products || []))
      .catch(() => {});
  }, []);

  // Fetch fresh data on edit
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await staffApi.get(editStaff._id);
        if (cancelled) return;
        const s = data?.staff || data;
        if (!s) return;
        setName(s.name || '');
        setEmail(s.email || '');
        setDesignation(s.designation || '');
        setAccessKeys(new Set(s.staff_app_access || []));
        const fbd = s.salary_breakdown || {};
        setFixedSalary(       fbd.fixed_salary        > 0 ? String(fbd.fixed_salary)        : '');
        setIncentiveValue(    fbd.incentive_value      > 0 ? String(fbd.incentive_value)     : '');
        setMaxDiscountPct(    fbd.max_discount_percent > 0 ? String(fbd.max_discount_percent) : '');
        setDiscountProductIds(fbd.discount_product_ids || []);
      } catch { /* keep params */ }
      finally { if (!cancelled) setInitialising(false); }
    })();
    return () => { cancelled = true; };
  }, [isEdit, editStaff?._id]);

  const toggleModule = useCallback(key => {
    setAccessKeys(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }, []);

  const allChecked = RETAILER_MODULES.every(m => accessKeys.has(m.key));
  const toggleAll  = () => allChecked ? setAccessKeys(new Set()) : setAccessKeys(new Set(ALL_KEYS));

  // Computed salary values
  const fixedNum   = Number(fixedSalary)    || 0;
  const incvNum    = Number(incentiveValue) || 0;
  const maxDiscNum = Number(maxDiscountPct) || 0;
  const hasDiscount = maxDiscNum > 0;

  // Incentive is always % of fixed salary
  const incvAmount   = fixedNum > 0 && incvNum > 0
    ? parseFloat(((fixedNum * incvNum) / 100).toFixed(2))
    : 0;

  const monthlyTotal = fixedNum + incvAmount;

  const validate = () => {
    const e = {};
    if (!name.trim())                e.name   = 'Staff name is required.';
    if (!/^\d{10}$/.test(mobile.trim())) e.mobile = 'Enter a valid 10-digit mobile number.';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email.';
    if (fixedSalary    && isNaN(Number(fixedSalary)))    e.fixedSalary    = 'Enter a valid number.';
    if (incentiveValue && isNaN(Number(incentiveValue))) e.incentiveValue = 'Enter a valid number.';
    if (maxDiscountPct) {
      const n = Number(maxDiscountPct);
      if (isNaN(n) || n < 0 || n > 100) e.maxDiscountPct = 'Must be 0–100.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const checked = [...accessKeys];
      const isAll   = ALL_KEYS.every(k => checked.includes(k));
      const payload = {
        name: name.trim(), mobile: mobile.trim(),
        email: email.trim(), designation: designation.trim(),
        staff_app_access:     isAll ? [] : checked,
        fixed_salary:         fixedNum,
        incentive_type:       incvNum > 0 ? 'percentage' : 'none',
        incentive_value:      incvNum,
        sales_percentage:     0,
        discount_access:      hasDiscount,
        max_discount_percent: maxDiscNum,
        discount_product_ids: discountProductIds,
      };
      if (isEdit) await staffApi.update(editStaff._id, payload);
      else        await staffApi.create(payload);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.secondary} />

      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>{isEdit ? 'Edit Staff' : 'Add Staff'}</Text>
        <TouchableOpacity style={[st.saveBtn, (saving || initialising) && { opacity: 0.6 }]}
          onPress={handleSave} disabled={saving || initialising}>
          {saving
            ? <ActivityIndicator size="small" color="#FFF" />
            : <><Ionicons name="checkmark" size={16} color="#FFF" /><Text style={st.saveBtnTxt}>Save</Text></>}
        </TouchableOpacity>
      </View>

      {initialising ? (
        <View style={st.loader}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={st.loaderTxt}>Loading…</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
        >
          <ScrollView
            contentContainerStyle={st.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >

            {/* ── 1. STAFF DETAILS ── */}
            <SH icon="person-outline" title="Staff Details" color={Colors.secondary} />
            <View style={st.card}>
              <Field label="Full Name" required error={errors.name}>
                <Inp value={name}
                  onChangeText={t => { setName(t); setErrors(e => ({ ...e, name: '' })); }}
                  placeholder="e.g. Ramesh Kumar" />
              </Field>
              <Field label="Mobile Number" required
                hint={isEdit ? 'Mobile is the login key — cannot be changed.' : 'Staff logs in with this number'}
                error={errors.mobile}>
                <Inp value={mobile}
                  onChangeText={t => { setMobile(t.replace(/\D/g, '').slice(0, 10)); setErrors(e => ({ ...e, mobile: '' })); }}
                  placeholder="10-digit mobile" keyboardType="number-pad" maxLength={10} editable={!isEdit} />
              </Field>
              <Field label="Email" error={errors.email} hint="Optional">
                <Inp value={email}
                  onChangeText={t => { setEmail(t); setErrors(e => ({ ...e, email: '' })); }}
                  placeholder="staff@email.com" keyboardType="email-address" />
              </Field>
              <Field label="Designation">
                <Inp value={designation} onChangeText={setDesignation}
                  placeholder="e.g. Sales Executive, Cashier" />
              </Field>
            </View>

            {/* ── 2. APP ACCESS (collapsible, starts closed) ── */}
            <View style={st.accessHeader}>
              <View style={st.accessLeft}>
                <View style={{ width: 3, height: 17, backgroundColor: '#2980B9', borderRadius: 2 }} />
                <Ionicons name="shield-checkmark-outline" size={14} color="#2980B9" />
                <Text style={[st.shTitle, { color: '#2980B9' }]}>App Access</Text>
                {accessKeys.size > 0 && (
                  <View style={st.accessBadge}>
                    <Text style={st.accessBadgeTxt}>{allChecked ? 'Full' : `${accessKeys.size}/${RETAILER_MODULES.length}`}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[st.accessBtn, accessOpen && st.accessBtnOpen]}
                onPress={() => setAccessOpen(v => !v)} activeOpacity={0.8}>
                <Ionicons
                  name={accessOpen ? 'checkmark-done-outline' : accessKeys.size > 0 ? 'create-outline' : 'add'}
                  size={13} color="#FFF" />
                <Text style={st.accessBtnTxt}>{accessOpen ? 'Done' : accessKeys.size > 0 ? 'Edit' : 'Add'}</Text>
              </TouchableOpacity>
            </View>

            {accessOpen && (
              <View style={[st.card, { marginTop: 6 }]}>
                <View style={st.saRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.saTitle}>Retailer App Access</Text>
                    <Text style={st.saSub}>
                      {allChecked ? 'Full access' : accessKeys.size === 0 ? 'No sections selected' : `${accessKeys.size} of ${RETAILER_MODULES.length} selected`}
                    </Text>
                  </View>
                  <TouchableOpacity style={st.saBtn} onPress={toggleAll}>
                    <Text style={st.saBtnTxt}>{allChecked ? 'Deselect All' : 'Select All'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ gap: 6 }}>
                  {RETAILER_MODULES.map(m => (
                    <ModRow key={m.key} mod={m} checked={accessKeys.has(m.key)} onToggle={() => toggleModule(m.key)} />
                  ))}
                </View>
                {accessKeys.size === 0 && (
                  <View style={st.warnRow}>
                    <Ionicons name="warning-outline" size={13} color={Colors.warning} />
                    <Text style={st.warnTxt}>No sections — staff sees Dashboard only.</Text>
                  </View>
                )}
                <TouchableOpacity style={st.doneBtn} onPress={() => setAccessOpen(false)}>
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                  <Text style={st.doneTxt}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── 3. SALARY BREAKDOWN (single card) ── */}
            <SH icon="cash-outline" title="Salary Breakdown" color="#27AE60" />
            <View style={st.card}>

              {/* Fixed Salary */}
              <Field label="Fixed Monthly Salary (₹)" error={errors.fixedSalary}
                hint="Guaranteed base pay every month">
                <Inp value={fixedSalary}
                  onChangeText={t => { setFixedSalary(t.replace(/[^0-9.]/g, '')); setErrors(e => ({ ...e, fixedSalary: '' })); }}
                  placeholder="e.g. 15000" keyboardType="decimal-pad" />
              </Field>

              <View style={st.divider} />

              {/* Incentive */}
              <Text style={st.fLabel}>Incentive / Bonus</Text>
              <Text style={st.hint}>Enter % of fixed salary — amount auto-calculates beside it</Text>
              <View style={st.incvRow}>
                {/* % input */}
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={st.fLabel}>Percentage (%)</Text>
                  <TextInput
                    style={st.input}
                    value={incentiveValue}
                    onChangeText={t => { setIncentiveValue(t.replace(/[^0-9.]/g, '')); setErrors(e => ({ ...e, incentiveValue: '' })); }}
                    placeholder="e.g. 10"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="decimal-pad"
                  />
                  {!!errors.incentiveValue && <Text style={st.err}>{errors.incentiveValue}</Text>}
                </View>

                {/* Arrow */}
                <View style={st.incvArrow}>
                  <Ionicons name="arrow-forward" size={16} color={Colors.textTertiary} />
                </View>

                {/* Auto-calc ₹ amount */}
                <View style={[{ flex: 1, gap: 4 }, st.incvResult]}>
                  <Text style={st.fLabel}>Amount (₹)</Text>
                  <Text style={st.incvResVal}>{incvAmount > 0 ? fmt(incvAmount) : '—'}</Text>
                  <Text style={st.incvResHint}>
                    {fixedNum > 0 && incvNum > 0
                      ? `${incvNum}% of ${fmt(fixedNum)}`
                      : fixedNum === 0 ? 'Enter fixed salary first' : ''}
                  </Text>
                </View>
              </View>

              <View style={st.divider} />

              {/* Discount Authority */}
              <Field label="Discount Authority (%)" error={errors.maxDiscountPct}
                hint="Max % staff can give as discount. Leave blank = no discount.">
                <Inp value={maxDiscountPct}
                  onChangeText={t => { setMaxDiscountPct(t.replace(/[^0-9.]/g, '')); setErrors(e => ({ ...e, maxDiscountPct: '' })); }}
                  placeholder="e.g. 10" keyboardType="decimal-pad" />
              </Field>

              {/* Product dropdown — only shown when discount % is set */}
              {hasDiscount && (
                <ProductPicker
                  products={products}
                  selectedIds={discountProductIds}
                  onDone={setDiscountProductIds}
                />
              )}
            </View>

            {/* ── 4. SALARY SUMMARY ── */}
            {(fixedNum > 0 || incvAmount > 0 || hasDiscount) && (
              <>
                <SH icon="receipt-outline" title="Salary Summary" color={Colors.secondary} />
                <View style={[st.card, { gap: 0, padding: 0, overflow: 'hidden' }]}>
                  {fixedNum > 0 && (
                    <View style={st.sumRow}>
                      <View style={[st.sumIcon, { backgroundColor: '#27AE6018' }]}>
                        <Ionicons name="wallet-outline" size={13} color="#27AE60" />
                      </View>
                      <Text style={st.sumLabel}>Fixed Salary</Text>
                      <Text style={[st.sumVal, { color: '#27AE60' }]}>{fmt(fixedNum)}/mo</Text>
                    </View>
                  )}
                  {incvAmount > 0 && (
                    <View style={st.sumRow}>
                      <View style={[st.sumIcon, { backgroundColor: '#8E44AD18' }]}>
                        <Ionicons name="percent-outline" size={13} color="#8E44AD" />
                      </View>
                      <Text style={st.sumLabel}>Incentive ({incvNum}%)</Text>
                      <Text style={[st.sumVal, { color: '#8E44AD' }]}>{fmt(incvAmount)}/mo</Text>
                    </View>
                  )}
                  {monthlyTotal > 0 && (
                    <View style={st.sumTotal}>
                      <Text style={st.sumTotalLbl}>Monthly Guaranteed</Text>
                      <Text style={st.sumTotalVal}>{fmt(monthlyTotal)}</Text>
                    </View>
                  )}
                  {hasDiscount && (
                    <View style={[st.sumRow, { borderBottomWidth: 0 }]}>
                      <View style={[st.sumIcon, { backgroundColor: Colors.primary + '18' }]}>
                        <Ionicons name="cut-outline" size={13} color={Colors.primary} />
                      </View>
                      <Text style={st.sumLabel}>Discount Authority</Text>
                      <Text style={[st.sumVal, { color: Colors.primary }]}>≤ {maxDiscNum}%</Text>
                    </View>
                  )}
                </View>
              </>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F4F7' },
  scroll: { padding: 16, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.secondary, paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { marginRight: 10 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#FFF' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  saveBtnTxt: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderTxt: { fontSize: 14, color: Colors.textSecondary },

  sh: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 20, marginBottom: 8 },
  shBar: { width: 3, height: 17, borderRadius: 2 },
  shTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },

  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, ...Shadows.sm, gap: 14 },
  divider: { height: 1, backgroundColor: Colors.borderLight },

  field: { gap: 5 },
  fLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.3, textTransform: 'uppercase' },
  input: { backgroundColor: '#F7F8FA', borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: Colors.textPrimary },
  inputDis: { backgroundColor: Colors.borderLight, color: Colors.textTertiary },
  textarea: { height: 72, paddingTop: 10 },
  err: { fontSize: 11, color: Colors.error },
  hint: { fontSize: 11, color: Colors.textTertiary, lineHeight: 16 },

  // App Access
  accessHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 0 },
  accessLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  accessBadge: { backgroundColor: Colors.primaryBg, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2 },
  accessBadgeTxt: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  accessBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  accessBtnOpen: { backgroundColor: Colors.success },
  accessBtnTxt: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  saRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  saTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  saSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  saBtn: { backgroundColor: Colors.secondaryBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  saBtnTxt: { fontSize: 11, fontWeight: '700', color: Colors.secondary },

  modRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#F7F8FA' },
  modRowOn: { borderColor: Colors.secondary, backgroundColor: Colors.secondaryBg },
  modIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modMeta: { flex: 1 },
  modName: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  modDesc: { fontSize: 10, color: Colors.textTertiary, marginTop: 1 },
  cb: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  cbOn: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },

  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.warningBg, borderRadius: 8, padding: 10 },
  warnTxt: { flex: 1, fontSize: 11, color: Colors.warningText },
  doneBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.success, borderRadius: 10, paddingVertical: 10 },
  doneTxt: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  // Incentive
  incvRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  incvArrow: { paddingTop: 26, alignItems: 'center' },
  incvResult: { backgroundColor: Colors.secondaryBg, borderRadius: 10, padding: 12 },
  incvResVal: { fontSize: 18, fontWeight: '900', color: Colors.secondary },
  incvResHint: { fontSize: 10, color: Colors.textTertiary },

  // Product picker
  prodTrig: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F7F8FA', borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 11 },
  prodTrigTxt: { flex: 1, fontSize: 13, color: Colors.textPrimary },

  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 8, maxHeight: '80%' },
  sheetHandle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  sheetTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  sheetClose: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  sheetSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginVertical: 10, backgroundColor: Colors.background, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 40 },
  sheetSI: { flex: 1, fontSize: 13, color: Colors.textPrimary, paddingVertical: 0 },
  prodRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  prodRowOn: { backgroundColor: Colors.secondaryBg },
  prodName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  prodCode: { fontSize: 11, color: Colors.textTertiary, marginTop: 1 },
  sheetDoneRow: { paddingHorizontal: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  sheetDoneBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13 },
  sheetDoneTxt: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Summary
  sumRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F2F5' },
  sumIcon: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  sumLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  sumVal: { fontSize: 13, fontWeight: '800' },
  sumTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.secondaryBg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.secondary + '30' },
  sumTotalLbl: { fontSize: 13, fontWeight: '700', color: Colors.secondary },
  sumTotalVal: { fontSize: 17, fontWeight: '900', color: Colors.secondary },
});
