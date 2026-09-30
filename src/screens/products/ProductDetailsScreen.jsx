// Retailer — Product Detail (view only)
//
// Structural parity with wholesalerapp/src/screens/product/ProductDetailScreen.jsx:
// a navy header with a "View Only" badge and category/brand tag pills, then a stack
// of section cards (PRODUCT INFORMATION / DESCRIPTION / IMAGES / PACKING INFO).
//
// There is deliberately NO Send Enquiry on this screen — it is here to read and buy.
//
// Buyer pricing: the retailer is the BUYER, so the price card shows MRP + Retail
// Rate. The seller's internal cost/margin columns (purchase_price, selling_price)
// are never surfaced, here or on the catalogue card.

import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  ActivityIndicator, Alert, Image, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import ProductActionsModal from '../../components/product/ProductActionsModal';
import { formatCurrency } from '../../utils/formatters';
import { SCREENS } from '../../constants';
import { productApi, myProductApi } from '../../utils/api';
import { mapMarketplaceProduct } from '../../utils/productMapper';

const NAV = Colors.secondary; // #1A2340
const OR = Colors.primary;    // #F4500A

const money = (v) => (v && v > 0 ? formatCurrency(v) : null);

// ── Divider ──────────────────────────────────────────────────
const Divider = () => <View style={styles.divider} />;

// ── Info row (label left / value right, hairline between rows) ─
function InfoRow({ label, value, last }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ── Section card ─────────────────────────────────────────────
function SectionCard({ icon, title, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIconWrap}>
          <Ionicons name={icon} size={14} color={NAV} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Divider />
      {children}
    </View>
  );
}

// ── Navy header (also used by the loading / error states) ────
function Header({ onBack, title, subtitle, tags = [], topInset }) {
  return (
    <View style={[styles.header, { paddingTop: topInset + 10 }]}>
      <View style={styles.hCircle1} />
      <View style={styles.hCircle2} />

      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.headerIconWrap}
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.headerSub} numberOfLines={1}>{subtitle}</Text> : null}
        </View>

        <View style={styles.viewOnlyBadge}>
          <Ionicons name="lock-closed-outline" size={11} color={OR} />
          <Text style={styles.viewOnlyText}>View Only</Text>
        </View>
      </View>

      {tags.length > 0 ? (
        <View style={styles.headerTags}>
          {tags.map((t) => (
            <View key={t.label} style={styles.headerTag}>
              <Ionicons name={t.icon} size={11} color="rgba(255,255,255,0.8)" />
              <Text style={styles.headerTagText}>{t.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const ProductDetailsScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [product, setProduct] = useState(route.params?.product);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState('');
  const [actionsVisible, setActionsVisible] = useState(false);

  const productId = route.params?.product?.id || route.params?.product?._raw?.id;

  const statusBarHeight = Platform.OS === 'android'
    ? (StatusBar.currentHeight ?? 24)
    : insets.top;

  const loadDetail = useCallback(async (isActive = () => true) => {
    if (!productId) {
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    setDetailError('');
    try {
      const data = await productApi.get(productId);
      if (isActive() && data) setProduct(mapMarketplaceProduct(data));
    } catch (error) {
      if (isActive()) setDetailError(error.message || 'Could not refresh product details.');
    } finally {
      if (isActive()) setDetailLoading(false);
    }
  }, [productId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadDetail(() => active);
      return () => { active = false; };
    }, [loadDetail]),
  );

  const goBack = () => (
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate(SCREENS.HOME)
  );

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

  // ── No product at all (deep link / missing route param) ────
  if (!product) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor={NAV} />
        <Header onBack={goBack} title="Product Detail" topInset={statusBarHeight} />
        <View style={styles.center}>
          {detailLoading ? (
            <>
              <ActivityIndicator size="large" color={NAV} />
              <Text style={styles.centerText}>Loading product…</Text>
            </>
          ) : (
            <>
              <Ionicons name="alert-circle-outline" size={44} color="#DC2626" />
              <Text style={[styles.centerText, { color: '#DC2626' }]}>
                {detailError || 'Product not found'}
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => loadDetail()}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  // ── Data ───────────────────────────────────────────────────
  const p = product._raw || {};
  const brand = product.brand || p.brand_id?.name || '';
  const category = product.category || p.category_id?.name || '';
  const subCat = product.subCategory || p.sub_category_id?.name || '';
  const canManage = product.canManage === true || p.can_manage === true;

  const images = product.images || [];

  const headerTags = [
    category && { icon: 'shapes-outline', label: category },
    brand && { icon: 'pricetag-outline', label: brand },
    canManage && { icon: 'storefront-outline', label: 'Your product' },
  ].filter(Boolean);

  // PRODUCT INFORMATION — the wholesaler's field list, in its order. The retailer
  // DTO carries a few extra columns but they are not part of the spec screen.
  const infoRows = [
    ['Product Code', product.productCode],
    ['Design', p.design || product.name],
    ['Brand', brand],
    ['Category', category],
    ['Sub-Category', subCat],
    ['Size', p.size],
    ['Finish', p.finish],
    ['Thickness', p.thickness],
    ['Material', p.material],
    ['Color', p.color],
    ['Surface', p.surface],
    ['Grade', p.grade],
    ['Tile Type', p.tile_type],
    ['Application', p.application],
    ['Anti-Skid', p.anti_skid],
    ['Origin', p.origin],
    ['Manufacturer', p.manufacturer],
    ['Collection', p.collection],
    ['Barcode / EAN', p.barcode],
    ['HSN Code', p.hsn_code],
    ['GST %', p.gst_percent != null ? `${p.gst_percent}%` : ''],
    ['Unit', p.unit],
  ].filter(([, v]) => v);

  const packingRows = [
    ['Pcs / Box', p.pcs_per_box ? `${p.pcs_per_box} pcs` : ''],
    ['Sq.ft / Box', p.sqft_per_box ? `${p.sqft_per_box} sq.ft` : ''],
    ['Weight / Box', p.weight_per_box ? `${p.weight_per_box} kg` : ''],
  ].filter(([, v]) => v);

  // Buyer pricing — MRP and Retail Rate only. The catalogue card shows the same
  // two figures; the wholesaler's screen shows the wholesale rate because it is
  // the SELLER. This screen is a buyer surface, so it must never surface the
  // seller's cost/margin columns.
  const prices = [
    { label: 'MRP', value: money(p.mrp), primary: true },
    { label: 'Retail Rate', value: money(p.retail_price) },
  ];

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={NAV} />

      <Header
        onBack={goBack}
        title={product.name}
        subtitle={product.productCode}
        tags={headerTags}
        topInset={statusBarHeight}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 96 }]}
      >
        {/* Product image */}
        <View style={styles.imageWrap}>
          {images.length > 0 ? (
            <Image source={{ uri: images[0] }} style={styles.productImage} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={56} color={Colors.textDisabled} />
              <Text style={styles.imagePlaceholderText}>No Image Available</Text>
            </View>
          )}

          {/* Manage (edit / delete) — only on the retailer's own listings. */}
          {canManage ? (
            <TouchableOpacity
              style={styles.manageBtn}
              onPress={() => setActionsVisible(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Manage ${product.name}`}
            >
              <Ionicons name="ellipsis-vertical" size={20} color={Colors.white} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.content}>
          {/* ── Product information ── */}
          {infoRows.length > 0 ? (
            <SectionCard icon="information-circle-outline" title="PRODUCT INFORMATION">
              {infoRows.map(([label, value], i) => (
                <InfoRow
                  key={label}
                  label={label}
                  value={value}
                  last={i === infoRows.length - 1}
                />
              ))}
            </SectionCard>
          ) : null}

          {/* ── Description ── */}
          {p.description ? (
            <SectionCard icon="document-text-outline" title="DESCRIPTION">
              <Text style={styles.descText}>{p.description}</Text>
            </SectionCard>
          ) : null}

          {/* ── Images gallery ── */}
          {images.length > 1 ? (
            <SectionCard icon="images-outline" title="IMAGES">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.galleryRow}
              >
                {images.map((url, i) => (
                  <Image key={i} source={{ uri: url }} style={styles.galleryImg} resizeMode="cover" />
                ))}
              </ScrollView>
            </SectionCard>
          ) : null}

          {/* ── Packing info ── */}
          {packingRows.length > 0 ? (
            <SectionCard icon="cube-outline" title="PACKING INFO">
              {packingRows.map(([label, value], i) => (
                <InfoRow
                  key={label}
                  label={label}
                  value={value}
                  last={i === packingRows.length - 1}
                />
              ))}
            </SectionCard>
          ) : null}

          {/* ── Pricing — buyer view: MRP + Retail Rate ── */}
          <SectionCard icon="pricetag-outline" title="PRICING">
            <View style={styles.priceGrid}>
              {prices.map(({ label, value, primary }) => (
                <View
                  key={label}
                  style={[styles.priceTile, primary && value && styles.priceTilePrimary]}
                >
                  <Text style={styles.priceTileLabel}>{label}</Text>
                  {value ? (
                    <Text style={[styles.priceTileValue, primary && styles.priceTileValuePrimary]}>
                      {value}
                    </Text>
                  ) : (
                    <Text style={styles.priceTileEmpty}>Not added</Text>
                  )}
                </View>
              ))}
            </View>
          </SectionCard>
        </View>
      </ScrollView>

      {/* ── Bottom action bar — Buy Item only ──
          This screen is view-only: the product description is here to read.
          Sending an enquiry is NOT done from here; buying is the single action,
          exactly like the wholesaler app's catalog bar.
          The product is handed to Purchase Entry so it arrives pre-selected. */}
      <View style={[styles.fabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TouchableOpacity
          style={styles.fabPrimary}
          activeOpacity={0.85}
          onPress={() => navigation.navigate(SCREENS.PURCHASE_ENTRY, { product })}
          accessibilityRole="button"
          accessibilityLabel={`Buy ${product.name}`}
        >
          <Ionicons name="cart-outline" size={18} color={Colors.white} />
          <Text style={styles.fabPrimaryText}>Buy Item</Text>
        </TouchableOpacity>
      </View>

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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F2F8' },
  scrollContent: { paddingTop: 0 },

  /* ── Loading / error ── */
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  centerText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: NAV, borderRadius: 10 },
  retryText: { color: '#FFF', fontWeight: '700', fontSize: 13 },

  /* ── Navy header ── */
  header: {
    backgroundColor: NAV,
    paddingHorizontal: 16,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  hCircle1: {
    position: 'absolute', top: -30, right: -30,
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  hCircle2: {
    position: 'absolute', bottom: -20, left: -20,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 10,
  },
  headerIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  headerTitleBlock: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFF' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  viewOnlyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(253,92,2,0.22)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(253,92,2,0.45)',
  },
  viewOnlyText: { fontSize: 10, fontWeight: '700', color: OR },
  headerTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  headerTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
  },
  headerTagText: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  /* ── Hero image ── */
  imageWrap: { width: '100%', height: 220, backgroundColor: '#E8EAF0' },
  productImage: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  imagePlaceholderText: { fontSize: 12, color: Colors.textDisabled },
  manageBtn: {
    position: 'absolute', top: 12, right: 12,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },

  /* ── Content ── */
  content: { padding: 14 },

  refreshingRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  refreshingText: { fontSize: 12, color: Colors.textSecondary },
  detailWarning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: BorderRadius.md, padding: 10, marginBottom: 12,
  },
  detailWarningText: { fontSize: 12, flex: 1, color: '#92400E', lineHeight: 17 },

  /* ── Section cards ── */
  card: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 12, ...Shadows.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardIconWrap: {
    width: 26, height: 26, borderRadius: 7,
    backgroundColor: Colors.secondaryBg,
    justifyContent: 'center', alignItems: 'center',
  },
  cardTitle: {
    fontSize: 11, fontWeight: '800', color: NAV,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginBottom: 8 },

  /* ── Info rows ── */
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  infoLabel: { fontSize: 13, color: Colors.textSecondary },
  infoValue: {
    fontSize: 13, fontWeight: '600', color: Colors.textPrimary,
    maxWidth: '55%', textAlign: 'right',
  },

  /* ── Description ── */
  descText: { fontSize: 13, color: Colors.textPrimary, lineHeight: 20 },

  /* ── Image gallery ── */
  galleryRow: { gap: 8, paddingVertical: 4 },
  galleryImg: { width: 100, height: 100, borderRadius: 10 },

  /* ── Pricing tiles ── */
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceTile: {
    width: '48%', backgroundColor: '#F4F6FA', borderRadius: BorderRadius.md,
    padding: Spacing.base, borderWidth: 1, borderColor: Colors.border,
  },
  priceTilePrimary: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  priceTileLabel: {
    fontSize: 10, color: Colors.textTertiary, textTransform: 'uppercase',
    letterSpacing: 0.4, marginBottom: 4,
  },
  priceTileValue: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  priceTileValuePrimary: { color: Colors.primary },
  priceTileEmpty: { fontSize: 13, color: Colors.textTertiary, fontStyle: 'italic' },

  /* ── Bottom action bar — Buy Item only. ── */
  fabBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingTop: 8,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  fabPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 46, borderRadius: 12, backgroundColor: Colors.primary,
  },
  fabPrimaryText: { fontSize: 14, fontWeight: '800', color: Colors.white },
});

export default ProductDetailsScreen;
