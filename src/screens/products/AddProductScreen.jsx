/**
 * AddProductScreen.jsx
 *
 * 2-step wizard matching the admin panel ProductManagement page:
 *
 * STEP 1 — Select Category, Sub-Category (if available) and Brand.
 *           "Continue" is only enabled once those are chosen.
 *
 * STEP 2 — Full product form with category-specific dynamic fields
 *           (tiles, granite, marble, blocks, sanitaryware, other).
 *
 * Mirrors: EzyEnquiryCrm-frontend/src/pages/ProductManagement.jsx
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity,
  KeyboardAvoidingView, Platform, Image, Switch, Alert, ActivityIndicator,
  Modal, TouchableWithoutFeedback, TextInput as RNTextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import TextInput from '../../components/common/TextInput';
import PrimaryButton from '../../components/common/PrimaryButton';
import { myProductApi, catalogApi, mediaUrl } from '../../utils/api';
import {
  fieldsForType, matchCategoryType, labelForType,
  calcSqftPerBox, CATEGORY_DEFAULT_UNIT,
} from '../../config/productFieldSchema';

// ─── Constants ────────────────────────────────────────────────
const UNITS      = ['Sq Ft', 'Sq Mtr', 'Piece', 'Box', 'Nos'];
const GST_OPTS   = ['0', '5', '12', '18', '28'];
const SALE_TYPES = ['Regular Sale', 'B2B Sale', 'Export Sale', 'Project Sale'];
const PROD_TYPES = ['Regular Product', 'Premium Product', 'Economy Product', 'Exclusive Product'];
const MAX_IMAGES = 10;
const DISC_FIELDS = new Set([
  'retail_discount', 'dealer_discount', 'wholesale_discount', 'project_discount',
]);

const INITIAL_FORM = {
  name: '', alias: '', code: '', description: '', hsn_code: '',
  brand_name: '', category_name: '', sub_category_name: '',
  unit: 'Box', gst_percent: '18',
  purchase_rate: '', landing_cost: '', mrp: '',
  retail_discount: '', retail_rate: '',
  dealer_discount: '', dealer_rate: '',
  wholesale_discount: '', wholesale_rate: '',
  project_discount: '', project_rate: '',
  min_selling_rate: '', min_stock_level: '', reorder_level: '',
  sales_type: 'Regular Sale', product_type: 'Regular Product',
  new_arrival: false, featured: false,
  size: '', finish: '', color: '', surface: '', thickness: '', grade: '',
  tile_type: '', application: '', anti_skid: '', origin: '', manufacturer: '',
  design: '', collection: '', pcs_per_box: '', sqft_per_box: '', weight_per_box: '',
  material: '', barcode: '',
};

// ─── Helpers ──────────────────────────────────────────────────
function sanitizeDecimal(v) {
  const c = String(v ?? '').replace(/[^0-9.]/g, '');
  const d = c.indexOf('.');
  if (d < 0) return c.replace(/^0+(?=\d)/, '');
  return c.slice(0, d).replace(/^0+(?=\d)/, '') + '.' + c.slice(d + 1).replace(/\./g, '');
}
function sanitizeDiscount(v) {
  const r = String(v ?? '').trim();
  if (!r) return '';
  const c = sanitizeDecimal(r);
  const n = Number(c);
  return Number.isFinite(n) && n > 100 ? '100' : c;
}
function discountFrom(mrp, rate) {
  const m = Number(mrp), r = Number(rate);
  if (!(m > 0) || !(r >= 0) || r > m) return '';
  return ((1 - r / m) * 100).toFixed(2).replace(/\.00$/, '');
}
function getImageUrls(p = {}) {
  const raw = p._raw || p;
  return Array.isArray(raw.image_urls) ? raw.image_urls.filter(Boolean) : [];
}
function productToForm(p = {}) {
  const raw = p._raw || p;
  const sp = raw.specs || raw, pk = raw.packing || raw;
  const pr = raw.prices || raw, st = raw.stock || raw;
  const cl = raw.classification || raw, fl = raw.flags || {};
  const mrp = pr.mrp ?? raw.mrp;
  const rR = pr.retail_price ?? raw.retail_price;
  const dR = pr.dealer_price ?? raw.dealer_price;
  const wR = pr.wholesale_rate ?? raw.wholesale_rate;
  const pR = pr.project_rate ?? raw.project_rate;
  return {
    ...INITIAL_FORM,
    name: raw.name || '', alias: raw.alias || '',
    code: raw.code || p.productCode || '',
    description: raw.description || '',
    hsn_code: sp.hsn_code || raw.hsn_code || '',
    brand_name: raw.brand?.name || raw.brand_id?.name || p.brand || '',
    category_name: raw.category?.name || raw.category_id?.name || p.category || '',
    sub_category_name: raw.sub_category?.name || raw.sub_category_id?.name || p.subCategory || '',
    unit: raw.unit || 'Box',
    gst_percent: String(raw.gst_percent ?? '18'),
    purchase_rate: String(pr.purchase_price ?? raw.purchase_price ?? ''),
    landing_cost: String(pr.landing_cost ?? raw.landing_cost ?? ''),
    mrp: String(mrp ?? ''),
    retail_discount: discountFrom(mrp, rR), retail_rate: String(rR ?? ''),
    dealer_discount: discountFrom(mrp, dR), dealer_rate: String(dR ?? ''),
    wholesale_discount: discountFrom(mrp, wR), wholesale_rate: String(wR ?? ''),
    project_discount: discountFrom(mrp, pR), project_rate: String(pR ?? ''),
    min_selling_rate: String(pr.min_selling_rate ?? raw.min_selling_rate ?? ''),
    min_stock_level: String(st.min_stock_level ?? raw.min_stock_level ?? ''),
    reorder_level: String(st.reorder_level ?? raw.reorder_level ?? ''),
    sales_type: cl.sales_type || raw.sales_type || 'Regular Sale',
    product_type: cl.product_type || raw.product_type || 'Regular Product',
    new_arrival: !!(fl.new_arrival ?? raw.new_arrival),
    featured: !!(fl.featured ?? raw.featured),
    size: sp.size || raw.size || '', finish: sp.finish || raw.finish || '',
    color: sp.color || raw.color || '', surface: sp.surface || raw.surface || '',
    thickness: sp.thickness || raw.thickness || '', grade: sp.grade || raw.grade || '',
    tile_type: sp.tile_type || raw.tile_type || '',
    application: sp.application || raw.application || '',
    anti_skid: sp.anti_skid || raw.anti_skid || '',
    origin: sp.origin || raw.origin || '',
    manufacturer: sp.manufacturer || raw.manufacturer || '',
    barcode: sp.barcode || raw.barcode || '',
    design: sp.design || raw.design || '',
    collection: sp.collection || raw.collection || '',
    pcs_per_box: String(pk.pcs_per_box ?? raw.pcs_per_box ?? ''),
    sqft_per_box: String(pk.sqft_per_box ?? raw.sqft_per_box ?? ''),
    weight_per_box: String(pk.weight_per_box ?? raw.weight_per_box ?? ''),
    material: sp.material || raw.material || '',
  };
}

// ─── Shared UI components ─────────────────────────────────────
const SH = ({ title }) => (
  <View style={s.section}>
    <View style={s.sectionBar} />
    <Text style={s.sectionTitle}>{title}</Text>
  </View>
);

const TR = ({ label, value, onChange, last }) => (
  <View style={[s.toggleRow, !last && s.toggleBorder]}>
    <Text style={s.toggleLabel}>{label}</Text>
    <Switch value={value} onValueChange={onChange}
      trackColor={{ true: Colors.primary, false: Colors.border }} thumbColor="#FFF" />
  </View>
);

const PDR = ({ label, discount, rate, onD, onR }) => (
  <View style={s.priceRow}>
    <View style={s.priceCol}>
      <TextInput label={`${label} Disc %`} value={discount} onChangeText={onD}
        placeholder="0" keyboardType="decimal-pad" helperText="0–100 %" />
    </View>
    <View style={s.priceCol}>
      <TextInput label={`${label} Rate`} value={rate} onChangeText={onR}
        placeholder="0.00" keyboardType="decimal-pad" helperText="Auto-calc, editable" />
    </View>
  </View>
);

// ─── Bottom-sheet select ──────────────────────────────────────
function SelField({ label, value, options, onChange, required, placeholder = 'Select' }) {
  const [vis, setVis] = useState(false);
  const norm = (options || []).map(o => typeof o === 'string' ? { value: o, label: o } : o);
  const sel = norm.find(o => o.value === value);
  return (
    <View style={s.selWrap}>
      <Text style={s.selLabel}>
        {label}{required ? <Text style={{ color: Colors.error }}> *</Text> : null}
      </Text>
      <TouchableOpacity style={s.selTrigger} onPress={() => setVis(true)} activeOpacity={0.8}>
        <Text style={[s.selVal, !sel && s.selPH]} numberOfLines={1}>
          {sel?.label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={17} color={Colors.textTertiary} />
      </TouchableOpacity>
      <Modal visible={vis} transparent animationType="slide" onRequestClose={() => setVis(false)}>
        <TouchableWithoutFeedback onPress={() => setVis(false)}>
          <View style={s.overlay}>
            <TouchableWithoutFeedback>
              <View style={s.sheet}>
                <View style={s.sheetHandle} />
                <View style={s.sheetHead}>
                  <Text style={s.sheetTitle}>{label}</Text>
                  {value && !required && (
                    <TouchableOpacity onPress={() => { onChange(''); setVis(false); }} style={s.clearBtn}>
                      <Text style={s.clearTxt}>Clear</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setVis(false)} style={s.closeBtn}>
                    <Ionicons name="close" size={21} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={s.sheetList}>
                  {norm.map(o => {
                    const act = o.value === value;
                    return (
                      <TouchableOpacity key={o.value}
                        style={[s.sheetOpt, act && s.sheetOptAct]}
                        onPress={() => { onChange(o.value); setVis(false); }}>
                        <Text style={[s.sheetOptTxt, act && s.sheetOptTxtAct]}>{o.label}</Text>
                        {act && <Ionicons name="checkmark-circle" size={19} color={Colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

// ─── Searchable catalog select with "add new" ─────────────────
function CatalogSelect({
  label, items = [], selectedId, onSelect,
  placeholder, disabled, allowNew, onNew, freeValue = '',
}) {
  const [vis, setVis] = useState(false);
  const [q, setQ] = useState('');
  const sel = items.find(i => i._id === selectedId);
  const display = sel?.name || freeValue || '';
  const filtered = q.trim()
    ? items.filter(i => i.name.toLowerCase().includes(q.toLowerCase()))
    : items;
  const showNew = allowNew && q.trim() &&
    !items.some(i => i.name.toLowerCase() === q.toLowerCase());

  return (
    <View style={s.selWrap}>
      <Text style={s.selLabel}>{label}</Text>
      <TouchableOpacity
        style={[s.selTrigger, disabled && s.selTriggerDisabled]}
        onPress={() => { if (!disabled) { setQ(''); setVis(true); } }}
        activeOpacity={disabled ? 1 : 0.8}>
        <Text style={[s.selVal, !display && s.selPH]} numberOfLines={1}>
          {display || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={17} color={Colors.textTertiary} />
      </TouchableOpacity>
      {disabled && (
        <Text style={s.disabledHint}>Select a category first</Text>
      )}
      <Modal visible={vis && !disabled} transparent animationType="slide"
        onRequestClose={() => setVis(false)}>
        <TouchableWithoutFeedback onPress={() => setVis(false)}>
          <View style={s.overlay}>
            <TouchableWithoutFeedback>
              <View style={s.sheet}>
                <View style={s.sheetHandle} />
                <View style={s.sheetHead}>
                  <Text style={s.sheetTitle}>{label}</Text>
                  {display ? (
                    <TouchableOpacity style={s.clearBtn}
                      onPress={() => { onSelect(''); onNew && onNew(''); setVis(false); }}>
                      <Text style={s.clearTxt}>Clear</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={() => setVis(false)} style={s.closeBtn}>
                    <Ionicons name="close" size={21} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={s.searchBar}>
                  <Ionicons name="search-outline" size={15} color={Colors.textTertiary} />
                  <RNTextInput style={s.searchInput} value={q} onChangeText={setQ} autoFocus
                    placeholder={`Search or type new ${label.toLowerCase()}…`}
                    placeholderTextColor={Colors.textTertiary} />
                  {q.length > 0 && (
                    <TouchableOpacity onPress={() => setQ('')}>
                      <Ionicons name="close-circle" size={15} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView style={s.sheetList}>
                  {showNew && (
                    <TouchableOpacity style={s.newRow}
                      onPress={() => { onNew && onNew(q.trim()); setVis(false); setQ(''); }}>
                      <View style={s.newIcon}>
                        <Ionicons name="add" size={15} color={Colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.newLbl}>Add new {label.toLowerCase()}</Text>
                        <Text style={s.newVal}>"{q.trim()}"</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  {filtered.map(item => {
                    const act = item._id === selectedId;
                    return (
                      <TouchableOpacity key={item._id}
                        style={[s.sheetOpt, act && s.sheetOptAct]}
                        onPress={() => { onSelect(item._id); setVis(false); setQ(''); }}>
                        <Text style={[s.sheetOptTxt, act && s.sheetOptTxtAct]}>{item.name}</Text>
                        {item.code ? <Text style={s.itemCode}>{item.code}</Text> : null}
                        {act && <Ionicons name="checkmark-circle" size={19} color={Colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                  {filtered.length === 0 && !showNew && (
                    <View style={{ padding: 24, alignItems: 'center' }}>
                      <Text style={{ color: Colors.textTertiary, fontSize: 13 }}>
                        {q.trim()
                          ? `No ${label.toLowerCase()} found. Type to add.`
                          : `No ${label.toLowerCase()}s yet.`}
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

// ─── CollapsibleSpec ──────────────────────────────────────────
// Shows a section heading with an "Add" button.
// Tapping "Add" / "Edit" expands the fields inline below the heading.
// Tapping "Done" collapses them again.
function CollapsibleSpec({ title, fields, form, attrs, set, setAttr }) {
  const [open, setOpen] = useState(false);

  const filledCount = fields.filter(fd => {
    const v = fd.storeIn === 'column' ? form[fd.key] : attrs[fd.key];
    return v && String(v).trim() !== '';
  }).length;

  return (
    <View style={{ marginBottom: 4 }}>
      {/* Header row — always visible */}
      <View style={s.collapseHeader}>
        <View style={s.collapseLeft}>
          <View style={s.sectionBar} />
          <Text style={s.sectionTitle}>{title}</Text>
          {filledCount > 0 && !open && (
            <View style={s.collapseCount}>
              <Text style={s.collapseCountTxt}>{filledCount} filled</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[s.collapseBtn, open && s.collapseBtnOpen]}
          onPress={() => setOpen(v => !v)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={open ? 'checkmark-done-outline' : (filledCount > 0 ? 'create-outline' : 'add')}
            size={14}
            color="#FFF"
          />
          <Text style={s.collapseBtnTxt}>
            {open ? 'Done' : filledCount > 0 ? 'Edit' : 'Add'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Expandable fields */}
      {open && (
        <View style={s.collapseBody}>
          <View style={s.grid}>
            {fields.map(fd => {
              const fullW = fd.type !== 'select';
              const val = fd.storeIn === 'column'
                ? (form[fd.key] || '')
                : (attrs[fd.key] || '');
              const change = fd.storeIn === 'column'
                ? v => {
                    set(fd.key, fd.type === 'number' ? sanitizeDecimal(v) : v);
                    if (fd.key === 'size' || fd.key === 'pcs_per_box') {
                      const sq = calcSqftPerBox(
                        fd.key === 'size' ? v : form.size,
                        fd.key === 'pcs_per_box' ? v : form.pcs_per_box,
                      );
                      if (sq) set('sqft_per_box', sq);
                    }
                  }
                : v => setAttr(fd.key, v);
              return (
                <View key={fd.key} style={fullW ? s.gFull : s.g2}>
                  <DynField fd={fd} value={val} onChange={change} />
                </View>
              );
            })}
          </View>

          {/* Inline Done button at bottom of fields */}
          <TouchableOpacity
            style={s.collapseDoneBtn}
            onPress={() => setOpen(false)}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={15} color="#FFF" />
            <Text style={s.collapseDoneTxt}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Dynamic spec field ───────────────────────────────────────
function DynField({ fd, value, onChange }) {
  const lbl = fd.unit ? `${fd.label} (${fd.unit})` : fd.label;
  if (fd.type === 'select') {
    return (
      <SelField label={lbl} required={fd.required} value={value || ''}
        options={fd.options || []} onChange={onChange}
        placeholder={fd.placeholder || `Select ${fd.label}…`} />
    );
  }
  return (
    <TextInput label={lbl} required={fd.required} value={value || ''}
      onChangeText={onChange} placeholder={fd.placeholder || ''}
      keyboardType={fd.type === 'number' ? 'decimal-pad' : 'default'} />
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 1 component — Category / Sub-Category / Brand selector
// ═══════════════════════════════════════════════════════════════
function Step1({
  cats, subs, brands,
  catId, subId, brandId,
  onCatId, onSubId, onBrandId,
  catFreeText, brandFreeText,
  onCatFreeText, onBrandFreeText,
  onContinue, onCancel,
  typeOverride, onTypeOverride,
  bottomInset = 14,
}) {
  const catSel     = cats.find(c => c._id === catId);
  const catName    = catSel?.name || catFreeText || '';
  const brandSel   = brands.find(b => b._id === brandId);
  const brandName  = brandSel?.name || brandFreeText || '';
  const hasSubs    = subs.length > 0;
  const subSel     = subs.find(s => s._id === subId);

  // Requirement mirror of admin panel:
  // Category + Brand required; Sub-Category only when category has subs
  const selectionComplete = !!catName && !!brandName && (!hasSubs || !!subId);

  // Use manual override if set, otherwise auto-detect from names
  const catType = typeOverride || matchCategoryType(catName, subSel?.name || '');

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.step1Scroll} keyboardShouldPersistTaps="handled">

        {/* Step label */}
        <View style={s.stepLabel}>
          <View style={s.stepDot}><Text style={s.stepDotTxt}>1</Text></View>
          <Text style={s.stepTxt}>SELECT CATEGORY, SUB-CATEGORY & BRAND</Text>
        </View>

        {/* Category */}
        <CatalogSelect
          label="Category *"
          items={cats}
          selectedId={catId}
          onSelect={id => { onCatId(id); onSubId(''); }}
          placeholder="Search categories…"
          allowNew
          onNew={n => { onCatId(''); onCatFreeText(n); onSubId(''); }}
          freeValue={!catId ? catFreeText : ''}
        />

        {/* Sub-Category — only when category has subs */}
        <CatalogSelect
          label="Sub-Category"
          items={subs}
          selectedId={subId}
          onSelect={onSubId}
          placeholder={hasSubs ? 'Select sub-category…' : 'No sub-categories yet'}
          disabled={!catName}
          allowNew
          onNew={n => { onSubId(''); }}
          freeValue=""
        />

        {/* Brand */}
        <CatalogSelect
          label="Brand *"
          items={brands}
          selectedId={brandId}
          onSelect={onBrandId}
          placeholder="Search brands…"
          allowNew
          onNew={n => { onBrandId(''); onBrandFreeText(n); }}
          freeValue={!brandId ? brandFreeText : ''}
        />

        {/* Info hint — matches admin panel */}
        {!selectionComplete && (
          <View style={s.step1Hint}>
            <Ionicons name="information-circle-outline" size={15} color={Colors.primary} />
            <Text style={s.step1HintTxt}>
              Please select <Text style={{ fontWeight: '700' }}>Category</Text> and{' '}
              <Text style={{ fontWeight: '700' }}>Brand</Text> to continue adding the product details.
            </Text>
          </View>
        )}

        {/* Product Type Selection — shown once category is picked */}
        {!!catName && (
          <View style={s.typeSection}>
            {/* Heading */}
            <View style={s.typeSectionHead}>
              <Text style={s.typeSectionTitle}>Product Type</Text>
              <Text style={s.typeSectionSub}>
                Auto-detected from category · tap to change
              </Text>
            </View>

            {/* Type cards */}
            <View style={s.typeCardRow}>
              {[
                { key: 'tiles',        label: 'Tiles',        icon: 'grid-outline',    color: '#2980B9', bg: '#EBF5FB' },
                { key: 'granite',      label: 'Granite',      icon: 'diamond-outline', color: '#7D6608', bg: '#FEF9E7' },
                { key: 'marble',       label: 'Marble',       icon: 'ellipse-outline', color: '#8E44AD', bg: '#F5EEF8' },
                { key: 'blocks',       label: 'Blocks',       icon: 'cube-outline',    color: '#E67E22', bg: '#FDF0E4' },
                { key: 'sanitaryware', label: 'Sanitary',     icon: 'water-outline',   color: '#16A085', bg: '#E8F8F5' },
                { key: 'other',        label: 'General',      icon: 'apps-outline',    color: '#566573', bg: '#F2F3F4' },
              ].map(t => {
                const active = catType === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[
                      s.typeCard,
                      { borderColor: active ? t.color : Colors.border },
                      active && { backgroundColor: t.bg },
                    ]}
                    onPress={() => onTypeOverride(t.key)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={t.icon}
                      size={13}
                      color={active ? t.color : Colors.textTertiary}
                    />
                    <Text style={[s.typeCardLabel, active && { color: t.color, fontWeight: '800' }]}>
                      {t.label}
                    </Text>
                    {active && (
                      <View style={[s.typeCardCheck, { backgroundColor: t.color }]}>
                        <Ionicons name="checkmark" size={8} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer buttons */}
      <View style={[s.step1Footer, { paddingBottom: bottomInset }]}>
        <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
          <Text style={s.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.continueBtn, !selectionComplete && s.continueBtnDisabled]}
          onPress={selectionComplete ? onContinue : undefined}
          activeOpacity={selectionComplete ? 0.85 : 1}>
          <Text style={[s.continueTxt, !selectionComplete && s.continueTxtDisabled]}>
            Continue to Details
          </Text>
          <Ionicons name="arrow-forward" size={16}
            color={selectionComplete ? '#FFF' : Colors.textTertiary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main screen
// ═══════════════════════════════════════════════════════════════
export default function AddProductScreen({ navigation, route }) {
  const editProduct = route?.params?.mode === 'edit' ? route.params.product : null;
  const productId   = editProduct?.id || editProduct?._raw?.id;
  const isEdit      = Boolean(productId);

  // Step: 1 = selection, 2 = full form
  const [step, setStep] = useState(isEdit ? 2 : 1);

  // Form state
  const [form,     setForm]     = useState(() => isEdit ? productToForm(editProduct) : { ...INITIAL_FORM });
  const [exImgs,   setExImgs]   = useState(() => isEdit ? getImageUrls(editProduct) : []);
  const [newImgs,  setNewImgs]  = useState([]);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [ready,    setReady]    = useState(!isEdit);
  const [fetching, setFetching] = useState(isEdit);
  const [attrs,    setAttrs]    = useState({});

  // Catalog state
  const [cats,        setCats]        = useState([]);
  const [subs,        setSubs]        = useState([]);
  const [brands,      setBrands]      = useState([]);
  const [catId,       setCatId]       = useState('');
  const [subId,       setSubId]       = useState('');
  const [brandId,     setBrandId]     = useState('');
  const [catFreeText, setCatFreeText] = useState('');
  const [brandFreeText, setBrandFreeText] = useState('');
  // Manual product type override (user can correct auto-detection in Step 1)
  const [typeOverride, setTypeOverride] = useState('');

  // Category type for dynamic fields — override beats auto-detection
  const catSel   = cats.find(c => c._id === catId);
  const subSel   = subs.find(s => s._id === subId);
  const catName  = catSel?.name  || catFreeText  || form.category_name  || '';
  const brandName= brands.find(b => b._id === brandId)?.name || brandFreeText || form.brand_name || '';
  const catType  = typeOverride || matchCategoryType(catName, subSel?.name || form.sub_category_name || '');
  const dynFields = fieldsForType(catType);

  // ── Load catalog ──────────────────────────────────────────
  useEffect(() => {
    Promise.all([catalogApi.categories(), catalogApi.brands()])
      .then(([cr, br]) => {
        setCats(cr?.data || cr || []);
        setBrands(br?.data || br || []);
      })
      .catch(() => {});
  }, []);

  // ── Sub-categories when catId changes ─────────────────────
  useEffect(() => {
    if (!catId) { setSubs([]); return; }
    catalogApi.subCategories(catId)
      .then(r => setSubs(r?.data || r || []))
      .catch(() => setSubs([]));
    // Reset manual type override when category changes so auto-detect re-runs
    setTypeOverride('');
  }, [catId]);

  // ── Sync IDs → form name fields ───────────────────────────
  useEffect(() => {
    if (catSel) setForm(f => ({ ...f, category_name: catSel.name }));
    else if (catFreeText) setForm(f => ({ ...f, category_name: catFreeText }));
  }, [catId, catFreeText, catSel]);

  useEffect(() => {
    if (subSel) setForm(f => ({ ...f, sub_category_name: subSel.name }));
  }, [subId, subSel]);

  useEffect(() => {
    const b = brands.find(x => x._id === brandId);
    if (b) setForm(f => ({ ...f, brand_name: b.name }));
    else if (brandFreeText) setForm(f => ({ ...f, brand_name: brandFreeText }));
  }, [brandId, brandFreeText, brands]);

  // Auto-set unit from category type
  useEffect(() => {
    if (catName) setForm(f => ({ ...f, unit: CATEGORY_DEFAULT_UNIT[catType] || f.unit }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catType]);

  // ── Load existing product for edit ────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    let active = true;
    setReady(false); setFetching(true);
    myProductApi.get(productId)
      .then(p => {
        if (!active || !p) return;
        setForm(productToForm(p));
        setExImgs(getImageUrls(p));
        const raw = p._raw || p;
        const cId = String(raw.category_id?._id    || raw.category_id    || '');
        const sId = String(raw.sub_category_id?._id || raw.sub_category_id || '');
        const bId = String(raw.brand_id?._id        || raw.brand_id        || '');
        if (cId) setCatId(cId);
        if (sId) setSubId(sId);
        if (bId) setBrandId(bId);
        setAttrs(raw.attributes || {});
        setReady(true); setError('');
      })
      .catch(e => { if (active) setError(e.message || 'Could not load product.'); })
      .finally(() => { if (active) setFetching(false); });
    return () => { active = false; };
  }, [isEdit, productId]);

  // ── Form helpers ──────────────────────────────────────────
  const set = useCallback((key, value) => {
    setForm(cur => {
      const v = DISC_FIELDS.has(key) ? sanitizeDiscount(value) : value;
      const next = { ...cur, [key]: v };
      if (key === 'size' || key === 'pcs_per_box') {
        const sq = calcSqftPerBox(next.size, next.pcs_per_box);
        if (sq) next.sqft_per_box = sq;
      }
      [
        ['retail_discount', 'retail_rate'],
        ['dealer_discount', 'dealer_rate'],
        ['wholesale_discount', 'wholesale_rate'],
        ['project_discount', 'project_rate'],
      ].forEach(([df, rf]) => {
        if (key === df || key === 'mrp') {
          const m = parseFloat(next.mrp), d = parseFloat(next[df]);
          if (m > 0 && d >= 0 && next[df] !== '') next[rf] = (m * (1 - d / 100)).toFixed(2);
        }
      });
      return next;
    });
    setError('');
  }, []);

  const setAttr = (key, value) => setAttrs(p => ({ ...p, [key]: value }));

  const pickImages = async () => {
    const cnt = exImgs.length + newImgs.length;
    if (cnt >= MAX_IMAGES) { Alert.alert('Limit', `Max ${MAX_IMAGES} images.`); return; }
    const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: MAX_IMAGES - cnt });
    if (res.didCancel) return;
    const picked = (res.assets || []).map((a, i) => ({
      uri: a.uri, type: a.type || 'image/jpeg', name: a.fileName || `p_${Date.now()}_${i}.jpg`,
    }));
    setNewImgs(p => [...p, ...picked].slice(0, MAX_IMAGES - exImgs.length));
  };

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (isEdit && !ready) { setError('Wait for product details to finish loading.'); return; }
    if (!form.name.trim()) { setError('Product name is required.'); return; }
    for (const fd of dynFields) {
      if (!fd.required) continue;
      const v = fd.storeIn === 'column' ? form[fd.key] : attrs[fd.key];
      if (!v || !String(v).trim()) {
        setError(`${fd.label} is required for ${labelForType(catType)} products.`);
        return;
      }
    }
    setSaving(true); setError('');
    try {
      const fields = { ...form };
      DISC_FIELDS.forEach(f => delete fields[f]);
      fields.attributes = { ...attrs };
      const saved = isEdit
        ? await myProductApi.update(productId, fields, newImgs, exImgs)
        : await myProductApi.create(fields, newImgs);
      setSaving(false);
      Alert.alert(
        isEdit ? 'Product updated' : 'Product created',
        `${saved?.name || 'Product'} has been ${isEdit ? 'updated' : 'added'}.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      setSaving(false);
      setError(e.message || 'Could not save product.');
    }
  };

  const num = key => v => set(key, sanitizeDecimal(v));
  const hasCat = !!catName;

  // ── RENDER ────────────────────────────────────────────────
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.secondary} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.hBtn}
          onPress={() => step === 2 && !isEdit ? setStep(1) : navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={step === 2 && !isEdit ? 'arrow-back' : 'arrow-back'} size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={s.hCenter}>
          <Text style={s.hTitle}>{isEdit ? 'Edit Product' : 'Add New Product'}</Text>
          <Text style={s.hSub}>
            {isEdit
              ? `${labelForType(catType)} · ${catName || 'Product'}`
              : step === 1
              ? 'Step 1 of 2 — Select Category & Brand'
              : `Step 2 of 2 — ${labelForType(catType)} Details`}
          </Text>
        </View>
        {/* Step indicator */}
        {!isEdit && (
          <View style={s.stepIndicator}>
            <View style={[s.stepDotSm, step >= 1 && s.stepDotSmActive]}>
              <Text style={s.stepDotSmTxt}>1</Text>
            </View>
            <View style={[s.stepLine, step >= 2 && s.stepLineActive]} />
            <View style={[s.stepDotSm, step >= 2 && s.stepDotSmActive]}>
              <Text style={s.stepDotSmTxt}>2</Text>
            </View>
          </View>
        )}
      </View>

      {/* ─── STEP 1 ─── */}
      {step === 1 && (
        <Step1
          cats={cats} subs={subs} brands={brands}
          catId={catId} subId={subId} brandId={brandId}
          onCatId={setCatId} onSubId={setSubId} onBrandId={setBrandId}
          catFreeText={catFreeText} brandFreeText={brandFreeText}
          onCatFreeText={setCatFreeText} onBrandFreeText={setBrandFreeText}
          typeOverride={typeOverride}
          onTypeOverride={t => setTypeOverride(t)}
          onContinue={() => setStep(2)}
          onCancel={() => navigation.goBack()}
          bottomInset={Math.max(insets.bottom, 14)}
        />
      )}

      {/* ─── STEP 2 ─── */}
      {step === 2 && (
        <KeyboardAvoidingView style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={[s.scroll, { paddingBottom: Math.max(insets.bottom + 60, 80) }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">

            {fetching && (
              <View style={s.infoBox}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={s.infoTxt}>Loading product details…</Text>
              </View>
            )}
            {!!error && (
              <View style={s.errBox}>
                <Ionicons name="alert-circle" size={15} color={Colors.error} />
                <Text style={s.errTxt}>{error}</Text>
              </View>
            )}

            {/* Selection summary row */}
            <View style={s.selSummary}>
              <View style={s.selSummaryItem}>
                <Ionicons name="folder-outline" size={13} color={Colors.primary} />
                <Text style={s.selSummaryTxt} numberOfLines={1}>{catName || '—'}</Text>
              </View>
              {(subSel?.name || form.sub_category_name) ? (
                <View style={s.selSummaryItem}>
                  <Ionicons name="pricetag-outline" size={13} color="#EA580C" />
                  <Text style={s.selSummaryTxt} numberOfLines={1}>
                    {subSel?.name || form.sub_category_name}
                  </Text>
                </View>
              ) : null}
              <View style={s.selSummaryItem}>
                <Ionicons name="bookmark-outline" size={13} color="#7C3AED" />
                <Text style={s.selSummaryTxt} numberOfLines={1}>{brandName || '—'}</Text>
              </View>
              {!isEdit && (
                <TouchableOpacity onPress={() => setStep(1)} style={s.changeBtn}>
                  <Text style={s.changeBtnTxt}>Change</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Images ── */}
            <SH title="Product Images" />
            <View style={s.imgRow}>
              {exImgs.map(url => (
                <View key={url} style={s.imgThumb}>
                  <Image source={{ uri: mediaUrl(url) }} style={s.imgImg} />
                  <TouchableOpacity style={s.imgDel}
                    onPress={() => setExImgs(p => p.filter(u => u !== url))}>
                    <Ionicons name="close" size={11} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
              {newImgs.map((img, idx) => (
                <View key={`ni-${idx}`} style={s.imgThumb}>
                  <Image source={{ uri: img.uri }} style={s.imgImg} />
                  <TouchableOpacity style={s.imgDel}
                    onPress={() => setNewImgs(p => p.filter((_, i) => i !== idx))}>
                    <Ionicons name="close" size={11} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
              {exImgs.length + newImgs.length < MAX_IMAGES && (
                <TouchableOpacity style={s.imgAdd} onPress={pickImages}>
                  <Ionicons name="add" size={22} color={Colors.textTertiary} />
                  <Text style={s.imgAddTxt}>Add</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Basic Info ── */}
            <SH title="Basic Information" />
            <TextInput label="Product Name" required value={form.name}
              onChangeText={v => set('name', v)}
              placeholder="e.g. Black Galaxy Granite Slab" />
            <TextInput label="Product Code" value={form.code}
              onChangeText={v => set('code', v)}
              placeholder="Auto-generated if blank" autoCapitalize="characters" />
            <TextInput label="Alias" value={form.alias}
              onChangeText={v => set('alias', v)} placeholder="Short name (optional)" />
            <TextInput label="HSN Code" value={form.hsn_code}
              onChangeText={v => set('hsn_code', v)} placeholder="HSN / SAC code" />
            <TextInput label="Description" value={form.description}
              onChangeText={v => set('description', v)} placeholder="Product description"
              multiline numberOfLines={3} />

            {/* ── Unit & Tax ── */}
            <SH title="Unit & Tax" />
            <View style={s.grid}>
              <View style={s.g2}>
                <SelField label="Unit" required options={UNITS}
                  value={form.unit} onChange={v => set('unit', v)} />
              </View>
              <View style={s.g2}>
                <SelField label="GST %"
                  options={GST_OPTS.map(v => ({ value: v, label: `${v}%` }))}
                  value={form.gst_percent} onChange={v => set('gst_percent', v)} />
              </View>
            </View>

            {/* ── Category-specific dynamic specs ── */}
            {hasCat && dynFields.length > 0 && (
              <CollapsibleSpec
                title={`${labelForType(catType)} Specifications`}
                fields={dynFields}
                form={form}
                attrs={attrs}
                set={set}
                setAttr={setAttr}
              />
            )}

            {/* Packing & Collection for tiles / general */}
            {(catType === 'tiles' || catType === 'other') && (
              <CollapsibleSpec
                title="Packing & Collection"
                fields={[
                  { key: 'design',         label: 'Design',            type: 'text',   storeIn: 'column', placeholder: 'Design name' },
                  { key: 'collection',     label: 'Collection',        type: 'text',   storeIn: 'column', placeholder: 'Collection name' },
                  { key: 'pcs_per_box',    label: 'Pieces / Box',      type: 'number', storeIn: 'column' },
                  { key: 'sqft_per_box',   label: 'Sq.Ft / Box (auto)',type: 'number', storeIn: 'column' },
                  { key: 'weight_per_box', label: 'Weight / Box (kg)', type: 'number', storeIn: 'column' },
                ]}
                form={form}
                attrs={attrs}
                set={set}
                setAttr={setAttr}
              />
            )}

            {/* ── Pricing ── */}
            <SH title="Pricing" />
            <View style={s.grid}>
              <View style={s.g2}>
                <TextInput label="Purchase Rate" value={form.purchase_rate}
                  onChangeText={num('purchase_rate')} placeholder="0.00" keyboardType="decimal-pad" />
              </View>
              <View style={s.g2}>
                <TextInput label="Landing Cost" value={form.landing_cost}
                  onChangeText={num('landing_cost')} placeholder="0.00" keyboardType="decimal-pad" />
              </View>
              <View style={s.gFull}>
                <TextInput label="MRP" value={form.mrp}
                  onChangeText={num('mrp')} placeholder="0.00" keyboardType="decimal-pad"
                  helperText="Rates below auto-calculate from MRP + discount %" />
              </View>
            </View>
            <PDR label="Retail"
              discount={form.retail_discount} rate={form.retail_rate}
              onD={v => set('retail_discount', v)} onR={num('retail_rate')} />
            <PDR label="Project"
              discount={form.project_discount} rate={form.project_rate}
              onD={v => set('project_discount', v)} onR={num('project_rate')} />
            <View style={s.grid}>
              <View style={s.g2}>
                <TextInput label="Min Selling Rate" value={form.min_selling_rate}
                  onChangeText={num('min_selling_rate')} placeholder="0.00" keyboardType="decimal-pad" />
              </View>
              <View style={s.g2}>
                <TextInput label="Min Stock Level" value={form.min_stock_level}
                  onChangeText={num('min_stock_level')} placeholder="0" keyboardType="decimal-pad" />
              </View>
              <View style={s.g2}>
                <TextInput label="Reorder Level" value={form.reorder_level}
                  onChangeText={num('reorder_level')} placeholder="0" keyboardType="decimal-pad" />
              </View>
            </View>

            <PrimaryButton
              title={isEdit ? 'UPDATE PRODUCT' : 'SAVE PRODUCT'}
              onPress={handleSave} loading={saving}
              disabled={isEdit && !ready}
              variant="primary" size="lg"
              style={{ marginTop: Spacing.lg }} />

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.screenPadding, paddingTop: 8, paddingBottom: 14,
  },
  hBtn:   { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  hCenter:{ flex: 1, alignItems: 'center' },
  hTitle: { ...Typography.h4, color: '#FFF' },
  hSub:   { ...Typography.caption, color: 'rgba(255,255,255,0.6)', marginTop: 1, textAlign: 'center' },

  // Step indicator in header
  stepIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepDotSm:     { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  stepDotSmActive: { backgroundColor: Colors.primary },
  stepDotSmTxt:  { fontSize: 11, fontWeight: '800', color: '#FFF' },
  stepLine:      { width: 14, height: 2, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 1 },
  stepLineActive:{ backgroundColor: Colors.primary },

  // Step 1
  step1Scroll: { padding: Spacing.screenPadding, paddingBottom: 40 },
  stepLabel:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  stepDot:     { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepDotTxt:  { fontSize: 13, fontWeight: '900', color: '#FFF' },
  stepTxt:     { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', flex: 1 },
  step1Hint:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Colors.primaryBg, borderRadius: 10, padding: 14, marginTop: 8, borderWidth: 1, borderColor: Colors.primary + '30' },
  step1HintTxt:{ flex: 1, fontSize: 13, color: Colors.primary, lineHeight: 18 },
  step1Footer: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: Colors.borderLight, backgroundColor: '#FFF' },
  cancelBtn:   { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingVertical: 13, alignItems: 'center' },
  cancelTxt:   { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  continueBtn: { flex: 2, borderRadius: 12, backgroundColor: Colors.primary, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  continueBtnDisabled: { backgroundColor: Colors.borderLight },
  continueTxt: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  continueTxtDisabled: { color: Colors.textTertiary },

  // Step 2
  scroll: { padding: Spacing.screenPadding },

  // Selection summary bar (step 2 top)
  selSummary:     { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderRadius: 10, padding: 10, marginBottom: 4, ...Shadows.sm },
  selSummaryItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.background, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  selSummaryTxt:  { fontSize: 12, fontWeight: '600', color: Colors.textPrimary, maxWidth: 120 },
  changeBtn:      { marginLeft: 'auto', backgroundColor: Colors.primaryBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  changeBtnTxt:   { fontSize: 12, fontWeight: '700', color: Colors.primary },

  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.secondaryBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10, borderWidth: 1, borderColor: Colors.secondary + '30' },
  typeTxt:   { fontSize: 13, color: Colors.secondary },

  infoBox: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: Colors.primaryBg, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.base },
  infoTxt: { ...Typography.caption, color: Colors.primary, flex: 1, fontWeight: '600' },
  errBox:  { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: Colors.errorBg, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.base },
  errTxt:  { ...Typography.caption, color: Colors.error, flex: 1 },

  section:      { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.lg, marginBottom: Spacing.md },
  sectionBar:   { width: 3, height: 16, backgroundColor: Colors.primary, borderRadius: 2, marginRight: 8 },
  sectionTitle: { ...Typography.h5, color: Colors.textPrimary },

  imgRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imgThumb: { width: 78, height: 78, borderRadius: 10, position: 'relative' },
  imgImg:   { width: 78, height: 78, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  imgDel:   { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center' },
  imgAdd:   { width: 78, height: 78, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
  imgAddTxt:{ ...Typography.caption, color: Colors.textTertiary, fontSize: 10, marginTop: 2 },

  grid:  { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  g2:    { width: '48%' },
  gFull: { width: '100%' },

  priceRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Colors.white, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, paddingTop: Spacing.base, marginBottom: Spacing.sm, ...Shadows.sm },
  priceCol: { width: '48%' },

  selWrap:   { marginBottom: Spacing.base },
  selLabel:  { ...Typography.label, color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 },
  selTrigger:{ minHeight: 48, paddingHorizontal: Spacing.base, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.input },
  selTriggerDisabled: { backgroundColor: Colors.borderLight },
  selVal:    { ...Typography.body1, color: Colors.textPrimary, flex: 1 },
  selPH:     { color: Colors.textTertiary },
  disabledHint: { fontSize: 11, color: Colors.textTertiary, marginTop: 3 },

  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay },
  sheet:   { maxHeight: '72%', backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius['3xl'], borderTopRightRadius: BorderRadius['3xl'], paddingTop: 8, paddingBottom: 24 },
  sheetHandle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.base },
  sheetHead: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  sheetTitle: { ...Typography.h4, color: Colors.textPrimary, flex: 1 },
  clearBtn:  { paddingHorizontal: Spacing.sm, paddingVertical: 8 },
  clearTxt:  { ...Typography.body2, color: Colors.primary, fontWeight: '700' },
  closeBtn:  { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  sheetList: { paddingHorizontal: Spacing.base },
  sheetOpt:  { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  sheetOptAct: { backgroundColor: Colors.primaryBg },
  sheetOptTxt: { ...Typography.body1, color: Colors.textPrimary, flex: 1 },
  sheetOptTxtAct: { color: Colors.primary, fontWeight: '700' },

  searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.base, marginVertical: 10, backgroundColor: Colors.background, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, paddingVertical: 0 },
  newRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, backgroundColor: Colors.primaryBg },
  newIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primary },
  newLbl:  { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  newVal:  { fontSize: 14, color: Colors.primary, fontWeight: '700', marginTop: 1 },
  itemCode:{ fontSize: 11, color: Colors.textTertiary, marginRight: 6 },

  toggleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, backgroundColor: Colors.white, paddingHorizontal: Spacing.base, borderRadius: BorderRadius.md, marginBottom: 8, ...Shadows.sm },
  toggleBorder:{ },
  toggleLabel: { ...Typography.body1, color: Colors.textPrimary, fontWeight: '600' },

  // CollapsibleSpec
  collapseHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.lg, marginBottom: 0 },
  collapseLeft:    { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  collapseCount:   { backgroundColor: Colors.primaryBg, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  collapseCountTxt:{ fontSize: 10, fontWeight: '700', color: Colors.primary },
  collapseBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  collapseBtnOpen: { backgroundColor: Colors.success },
  collapseBtnTxt:  { fontSize: 12, fontWeight: '700', color: '#FFF' },
  collapseBody:    { backgroundColor: Colors.white, borderRadius: 12, padding: 14, marginTop: 8, ...Shadows.sm },
  collapseDoneBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.success, borderRadius: 10, paddingVertical: 10, marginTop: 10 },
  collapseDoneTxt: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  // Product type cards (Step 1)
  typeSection:     { marginTop: Spacing.base, marginBottom: 4 },
  typeSectionHead: { marginBottom: 8 },
  typeSectionTitle:{ fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  typeSectionSub:  { fontSize: 10, color: Colors.textTertiary, marginTop: 2 },
  typeCardRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeCard:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white, position: 'relative' },
  typeCardIcon:    { width: 20, height: 20, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  typeCardLabel:   { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  typeCardCheck:   { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
});
