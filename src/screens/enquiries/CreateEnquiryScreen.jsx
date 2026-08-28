import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import AppHeader from '../../components/common/AppHeader';
import TextInput from '../../components/common/TextInput';
import PrimaryButton from '../../components/common/PrimaryButton';
import QuantitySelector from '../../components/common/QuantitySelector';
import { enquiryApi, profileApi, mediaUrl } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { SCREENS } from '../../constants';

const UNITS = ['Box', 'Sq Ft', 'Sq Mtr', 'Pieces', 'Pallets'];

export default function CreateEnquiryScreen({ navigation, route }) {
  const { product } = route.params;
  const { user } = useAuth();
  const raw = product._raw || product;

  const [quantity, setQuantity]           = useState(100);
  const [unit, setUnit]                   = useState(raw?.unit || product?.unit || 'Box');
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [remarks, setRemarks]             = useState('');
  const [errors, setErrors]               = useState({});
  const [loading, setLoading]             = useState(false);
  const [addresses, setAddresses]         = useState([]);
  const [addrLoading, setAddrLoading]     = useState(true);

  // Product details
  const productName  = product.name || raw?.name || '';
  const productCode  = product.productCode || raw?.code || '';
  const brandName    = product.brand || raw?.brand_id?.name || '';
  const categoryName = product.category || raw?.category_id?.name || '';
  const size         = product.size || raw?.size || '';
  const finish       = product.finish || raw?.finish || '';
  const color        = product.color || raw?.color || '';
  const material     = product.material || raw?.material || '';
  const gstPercent   = raw?.gst_percent ?? product.gstPercent ?? 18;
  const retailPrice  = raw?.retail_price || raw?.prices?.retail_price || product.retailPrice;
  const mrpPrice     = raw?.mrp || raw?.prices?.mrp || product.mrp;
  const sellerName   = product.seller?.name || raw?.seller?.name || '';
  const sellerCity   = product.seller?.city || raw?.seller?.city || '';
  const sellerState  = product.seller?.state || raw?.seller?.state || '';
  const visibleStock = raw?.visible_stock ?? product.visibleStock ?? null;
  const inStock      = raw?.in_stock !== false && product.inStock !== false;
  const productImage = (product.images && product.images[0]) || (raw?.image_urls && mediaUrl(raw.image_urls[0])) || null;
  const pcsPerBox    = raw?.pcs_per_box || raw?.packing?.pcs_per_box || product.pcsPerBox;
  const sqftPerBox   = raw?.sqft_per_box || raw?.packing?.sqft_per_box || product.sqftPerBox;

  // Load delivery addresses
  const loadAddresses = useCallback(async () => {
    setAddrLoading(true);
    try {
      const data = await profileApi.listAddresses();
      const list = data?.addresses || [];
      setAddresses(list);
      const def = list.find(a => a.is_default) || list[0];
      if (def) setSelectedAddressId(def._id?.toString() || def.id?.toString());
    } catch {
      const city = user?.company?.city || '';
      if (city) {
        const fallback = [{
          _id: 'company', label: 'Company Address',
          address: user?.company?.address || '',
          city, state: user?.company?.state || '',
          pin_code: user?.company?.pin_code || '',
          is_default: true,
        }];
        setAddresses(fallback);
        setSelectedAddressId('company');
      }
    } finally {
      setAddrLoading(false);
    }
  }, [user]);

  useEffect(() => { loadAddresses(); }, [loadAddresses]);

  const validate = () => {
    const e = {};
    if (!quantity || quantity < 1) e.quantity = 'Quantity must be at least 1';
    if (!selectedAddressId && addresses.length > 0) e.address = 'Please select a delivery location';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      const productId = raw?.id || raw?._id || product.id;
      const selected  = addresses.find(a => (a._id?.toString() || a.id?.toString()) === selectedAddressId);
      const location  = [selected?.city, selected?.state].filter(Boolean).join(', ');

      const payload = {
        product_id: productId,
        qty:        quantity,
        unit,
        location,
        remarks: remarks.trim(),
        ...(selectedAddressId && selectedAddressId !== 'company' && { address_id: selectedAddressId }),
      };

      const enquiry = await enquiryApi.create(payload);
      setLoading(false);
      navigation.replace(SCREENS.ENQUIRY_SUCCESS, {
        enquiryId:   enquiry?.enquiry_code || enquiry?.id,
        enquiryDbId: enquiry?.id,
        product,
      });
    } catch (err) {
      setLoading(false);
      setErrors({ submit: err.message || 'Could not send enquiry. Please try again.' });
    }
  };

  // Calculation helpers
  const selectedAddr = addresses.find(a => (a._id?.toString() || a.id?.toString()) === selectedAddressId);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AppHeader title="Send Enquiry" showBack onBack={() => navigation.goBack()} centerTitle />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={true}
        >
          {/* ═══ Product Hero Card ═══ */}
          <View style={styles.heroCard}>
            {/* Product Image */}
            <View style={styles.heroTop}>
              {productImage ? (
                <Image source={{ uri: productImage }} style={styles.heroImage} resizeMode="cover" />
              ) : (
                <View style={[styles.heroImage, styles.heroImagePlaceholder]}>
                  <Ionicons name="image-outline" size={32} color={Colors.border} />
                </View>
              )}
              <View style={styles.heroInfo}>
                <Text style={styles.heroName} numberOfLines={2}>{productName}</Text>
                {productCode ? <Text style={styles.heroCode}>{productCode}</Text> : null}
                <View style={styles.heroChips}>
                  {brandName ? (
                    <View style={styles.chipBrand}>
                      <Ionicons name="pricetag" size={10} color={Colors.secondary} />
                      <Text style={styles.chipBrandText}>{brandName}</Text>
                    </View>
                  ) : null}
                  {categoryName ? (
                    <View style={styles.chipCat}>
                      <Text style={styles.chipCatText}>{categoryName}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Product Specs Grid */}
            <View style={styles.specsGrid}>
              {size ? <SpecItem icon="resize-outline" label="Size" value={size} /> : null}
              {finish ? <SpecItem icon="color-palette-outline" label="Finish" value={finish} /> : null}
              {color ? <SpecItem icon="ellipse" label="Color" value={color} /> : null}
              {material ? <SpecItem icon="layers-outline" label="Material" value={material} /> : null}
            </View>

            {/* Pricing + Stock Row */}
            <View style={styles.priceStockRow}>
              <View style={styles.priceBox}>
                {retailPrice ? (
                  <>
                    <Text style={styles.priceLabel}>RETAIL PRICE</Text>
                    <Text style={styles.priceValue}>{formatCurrency(retailPrice)}<Text style={styles.priceUnit}>/{unit}</Text></Text>
                  </>
                ) : mrpPrice ? (
                  <>
                    <Text style={styles.priceLabel}>MRP</Text>
                    <Text style={styles.priceValue}>{formatCurrency(mrpPrice)}<Text style={styles.priceUnit}>/{unit}</Text></Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.priceLabel}>PRICE</Text>
                    <Text style={styles.priceOnEnquiry}>On Enquiry</Text>
                  </>
                )}
              </View>
              <View style={styles.stockBox}>
                <View style={[styles.stockDot, inStock ? styles.stockDotGreen : styles.stockDotRed]} />
                <Text style={[styles.stockText, inStock ? styles.stockTextGreen : styles.stockTextRed]}>
                  {visibleStock != null && visibleStock > 0
                    ? `${visibleStock} ${unit} available`
                    : inStock ? 'In Stock' : 'Out of Stock'}
                </Text>
              </View>
            </View>

            {/* Packing info */}
            {(pcsPerBox || sqftPerBox) ? (
              <View style={styles.packingRow}>
                <Ionicons name="cube-outline" size={14} color={Colors.textTertiary} />
                <Text style={styles.packingText}>
                  {pcsPerBox ? `${pcsPerBox} pcs/box` : ''}{pcsPerBox && sqftPerBox ? ' · ' : ''}{sqftPerBox ? `${sqftPerBox} sqft/box` : ''}
                </Text>
              </View>
            ) : null}

            {/* Seller Info */}
            {sellerName ? (
              <View style={styles.sellerRow}>
                <View style={styles.sellerIcon}>
                  <Ionicons name="storefront-outline" size={16} color={Colors.primary} />
                </View>
                <View style={styles.sellerInfo}>
                  <Text style={styles.sellerName}>{sellerName}</Text>
                  {(sellerCity || sellerState) ? (
                    <Text style={styles.sellerLocation}>
                      <Ionicons name="location-outline" size={11} color={Colors.textTertiary} />
                      {' '}{[sellerCity, sellerState].filter(Boolean).join(', ')}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.sellerBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#27AE60" />
                  <Text style={styles.sellerBadgeText}>Verified</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* ═══ Quantity Section ═══ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="calculator-outline" size={18} color={Colors.primary} />
              <Text style={styles.cardTitle}>Quantity & Unit</Text>
            </View>
            <Text style={styles.fieldLabel}>HOW MUCH DO YOU NEED?</Text>
            <QuantitySelector value={quantity} onChangeValue={setQuantity} unit={unit} min={1} step={10} />
            {errors.quantity ? <Text style={styles.errorText}>{errors.quantity}</Text> : null}

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>SELECT UNIT</Text>
            <View style={styles.unitRow}>
              {UNITS.map(u => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitChip, unit === u && styles.unitChipActive]}
                  onPress={() => setUnit(u)}
                >
                  <Text style={[styles.unitChipText, unit === u && styles.unitChipTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Approximate value hint */}
            {retailPrice && quantity > 0 ? (
              <View style={styles.approxBox}>
                <Ionicons name="information-circle-outline" size={14} color={Colors.info} />
                <Text style={styles.approxText}>
                  Approximate value: <Text style={styles.approxBold}>{formatCurrency(retailPrice * quantity)}</Text> (before GST)
                </Text>
              </View>
            ) : null}
          </View>

          {/* ═══ Delivery Location ═══ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="location-outline" size={18} color={Colors.primary} />
              <Text style={styles.cardTitle}>Delivery Location</Text>
            </View>
            {errors.address ? <Text style={styles.errorText}>{errors.address}</Text> : null}

            {addrLoading ? (
              <View style={styles.addrLoading}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.addrLoadingText}>Loading saved addresses…</Text>
              </View>
            ) : addresses.length === 0 ? (
              <View style={styles.noAddrBox}>
                <Ionicons name="location-outline" size={24} color={Colors.textTertiary} />
                <Text style={styles.noAddrTitle}>No saved addresses</Text>
                <Text style={styles.noAddrSub}>Add your delivery addresses in Profile → Company Details</Text>
              </View>
            ) : (
              addresses.map(addr => {
                const addrId   = addr._id?.toString() || addr.id?.toString();
                const selected = selectedAddressId === addrId;
                return (
                  <TouchableOpacity
                    key={addrId}
                    style={[styles.addressCard, selected && styles.addressCardSelected]}
                    onPress={() => setSelectedAddressId(addrId)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
                      {selected && <View style={styles.radioInner} />}
                    </View>
                    <View style={styles.addressContent}>
                      <View style={styles.addressTopRow}>
                        <Text style={styles.addressLabel}>{addr.label || 'Address'}</Text>
                        {addr.is_default && (
                          <View style={styles.defaultBadge}><Text style={styles.defaultText}>DEFAULT</Text></View>
                        )}
                      </View>
                      {addr.address ? <Text style={styles.addressLine} numberOfLines={2}>{addr.address}</Text> : null}
                      <View style={styles.addressMeta}>
                        <Ionicons name="navigate-outline" size={11} color={Colors.textTertiary} />
                        <Text style={styles.addressCity}>
                          {[addr.city, addr.state, addr.pin_code].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                      {addr.mobile ? (
                        <View style={styles.addressMeta}>
                          <Ionicons name="call-outline" size={11} color={Colors.textTertiary} />
                          <Text style={styles.addressCity}>{addr.contact_name ? `${addr.contact_name} · ` : ''}{addr.mobile}</Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* ═══ Remarks ═══ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="chatbox-ellipses-outline" size={18} color={Colors.primary} />
              <Text style={styles.cardTitle}>Additional Notes</Text>
            </View>
            <TextInput
              placeholder="Special requirements, project details, urgency, preferred delivery date..."
              value={remarks}
              onChangeText={setRemarks}
              multiline
              numberOfLines={4}
              maxLength={2000}
            />
            <Text style={styles.charCount}>{remarks.length}/2000</Text>
          </View>

          {/* ═══ Order Summary ═══ */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryIconCircle}>
                <Ionicons name="receipt-outline" size={20} color={Colors.secondary} />
              </View>
              <Text style={styles.summaryTitle}>Enquiry Summary</Text>
            </View>

            <View style={styles.summaryDivider} />

            <SummaryRow icon="grid-outline" label="Product" value={productName} />
            <SummaryRow icon="pricetag-outline" label="Brand" value={brandName || '—'} />
            <SummaryRow icon="layers-outline" label="Quantity" value={`${quantity} ${unit}`} highlight />
            <SummaryRow icon="storefront-outline" label="Seller" value={sellerName || '—'} />
            <SummaryRow
              icon="location-outline"
              label="Deliver To"
              value={selectedAddr ? [selectedAddr.city, selectedAddr.state].filter(Boolean).join(', ') : 'Not selected'}
            />
            {retailPrice && quantity > 0 ? (
              <View style={styles.summaryTotal}>
                <Text style={styles.summaryTotalLabel}>Estimated Value</Text>
                <Text style={styles.summaryTotalValue}>{formatCurrency(retailPrice * quantity)}</Text>
                <Text style={styles.summaryTotalNote}>+ {gstPercent}% GST · Final price confirmed by seller</Text>
              </View>
            ) : null}
          </View>

          {/* ═══ GST Note ═══ */}
          <View style={styles.gstNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color={Colors.info} />
            <Text style={styles.gstNoteText}>
              GST ({gstPercent}%) will be calculated by the seller in their quotation. This enquiry is non-binding.
            </Text>
          </View>

          {/* ═══ Error ═══ */}
          {errors.submit ? (
            <View style={styles.submitError}>
              <Ionicons name="alert-circle" size={18} color={Colors.error} />
              <Text style={styles.submitErrorText}>{errors.submit}</Text>
            </View>
          ) : null}

          {/* ═══ Submit Button ═══ */}
          <PrimaryButton
            title="SEND ENQUIRY"
            onPress={handleSubmit}
            loading={loading}
            size="lg"
            style={styles.submitBtn}
          />

          <Text style={styles.disclaimer}>
            By sending, you agree to receive quotations from the seller. No payment is required at this stage.
          </Text>

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ─── Sub-components ─── */
const SpecItem = ({ icon, label, value }) => (
  <View style={styles.specItem}>
    <Ionicons name={icon} size={13} color={Colors.textTertiary} />
    <Text style={styles.specLabel}>{label}</Text>
    <Text style={styles.specValue}>{value}</Text>
  </View>
);

const SummaryRow = ({ icon, label, value, highlight }) => (
  <View style={styles.summaryRow}>
    <View style={styles.summaryRowLeft}>
      <Ionicons name={icon} size={14} color={Colors.textTertiary} />
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
    <Text style={[styles.summaryValue, highlight && styles.summaryValueHighlight]} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

/* ─── Styles ─── */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { padding: Spacing.screenPadding, paddingBottom: 40 },

  /* Hero Card */
  heroCard: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 16, marginBottom: 14,
    ...Shadows.md, borderWidth: 1, borderColor: Colors.borderLight,
  },
  heroTop: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  heroImage: { width: 80, height: 80, borderRadius: 14, backgroundColor: Colors.background },
  heroImagePlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  heroInfo: { flex: 1 },
  heroName: { ...Typography.h5, color: Colors.textPrimary, marginBottom: 3, lineHeight: 22 },
  heroCode: { ...Typography.caption, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  heroChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chipBrand: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.secondaryBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  chipBrandText: { fontSize: 11, fontWeight: '700', color: Colors.secondary },
  chipCat: { backgroundColor: Colors.primaryBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  chipCatText: { fontSize: 11, fontWeight: '700', color: Colors.primary },

  /* Specs Grid */
  specsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  specItem: { flexDirection: 'row', alignItems: 'center', gap: 5, width: '47%', paddingVertical: 3 },
  specLabel: { fontSize: 10, color: Colors.textTertiary, minWidth: 42 },
  specValue: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary, flex: 1 },

  /* Price + Stock */
  priceStockRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  priceBox: {},
  priceLabel: { fontSize: 9, fontWeight: '700', color: Colors.textTertiary, letterSpacing: 0.5, marginBottom: 2 },
  priceValue: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  priceUnit: { fontSize: 12, fontWeight: '400', color: Colors.textSecondary },
  priceOnEnquiry: { fontSize: 15, fontWeight: '700', color: Colors.secondary },
  stockBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  stockDot: { width: 8, height: 8, borderRadius: 4 },
  stockDotGreen: { backgroundColor: '#27AE60' },
  stockDotRed: { backgroundColor: Colors.error },
  stockText: { fontSize: 11, fontWeight: '600' },
  stockTextGreen: { color: '#27AE60' },
  stockTextRed: { color: Colors.error },

  /* Packing */
  packingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8 },
  packingText: { fontSize: 11, color: Colors.textSecondary },

  /* Seller */
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  sellerIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  sellerInfo: { flex: 1 },
  sellerName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  sellerLocation: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  sellerBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#E8F8EF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  sellerBadgeText: { fontSize: 10, fontWeight: '700', color: '#27AE60' },

  /* Generic Card */
  card: { backgroundColor: Colors.white, borderRadius: 18, padding: 18, ...Shadows.sm, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: { ...Typography.h5, color: Colors.textPrimary },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: Colors.textTertiary, letterSpacing: 0.8, marginBottom: 10 },
  errorText: { fontSize: 12, color: Colors.error, marginTop: 4, marginBottom: 4 },

  /* Units */
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background },
  unitChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  unitChipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  unitChipTextActive: { color: Colors.primary, fontWeight: '700' },

  /* Approx value */
  approxBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.infoBg, borderRadius: 10, padding: 12, marginTop: 14 },
  approxText: { fontSize: 12, color: Colors.infoText, flex: 1, lineHeight: 17 },
  approxBold: { fontWeight: '700' },

  /* Address */
  addrLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16 },
  addrLoadingText: { fontSize: 13, color: Colors.textSecondary },
  noAddrBox: { alignItems: 'center', gap: 6, paddingVertical: 20 },
  noAddrTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  noAddrSub: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  addressCard: { flexDirection: 'row', padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, marginBottom: 10, gap: 12, backgroundColor: Colors.background },
  addressCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radioOuterActive: { borderColor: Colors.primary },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary },
  addressContent: { flex: 1 },
  addressTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  addressLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  defaultBadge: { backgroundColor: '#E8F8EF', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  defaultText: { fontSize: 9, fontWeight: '800', color: '#27AE60', letterSpacing: 0.4 },
  addressLine: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18, marginBottom: 4 },
  addressMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  addressCity: { fontSize: 11, color: Colors.textTertiary },

  /* Remarks */
  charCount: { fontSize: 10, color: Colors.textTertiary, textAlign: 'right', marginTop: 4 },

  /* Summary */
  summaryCard: { backgroundColor: Colors.secondaryBg, borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: Colors.secondary + '15' },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  summaryIconCircle: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', ...Shadows.sm },
  summaryTitle: { ...Typography.h5, color: Colors.secondary },
  summaryDivider: { height: 1, backgroundColor: Colors.secondary + '15', marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  summaryRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryLabel: { fontSize: 12, color: Colors.textSecondary },
  summaryValue: { fontSize: 12, color: Colors.textPrimary, fontWeight: '600', maxWidth: '55%', textAlign: 'right' },
  summaryValueHighlight: { color: Colors.primary, fontWeight: '800', fontSize: 14 },
  summaryTotal: { alignItems: 'center', paddingTop: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: Colors.secondary + '15' },
  summaryTotalLabel: { fontSize: 10, fontWeight: '700', color: Colors.textTertiary, letterSpacing: 0.5 },
  summaryTotalValue: { fontSize: 22, fontWeight: '800', color: Colors.secondary, marginTop: 2 },
  summaryTotalNote: { fontSize: 10, color: Colors.textTertiary, marginTop: 4 },

  /* GST note */
  gstNote: { flexDirection: 'row', gap: 8, backgroundColor: Colors.infoBg, borderRadius: 12, padding: 12, marginBottom: 14, alignItems: 'flex-start' },
  gstNoteText: { fontSize: 11, color: Colors.infoText, flex: 1, lineHeight: 17 },

  /* Error */
  submitError: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Colors.errorBg, borderRadius: 12, padding: 14, marginBottom: 14 },
  submitErrorText: { fontSize: 13, color: Colors.error, flex: 1, lineHeight: 19 },

  /* Submit */
  submitBtn: { marginBottom: 12 },
  disclaimer: { fontSize: 11, color: Colors.textTertiary, textAlign: 'center', lineHeight: 17, paddingHorizontal: 16 },
});
