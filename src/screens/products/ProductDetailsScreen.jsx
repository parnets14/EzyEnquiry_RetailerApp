import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import ImageGallery from '../../components/product/ImageGallery';
import PrimaryButton from '../../components/common/PrimaryButton';
import { formatCurrency } from '../../utils/formatters';
import { SCREENS } from '../../constants';

const money = (v) => (v && v > 0 ? formatCurrency(v) : null);

const ProductDetailsScreen = ({ navigation, route }) => {
  const { product } = route.params;
  const p = product._raw || {};

  const brand    = product.brand || p.brand_id?.name || '';
  const category = product.category || p.category_id?.name || '';
  const subCat   = p.sub_category_id?.name || '';

  // Section field lists — only keep the ones that have a value.
  const basic = [
    ['Product Code', product.productCode],
    ['Brand', brand],
    ['Category', category],
    ['Sub-Category', subCat],
    ['Unit', p.unit],
    ['GST %', p.gst_percent != null ? `${p.gst_percent}%` : ''],
    ['HSN Code', p.hsn_code],
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

  // Pricing tiles — only show non-zero prices
  const prices = [
    ['MRP', money(p.mrp), true],
    ['Retail Rate', money(p.retail_price)],
    ['Dealer Rate', money(p.dealer_price)],
    ['Wholesale Rate', money(p.wholesale_rate)],
  ].filter(([, v]) => v);

  const headlinePrice = money(p.retail_price) || money(p.mrp);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Back button over image */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={22} color={Colors.white} />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        <ImageGallery images={product.images} height={280} />

        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.productName}>{product.name}</Text>
          {product.productCode ? <Text style={styles.productCode}>{product.productCode}</Text> : null}

          {/* Brand + category chips */}
          <View style={styles.chipRow}>
            {brand ? <View style={styles.brandChip}><Ionicons name="business-outline" size={12} color={Colors.secondary} /><Text style={styles.brandChipText}>{brand}</Text></View> : null}
            {category ? <View style={styles.catChip}><Text style={styles.catChipText}>{category}</Text></View> : null}
          </View>

          {/* Headline price */}
          <View style={styles.priceCard}>
            {headlinePrice ? (
              <View style={styles.priceRow}>
                <View>
                  <Text style={styles.priceLabel}>{money(p.retail_price) ? 'Retail Rate' : 'MRP'}</Text>
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

          {/* Pricing */}
          {prices.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="cash-outline" size={16} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Pricing</Text>
              </View>
              <View style={styles.priceGrid}>
                {prices.map(([label, value, primary]) => (
                  <View key={label} style={[styles.priceTile, primary && styles.priceTilePrimary]}>
                    <Text style={styles.priceTileLabel}>{label}</Text>
                    <Text style={[styles.priceTileValue, primary && styles.priceTileValuePrimary]}>{value}</Text>
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

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <SafeAreaView edges={['bottom']} style={styles.ctaBar}>
        <View style={styles.ctaContent}>
          <PrimaryButton
            title="SEND ENQUIRY"
            onPress={() => navigation.navigate(SCREENS.CREATE_ENQUIRY, { product })}
            size="lg"
          />
        </View>
      </SafeAreaView>
    </View>
  );
};

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
  content: { padding: Spacing.screenPadding },

  productName: { ...Typography.h3, color: Colors.textPrimary, marginBottom: 3 },
  productCode: { ...Typography.caption, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },

  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: Spacing.base },
  brandChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.secondaryBg, borderRadius: BorderRadius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  brandChipText: { ...Typography.caption, color: Colors.secondary, fontWeight: '700' },
  catChip: { backgroundColor: Colors.primaryBg, borderRadius: BorderRadius.sm, paddingHorizontal: 10, paddingVertical: 6, justifyContent: 'center' },
  catChipText: { ...Typography.caption, color: Colors.primary, fontWeight: '700' },

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

  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceTile: {
    width: '48%', backgroundColor: Colors.white, borderRadius: BorderRadius.md,
    padding: Spacing.base, borderWidth: 1, borderColor: Colors.border,
  },
  priceTilePrimary: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  priceTileLabel: { ...Typography.caption, color: Colors.textTertiary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  priceTileValue: { ...Typography.h5, color: Colors.textPrimary },
  priceTileValuePrimary: { color: Colors.primary },

  description: {
    ...Typography.body2, color: Colors.textSecondary, lineHeight: 22,
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base,
    borderWidth: 1, borderColor: Colors.borderLight,
  },

  ctaBar: { backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  ctaContent: { padding: Spacing.base },
});

export default ProductDetailsScreen;
