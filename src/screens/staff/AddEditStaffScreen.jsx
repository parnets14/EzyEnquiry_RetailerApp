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
import { staffApi, myProductApi, productApi } from '../../utils/api';

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

// ─── Preset role access ───────────────────────────────────────
// Mirrors the wholesaler's STAFF_ROLES list, adapted to what staff do in the
// Retailer App. Picking a preset fills the designation; picking a module set
// still controls actual permissions. Owners can also add a custom name.
const STAFF_ROLES = [
  { key: 'Manager',         label: 'Manager',         desc: 'Orders, Enquiries, Customers, Invoices' },
  { key: 'Accountant',      label: 'Accountant',      desc: 'Invoices, Reports, Payments' },
  { key: 'Sales Executive', label: 'Sales Executive', desc: 'Enquiries, Orders, Customers' },
  { key: 'Store Keeper',    label: 'Store Keeper',    desc: 'Products, Orders' },
];

// Suggested module set per preset role — applied when a preset is picked.
const ROLE_MODULES = {
  'Manager':         ['dashboard', 'products', 'enquiries', 'orders', 'invoices', 'customers', 'notifications', 'reports'],
  'Accountant':      ['dashboard', 'invoices', 'reports', 'notifications'],
  'Sales Executive': ['dashboard', 'products', 'enquiries', 'orders', 'customers', 'notifications'],
  'Store Keeper':    ['dashboard', 'products', 'orders', 'notifications'],
};

const fmt    = n => Number(n) > 0 ? `\u20B9${Number(n).toLocaleString('en-IN')}` : '\u2014';
const fmtAmt = n => Number(n) > 0 ? `\u20B9${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}` : null;

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
// ══════════════════════════════════════════════════════════════
// ProductDiscountList — flat Item / Max % table (wholesaler parity)
// productDiscounts: [{ id, name, code, mrp, retailPrice, discount }]
// ══════════════════════════════════════════════════════════════
function ProductDiscountList({ products, productsLoading, productDiscounts, onChange }) {
  const [vis, setVis] = useState(false);
  const [q,   setQ]   = useState('');
  const insets = useSafeAreaInsets();

  const addedIds = new Set(productDiscounts.map(d => d.id));

  const filtered = (q.trim()
    ? products.filter(p =>
        (p.name || '').toLowerCase().includes(q.toLowerCase()) ||
        (p.code || '').toLowerCase().includes(q.toLowerCase()))
    : products
  ).filter(p => !addedIds.has(p.id || p._id));

  const addProduct = (p) => {
    const id = p.id || p._id;
    if (addedIds.has(id)) return;
    onChange([...productDiscounts, {
      id,
      name:        p.name        || '',
      code:        p.code        || '',
      mrp:         p.mrp         || 0,
      retailPrice: p.retailPrice || 0,
      discount:    '',
    }]);
    setVis(false);
    setQ('');
  };

  const removeProduct = (id) => onChange(productDiscounts.filter(d => d.id !== id));

  const updateDiscount = (id, val) =>
    onChange(productDiscounts.map(d =>
      d.id === id ? { ...d, discount: val.replace(/[^0-9.]/g, '') } : d
    ));

  return (
    <View style={{ gap: 10 }}>

      <Text style={st.hint}>
        Choose items this staff member can offer a discount on, then set the
        maximum discount % allowed per item. Staff cannot exceed these limits.
        This is private to the staff profile — customers never see it.
      </Text>

      {/* Header row — mirrors the wholesaler's slabHead */}
      {productDiscounts.length > 0 && (
        <View style={st.slabHead}>
          <Text style={[st.slabHeadTxt, { flex: 2 }]}>Item</Text>
          <Text style={[st.slabHeadTxt, { flex: 1, textAlign: 'center' }]}>Max %</Text>
          <View style={{ width: 30 }} />
        </View>
      )}

      {productDiscounts.map((d) => (
        <View key={d.id} style={st.authRow}>
          <View style={{ flex: 2, paddingRight: 8 }}>
            <Text style={st.authName} numberOfLines={1}>{d.name || 'Item'}</Text>
            {!!d.code && <Text style={st.authCode}>{d.code}</Text>}
          </View>
          <TextInput
            style={[st.slabInput, { flex: 1, textAlign: 'center' }]}
            value={d.discount}
            onChangeText={v => updateDiscount(d.id, v)}
            keyboardType="decimal-pad"
            placeholder="10"
            placeholderTextColor={Colors.textTertiary}
            maxLength={5}
          />
          <TouchableOpacity
            style={st.slabDel}
            onPress={() => removeProduct(d.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={20} color={Colors.border} />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={st.addSlabBtn} onPress={() => setVis(true)} activeOpacity={0.8}>
        <Ionicons name="add" size={15} color={Colors.primary} />
        <Text style={st.addSlabTxt}>Select Items</Text>
      </TouchableOpacity>

      {/* ── Product picker bottom sheet ── */}
      <Modal
        visible={vis}
        transparent
        animationType="slide"
        onRequestClose={() => { setVis(false); setQ(''); }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback onPress={() => { setVis(false); setQ(''); }}>
            <View style={st.sheetOverlay}>
              <TouchableWithoutFeedback>
                <View style={st.sheet}>
                  <View style={st.sheetHandle} />

                  {/* Sheet header */}
                  <View style={st.sheetHead}>
                    <View>
                      <Text style={st.sheetTitle}>Select Product</Text>
                      <Text style={st.sheetSubtitle}>
                        {products.length - addedIds.size} available · {addedIds.size} already added
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => { setVis(false); setQ(''); }} style={st.sheetClose}>
                      <Ionicons name="close" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {/* Search */}
                  <View style={st.sheetSearch}>
                    <Ionicons name="search-outline" size={14} color={Colors.textTertiary} />
                    <TextInput
                      style={st.sheetSI}
                      value={q}
                      onChangeText={setQ}
                      autoFocus
                      placeholder="Search by name or code…"
                      placeholderTextColor={Colors.textTertiary}
                    />
                    {q.length > 0 && (
                      <TouchableOpacity onPress={() => setQ('')}>
                        <Ionicons name="close-circle" size={15} color={Colors.textTertiary} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Product list */}
                  <ScrollView
                    style={{ maxHeight: 380 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled">
                    {filtered.length === 0 ? (
                      <View style={{ padding: 32, alignItems: 'center', gap: 8 }}>
                        {productsLoading ? (
                          <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                          <>
                            <Ionicons name="cube-outline" size={28} color={Colors.border} />
                            <Text style={{ color: Colors.textTertiary, fontSize: 13, textAlign: 'center' }}>
                              {products.length === 0
                                ? 'No products in catalogue'
                                : q.trim()
                                  ? 'No products match your search'
                                  : 'All products already added'}
                            </Text>
                          </>
                        )}
                      </View>
                    ) : (
                      filtered.map(p => {
                        const id       = p.id || p._id;
                        const hasMrp   = p.mrp > 0;
                        const hasRetail= p.retailPrice > 0;
                        return (
                          <TouchableOpacity
                            key={id}
                            style={st.sheetProdRow}
                            onPress={() => addProduct(p)}
                            activeOpacity={0.75}>
                            {/* Left icon */}
                            <View style={st.sheetProdIcon}>
                              <Ionicons name="cube-outline" size={16} color={Colors.primary} />
                            </View>
                            {/* Info */}
                            <View style={{ flex: 1 }}>
                              <Text style={st.prodName} numberOfLines={1}>{p.name}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                                {p.code ? (
                                  <Text style={st.prodCode}>{p.code}</Text>
                                ) : null}
                                {hasMrp && (
                                  <Text style={st.sheetProdMrp}>MRP {fmtAmt(p.mrp)}</Text>
                                )}
                                {!hasMrp && hasRetail && (
                                  <Text style={st.sheetProdMrp}>₹{fmtAmt(p.retailPrice)}</Text>
                                )}
                              </View>
                            </View>
                            {/* Add icon */}
                            <View style={st.sheetProdAdd}>
                              <Ionicons name="add" size={14} color={Colors.primary} />
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>

                  <View style={{ height: Math.max(insets.bottom, 16) }} />
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

  // Role access — a preset (from STAFF_ROLES) or a custom name.
  // `selectedCustom` wins when set, matching the wholesaler's behaviour.
  const existingRoleAccess = editStaff?.role_access || editStaff?.designation || '';
  const presetMatch = STAFF_ROLES.find(
    r => existingRoleAccess.toLowerCase() === r.key.toLowerCase(),
  )?.key || '';
  const [role,           setRole]           = useState(presetMatch || (existingRoleAccess ? '' : 'Sales Executive'));
  const [selectedCustom, setSelectedCustom] = useState(presetMatch ? '' : existingRoleAccess);
  const [customRoles,    setCustomRoles]    = useState(
    (presetMatch || !existingRoleAccess) ? [] : [existingRoleAccess],
  );
  const [showRoleModal,  setShowRoleModal]  = useState(false);
  const [newRoleName,    setNewRoleName]    = useState('');

  // App Access
  const [accessKeys, setAccessKeys] = useState(() => new Set(editStaff?.staff_app_access || []));

  // Salary
  const bd = editStaff?.salary_breakdown || {};
  const [fixedSalary,    setFixedSalary]    = useState(bd.fixed_salary > 0 ? String(bd.fixed_salary) : '');

  // Incentive slabs — "when sales reach sales_amount, pay incentive_pct %".
  // The highest reached slab applies.
  const [slabs, setSlabs] = useState(
    Array.isArray(bd.incentive_slabs) && bd.incentive_slabs.length
      ? bd.incentive_slabs.map(s => ({
          sales_amount:  String(s.sales_amount  ?? ''),
          incentive_pct: String(s.incentive_pct ?? ''),
        }))
      : [],
  );

  // Live current-month sales + earned incentive (edit mode only).
  const [earned, setEarned] = useState(null);

  // Product discounts — includes mrp + retailPrice for display
  const [productDiscounts, setProductDiscounts] = useState(
    (bd.product_discounts || []).map(d => ({
      id:          d.id || d._id,
      name:        d.name        || '',
      code:        d.code        || '',
      mrp:         d.mrp         || 0,
      retailPrice: d.retailPrice || d.retail_price || 0,
      discount:    d.discount != null ? String(d.discount) : '',
    }))
  );

  // Products catalogue for picker
  const [products,        setProducts]        = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // UI
  const [saving,       setSaving]       = useState(false);
  const [initialising, setInitialising] = useState(isEdit);
  const [errors,       setErrors]       = useState({});

  // Load products — keep mrp + retailPrice for the discount cards
  useEffect(() => {
    setProductsLoading(true);
    Promise.all([
      productApi.search({ limit: 200 }),
      myProductApi.list({ limit: 200 }),
    ])
      .then(([catalogData, myData]) => {
        const catalogList = (catalogData?.products || []).map(p => ({
          id:          String(p.id || p._id),
          name:        p.name                            || '',
          code:        p.productCode || p.code           || '',
          mrp:         Number(p.prices?.mrp)             || Number(p.mrp)          || 0,
          retailPrice: Number(p.prices?.retail_price)   || Number(p.retail_price)  || 0,
        }));
        const myList = (myData?.products || []).map(p => ({
          id:          String(p.id || p._id),
          name:        p.name          || '',
          code:        p.code          || '',
          mrp:         Number(p.mrp)   || 0,
          retailPrice: Number(p.retail_price) || Number(p.retailPrice) || 0,
        }));
        // Merge, dedupe by id
        const seen   = new Set();
        const merged = [...catalogList, ...myList].filter(p => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
        setProducts(merged);
      })
      .catch(() => {})
      .finally(() => setProductsLoading(false));
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
        setName(s.name           || '');
        setEmail(s.email         || '');
        setDesignation(s.designation || '');
        setAccessKeys(new Set(s.staff_app_access || []));
        const fbd = s.salary_breakdown || {};
        setFixedSalary(        fbd.fixed_salary         > 0 ? String(fbd.fixed_salary)         : '');
        setSlabs(
          Array.isArray(fbd.incentive_slabs) && fbd.incentive_slabs.length
            ? fbd.incentive_slabs.map(x => ({
                sales_amount:  String(x.sales_amount  ?? ''),
                incentive_pct: String(x.incentive_pct ?? ''),
              }))
            : [],
        );
        // Role access — restore preset or custom selection.
        const ra = s.role_access || s.designation || '';
        const pm = STAFF_ROLES.find(r => ra.toLowerCase() === r.key.toLowerCase())?.key || '';
        if (pm) { setRole(pm); setSelectedCustom(''); }
        else if (ra) { setRole(''); setSelectedCustom(ra); setCustomRoles([ra]); }
        setProductDiscounts(
          (fbd.product_discounts || []).map(d => ({
            id:          d.id || d._id,
            name:        d.name        || '',
            code:        d.code        || '',
            mrp:         d.mrp         || 0,
            retailPrice: d.retailPrice || d.retail_price || 0,
            discount:    d.discount != null ? String(d.discount) : '',
          }))
        );
      } catch { /* keep params */ }
      finally { if (!cancelled) setInitialising(false); }
    })();
    return () => { cancelled = true; };
  }, [isEdit, editStaff?._id]);

  // ── "This Month" earned incentive (edit mode only) ────────────────────────
  useEffect(() => {
    if (!isEdit || !editStaff?._id) return;
    let alive = true;
    staffApi.incentive(editStaff._id)
      .then(res => { if (alive) setEarned(res?.data ?? res ?? null); })
      .catch(() => { /* the card simply stays hidden */ });
    return () => { alive = false; };
  }, [isEdit, editStaff?._id]);

  // ── Role access helpers ───────────────────────────────────────────────────
  // Picking a preset also seeds the module checkboxes (owner can still adjust).
  const pickPreset = (key) => {
    setRole(key);
    setSelectedCustom('');
    setDesignation(key);
    const mods = ROLE_MODULES[key];
    if (mods) setAccessKeys(new Set(mods));
  };

  const pickCustom = (name) => {
    setSelectedCustom(name);
    setRole('');
    setDesignation(name);
  };

  const addCustomRole = () => {
    const n = newRoleName.trim();
    if (!n) return;
    if (!customRoles.some(r => r.toLowerCase() === n.toLowerCase())) {
      setCustomRoles(prev => [...prev, n]);
    }
    pickCustom(n);
    setNewRoleName('');
    setShowRoleModal(false);
  };

  const roleAccess = selectedCustom || role || '';

  // ── Incentive slab helpers ────────────────────────────────────────────────
  const addSlab    = () => setSlabs(s => [...s, { sales_amount: '', incentive_pct: '' }]);
  const removeSlab = (i) => setSlabs(s => s.filter((_, idx) => idx !== i));
  const setSlabVal = (i, k, v) =>
    setSlabs(s => s.map((row, idx) => idx === i ? { ...row, [k]: v.replace(/[^\d.]/g, '') } : row));

  // Computed salary
  const fixedNum = Number(fixedSalary) || 0;

  const validate = () => {
    const e = {};
    if (!name.trim())                        e.name           = 'Staff name is required.';
    if (!/^\d{10}$/.test(mobile.trim()))     e.mobile         = 'Enter a valid 10-digit mobile number.';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email.';
    if (!roleAccess)                         e.role           = 'Select or add a role access.';
    if (fixedSalary && isNaN(Number(fixedSalary)))    e.fixedSalary    = 'Enter a valid number.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const checked = [...accessKeys];
      const isAll   = ALL_KEYS.every(k => checked.includes(k));

      // Clean slabs: keep only valid rows, sorted ascending by sales amount.
      const cleanSlabs = slabs
        .map(s => ({
          sales_amount:  Number(s.sales_amount),
          incentive_pct: Number(s.incentive_pct),
        }))
        .filter(s => isFinite(s.sales_amount) && s.sales_amount > 0 && isFinite(s.incentive_pct) && s.incentive_pct >= 0)
        .sort((a, b) => a.sales_amount - b.sales_amount);

      // Clean product discounts: keep rows with a valid id + 0–100 %.
      const cleanDiscounts = productDiscounts
        .map(d => ({
          id:          d.id,
          name:        d.name,
          code:        d.code,
          mrp:         Number(d.mrp) || 0,
          retailPrice: Number(d.retailPrice) || 0,
          discount:    Number(d.discount) || 0,
        }))
        .filter(d => d.id && d.discount >= 0 && d.discount <= 100);

      const payload = {
        name:              name.trim(),
        mobile:            mobile.trim(),
        email:             email.trim(),
        designation:       designation.trim() || roleAccess,
        role_access:       roleAccess,
        staff_app_access:  isAll ? [] : checked,
        fixed_salary:      fixedNum,
        incentive_slabs:   cleanSlabs,
        sales_percentage:  0,
        discount_access:   cleanDiscounts.length > 0,
        max_discount_percent: cleanDiscounts.length
          ? Math.max(...cleanDiscounts.map(d => d.discount))
          : 0,
        product_discounts: cleanDiscounts,
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
        <TouchableOpacity
          style={[st.saveBtn, (saving || initialising) && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving || initialising}>
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
          keyboardVerticalOffset={0}>
          <ScrollView
            contentContainerStyle={st.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive">

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

            {/* ── 1b. ROLE ACCESS ── */}
            <SH icon="shield-key-outline" title="Role Access" color={Colors.primary} />
            <View style={st.card}>
              {STAFF_ROLES.map(r => {
                const active = !selectedCustom && role === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    style={st.roleRow}
                    onPress={() => pickPreset(r.key)}
                    activeOpacity={0.85}>
                    <View style={[st.radio, active && st.radioActive]}>
                      {active && <Ionicons name="checkmark" size={13} color="#FFF" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.roleLabel, active && { color: Colors.primary }]}>{r.label}</Text>
                      <Text style={st.roleDesc}>{r.desc}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Custom role names added by the owner */}
              {customRoles.map(cname => {
                const active = selectedCustom === cname;
                return (
                  <TouchableOpacity
                    key={cname}
                    style={st.roleRow}
                    onPress={() => pickCustom(cname)}
                    activeOpacity={0.85}>
                    <View style={[st.radio, active && st.radioActive]}>
                      {active && <Ionicons name="checkmark" size={13} color="#FFF" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.roleLabel, active && { color: Colors.primary }]}>{cname}</Text>
                      <Text style={st.roleDesc}>Custom access</Text>
                    </View>
                    <View style={st.customTag}>
                      <Text style={st.customTagTxt}>Custom</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {!!errors.role && <Text style={st.err}>{errors.role}</Text>}

              <TouchableOpacity
                style={st.addRoleBtn}
                onPress={() => { setNewRoleName(''); setShowRoleModal(true); }}
                activeOpacity={0.8}>
                <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                <Text style={st.addRoleTxt}>Add Role Access</Text>
              </TouchableOpacity>

              <Text style={[st.hint, { marginTop: 10 }]}>
                The role you pick decides what this staff member can access in the app.
                Add a custom role if none of the presets fit.
              </Text>
            </View>

            {/* App access is derived from the chosen Role Access above — the
                wholesaler works the same way. `accessKeys` is still sent with
                the payload; it is simply no longer edited by hand here. */}

            {/* ── 3. SALARY DETAILS ── (same separate-card layout as the wholesaler) */}
            <SH icon="cash-outline" title="Salary Details" color="#27AE60" />
            <View style={st.card}>
              <Field label="Monthly Salary (₹)" error={errors.fixedSalary}
                hint="Guaranteed base pay every month">
                <Inp value={fixedSalary}
                  onChangeText={t => { setFixedSalary(t.replace(/[^0-9.]/g, '')); setErrors(e => ({ ...e, fixedSalary: '' })); }}
                  placeholder="e.g. 15000" keyboardType="decimal-pad" />
              </Field>
            </View>

            {/* ── 4. INCENTIVE DETAILS ── own card, like the wholesaler */}
            <SH icon="trending-up-outline" title="Incentive Details" color="#8E44AD" />
            <View style={st.card}>
              <Text style={st.hint}>
                Add slabs: when the staff&apos;s sales reach an amount, they earn that %.
                The highest reached slab applies.
              </Text>

              {/* Incentive slabs (sales amount → %) */}
              {slabs.length > 0 && (
                <View style={st.slabHead}>
                  <Text style={[st.slabHeadTxt, { flex: 1.4 }]}>Sales ≥ (₹)</Text>
                  <Text style={[st.slabHeadTxt, { flex: 1 }]}>Incentive %</Text>
                  <View style={{ width: 30 }} />
                </View>
              )}

              {slabs.map((s, i) => (
                <View key={i} style={st.slabRow}>
                  <TextInput
                    style={[st.slabInput, { flex: 1.4 }]}
                    value={s.sales_amount}
                    onChangeText={v => setSlabVal(i, 'sales_amount', v)}
                    keyboardType="decimal-pad"
                    placeholder="50000"
                    placeholderTextColor={Colors.textTertiary}
                  />
                  <TextInput
                    style={[st.slabInput, { flex: 1 }]}
                    value={s.incentive_pct}
                    onChangeText={v => setSlabVal(i, 'incentive_pct', v)}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor={Colors.textTertiary}
                  />
                  <TouchableOpacity
                    style={st.slabDel}
                    onPress={() => removeSlab(i)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={20} color={Colors.border} />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={st.addSlabBtn} onPress={addSlab} activeOpacity={0.8}>
                <Ionicons name="add" size={15} color={Colors.primary} />
                <Text style={st.addSlabTxt}>Add Incentive Slab</Text>
              </TouchableOpacity>

              {slabs.length > 0 && (
                <View style={st.slabExample}>
                  <Text style={st.slabExampleTxt}>
                    Example: Sales ₹50,000 → 1% · ₹1,00,000 → 2% · ₹2,00,000 → 3%
                  </Text>
                </View>
              )}
            </View>

            {/* ── 5. DISCOUNT AUTHORIZED ACCESS ── own card, like the wholesaler */}
            <SH icon="pricetags-outline" title="Discount Authorized Access" color={Colors.primary} />
            <View style={st.card}>
              <ProductDiscountList
                products={products}
                productsLoading={productsLoading}
                productDiscounts={productDiscounts}
                onChange={setProductDiscounts}
              />
            </View>

            {/* ── 3e. THIS MONTH EARNED (edit mode) ── */}
            {earned && (
              <>
                <SH
                  icon="wallet-outline"
                  title={`This Month${earned.periodLabel ? ` · ${earned.periodLabel}` : ''}`}
                  color={Colors.secondary}
                />
                <View style={st.earnedCard}>
                  <View style={st.earnedItem}>
                    <Text style={st.earnedLabel}>Sales</Text>
                    <Text style={st.earnedValue}>{fmt(earned.monthSales)}</Text>
                  </View>
                  <View style={st.earnedDivider} />
                  <View style={st.earnedItem}>
                    <Text style={st.earnedLabel}>Rate</Text>
                    <Text style={st.earnedValue}>{earned.pct || 0}%</Text>
                  </View>
                  <View style={st.earnedDivider} />
                  <View style={st.earnedItem}>
                    <Text style={st.earnedLabel}>Incentive</Text>
                    <Text style={[st.earnedValue, { color: Colors.primary }]}>{fmt(earned.amount)}</Text>
                  </View>
                </View>
                {!!earned.basisNote && (
                  <Text style={[st.hint, { marginTop: -8, marginBottom: 12 }]}>
                    {earned.basisNote}
                    {earned.orderCount != null ? ` ${earned.orderCount} order${earned.orderCount === 1 ? '' : 's'} this month.` : ''}
                  </Text>
                )}
              </>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ── Add Role Access modal ── */}
      <Modal
        visible={showRoleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRoleModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowRoleModal(false)}>
          <View style={st.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={st.modalCard}>
                <Text style={st.modalTitle}>Add Role Access</Text>
                <Text style={st.modalSub}>Create a custom access name for this staff member.</Text>
                <TextInput
                  style={st.input}
                  value={newRoleName}
                  onChangeText={setNewRoleName}
                  placeholder="e.g. Cashier, Floor Manager"
                  placeholderTextColor={Colors.textTertiary}
                  autoFocus
                />
                <View style={st.modalBtnRow}>
                  <TouchableOpacity style={st.modalGhost} onPress={() => setShowRoleModal(false)}>
                    <Text style={st.modalGhostTxt}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.modalPrimary} onPress={addCustomRole}>
                    <Text style={st.modalPrimaryTxt}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#F2F4F7' },
  scroll:      { padding: 16, paddingBottom: 120 },
  header:      { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.secondary, paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:     { marginRight: 10 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#FFF' },
  saveBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  saveBtnTxt:  { fontSize: 13, fontWeight: '700', color: '#FFF' },
  loader:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderTxt:   { fontSize: 14, color: Colors.textSecondary },

  sh:      { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 20, marginBottom: 8 },
  shBar:   { width: 3, height: 17, borderRadius: 2 },
  shTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },

  card:    { backgroundColor: '#FFF', borderRadius: 14, padding: 16, ...Shadows.sm, gap: 14 },

  field:    { gap: 5 },
  fLabel:   { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.3, textTransform: 'uppercase' },
  input:    { backgroundColor: '#F7F8FA', borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: Colors.textPrimary },
  inputDis: { backgroundColor: Colors.borderLight, color: Colors.textTertiary },
  err:      { fontSize: 11, color: Colors.error },
  hint:     { fontSize: 11, color: Colors.textTertiary, lineHeight: 16 },

  // App Access styles removed — access now comes from the selected Role Access.

  // ── Discount Authorized Access (flat Item / Max % table) ──
  authRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  authName: { fontSize: 13.5, fontWeight: '700', color: Colors.textPrimary },
  authCode: { fontSize: 11, color: Colors.textTertiary, marginTop: 1 },

  // ── Bottom sheet ──
  sheetOverlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:          { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 8, maxHeight: '85%' },
  sheetHandle:    { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  sheetHead:      { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  sheetTitle:     { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  sheetSubtitle:  { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  sheetClose:     { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  sheetSearch:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginVertical: 10, backgroundColor: Colors.background, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 40 },
  sheetSI:        { flex: 1, fontSize: 13, color: Colors.textPrimary, paddingVertical: 0 },

  sheetProdRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  sheetProdIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  sheetProdMrp:  { fontSize: 11, fontWeight: '700', color: '#E67E22', backgroundColor: '#FEF9E7', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  sheetProdAdd:  { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },

  prodName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  prodCode: { fontSize: 11, color: Colors.textTertiary },

  // ── Role Access ──
  roleRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  radio:        { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActive:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleLabel:    { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  roleDesc:     { fontSize: 11.5, color: Colors.textTertiary, marginTop: 1 },
  customTag:    { backgroundColor: Colors.primaryBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  customTagTxt: { fontSize: 9.5, fontWeight: '800', color: Colors.primary },
  addRoleBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed', backgroundColor: Colors.primaryBg },
  addRoleTxt:   { fontSize: 13, fontWeight: '800', color: Colors.primary },

  // ── Incentive slabs ──
  slabHead:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  slabHeadTxt:   { fontSize: 11, fontWeight: '800', color: Colors.textTertiary },
  slabRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  slabInput:     { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, height: 44, paddingHorizontal: 12, fontSize: 14, fontWeight: '600', color: Colors.textPrimary, backgroundColor: '#FFF' },
  slabDel:       { width: 30, alignItems: 'center' },
  addSlabBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed', backgroundColor: Colors.primaryBg },
  addSlabTxt:    { fontSize: 13, fontWeight: '800', color: Colors.primary },
  slabExample:   { marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: Colors.secondaryBg },
  slabExampleTxt:{ fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },

  // ── This Month earned ──
  earnedCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.secondary, borderRadius: 14, paddingVertical: 16, marginBottom: 14 },
  earnedItem:    { flex: 1, alignItems: 'center' },
  earnedLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  earnedValue:   { fontSize: 15, fontWeight: '900', color: '#FFF' },
  earnedDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.15)' },

  // ── Modal ──
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(15,22,38,0.55)', justifyContent: 'center', padding: 24 },
  modalCard:      { backgroundColor: '#FFF', borderRadius: 18, padding: 20 },
  modalTitle:     { fontSize: 17, fontWeight: '900', color: Colors.textPrimary },
  modalSub:       { fontSize: 12.5, color: Colors.textSecondary, marginTop: 3, marginBottom: 14 },
  modalBtnRow:    { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalGhost:     { flex: 1, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  modalGhostTxt:  { fontSize: 14, fontWeight: '800', color: Colors.textSecondary },
  modalPrimary:   { flex: 1, height: 46, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  modalPrimaryTxt: { fontSize: 14, fontWeight: '800', color: '#FFF' },
});
