import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity,
  KeyboardAvoidingView, Platform, Image, Switch, Alert, ActivityIndicator, findNodeHandle, UIManager,
  Modal, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import TextInput from '../../components/common/TextInput';
import PrimaryButton from '../../components/common/PrimaryButton';
import { myProductApi, mediaUrl } from '../../utils/api';

const SIZES = [
  '300x300', '300x450', '300x600', '400x400', '450x900',
  '600x600', '600x1200', '800x800', '800x1600',
  '1000x1000', '1200x1200', '1200x2400',
];
const FINISHES = ['Glossy', 'Matte', 'Satin', 'Anti-Skid', 'Polished', 'Rustic', 'Textured', 'Natural'];
const SURFACES = ['Polished', 'Unpolished', 'Matt', 'Glossy', 'Rough', 'Structured'];
const GRADES = ['Grade A', 'Grade B', 'Grade C', 'First Quality', 'Second Quality', 'Commercial'];
const TILE_TYPES = ['All', 'Floor Tile', 'Wall Tile', 'Floor & Wall', 'Outdoor', 'Pool Tile', 'Mosaic', 'Subway'];
const APPLICATIONS = ['All', 'Living Room', 'Bedroom', 'Bathroom', 'Kitchen', 'Outdoor', 'Commercial', 'Swimming Pool'];
const ANTI_SKIDS = ['R9', 'R10', 'R11', 'R12', 'Non Slip', 'Normal'];
const ORIGINS = ['India', 'Italy', 'Spain', 'China', 'Portugal', 'Brazil', 'Turkey', 'UAE'];
const UNITS = ['Sq Ft', 'Sq Mtr', 'Piece', 'Box', 'Nos'];
const GST_OPTS = ['0', '5', '12', '18', '28'];
const SALE_TYPES = ['Regular Sale', 'B2B Sale', 'Export Sale', 'Project Sale'];
const PRODUCT_TYPES = ['Regular Product', 'Premium Product', 'Economy Product', 'Exclusive Product'];
const MAX_IMAGES = 10;

const RATE_DISCOUNTS = {
  retail_rate: 'retail_discount',
  dealer_rate: 'dealer_discount',
  wholesale_rate: 'wholesale_discount',
  project_rate: 'project_discount',
};
const DISCOUNT_FIELDS = new Set(Object.values(RATE_DISCOUNTS));

const INITIAL = {
  name: '', alias: '', code: '', description: '', hsn_code: '',
  brand_name: '', category_name: '', sub_category_name: '',
  unit: 'Box', gst_percent: '18',
  size: '', finish: '', material: '', color: '', surface: '', thickness: '', grade: '',
  tile_type: '', application: '', anti_skid: '', origin: '', manufacturer: '', barcode: '',
  design: '', collection: '', pcs_per_box: '', sqft_per_box: '', weight_per_box: '',
  purchase_rate: '', landing_cost: '', mrp: '',
  retail_discount: '', retail_rate: '', dealer_discount: '', dealer_rate: '',
  wholesale_discount: '', wholesale_rate: '', project_discount: '', project_rate: '',
  min_selling_rate: '', min_stock_level: '', reorder_level: '',
  sales_type: 'Regular Sale', product_type: 'Regular Product',
  new_arrival: false, featured: false,
};

function calcSqftPerBox(size, pcsPerBox) {
  if (!size) return '';
  const dimensions = String(size).toLowerCase().match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/);
  const pieces = parseFloat(pcsPerBox);
  if (!dimensions || !pieces || pieces <= 0) return '';
  const width = parseFloat(dimensions[1]);
  const height = parseFloat(dimensions[2]);
  if (!width || !height) return '';
  return ((width / 304.8) * (height / 304.8) * pieces).toFixed(2);
}

function sanitizeDecimal(value) {
  const cleaned = String(value ?? '').replace(/[^0-9.]/g, '');
  const dotIndex = cleaned.indexOf('.');
  if (dotIndex < 0) return cleaned.replace(/^0+(?=\d)/, '');
  const whole = cleaned.slice(0, dotIndex).replace(/^0+(?=\d)/, '');
  const decimal = cleaned.slice(dotIndex + 1).replace(/\./g, '');
  return `${whole}.${decimal}`;
}

function sanitizeDiscount(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const parsed = Number(raw.replace(/[^0-9.-]/g, ''));
  if (Number.isFinite(parsed) && parsed < 0) return '0';
  const cleaned = sanitizeDecimal(raw);
  const number = Number(cleaned);
  return Number.isFinite(number) && number > 100 ? '100' : cleaned;
}

const formValue = value => (value === undefined || value === null ? '' : String(value));

function discountFrom(mrp, rate) {
  const mrpNumber = Number(mrp);
  const rateNumber = Number(rate);
  if (!(mrpNumber > 0) || !(rateNumber >= 0) || rateNumber > mrpNumber) return '';
  return ((1 - rateNumber / mrpNumber) * 100).toFixed(2).replace(/\.00$/, '');
}

function productToForm(product = {}) {
  const raw = product._raw || product;
  const specs = raw.specs || raw;
  const packing = raw.packing || raw;
  const prices = raw.prices || raw;
  const stock = raw.stock || raw;
  const classification = raw.classification || raw;
  const flags = raw.flags || {};
  const mrp = prices.mrp ?? raw.mrp;
  const retailRate = prices.retail_price ?? raw.retail_price;
  const dealerRate = prices.dealer_price ?? raw.dealer_price;
  const wholesaleRate = prices.wholesale_rate ?? raw.wholesale_rate;
  const projectRate = prices.project_rate ?? raw.project_rate;

  return {
    ...INITIAL,
    name: formValue(raw.name), alias: formValue(raw.alias), code: formValue(raw.code || product.productCode),
    description: formValue(raw.description), hsn_code: formValue(specs.hsn_code),
    brand_name: formValue(raw.brand?.name || raw.brand_id?.name || product.brand),
    category_name: formValue(raw.category?.name || raw.category_id?.name || product.category),
    sub_category_name: formValue(raw.sub_category?.name || raw.sub_category_id?.name || product.subCategory),
    unit: formValue(raw.unit) || INITIAL.unit, gst_percent: formValue(raw.gst_percent) || INITIAL.gst_percent,
    size: formValue(specs.size), finish: formValue(specs.finish), material: formValue(specs.material),
    color: formValue(specs.color), surface: formValue(specs.surface), thickness: formValue(specs.thickness),
    grade: formValue(specs.grade), tile_type: formValue(specs.tile_type), application: formValue(specs.application),
    anti_skid: formValue(specs.anti_skid), origin: formValue(specs.origin), manufacturer: formValue(specs.manufacturer),
    barcode: formValue(specs.barcode), design: formValue(specs.design), collection: formValue(specs.collection),
    pcs_per_box: formValue(packing.pcs_per_box), sqft_per_box: formValue(packing.sqft_per_box),
    weight_per_box: formValue(packing.weight_per_box),
    purchase_rate: formValue(prices.purchase_price ?? raw.purchase_price),
    landing_cost: formValue(prices.landing_cost ?? raw.landing_cost), mrp: formValue(mrp),
    retail_discount: discountFrom(mrp, retailRate), retail_rate: formValue(retailRate),
    dealer_discount: discountFrom(mrp, dealerRate), dealer_rate: formValue(dealerRate),
    wholesale_discount: discountFrom(mrp, wholesaleRate), wholesale_rate: formValue(wholesaleRate),
    project_discount: discountFrom(mrp, projectRate), project_rate: formValue(projectRate),
    min_selling_rate: formValue(prices.min_selling_rate ?? raw.min_selling_rate),
    min_stock_level: formValue(stock.min_stock_level ?? raw.min_stock_level),
    reorder_level: formValue(stock.reorder_level ?? raw.reorder_level),
    sales_type: formValue(classification.sales_type ?? raw.sales_type) || INITIAL.sales_type,
    product_type: formValue(classification.product_type ?? raw.product_type) || INITIAL.product_type,
    new_arrival: flags.new_arrival === true || raw.new_arrival === true,
    featured: flags.featured === true || raw.featured === true,
  };
}

function productImageUrls(product = {}) {
  const raw = product._raw || product;
  return Array.isArray(raw.image_urls) ? raw.image_urls.filter(Boolean) : [];
}

export default function AddProductScreen({ navigation, route }) {
  const editProduct = route?.params?.mode === 'edit' ? route.params.product : null;
  const productId = editProduct?.id || editProduct?._raw?.id;
  const isEdit = Boolean(productId);
  const [form, setForm] = useState(() => (isEdit ? productToForm(editProduct) : INITIAL));
  const [existingImages, setExistingImages] = useState(() => (isEdit ? productImageUrls(editProduct) : []));
  const [images, setImages] = useState([]); // newly selected { uri, type, name }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editReady, setEditReady] = useState(!isEdit);
  const [editLoading, setEditLoading] = useState(isEdit);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!isEdit) return undefined;
    let active = true;
    setEditReady(false);
    setEditLoading(true);
    myProductApi.get(productId)
      .then(product => {
        if (!active || !product) return;
        setForm(productToForm(product));
        setExistingImages(productImageUrls(product));
        setEditReady(true);
        setError('');
      })
      .catch(err => {
        if (active) setError(err.message || 'Could not load the latest product details. Go back and try again.');
      })
      .finally(() => {
        if (active) setEditLoading(false);
      });
    return () => { active = false; };
  }, [isEdit, productId]);

  const set = useCallback((key, value) => {
    setForm(current => {
      const nextValue = DISCOUNT_FIELDS.has(key) ? sanitizeDiscount(value) : value;
      const next = { ...current, [key]: nextValue };

      if (key === 'size' || key === 'pcs_per_box') {
        next.sqft_per_box = calcSqftPerBox(next.size, next.pcs_per_box);
      }

      const applyDiscount = (rateField, discountField) => {
        const mrp = parseFloat(next.mrp);
        const discount = parseFloat(next[discountField]);
        if (mrp > 0 && discount >= 0 && next[discountField] !== '') {
          next[rateField] = (mrp * (1 - discount / 100)).toFixed(2);
        }
      };

      Object.entries(RATE_DISCOUNTS).forEach(([rateField, discountField]) => {
        if (key === discountField || key === 'mrp') {
          applyDiscount(rateField, discountField);
        }
      });

      return next;
    });
    setError('');
  }, []);

  // Scroll the focused input into view above the keyboard.
  const handleFieldFocus = useCallback((event) => {
    const target = event?.target || event?.nativeEvent?.target;
    const scrollNode = scrollRef.current ? findNodeHandle(scrollRef.current) : null;
    if (!target || !scrollNode) return;
    try {
      UIManager.measureLayout(
        typeof target === 'number' ? target : findNodeHandle(target),
        scrollNode,
        () => {},
        (_x, y) => {
          const offset = Math.max(y - 90, 0);
          scrollRef.current?.scrollTo({ y: offset, animated: true });
        },
      );
    } catch { /* measure not available */ }
  }, []);

  const pickImages = async () => {
    const imageCount = existingImages.length + images.length;
    if (imageCount >= MAX_IMAGES) {
      Alert.alert('Limit reached', `You can add up to ${MAX_IMAGES} images.`);
      return;
    }
    const res = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: MAX_IMAGES - imageCount,
    });
    if (res.didCancel) return;
    if (res.errorCode) {
      Alert.alert('Gallery error', res.errorMessage || res.errorCode);
      return;
    }
    const picked = (res.assets || []).map((asset, index) => ({
      uri: asset.uri,
      type: asset.type || 'image/jpeg',
      name: asset.fileName || `product_${Date.now()}_${index}.jpg`,
    }));
    setImages(previous => [...previous, ...picked].slice(0, MAX_IMAGES - existingImages.length));
  };

  const removeExistingImage = (url) => setExistingImages(previous => previous.filter(imageUrl => imageUrl !== url));
  const removeImage = (index) => setImages(previous => previous.filter((_, itemIndex) => itemIndex !== index));

  const handleSave = async () => {
    if (isEdit && !editReady) {
      setError('Wait for the latest product details to load before saving.');
      return;
    }
    if (!form.name.trim()) {
      setError('Product name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // Discount percentages are calculator-only. The calculated rates are persisted.
      const productFields = { ...form };
      DISCOUNT_FIELDS.forEach(field => delete productFields[field]);
      const saved = isEdit
        ? await myProductApi.update(productId, productFields, images, existingImages)
        : await myProductApi.create(productFields, images);
      setSaving(false);
      Alert.alert(
        isEdit ? 'Product updated' : 'Product created',
        `${saved?.name || 'Product'} has been ${isEdit ? 'updated in all catalogues' : 'added to your products'}.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      setSaving(false);
      setError(err.message || `Could not ${isEdit ? 'update' : 'create'} product. Please try again.`);
    }
  };

  const numericChange = (field) => (value) => set(field, sanitizeDecimal(value));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <View style={styles.blueHeader}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{isEdit ? 'Edit Product' : 'Add Product'}</Text>
          <Text style={styles.headerSub}>{isEdit ? 'Update your product across all catalogues' : 'Create a product for your catalog'}</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          pointerEvents={isEdit && !editReady ? 'none' : 'auto'}
          style={isEdit && !editReady ? styles.formDisabled : undefined}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {editLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading all product details for editing…</Text>
            </View>
          ) : null}
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <SectionHeader title="Product Images" />
          <View style={styles.imageRow}>
            {existingImages.map(url => (
              <View key={url} style={styles.imgThumb}>
                <Image source={{ uri: mediaUrl(url) }} style={styles.imgThumbImg} />
                <TouchableOpacity style={styles.imgRemove} onPress={() => removeExistingImage(url)}>
                  <Ionicons name="close" size={12} color="#FFF" />
                </TouchableOpacity>
              </View>
            ))}
            {images.map((image, index) => (
              <View key={`${image.uri}-${index}`} style={styles.imgThumb}>
                <Image source={{ uri: image.uri }} style={styles.imgThumbImg} />
                <TouchableOpacity style={styles.imgRemove} onPress={() => removeImage(index)}>
                  <Ionicons name="close" size={12} color="#FFF" />
                </TouchableOpacity>
              </View>
            ))}
            {existingImages.length + images.length < MAX_IMAGES && (
              <TouchableOpacity style={styles.imgAdd} onPress={pickImages}>
                <Ionicons name="add" size={22} color={Colors.textTertiary} />
                <Text style={styles.imgAddText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>

          <SectionHeader title="Basic Information" />
          <FField onFocusScroll={handleFieldFocus} label="Product Name" required value={form.name} onChangeText={value => set('name', value)} placeholder="e.g. Vitrified Floor Tile" />
          <FField onFocusScroll={handleFieldFocus} label="Product Code" value={form.code} onChangeText={value => set('code', value)} placeholder="Auto-generated if left blank" autoCapitalize="characters" />
          <FField onFocusScroll={handleFieldFocus} label="Alias" value={form.alias} onChangeText={value => set('alias', value)} placeholder="Short name (optional)" />

          <FField onFocusScroll={handleFieldFocus} label="Brand" value={form.brand_name} onChangeText={value => set('brand_name', value)} placeholder="Type a brand name to add" helperText="New brand will be created automatically" />
          <FField onFocusScroll={handleFieldFocus} label="Category" value={form.category_name} onChangeText={value => { set('category_name', value); if (!value.trim()) set('sub_category_name', ''); }} placeholder="Type a category to add" helperText="New category will be created automatically" />
          <FField onFocusScroll={handleFieldFocus} label="Sub-Category" value={form.sub_category_name} onChangeText={value => set('sub_category_name', value)} placeholder="Type a sub-category to add" helperText="Added under the category above" editable={Boolean(form.category_name.trim())} />

          <FField onFocusScroll={handleFieldFocus} label="HSN Code" value={form.hsn_code} onChangeText={value => set('hsn_code', value)} placeholder="HSN code" />
          <FField onFocusScroll={handleFieldFocus} label="Description" value={form.description} onChangeText={value => set('description', value)} placeholder="Product description" multiline numberOfLines={3} />

          <SectionHeader title="Unit & Tax" />
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <SelectField label="Unit" required options={UNITS} value={form.unit} onChange={value => set('unit', value)} />
            </View>
            <View style={styles.gridItem}>
              <SelectField label="GST %" options={GST_OPTS.map(value => ({ value, label: `${value}%` }))} value={form.gst_percent} onChange={value => set('gst_percent', value)} />
            </View>
          </View>

          <SectionHeader title="Tile Specifications" />
          <View style={styles.grid}>
            <View style={styles.gridItem}><SelectField label="Tile Size" options={SIZES.map(value => ({ value, label: `${value} MM` }))} value={form.size} onChange={value => set('size', value)} /></View>
            <View style={styles.gridItem}><SelectField label="Finish" options={FINISHES} value={form.finish} onChange={value => set('finish', value)} /></View>
            <View style={styles.gridItem}><FField onFocusScroll={handleFieldFocus} label="Material" value={form.material} onChangeText={value => set('material', value)} placeholder="e.g. Vitrified" /></View>
            <View style={styles.gridItem}><FField onFocusScroll={handleFieldFocus} label="Colour" value={form.color} onChangeText={value => set('color', value)} placeholder="e.g. Ivory" /></View>
            <View style={styles.gridItem}><SelectField label="Surface" options={SURFACES} value={form.surface} onChange={value => set('surface', value)} /></View>
            <View style={styles.gridItem}><FField onFocusScroll={handleFieldFocus} label="Thickness" value={form.thickness} onChangeText={value => set('thickness', value)} placeholder="e.g. 9mm" /></View>
            <View style={styles.gridItem}><SelectField label="Grade" options={GRADES} value={form.grade} onChange={value => set('grade', value)} /></View>
            <View style={styles.gridItem}><SelectField label="Tile Type" options={TILE_TYPES} value={form.tile_type} onChange={value => set('tile_type', value)} /></View>
            <View style={styles.gridItem}><SelectField label="Application" options={APPLICATIONS} value={form.application} onChange={value => set('application', value)} /></View>
            <View style={styles.gridItem}><SelectField label="Anti Skid" options={ANTI_SKIDS} value={form.anti_skid} onChange={value => set('anti_skid', value)} /></View>
            <View style={styles.gridItem}><SelectField label="Origin" options={ORIGINS} value={form.origin} onChange={value => set('origin', value)} /></View>
            <View style={styles.gridItem}><FField onFocusScroll={handleFieldFocus} label="Manufacturer" value={form.manufacturer} onChangeText={value => set('manufacturer', value)} placeholder="Manufacturer" /></View>
            <View style={styles.gridItem}><FField onFocusScroll={handleFieldFocus} label="Barcode" value={form.barcode} onChangeText={value => set('barcode', value)} placeholder="Barcode / EAN" /></View>
          </View>

          <SectionHeader title="Packing & Collection" />
          <FField onFocusScroll={handleFieldFocus} label="Design" value={form.design} onChangeText={value => set('design', value)} placeholder="Design name" />
          <FField onFocusScroll={handleFieldFocus} label="Collection" value={form.collection} onChangeText={value => set('collection', value)} placeholder="Collection name" />
          <View style={styles.grid}>
            <View style={styles.gridItem}><FField onFocusScroll={handleFieldFocus} label="Pcs / Box" value={form.pcs_per_box} onChangeText={numericChange('pcs_per_box')} placeholder="0" keyboardType="decimal-pad" /></View>
            <View style={styles.gridItem}><FField onFocusScroll={handleFieldFocus} label="Sqft / Box (Auto)" value={form.sqft_per_box} onChangeText={numericChange('sqft_per_box')} placeholder="0.00" keyboardType="decimal-pad" helperText="Calculated from tile size and pieces; you can edit it" /></View>
            <View style={styles.gridItem}><FField onFocusScroll={handleFieldFocus} label="Weight / Box (Kg)" value={form.weight_per_box} onChangeText={numericChange('weight_per_box')} placeholder="0.00" keyboardType="decimal-pad" /></View>
          </View>

          <SectionHeader title="Pricing" />
          <View style={styles.grid}>
            <View style={styles.gridItem}><FField onFocusScroll={handleFieldFocus} label="Purchase Rate" value={form.purchase_rate} onChangeText={numericChange('purchase_rate')} placeholder="0.00" keyboardType="decimal-pad" /></View>
            <View style={styles.gridItem}><FField onFocusScroll={handleFieldFocus} label="Landing Cost" value={form.landing_cost} onChangeText={numericChange('landing_cost')} placeholder="0.00" keyboardType="decimal-pad" /></View>
            <View style={styles.gridItem}><FField onFocusScroll={handleFieldFocus} label="MRP" value={form.mrp} onChangeText={numericChange('mrp')} placeholder="0.00" keyboardType="decimal-pad" helperText="Rates below calculate from MRP and discount" /></View>
          </View>

          <PriceDiscountRow
            label="Retail"
            discount={form.retail_discount}
            rate={form.retail_rate}
            onDiscountChange={value => set('retail_discount', value)}
            onRateChange={numericChange('retail_rate')}
            onFocusScroll={handleFieldFocus}
          />
          <PriceDiscountRow
            label="Dealer"
            discount={form.dealer_discount}
            rate={form.dealer_rate}
            onDiscountChange={value => set('dealer_discount', value)}
            onRateChange={numericChange('dealer_rate')}
            onFocusScroll={handleFieldFocus}
          />
          <PriceDiscountRow
            label="Wholesale"
            discount={form.wholesale_discount}
            rate={form.wholesale_rate}
            onDiscountChange={value => set('wholesale_discount', value)}
            onRateChange={numericChange('wholesale_rate')}
            onFocusScroll={handleFieldFocus}
          />
          <PriceDiscountRow
            label="Project"
            discount={form.project_discount}
            rate={form.project_rate}
            onDiscountChange={value => set('project_discount', value)}
            onRateChange={numericChange('project_rate')}
            onFocusScroll={handleFieldFocus}
          />

          <View style={styles.grid}>
            <View style={styles.gridItem}><FField onFocusScroll={handleFieldFocus} label="Min Selling Rate" value={form.min_selling_rate} onChangeText={numericChange('min_selling_rate')} placeholder="0.00" keyboardType="decimal-pad" /></View>
            <View style={styles.gridItem}><FField onFocusScroll={handleFieldFocus} label="Min Stock Level" value={form.min_stock_level} onChangeText={numericChange('min_stock_level')} placeholder="0" keyboardType="decimal-pad" /></View>
            <View style={styles.gridItem}><FField onFocusScroll={handleFieldFocus} label="Reorder Level" value={form.reorder_level} onChangeText={numericChange('reorder_level')} placeholder="0" keyboardType="decimal-pad" /></View>
          </View>

          <SectionHeader title="Product Type & Flags" />
          <SelectField label="Sales Type" options={SALE_TYPES} value={form.sales_type} onChange={value => set('sales_type', value)} />
          <SelectField label="Product Type" options={PRODUCT_TYPES} value={form.product_type} onChange={value => set('product_type', value)} />
          <ToggleRow label="New Arrival" value={form.new_arrival} onChange={value => set('new_arrival', value)} />
          <ToggleRow label="Featured" value={form.featured} onChange={value => set('featured', value)} last />

          <PrimaryButton
            title={isEdit ? 'UPDATE PRODUCT' : 'SAVE PRODUCT'}
            onPress={handleSave}
            loading={saving}
            disabled={isEdit && !editReady}
            variant="primary"
            size="lg"
            style={{ marginTop: Spacing.lg }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const FField = ({ onFocusScroll, ...props }) => (
  <TextInput {...props} onFocus={onFocusScroll} />
);

const SectionHeader = ({ title }) => (
  <View style={styles.section}>
    <View style={styles.sectionBar} />
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const PriceDiscountRow = ({
  label, discount, rate, onDiscountChange, onRateChange, onFocusScroll,
}) => (
  <View style={styles.priceRow}>
    <View style={styles.priceRowItem}>
      <FField
        onFocusScroll={onFocusScroll}
        label={`${label} Discount %`}
        value={discount}
        onChangeText={onDiscountChange}
        placeholder="0"
        keyboardType="decimal-pad"
        helperText="0 to 100%"
      />
    </View>
    <View style={styles.priceRowItem}>
      <FField
        onFocusScroll={onFocusScroll}
        label={`${label} Rate (Auto)`}
        value={rate}
        onChangeText={onRateChange}
        placeholder="0.00"
        keyboardType="decimal-pad"
        helperText="Calculated rate remains editable"
      />
    </View>
  </View>
);

const SelectField = ({ label, value, options, onChange, required = false, placeholder = 'Select' }) => {
  const [visible, setVisible] = useState(false);
  const normalizedOptions = options.map(option => (
    typeof option === 'string' ? { value: option, label: option } : option
  ));
  const selected = normalizedOptions.find(option => option.value === value);

  const choose = (nextValue) => {
    onChange(nextValue);
    setVisible(false);
  };

  return (
    <View style={styles.selectContainer}>
      <Text style={styles.selectLabel}>
        {label}{required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TouchableOpacity style={styles.selectTrigger} onPress={() => setVisible(true)} activeOpacity={0.75}>
        <Text style={[styles.selectValue, !selected && styles.selectPlaceholder]} numberOfLines={1}>
          {selected?.label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={Colors.textTertiary} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={styles.selectOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.selectSheet}>
                <View style={styles.selectHandle} />
                <View style={styles.selectSheetHeader}>
                  <Text style={styles.selectSheetTitle}>Select {label}</Text>
                  {value && !required ? (
                    <TouchableOpacity onPress={() => choose('')} style={styles.clearSelectionButton}>
                      <Text style={styles.clearSelectionText}>Clear</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeSelectionButton}>
                    <Ionicons name="close" size={21} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.selectOptions} showsVerticalScrollIndicator={false}>
                  {normalizedOptions.map(option => {
                    const active = option.value === value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.selectOption, active && styles.selectOptionActive]}
                        onPress={() => choose(option.value)}
                      >
                        <Text style={[styles.selectOptionText, active && styles.selectOptionTextActive]}>{option.label}</Text>
                        {active ? <Ionicons name="checkmark-circle" size={20} color={Colors.primary} /> : null}
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
};

const ToggleRow = ({ label, value, onChange, last }) => (
  <View style={[styles.toggleRow, !last && styles.toggleBorder]}>
    <Text style={styles.toggleLabel}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ true: Colors.primary, false: Colors.border }}
      thumbColor="#FFF"
    />
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  keyboardAvoider: { flex: 1 },
  blueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.secondary, paddingHorizontal: Spacing.screenPadding, paddingTop: 8, paddingBottom: 14 },
  headerBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { ...Typography.h4, color: '#FFF' },
  headerSub: { ...Typography.caption, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  scroll: { padding: Spacing.screenPadding, paddingBottom: 340 },
  formDisabled: { opacity: 0.72 },
  loadingBox: {
    flexDirection: 'row', gap: 9, alignItems: 'center',
    backgroundColor: Colors.primaryBg, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.base,
  },
  loadingText: { ...Typography.caption, color: Colors.primary, flex: 1, fontWeight: '600' },

  errorBox: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: Colors.errorBg, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.base },
  errorText: { ...Typography.caption, color: Colors.error, flex: 1 },

  section: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.lg, marginBottom: Spacing.md },
  sectionBar: { width: 3, height: 16, backgroundColor: Colors.primary, borderRadius: 2, marginRight: 8 },
  sectionTitle: { ...Typography.h5, color: Colors.textPrimary },

  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imgThumb: { width: 78, height: 78, borderRadius: 10, position: 'relative' },
  imgThumbImg: { width: 78, height: 78, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  imgRemove: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center' },
  imgAdd: { width: 78, height: 78, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
  imgAddText: { ...Typography.caption, color: Colors.textTertiary, fontSize: 10, marginTop: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: { width: '48%' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Colors.white, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, paddingTop: Spacing.base, marginBottom: Spacing.sm, ...Shadows.sm },
  priceRowItem: { width: '48%' },

  selectContainer: { marginBottom: Spacing.base },
  selectLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 },
  required: { color: Colors.error },
  selectTrigger: { minHeight: 48, paddingHorizontal: Spacing.base, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.input },
  selectValue: { ...Typography.body1, color: Colors.textPrimary, flex: 1 },
  selectPlaceholder: { color: Colors.textTertiary },
  selectOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay },
  selectSheet: { maxHeight: '72%', backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius['3xl'], borderTopRightRadius: BorderRadius['3xl'], paddingTop: 8, paddingBottom: 24 },
  selectHandle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.base },
  selectSheetHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  selectSheetTitle: { ...Typography.h4, color: Colors.textPrimary, flex: 1 },
  clearSelectionButton: { paddingHorizontal: Spacing.sm, paddingVertical: 8 },
  clearSelectionText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },
  closeSelectionButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  selectOptions: { paddingHorizontal: Spacing.base },
  selectOption: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  selectOptionActive: { backgroundColor: Colors.primaryBg },
  selectOptionText: { ...Typography.body1, color: Colors.textPrimary, flex: 1 },
  selectOptionTextActive: { color: Colors.primary, fontWeight: '700' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, backgroundColor: Colors.white, paddingHorizontal: Spacing.base, borderRadius: BorderRadius.md, marginBottom: 8, ...Shadows.sm },
  toggleBorder: {},
  toggleLabel: { ...Typography.body1, color: Colors.textPrimary, fontWeight: '600' },
});
