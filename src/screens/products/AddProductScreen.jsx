/**
 * AddProductScreen.jsx  (Retailer app)
 *
 * Wholesaler-style stepped Add / Edit product flow — kept structurally
 * identical to `wholesalerapp/src/screens/product/AddProductScreen.jsx` so
 * staff moving between the two apps see the same form.
 *
 *   Step 1 — Select Category        (chips + inline create)
 *   Step 2 — Sub-Category           (chips + inline create, only when the
 *                                    chosen category actually has sub-categories)
 *   Step 3 — Brand                  (chips + inline create)
 *   Step 4 — Product Details        (name, code, category-driven dynamic fields)
 *   Step 5 — Unit, Pricing & Stock
 *   Step 6 — Images
 *
 * Step numbers are dynamic: when a category has no sub-categories the
 * Sub-Category step is skipped and every later step shifts down by one,
 * matching the wholesaler form's behaviour.
 *
 * Category-specific values are stored in Product.attributes on the backend.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  Image, Alert, Modal, Pressable, TextInput as RNTextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import { Colors } from '../../theme/colors';
import { Shadows, Spacing } from '../../theme/spacing';
import { myProductApi, catalogApi, mediaUrl } from '../../utils/api';
import { fieldOptionsService } from '../../services/fieldOptionsService';
import {
  categoryTypeFromName, fieldsForType, CATEGORY_UNIT, UNIT_OPTIONS,
} from '../../utils/categoryFields';

const MAX_IMAGES = 10;
const ORANGE     = Colors.primary;    // #F4500A
const NAVY       = Colors.secondary;  // #1A2340
const MUTED      = Colors.textSecondary;
const BORDER     = Colors.border;

const numOnly = (v) => String(v).replace(/[^0-9.]/g, '');

// ── Section label (numbered step, wholesaler style) ───────────
function StepLabel({ n, text }) {
  return (
    <View style={s.stepRow}>
      <View style={s.stepDot}>
        <Text style={s.stepDotTxt}>{n}</Text>
      </View>
      <Text style={s.stepTxt}>{text}</Text>
      <View style={s.stepLine} />
    </View>
  );
}

// ── Chip row (category / sub / brand) ────────────────────────
function ChipRow({ items, activeId, onPick }) {
  if (!items.length) return null;
  return (
    <View style={s.chipWrap}>
      {items.map(item => {
        const on = activeId === (item._id || item.id);
        return (
          <TouchableOpacity
            key={item._id || item.id}
            style={[s.chip, on && s.chipOn]}
            onPress={() => onPick(item)}
            activeOpacity={0.8}>
            <Text style={[s.chipTxt, on && s.chipTxtOn]}>{item.name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Inline "Add new …" button ────────────────────────────────
function AddNewBtn({ label, onPress }) {
  return (
    <TouchableOpacity style={s.addNewBtn} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name="add-circle-outline" size={16} color={ORANGE} />
      <Text style={s.addNewTxt}>Add new {label}</Text>
    </TouchableOpacity>
  );
}

// ── Field label ───────────────────────────────────────────────
function FL({ children }) {
  return <Text style={s.fieldLabel}>{children}</Text>;
}

// ── Text / number input ───────────────────────────────────────
function FInput({ label, value, onChangeText, placeholder, keyboardType, error, half, multiline, required }) {
  return (
    <View style={[s.fieldWrap, half && s.halfCol]}>
      {label ? <FL>{label}{required ? ' *' : ''}</FL> : null}
      <RNTextInput
        style={[s.input, error && s.inputErr, multiline && { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || ''}
        placeholderTextColor={Colors.textTertiary}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        autoCapitalize="none"
      />
      {!!error && <Text style={s.errTxt}>{error}</Text>}
    </View>
  );
}

// ── Select field (tap to open modal, + to add an option) ─────
function FSelect({ label, value, onPress, onAdd, error, half, required }) {
  return (
    <View style={[s.fieldWrap, half && s.halfCol]}>
      {label ? <FL>{label}{required ? ' *' : ''}</FL> : null}
      <View style={s.selectRow}>
        <TouchableOpacity
          style={[s.selectBox, { flex: 1 }, error && s.inputErr]}
          onPress={onPress}
          activeOpacity={0.8}>
          <Text style={[s.selectTxt, !value && { color: Colors.textTertiary }]}>
            {value || `Select ${label}`}
          </Text>
          <Ionicons name="chevron-down" size={16} color={MUTED} />
        </TouchableOpacity>
        <TouchableOpacity style={s.optAddBtn} onPress={onAdd} activeOpacity={0.8}>
          <Ionicons name="add" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
      {!!error && <Text style={s.errTxt}>{error}</Text>}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Screen
// ═══════════════════════════════════════════════════════════════
export default function AddProductScreen({ navigation, route }) {
  const insets  = useSafeAreaInsets();
  const editing = route?.params?.mode === 'edit'
    ? route.params.product
    : (route?.params?.product || null);
  const raw       = editing?._raw || editing || null;
  const productId = editing?.id || editing?._id || raw?.id || raw?._id || null;
  const isEdit    = Boolean(productId);

  const specs   = raw?.specs   || raw || {};
  const packing = raw?.packing || raw || {};
  const prices  = raw?.prices  || raw || {};

  // ── Taxonomy ──────────────────────────────────────────────
  const [categories,  setCategories]  = useState([]);
  const [brands,      setBrands]      = useState([]);
  const [taxLoading,  setTaxLoading]  = useState(true);

  // Selection
  const [category,    setCategory]    = useState(null);  // { _id, name, sub_categories }
  const [subCategory, setSubCategory] = useState(null);  // { _id, name }
  const [brand,       setBrand]       = useState(null);  // { _id, name }

  // Category-specific attribute values
  const [attrs, setAttrs] = useState(raw?.attributes || {});
  const [errors, setErrors] = useState({});
  const setAttr = (k, v) => { setAttrs(a => ({ ...a, [k]: v })); setErrors(e => ({ ...e, [k]: null })); };

  // Common fields
  const [name,     setName]     = useState(raw?.name || '');
  const [unit,     setUnit]     = useState(raw?.unit || 'Sq Ft');
  const [desc,     setDesc]     = useState(raw?.description || '');
  const [prices2,  setPrices2]  = useState({
    purchase_price: prices.purchase_price != null ? String(prices.purchase_price) : '',
    selling_price:  prices.selling_price  != null ? String(prices.selling_price)  : (raw?.retail_rate ? String(raw.retail_rate) : ''),
    wholesale_rate: prices.wholesale_rate != null ? String(prices.wholesale_rate) : '',
    mrp:            prices.mrp            != null ? String(prices.mrp)            : '',
    gst_percent:    raw?.gst_percent      != null ? String(raw.gst_percent)       : '18',
    opening_stock:  raw?.opening_stock    != null ? String(raw.opening_stock)     : '',
    hsn_code:       specs.hsn_code || '',
    pcs_per_box:    packing.pcs_per_box   != null ? String(packing.pcs_per_box)   : '',
    sqft_per_box:   packing.sqft_per_box  != null ? String(packing.sqft_per_box)  : '',
    code:           raw?.code || '',
  });
  const setPrice = (k, v) => setPrices2(p => ({ ...p, [k]: v }));

  // Images
  const [imageUrls, setImageUrls] = useState(
    Array.isArray(raw?.image_urls) ? raw.image_urls.filter(Boolean) : []
  );
  const [newImgs, setNewImgs] = useState([]);

  // UI state
  const [saving,    setSaving]   = useState(false);
  const [activeModal, setModal]  = useState(null); // 'unit' | 'select' | 'newCat' | 'newSub' | 'newBrand'
  const [selectField, setSelectField] = useState(null);
  const [modalInput,  setModalInput]  = useState('');
  const [modalSaving, setModalSaving] = useState(false);

  // Custom dropdown options the user has added (persisted), keyed by field key.
  const [customOptions, setCustomOptions] = useState({});
  const [hiddenOptions, setHiddenOptions] = useState({}); // built-in options the user removed
  const [optModalField, setOptModalField] = useState(null); // field def when adding a new option
  const [optInput, setOptInput] = useState('');

  // ── Load persisted custom options ─────────────────────────
  useEffect(() => {
    fieldOptionsService.all().then(map => {
      const { __hidden__ = {}, ...custom } = map || {};
      setCustomOptions(custom);
      setHiddenOptions(__hidden__);
    }).catch(() => {});
  }, []);

  // Merge built-in options with the user's custom ones, minus any hidden defaults.
  const optionsFor = (f) => {
    const base   = Array.isArray(f.options) ? f.options : [];
    const custom = customOptions[f.key] || [];
    const hidden = (hiddenOptions[f.key] || []).map(x => String(x).toLowerCase());
    const seen = new Set();
    return [...base, ...custom].filter(o => {
      const k = String(o).toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return !hidden.includes(k);
    });
  };

  const addCustomOption = async () => {
    const v = optInput.trim();
    if (!v || !optModalField) return;
    const list = await fieldOptionsService.add(optModalField.key, v);
    setCustomOptions(prev => ({ ...prev, [optModalField.key]: list }));
    setAttr(optModalField.key, v);   // auto-select the newly added option
    setOptInput('');
    setOptModalField(null);
  };

  const isCustomOption = (f, opt) =>
    (customOptions[f.key] || []).some(x => String(x).toLowerCase() === String(opt).toLowerCase());

  // Delete any option: custom → remove from storage; built-in default → hide it.
  const deleteOption = async (f, opt) => {
    if (isCustomOption(f, opt)) {
      const list = await fieldOptionsService.remove(f.key, opt);
      setCustomOptions(prev => ({ ...prev, [f.key]: list }));
    } else {
      const list = await fieldOptionsService.hide(f.key, opt);
      setHiddenOptions(prev => ({ ...prev, [f.key]: list }));
    }
    if (String(attrs[f.key] ?? '').toLowerCase() === String(opt).toLowerCase()) setAttr(f.key, '');
  };

  // ── Load taxonomy ─────────────────────────────────────────
  const loadTaxonomy = async () => {
    setTaxLoading(true);
    try {
      const [catRes, brandRes] = await Promise.all([
        catalogApi.categories(),
        catalogApi.brands(),
      ]);
      const cats   = catRes?.data  || catRes  || [];
      const brnds  = brandRes?.data || brandRes || [];
      setCategories(Array.isArray(cats)  ? cats  : []);
      setBrands(    Array.isArray(brnds) ? brnds : []);
      return { cats, brnds };
    } catch {
      setCategories([]);
      setBrands([]);
      return { cats: [], brnds: [] };
    } finally {
      setTaxLoading(false);
    }
  };

  useEffect(() => { loadTaxonomy(); }, []);

  // Pre-normalise the edit payload's category/sub/brand identifiers once, so the
  // pre-select effect below depends on stable primitives instead of the whole
  // `raw` object (which is rebuilt on every render).
  const editRefs = useMemo(() => ({
    categoryName: raw?.category?.name    || raw?.category_name    || editing?.category    || '',
    categoryId:   raw?.category_id       || raw?.category?._id    || null,
    subName:      raw?.sub_category?.name || raw?.sub_category_name || editing?.subCategory || '',
    subId:        raw?.sub_category_id   || raw?.sub_category?._id || null,
    brandName:    raw?.brand?.name       || raw?.brand_name       || editing?.brand       || '',
    brandId:      raw?.brand_id          || raw?.brand?._id       || null,
  }), [raw, editing]);

  // Pre-select when editing
  useEffect(() => {
    if (!editing || !categories.length) return;
    const cat = categories.find(c =>
      c.name === editRefs.categoryName ||
      String(c._id) === String(editRefs.categoryId)
    );
    if (cat) {
      setCategory(cat);
      const sub = (cat.sub_categories || []).find(s =>
        s.name === editRefs.subName ||
        String(s._id) === String(editRefs.subId)
      );
      if (sub) setSubCategory(sub);
    }
    const br = brands.find(b =>
      b.name === editRefs.brandName ||
      String(b._id) === String(editRefs.brandId)
    );
    if (br) setBrand(br);
  }, [editing, categories, brands, editRefs]);

  // Default unit when category changes (new product only)
  useEffect(() => {
    if (category && !isEdit) {
      setUnit(CATEGORY_UNIT[categoryTypeFromName(category.name)] || 'Piece');
    }
  }, [category, isEdit]);

  // ── Derived ───────────────────────────────────────────────
  const catType = useMemo(
    () => raw?.category_type || categoryTypeFromName(category?.name || ''),
    [category, raw]
  );
  const fields = useMemo(() => fieldsForType(catType), [catType]);
  const subs   = category?.sub_categories || [];

  // Steps shift down by one when the category has no sub-categories — identical
  // to the wholesaler form. `detailsN` is the step number of the Details card.
  const hasSubs  = subs.length > 0;
  const detailsN = hasSubs ? 4 : 3;
  const pricingN = hasSubs ? 5 : 4;
  const imagesN  = hasSubs ? 6 : 5;

  // ── Create taxonomy items ─────────────────────────────────
  const submitModal = async () => {
    const val = modalInput.trim();
    if (!val) return;
    setModalSaving(true);
    try {
      if (activeModal === 'newCat') {
        await catalogApi.createCategory({ name: val });
        const fresh = await loadTaxonomy();
        const picked = (fresh.cats || []).find(c => c.name?.toLowerCase() === val.toLowerCase());
        if (picked) { setCategory(picked); setSubCategory(null); }
      } else if (activeModal === 'newSub') {
        if (!category?._id) { Alert.alert('Select a category first'); return; }
        await catalogApi.createSubCategory({ name: val, category_id: category._id });
        const fresh = await loadTaxonomy();
        const freshCat = (fresh.cats || []).find(c => String(c._id) === String(category._id));
        if (freshCat) {
          setCategory(freshCat);
          const picked = (freshCat.sub_categories || []).find(s => s.name?.toLowerCase() === val.toLowerCase());
          if (picked) setSubCategory(picked);
        }
      } else if (activeModal === 'newBrand') {
        await catalogApi.createBrand({ name: val });
        const fresh = await loadTaxonomy();
        const picked = (fresh.brnds || []).find(b => b.name?.toLowerCase() === val.toLowerCase());
        if (picked) setBrand(picked);
      }
      setModal(null);
      setModalInput('');
    } catch (err) {
      Alert.alert('Failed', err?.message || 'Could not save. Try again.');
    } finally {
      setModalSaving(false);
    }
  };

  // ── Image picker ──────────────────────────────────────────
  const pickImages = async () => {
    const count = imageUrls.length + newImgs.length;
    if (count >= MAX_IMAGES) {
      Alert.alert('Limit reached', `You can add up to ${MAX_IMAGES} images.`);
      return;
    }
    const res = await launchImageLibrary({
      mediaType: 'photo', quality: 0.8, selectionLimit: MAX_IMAGES - count,
    });
    if (res.didCancel) return;
    if (res.errorCode) { Alert.alert('Error', res.errorMessage || 'Could not open gallery.'); return; }
    const picked = (res.assets || []).map((a, i) => ({
      uri: a.uri, type: a.type || 'image/jpeg', name: a.fileName || `p_${Date.now()}_${i}.jpg`,
    }));
    setNewImgs(prev => [...prev, ...picked].slice(0, MAX_IMAGES - imageUrls.length));
  };
  const removeExisting = (url) => setImageUrls(prev => prev.filter(u => u !== url));
  const removeNew = (idx) => setNewImgs(prev => prev.filter((_, i) => i !== idx));

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    const e = {};
    if (!category)          e._category = 'Select a category';
    if (!brand)             e._brand    = 'Select a brand';
    if (!name.trim())       e.name      = 'Product name is required';
    fields.forEach(f => {
      if (f.required && !String(attrs[f.key] ?? '').trim()) e[f.key] = `${f.label} is required`;
    });
    if (!prices2.purchase_price) e.purchase_price = 'Purchase price required';
    setErrors(e);
    if (Object.keys(e).length) {
      Alert.alert('Missing details', Object.values(e)[0]);
      return;
    }

    const sizeStr = attrs.size
      || (attrs.length && attrs.width ? `${attrs.length}x${attrs.width}` : '')
      || '';

    const fieldPayload = {
      name:              name.trim(),
      code:              prices2.code.trim() || undefined,
      unit,
      size:              sizeStr,
      finish:            attrs.finish  || '',
      color:             attrs.colour  || attrs.color || '',
      material:          attrs.material || '',
      thickness:         attrs.thickness || '',
      category_name:     category.name,
      sub_category_name: subCategory?.name || '',
      brand_name:        brand.name,
      category_type:     catType,
      attributes:        attrs,
      hsn_code:          prices2.hsn_code.trim(),
      description:       desc.trim(),
      pcs_per_box:       prices2.pcs_per_box   || undefined,
      sqft_per_box:      prices2.sqft_per_box  || undefined,
      gst_percent:       prices2.gst_percent   || 18,
      purchase_price:    prices2.purchase_price || 0,
      selling_price:     prices2.selling_price  || 0,
      wholesale_rate:    prices2.wholesale_rate  || 0,
      mrp:               prices2.mrp             || 0,
      opening_stock:     prices2.opening_stock   || 0,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await myProductApi.update(productId, fieldPayload, newImgs, imageUrls);
        Alert.alert('Updated', 'Product updated successfully.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await myProductApi.create(fieldPayload, newImgs);
        Alert.alert('Added', 'Product added to your catalogue.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err) {
      Alert.alert('Failed', err?.message || 'Could not save product.');
    } finally {
      setSaving(false);
    }
  };

  const totalImages = imageUrls.length + newImgs.length;

  // ── Render ────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.hBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isEdit ? 'Edit Product' : 'Add Product'}</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        <ScrollView
          contentContainerStyle={[s.container, { paddingBottom: Math.max(insets.bottom + 40, 60) }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>

          {/* ── STEP 1 — Category ── */}
          <StepLabel n="1" text="Select Category" />
          <View style={s.card}>
            {taxLoading ? (
              <View style={s.loadingRow}>
                <ActivityIndicator size="small" color={ORANGE} />
                <Text style={s.loadingTxt}>Loading categories…</Text>
              </View>
            ) : (
              <>
                {categories.length === 0 ? (
                  <Text style={s.mutedTxt}>No categories yet. Tap "Add new Category" to create one.</Text>
                ) : (
                  <ChipRow
                    items={categories}
                    activeId={category?._id}
                    onPick={c => { setCategory(c); setSubCategory(null); }}
                  />
                )}
                <AddNewBtn label="Category" onPress={() => { setModalInput(''); setModal('newCat'); }} />
                {!!errors._category && <Text style={s.errTxt}>{errors._category}</Text>}
              </>
            )}
          </View>

          {/* ── STEP 2 — Sub-Category (only when the category has subs) ── */}
          {category && (
            <>
              {hasSubs && (
                <>
                  <StepLabel n="2" text="Select Sub-Category" />
                  <View style={s.card}>
                    <ChipRow
                      items={subs}
                      activeId={subCategory?._id}
                      onPick={sub => setSubCategory(prev => prev?._id === sub._id ? null : sub)}
                    />
                  </View>
                </>
              )}

              {/* ── Next step — Brand ── */}
              <StepLabel n={hasSubs ? '3' : '2'} text="Select Brand" />
              <View style={s.card}>
                {brands.length === 0 ? (
                  <Text style={s.mutedTxt}>No brands yet. Tap "Add new Brand" to create one.</Text>
                ) : (
                  <ChipRow
                    items={brands}
                    activeId={brand?._id}
                    onPick={b => setBrand(prev => prev?._id === b._id ? null : b)}
                  />
                )}
                <AddNewBtn label="Brand" onPress={() => { setModalInput(''); setModal('newBrand'); }} />
                {!!errors._brand && <Text style={s.errTxt}>{errors._brand}</Text>}
              </View>
            </>
          )}

          {/* Gate hint */}
          {category && !brand && (
            <View style={s.gateHint}>
              <Ionicons name="arrow-up" size={16} color={ORANGE} />
              <Text style={s.gateHintTxt}>Select a Brand above to continue adding the item.</Text>
            </View>
          )}

          {/* ── STEP 4 — Product Details ── */}
          {category && brand && (
            <>
              <StepLabel n={String(detailsN)} text={`${cap(catType)} Details`} />
              <View style={s.card}>

                {/* Product name always first */}
                <View style={s.fieldWrap}>
                  <FL>Product Name *</FL>
                  <RNTextInput
                    style={[s.input, errors.name && s.inputErr]}
                    value={name}
                    onChangeText={t => { setName(t); setErrors(e => ({ ...e, name: null })); }}
                    placeholder="e.g. Black Galaxy Slab"
                    placeholderTextColor={Colors.textTertiary}
                  />
                  {!!errors.name && <Text style={s.errTxt}>{errors.name}</Text>}
                </View>

                {/* Dynamic category-specific fields */}
                <View style={s.grid}>
                  {fields.map(f => {
                    const val = String(attrs[f.key] ?? '');
                    if (f.type === 'select') {
                      return (
                        <FSelect
                          key={f.key}
                          label={f.label}
                          value={val}
                          required={f.required}
                          half={f.half}
                          error={errors[f.key]}
                          onPress={() => { setSelectField(f); setModal('select'); }}
                          onAdd={() => { setOptModalField(f); setOptInput(''); }}
                        />
                      );
                    }
                    return (
                      <FInput
                        key={f.key}
                        label={`${f.label}${f.unit ? ` (${f.unit})` : ''}`}
                        value={val}
                        required={f.required}
                        half={f.half}
                        error={errors[f.key]}
                        placeholder={f.placeholder || ''}
                        keyboardType={f.type === 'number' ? 'decimal-pad' : 'default'}
                        onChangeText={t => setAttr(f.key, f.type === 'number' ? numOnly(t) : t)}
                      />
                    );
                  })}
                </View>
              </View>

              {/* ── STEP 5 — Unit, Pricing & Stock ── */}
              <StepLabel n={String(pricingN)} text="Unit, Pricing & Stock" />
              <View style={s.card}>

                {/* Unit picker */}
                <View style={s.fieldWrap}>
                  <FL>Unit of Measurement</FL>
                  <TouchableOpacity
                    style={s.selectBox}
                    onPress={() => setModal('unit')}
                    activeOpacity={0.8}>
                    <Text style={s.selectTxt}>{unit}</Text>
                    <Ionicons name="chevron-down" size={16} color={MUTED} />
                  </TouchableOpacity>
                </View>

                {/* Pricing — 2-column grid */}
                <View style={s.grid}>
                  <View style={s.halfCol}>
                    <FL>Purchase Price *</FL>
                    <RNTextInput style={[s.input, errors.purchase_price && s.inputErr]} value={prices2.purchase_price}
                      onChangeText={t => { setPrice('purchase_price', numOnly(t)); setErrors(e => ({ ...e, purchase_price: null })); }}
                      keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.textTertiary} />
                    {!!errors.purchase_price && <Text style={s.errTxt}>{errors.purchase_price}</Text>}
                  </View>
                  <View style={s.halfCol}>
                    <FL>Selling Price</FL>
                    <RNTextInput style={s.input} value={prices2.selling_price}
                      onChangeText={t => setPrice('selling_price', numOnly(t))}
                      keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.textTertiary} />
                  </View>
                  <View style={s.halfCol}>
                    <FL>Wholesale / Dealer</FL>
                    <RNTextInput style={s.input} value={prices2.wholesale_rate}
                      onChangeText={t => setPrice('wholesale_rate', numOnly(t))}
                      keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.textTertiary} />
                  </View>
                  <View style={s.halfCol}>
                    <FL>MRP</FL>
                    <RNTextInput style={s.input} value={prices2.mrp}
                      onChangeText={t => setPrice('mrp', numOnly(t))}
                      keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.textTertiary} />
                  </View>
                  <View style={s.halfCol}>
                    <FL>GST %</FL>
                    <RNTextInput style={s.input} value={prices2.gst_percent}
                      onChangeText={t => setPrice('gst_percent', numOnly(t))}
                      keyboardType="decimal-pad" placeholder="18" placeholderTextColor={Colors.textTertiary} />
                  </View>
                  <View style={s.halfCol}>
                    <FL>Opening Stock ({unit})</FL>
                    <RNTextInput style={s.input} value={prices2.opening_stock}
                      onChangeText={t => setPrice('opening_stock', numOnly(t))}
                      keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.textTertiary} />
                  </View>
                  <View style={s.halfCol}>
                    <FL>Pieces per Box</FL>
                    <RNTextInput style={s.input} value={prices2.pcs_per_box}
                      onChangeText={t => setPrice('pcs_per_box', numOnly(t))}
                      keyboardType="decimal-pad" placeholder="e.g. 4" placeholderTextColor={Colors.textTertiary} />
                  </View>
                  <View style={s.halfCol}>
                    <FL>Sq Ft per Box</FL>
                    <RNTextInput style={s.input} value={prices2.sqft_per_box}
                      onChangeText={t => setPrice('sqft_per_box', numOnly(t))}
                      keyboardType="decimal-pad" placeholder="e.g. 16" placeholderTextColor={Colors.textTertiary} />
                  </View>
                </View>

                {/* HSN Code — full width */}
                <View style={s.fieldWrap}>
                  <FL>HSN Code</FL>
                  <RNTextInput style={s.input} value={prices2.hsn_code}
                    onChangeText={t => setPrice('hsn_code', t)}
                    placeholder="Optional" placeholderTextColor={Colors.textTertiary} />
                </View>
              </View>

              {/* ── STEP 6 — Images ── */}
              <StepLabel n={String(imagesN)} text="Images" />
              <View style={s.card}>
                <View style={s.imgRow}>
                  {imageUrls.map(u => (
                    <View key={u} style={s.imgWrap}>
                      <Image source={{ uri: mediaUrl(u) }} style={s.imgThumb} resizeMode="cover" />
                      <TouchableOpacity style={s.imgRemove} onPress={() => removeExisting(u)}>
                        <Ionicons name="close" size={12} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {newImgs.map((img, idx) => (
                    <View key={`ni-${idx}`} style={s.imgWrap}>
                      <Image source={{ uri: img.uri }} style={s.imgThumb} resizeMode="cover" />
                      <TouchableOpacity style={s.imgRemove} onPress={() => removeNew(idx)}>
                        <Ionicons name="close" size={12} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {totalImages < MAX_IMAGES && (
                    <TouchableOpacity style={s.imgAdd} onPress={pickImages} activeOpacity={0.8}>
                      <Ionicons name="camera-outline" size={22} color={ORANGE} />
                      <Text style={s.imgAddTxt}>Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={s.imgHint}>{totalImages} / {MAX_IMAGES} images</Text>
              </View>

              {/* ── Extra details (retailer-specific: code + description) ── */}
              <View style={s.card}>
                <View style={s.fieldWrap}>
                  <FL>Product Code</FL>
                  <RNTextInput
                    style={s.input}
                    value={prices2.code}
                    onChangeText={t => setPrice('code', t)}
                    placeholder="Leave blank to auto-generate"
                    placeholderTextColor={Colors.textTertiary}
                    autoCapitalize="characters"
                  />
                </View>
                <View style={s.fieldWrap}>
                  <FL>Description (optional)</FL>
                  <RNTextInput
                    style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                    value={desc}
                    onChangeText={setDesc}
                    placeholder="Product description…"
                    placeholderTextColor={Colors.textTertiary}
                    multiline
                  />
                </View>
              </View>

              {/* Save button */}
              <TouchableOpacity
                style={[s.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}>
                {saving
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
                      <Text style={s.saveBtnTxt}>{isEdit ? 'Save Changes' : 'Add Product'}</Text>
                    </>}
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ══ MODALS ══════════════════════════════════════════════ */}

      {/* Unit picker */}
      <Modal visible={activeModal === 'unit'} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <Pressable style={s.overlay} onPress={() => setModal(null)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalTitle}>Unit of Measurement</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {UNIT_OPTIONS.map(u => (
                <TouchableOpacity
                  key={u}
                  style={[s.optRow, unit === u && s.optRowOn]}
                  onPress={() => { setUnit(u); setModal(null); }}>
                  <Text style={[s.optTxt, unit === u && { color: ORANGE, fontWeight: '800' }]}>{u}</Text>
                  {unit === u && <Ionicons name="checkmark" size={18} color={ORANGE} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Dynamic select-field picker — list + delete + add-new */}
      <Modal visible={activeModal === 'select'} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <Pressable style={s.overlay} onPress={() => setModal(null)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalTitle}>{selectField?.label}</Text>
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {(selectField ? optionsFor(selectField) : []).map(opt => {
                const on = attrs[selectField.key] === opt;
                return (
                  <View key={opt} style={[s.optRow, on && s.optRowOn]}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => { setAttr(selectField.key, opt); setModal(null); }}>
                      <Text style={[s.optTxt, on && { color: ORANGE, fontWeight: '800' }]}>{opt}</Text>
                    </TouchableOpacity>
                    {on && <Ionicons name="checkmark" size={18} color={ORANGE} style={{ marginRight: 6 }} />}
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => deleteOption(selectField, opt)}>
                      <Ionicons name="trash-outline" size={18} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
            {/* Add a new custom option from inside the picker too */}
            <TouchableOpacity
              style={s.optAddInline}
              onPress={() => { const f = selectField; setModal(null); setOptModalField(f); setOptInput(''); }}>
              <Ionicons name="add-circle-outline" size={18} color={ORANGE} />
              <Text style={s.optAddInlineTxt}>Add new {selectField?.label}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add custom option modal */}
      <Modal visible={!!optModalField} transparent animationType="fade" onRequestClose={() => setOptModalField(null)}>
        <Pressable style={s.overlay} onPress={() => setOptModalField(null)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalTitle}>Add {optModalField?.label}</Text>
            <RNTextInput
              style={s.modalInput}
              value={optInput}
              onChangeText={setOptInput}
              autoFocus
              placeholder={`Enter ${optModalField?.label || 'value'}`}
              placeholderTextColor={MUTED}
            />
            <View style={s.modalBtnRow}>
              <TouchableOpacity style={s.btnGhost} onPress={() => setOptModalField(null)}>
                <Text style={s.btnGhostTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnPrimary} onPress={addCustomOption}>
                <Text style={s.btnPrimaryTxt}>Add</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create Category / Sub-Category / Brand */}
      {['newCat', 'newSub', 'newBrand'].map(type => (
        <Modal key={type} visible={activeModal === type} transparent animationType="fade"
          onRequestClose={() => { setModal(null); setModalInput(''); }}>
          <Pressable style={s.overlay} onPress={() => { setModal(null); setModalInput(''); }}>
            <Pressable style={s.modalCard} onPress={() => {}}>
              <Text style={s.modalTitle}>
                {type === 'newCat'   ? 'Add Category'
                : type === 'newSub'  ? 'Add Sub-Category'
                :                      'Add Brand'}
              </Text>
              <RNTextInput
                style={s.modalInput}
                value={modalInput}
                onChangeText={setModalInput}
                autoFocus
                placeholder={
                  type === 'newCat'  ? 'e.g. Tiles, Granite, Marble'
                  : type === 'newSub' ? 'e.g. Floor Tiles, Slabs'
                  :                     'e.g. Kajaria, Nitco'
                }
                placeholderTextColor={MUTED}
              />
              <View style={s.modalBtnRow}>
                <TouchableOpacity
                  style={s.btnGhost}
                  onPress={() => { setModal(null); setModalInput(''); }}>
                  <Text style={s.btnGhostTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.btnPrimary, modalSaving && { opacity: 0.6 }]}
                  onPress={submitModal}
                  disabled={modalSaving}>
                  {modalSaving
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <Text style={s.btnPrimaryTxt}>Add</Text>}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ))}

    </SafeAreaView>
  );
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Product');

// ── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.background },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: NAVY, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  hBtn:        { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFF' },
  container:   { padding: Spacing.screenPadding, backgroundColor: Colors.background },

  // Step label
  stepRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 10 },
  stepDot:     { width: 24, height: 24, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  stepDotTxt:  { color: '#FFF', fontSize: 12, fontWeight: '900' },
  stepTxt:     { fontSize: 13, fontWeight: '800', color: Colors.textPrimary, flex: 1 },
  stepLine:    { flex: 1, height: 1, backgroundColor: BORDER },

  // Card
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: BORDER, ...Shadows.sm, gap: 10 },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  loadingTxt: { fontSize: 13, color: MUTED },
  mutedTxt:   { fontSize: 13, color: MUTED },
  errTxt:     { fontSize: 11, color: Colors.error, fontWeight: '600', marginTop: 4 },

  // Chips
  chipWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:        { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: BORDER, backgroundColor: '#FFF' },
  chipOn:      { backgroundColor: Colors.primaryBg, borderColor: ORANGE },
  chipTxt:     { fontSize: 13, fontWeight: '700', color: MUTED },
  chipTxtOn:   { color: ORANGE },

  // Add new button
  addNewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: ORANGE, borderStyle: 'dashed', backgroundColor: Colors.primaryBg },
  addNewTxt: { fontSize: 12, fontWeight: '800', color: ORANGE },

  // Gate hint
  gateHint:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primaryBg, borderRadius: 12, padding: 14, marginBottom: 14 },
  gateHintTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: ORANGE },

  // Fields
  fieldLabel: { fontSize: 11.5, fontWeight: '700', color: MUTED, marginBottom: 6 },
  fieldWrap:  { width: '100%' },
  halfCol:    { width: '48%' },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  input:      { borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, height: 46, paddingHorizontal: 12, fontSize: 14, color: Colors.textPrimary, backgroundColor: '#FFF' },
  inputErr:   { borderColor: Colors.error },
  selectRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectBox:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, height: 46, paddingHorizontal: 12, backgroundColor: '#FFF' },
  selectTxt:  { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  optAddBtn:  { width: 46, height: 46, borderRadius: 10, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  optAddInline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: ORANGE, borderStyle: 'dashed', backgroundColor: Colors.primaryBg },
  optAddInlineTxt: { fontSize: 13, fontWeight: '800', color: ORANGE },

  // Images
  imgRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imgWrap:    { width: 74, height: 74, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  imgThumb:   { width: '100%', height: '100%', borderRadius: 10 },
  imgRemove:  { position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  imgAdd:     { width: 74, height: 74, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1.5, borderStyle: 'dashed', borderColor: ORANGE, backgroundColor: Colors.primaryBg },
  imgAddTxt:  { fontSize: 10, fontWeight: '700', color: ORANGE },
  imgHint:    { fontSize: 11, color: MUTED, textAlign: 'right' },

  // Save
  saveBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 16, marginTop: 4 },
  saveBtnTxt: { color: '#FFF', fontSize: 15, fontWeight: '900' },

  // Modals
  overlay:      { flex: 1, backgroundColor: 'rgba(15,22,38,0.55)', justifyContent: 'center', padding: 24 },
  modalCard:    { backgroundColor: '#FFF', borderRadius: 18, padding: 20 },
  modalTitle:   { fontSize: 16, fontWeight: '900', color: Colors.textPrimary, marginBottom: 14 },
  modalInput:   { borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, height: 48, paddingHorizontal: 14, fontSize: 15, color: Colors.textPrimary, backgroundColor: '#F8FAFC', marginBottom: 4 },
  modalBtnRow:  { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnGhost:     { flex: 1, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  btnGhostTxt:  { fontSize: 14, fontWeight: '800', color: MUTED },
  btnPrimary:   { flex: 1, height: 46, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryTxt:{ fontSize: 14, fontWeight: '900', color: '#FFF' },
  optRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 12, borderRadius: 10 },
  optRowOn:     { backgroundColor: Colors.primaryBg },
  optTxt:       { fontSize: 15, color: Colors.textPrimary },
});
