import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import ImageGallery from '../../components/product/ImageGallery';
import ProductActionsModal from '../../components/product/ProductActionsModal';
import PrimaryButton from '../../components/common/PrimaryButton';
import { formatCurrency } from '../../utils/formatters';
import { SCREENS } from '../../constants';
import { productApi, myProductApi } from '../../utils/api';
import { mapMarketplaceProduct } from '../../utils/productMapper';

const money = (v) => (v && v > 0 ? formatCurrency(v) : null);

const ProductDetailsScreen = ({ navigation, route }) => {
  const [product, setProduct] = useState(route.params.product);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState('');
  const [actionsVisible, setActionsVisible] = useState(false);

  const productId = route.params.product?.id || route.params.product?._raw?.id;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!productId) {
        setDetailLoading(false);
        return () => { active = false; };
      }

      setDetailLoading(true);
      setDetailError('');
      productApi.get(productId)
        .then(data => {
          if (active && data) setProduct(mapMarketplaceProduct(data));
        })
        .catch(error => {
          if (active) setDetailError(error.message || 'Could not refresh product details.');
        })
        .finally(() => {
          if (active) setDetailLoading(false);
        });

      return () => { active = false; };
    }, [productId]),
  );

  const p = product._raw || {};
  const brand = product.brand || p.brand_id?.name || '';
  const category = product.category || p.category_id?.name || '';
  const subCat = product.subCategory || p.sub_category_id?.name || '';
  const seller = product.seller || p.seller || null;
  const addedByType = product.addedByType || p.added_by_type
    || (seller?.biz_type === 'Retailer' ? 'Retailer' : seller?.biz_type === 'Wholesaler' ? 'Wholesaler' : 'Admin');
  const canManage = product.canManage === true || p.can_manage === true;
  const canEnquire = product.canEnquire === true || p.can_enquire === true;

  const deleteProduct = () => {
    setActionsVisible(false);
    Alert.alert(
      'Delete product?',
      `${product.name} will be removed from the Retailer, Wholesaler, and Admin catalogues.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await myProductApi.remove(productId);
              Alert.alert('Product deleted', 'The product has been removed from all catalogues.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error) {
              Alert.alert('Could not delete product', error.message || 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const openManageMenu = () => setActionsVisible(true);

  // Section field lists — only keep the ones that have a value.
  const basic = [
    ['Product Code', product.productCode],
    ['Alias', product.alias || p.alias],
    ['Brand', brand],
    ['Category', category],
    ['Sub-Category', subCat],
    ['Product Type', p.product_type],
    ['Sales Type', p.sales_type],
    ['Unit', p.unit],
    ['GST %', p.gst_percent != null ? `${p.gst_percent}%` : ''],
    ['HSN Code', p.hsn_code],
    ['Barcode / EAN', p.barcode],
  ].filter(([, v]) => v);

  const specs = [
    ['Size', p.size],
    ['Finish', p.finish],
    ['Colour', p.color],
    ['Surface', p.surface],
    ['Thickness', p.thickness],
    ['Grade', p.grade],
    ['Tile Type', p.tile_type],
    ['Application', p.application],
    ['Material', p.material],
    ['Anti Skid', p.anti_skid],
    ['Origin', p.origin],
    ['Manufacturer', p.manufacturer],
  ].filter(([, v]) => v);

  const packing = [
    ['Design', p.design],
    ['Collection', p.collection],
    ['Pcs / Box', p.pcs_per_box ? `${p.pcs_per_box}` : ''],
    ['Sqft / Box', p.sqft_per_box ? `${p.sqft_per_box} Sq.Ft` : ''],
    ['Weight / Box', p.weight_per_box ? `${p.weight_per_box} Kg` : ''],
  ].filter(([, v]) => v);

  const isAdminProduct = addedByType === 'Admin';
  const availabilityValue = product.inStock
    ? (product.tracksInventory ? 'In Stock' : 'Available')
    : 'Currently Out of Stock';

  // Admin products are the official platform catalogue. For every product type
  // we keep the Seller & Availability card uniform and do NOT show a location.
  const sellerName = isAdminProduct
    ? 'EzyEnquiry Official'
    : (seller?.name || `${addedByType} Seller`);
  const sellerSubtitle = isAdminProduct
    ? 'Platform verified catalogue'
    : (seller?.biz_type || addedByType);
  const sellerLocation = '';
  const sellerVerified = isAdminProduct || seller?.verified === true;
  const sellerInitial = (sellerName || '?').trim().charAt(0).toUpperCase();
  const stockQtyLabel = product.tracksInventory
    ? (product.visibleStock > 0 ? `${product.visibleStock} ${p.unit || ''}`.trim() : '0')
    : '';

  // Pricing tiles — only show retailer-safe non-zero prices.
  // MRP and Retail Rate are always shown so buyers see them regardless of who
  // added the product. When a value was not entered, show a clear "Not added"
  // note instead of a hidden row or a misleading amount. Dealer Rate stays
  // optional and is only shown when present.
  const prices = [
    { label: 'MRP', value: money(p.mrp), primary: true },
    { label: 'Retail Rate', value: money(p.retail_price) },
  ];

  // Retailers only see MRP and Retail Rate. Selling price is an internal
  // seller figure and must never surface in the retailer app.
  const headlinePrice = money(p.retail_price) || money(p.mrp);
  const headlineLabel = money(p.retail_price) ? 'Retail Rate' : 'MRP';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Back button over image */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={22} color={Colors.white} />
      </TouchableOpacity>
      {canManage ? (
        <TouchableOpacity
          style={styles.manageBtn}
          onPress={openManageMenu}
          accessibilityRole="button"
          accessibilityLabel={`Manage ${product.name}`}
        >
          <Ionicons name="ellipsis-vertical" size={23} color={Colors.white} />
        </TouchableOpacity>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false}>
        <ImageGallery images={product.images} height={280} />

        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.productName}>{product.name}</Text>
          {product.productCode ? <Text style={styles.productCode}>{product.productCode}</Text> : null}
          {detailLoading ? (
            <View style={styles.refreshingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.refreshingText}>Refreshing latest product details…</Text>
            </View>
          ) : null}
          {detailError ? (
            <View style={styles.detailWarning}>
              <Ionicons name="information-circle-outline" size={15} color="#B45309" />
              <Text style={styles.detailWarningText}>{detailError} Showing the last loaded information.</Text>
            </View>
          ) : null}

          <View style={styles.addedByCard}>
            <View style={styles.addedByIcon}>
              <Ionicons
                name={addedByType === 'Retailer' ? 'storefront-outline' : addedByType === 'Wholesaler' ? 'business-outline' : 'shield-checkmark-outline'}
                size={20}
                color={Colors.primary}
              />
            </View>
            <View style={styles.addedByContent}>
              <Text style={styles.addedByLabel}>ADDED BY</Text>
              <Text style={styles.addedByValue}>{isAdminProduct ? 'EzyEnquiry Official' : addedByType}</Text>
              {isAdminProduct ? (
                <Text style={styles.addedByCompany} numberOfLines={1}>Platform verified catalogue</Text>
              ) : seller?.name ? (
                <Text style={styles.addedByCompany} numberOfLines={1}>{seller.name}</Text>
              ) : null}
            </View>
            {canManage ? (
              <View style={styles.yourProductBadge}>
                <Text style={styles.yourProductText}>YOUR PRODUCT</Text>
              </View>
            ) : null}
          </View>

          {/* Brand + category chips */}
          <View style={styles.chipRow}>
            {brand ? <View style={styles.brandChip}><Ionicons name="business-outline" size={12} color={Colors.secondary} /><Text style={styles.brandChipText}>{brand}</Text></View> : null}
            {category ? <View style={styles.catChip}><Text style={styles.catChipText}>{category}</Text></View> : null}
            {product.flags?.featured ? <View style={styles.featureChip}><Ionicons name="star" size={11} color="#B45309" /><Text style={styles.featureChipText}>Featured</Text></View> : null}
            {product.flags?.new_arrival ? <View style={styles.newChip}><Ionicons name="sparkles" size={11} color="#047857" /><Text style={styles.newChipText}>New Arrival</Text></View> : null}
            <View style={product.inStock ? styles.stockChip : styles.outStockChip}>
              <Text style={product.inStock ? styles.stockChipText : styles.outStockChipText}>
                {product.inStock ? 'In Stock' : 'Out of Stock'}
              </Text>
            </View>
          </View>

          {/* Headline price */}
          <View style={styles.priceCard}>
            {headlinePrice ? (
              <View style={styles.priceRow}>
                <View>
                  <Text style={styles.priceLabel}>{headlineLabel}</Text>
                  <Text style={styles.price}>{headlinePrice}</Text>
                </View>
                {money(p.mrp) && p.mrp > (p.retail_price || 0) && p.retail_price > 0 ? (
                  <Text style={styles.mrpStrike}>MRP {money(p.mrp)}</Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.enquireRow}>
                <Ionicons name="pricetag-outline" size={16} color={Colors.secondary} />
                <Text style={styles.enquirePrice}>Price on Enquiry</Text>
              </View>
            )}
          </View>

          {/* Basic Information */}
          <Section icon="information-circle-outline" title="Basic Information" rows={basic} />

          {/* Specifications */}
          <Section icon="options-outline" title="Specifications" rows={specs} />

          {/* Packing */}
          <Section icon="cube-outline" title="Packing & Collection" rows={packing} />

          {/* Seller and stock */}
          <SellerCard
            isAdmin={isAdminProduct}
            initial={sellerInitial}
            name={sellerName}
            subtitle={sellerSubtitle}
            location={sellerLocation}
            verified={sellerVerified}
            inStock={product.inStock}
            availability={availabilityValue}
            stockQty={stockQtyLabel}
          />

          {/* Pricing */}
          {prices.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="cash-outline" size={16} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Pricing</Text>
              </View>
              <View style={styles.priceGrid}>
                {prices.map(({ label, value, primary }) => (
                  <View key={label} style={[styles.priceTile, primary && value && styles.priceTilePrimary]}>
                    <Text style={styles.priceTileLabel}>{label}</Text>
                    {value ? (
                      <Text style={[styles.priceTileValue, primary && styles.priceTileValuePrimary]}>{value}</Text>
                    ) : (
                      <Text style={styles.priceTileEmpty}>Not added</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Description */}
          {p.description ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="document-text-outline" size={16} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Description</Text>
              </View>
              <Text style={styles.description}>{p.description}</Text>
            </View>
          ) : null}

          <View style={styles.bottomSpace} />
        </View>
      </ScrollView>

      {/* Enquiries require a valid approved non-Retailer seller. */}
      {canEnquire ? (
        <SafeAreaView edges={['bottom']} style={styles.ctaBar}>
          <View style={styles.ctaContent}>
            <PrimaryButton
              title="SEND ENQUIRY"
              onPress={() => navigation.navigate(SCREENS.CREATE_ENQUIRY, { product })}
              size="lg"
            />
          </View>
        </SafeAreaView>
      ) : null}

      <ProductActionsModal
        visible={actionsVisible}
        productName={product.name}
        onClose={() => setActionsVisible(false)}
        onEdit={() => {
          setActionsVisible(false);
          navigation.navigate(SCREENS.ADD_PRODUCT, { mode: 'edit', product });
        }}
        onDelete={deleteProduct}
      />
    </View>
  );
};

/* ── Polished seller + availability card ── */
const SellerCard = ({ isAdmin, initial, name, subtitle, location, verified, inStock, availability, stockQty }) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Ionicons name="storefront-outline" size={16} color={Colors.primary} />
      <Text style={styles.sectionTitle}>Seller & Availability</Text>
    </View>

    <View style={styles.sellerCard}>
      {/* Seller identity row */}
      <View style={styles.sellerHeaderRow}>
        <View style={[styles.sellerAvatar, isAdmin && styles.sellerAvatarAdmin]}>
          {isAdmin ? (
            <Ionicons name="shield-checkmark" size={22} color={Colors.white} />
          ) : (
            <Text style={styles.sellerAvatarText}>{initial}</Text>
          )}
        </View>

        <View style={styles.sellerHeaderInfo}>
          <View style={styles.sellerNameRow}>
            <Text style={styles.sellerName} numberOfLines={1}>{name}</Text>
            {verified ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={13} color="#15803D" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            ) : null}
          </View>
          {subtitle ? <Text style={styles.sellerSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
          {location ? (
            <View style={styles.sellerLocationRow}>
              <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
              <Text style={styles.sellerLocation} numberOfLines={1}>{location}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.sellerDivider} />

      {/* Availability row */}
      <View style={styles.availabilityRow}>
        <View style={styles.availabilityLeft}>
          <Ionicons
            name={inStock ? 'checkmark-circle-outline' : 'close-circle-outline'}
            size={16}
            color={inStock ? '#15803D' : '#B91C1C'}
          />
          <Text style={styles.availabilityLabel}>Availability</Text>
        </View>
        <View style={inStock ? styles.availPillIn : styles.availPillOut}>
          <Text style={inStock ? styles.availPillInText : styles.availPillOutText}>{availability}</Text>
        </View>
      </View>

      {stockQty ? (
        <View style={styles.availabilityRow}>
          <View style={styles.availabilityLeft}>
            <Ionicons name="cube-outline" size={16} color={Colors.textTertiary} />
            <Text style={styles.availabilityLabel}>Available Stock</Text>
          </View>
          <Text style={styles.stockQtyText}>{stockQty}</Text>
        </View>
      ) : null}
    </View>
  </View>
);

/* ── Section with a 2-column label/value grid ── */
const Section = ({ icon, title, rows }) => {
  if (!rows || rows.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={16} color={Colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.grid}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.gridItem}>
            <Text style={styles.gridLabel}>{label}</Text>
            <Text style={styles.gridValue}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  backBtn: {
    position: 'absolute', top: 48, left: 16, zIndex: 10,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  manageBtn: {
    position: 'absolute', top: 48, right: 16, zIndex: 10,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: Spacing.screenPadding },

  productName: { ...Typography.h3, color: Colors.textPrimary, marginBottom: 3 },
  productCode: { ...Typography.caption, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  refreshingRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  refreshingText: { ...Typography.caption, color: Colors.textSecondary },
  detailWarning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: BorderRadius.md, padding: 10, marginBottom: 12,
  },
  detailWarningText: { ...Typography.caption, flex: 1, color: '#92400E', lineHeight: 17 },
  addedByCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.borderLight,
    padding: 12, marginBottom: Spacing.base,
  },
  addedByIcon: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primaryBg,
  },
  addedByContent: { flex: 1 },
  addedByLabel: { ...Typography.caption, color: Colors.textTertiary, fontSize: 9, fontWeight: '700', letterSpacing: 0.7 },
  addedByValue: { ...Typography.h5, color: Colors.textPrimary, marginTop: 1 },
  addedByCompany: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
  yourProductBadge: { backgroundColor: '#DCFCE7', borderRadius: BorderRadius.badge, paddingHorizontal: 8, paddingVertical: 5 },
  yourProductText: { ...Typography.caption, color: '#15803D', fontSize: 9, fontWeight: '800' },

  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: Spacing.base },
  brandChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.secondaryBg, borderRadius: BorderRadius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  brandChipText: { ...Typography.caption, color: Colors.secondary, fontWeight: '700' },
  catChip: { backgroundColor: Colors.primaryBg, borderRadius: BorderRadius.sm, paddingHorizontal: 10, paddingVertical: 6, justifyContent: 'center' },
  catChipText: { ...Typography.caption, color: Colors.primary, fontWeight: '700' },
  featureChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', borderRadius: BorderRadius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  featureChipText: { ...Typography.caption, color: '#B45309', fontWeight: '700' },
  newChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#D1FAE5', borderRadius: BorderRadius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  newChipText: { ...Typography.caption, color: '#047857', fontWeight: '700' },
  stockChip: { backgroundColor: '#DCFCE7', borderRadius: BorderRadius.sm, paddingHorizontal: 10, paddingVertical: 6, justifyContent: 'center' },
  stockChipText: { ...Typography.caption, color: '#15803D', fontWeight: '700' },
  outStockChip: { backgroundColor: '#FEE2E2', borderRadius: BorderRadius.sm, paddingHorizontal: 10, paddingVertical: 6, justifyContent: 'center' },
  outStockChipText: { ...Typography.caption, color: '#B91C1C', fontWeight: '700' },

  priceCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.base, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  priceLabel: { ...Typography.caption, color: Colors.textTertiary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  price: { ...Typography.h2, color: Colors.primary },
  mrpStrike: { ...Typography.body2, color: Colors.textTertiary, textDecorationLine: 'line-through' },
  enquireRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  enquirePrice: { ...Typography.h4, color: Colors.secondary },

  section: { marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  sectionTitle: { ...Typography.h5, color: Colors.textPrimary },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  gridItem: { width: '50%', padding: Spacing.sm, borderRightWidth: 1, borderBottomWidth: 1, borderColor: Colors.borderLight },
  gridLabel: { ...Typography.caption, color: Colors.textTertiary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  gridValue: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '600' },

  /* Seller card */
  sellerCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.borderLight, padding: Spacing.base,
  },
  sellerHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sellerAvatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary,
  },
  sellerAvatarAdmin: { backgroundColor: Colors.secondary },
  sellerAvatarText: { ...Typography.h4, color: Colors.white, fontWeight: '800' },
  sellerHeaderInfo: { flex: 1 },
  sellerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  sellerName: { ...Typography.h5, color: Colors.textPrimary, flexShrink: 1 },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#DCFCE7', borderRadius: BorderRadius.badge, paddingHorizontal: 7, paddingVertical: 2,
  },
  verifiedText: { ...Typography.caption, color: '#15803D', fontSize: 10, fontWeight: '800' },
  sellerSubtitle: { ...Typography.caption, color: Colors.secondary, fontWeight: '700', marginTop: 2, textTransform: 'capitalize' },
  sellerLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  sellerLocation: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },

  sellerDivider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 12 },

  availabilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  availabilityLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  availabilityLabel: { ...Typography.body2, color: Colors.textSecondary },
  availPillIn: { backgroundColor: '#DCFCE7', borderRadius: BorderRadius.badge, paddingHorizontal: 10, paddingVertical: 4 },
  availPillInText: { ...Typography.caption, color: '#15803D', fontWeight: '800' },
  availPillOut: { backgroundColor: '#FEE2E2', borderRadius: BorderRadius.badge, paddingHorizontal: 10, paddingVertical: 4 },
  availPillOutText: { ...Typography.caption, color: '#B91C1C', fontWeight: '800' },
  stockQtyText: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '700' },

  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceTile: {
    width: '48%', backgroundColor: Colors.white, borderRadius: BorderRadius.md,
    padding: Spacing.base, borderWidth: 1, borderColor: Colors.border,
  },
  priceTilePrimary: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  priceTileLabel: { ...Typography.caption, color: Colors.textTertiary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  priceTileValue: { ...Typography.h5, color: Colors.textPrimary },
  priceTileValuePrimary: { color: Colors.primary },
  priceTileEmpty: { ...Typography.body2, color: Colors.textTertiary, fontStyle: 'italic' },

  description: {
    ...Typography.body2, color: Colors.textSecondary, lineHeight: 22,
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  bottomSpace: { height: 100 },

  ctaBar: { backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  ctaContent: { padding: Spacing.base },
});

export default ProductDetailsScreen;
