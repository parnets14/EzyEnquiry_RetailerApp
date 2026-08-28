import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing, Shadows } from '../../theme/spacing';
import { formatCurrency } from '../../utils/formatters';

/**
 * ProductCard — shows only the real product fields that exist.
 * Any empty field is hidden so nothing fake/placeholder is shown.
 * `compact` renders a tidy grid tile (2 per row); default is full-width.
 */
const ProductCard = ({ product, onPress, style, compact = false }) => {
  const {
    name, productCode, brand, category, size, finish, tileType, grade,
    material, color, thickness, application, unit, gstPercent,
    retailPrice, mrp, dealerPrice, pcsPerBox, sqftPerBox, images,
  } = product;

  const imageUri = images && images.length > 0 ? images[0] : null;

  const allChips = [size, finish, tileType, grade, material, color, thickness, application].filter(Boolean);
  const chips = compact ? allChips.slice(0, 2) : allChips;

  const packing = [];
  if (pcsPerBox) packing.push(`${pcsPerBox} pcs/box`);
  if (sqftPerBox) packing.push(`${sqftPerBox} sqft/box`);

  const priceValue = retailPrice || mrp || null;
  const priceLabel = retailPrice ? 'Retail' : 'MRP';

  return (
    <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.9}>
      {/* Image */}
      <View style={[styles.imageContainer, compact && styles.imageContainerCompact]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={32} color={Colors.border} />
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
        {images && images.length > 1 && (
          <View style={styles.imageCount}>
            <Ionicons name="images-outline" size={11} color={Colors.white} />
            <Text style={styles.imageCountText}>{images.length}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={[styles.content, compact && styles.contentCompact]}>
        {category ? <Text style={styles.category} numberOfLines={1}>{category}</Text> : null}

        <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={2}>{name}</Text>
        {productCode ? <Text style={styles.code} numberOfLines={1}>{productCode}</Text> : null}

        {/* Brand */}
        {brand ? (
          <View style={styles.brandRow}>
            <Ionicons name="business-outline" size={12} color={Colors.textTertiary} />
            <Text style={styles.brandText} numberOfLines={1}>{brand}</Text>
          </View>
        ) : null}

        {/* Spec chips */}
        {chips.length > 0 && (
          <View style={styles.specRow}>
            {chips.map((c, i) => (
              <View key={`${c}-${i}`} style={styles.specTag}>
                <Text style={styles.specTagText} numberOfLines={1}>{c}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Packing (full-width mode only) */}
        {!compact && packing.length > 0 && (
          <View style={styles.packingRow}>
            <Ionicons name="cube-outline" size={12} color={Colors.textTertiary} />
            <Text style={styles.packingText}>{packing.join('  ·  ')}</Text>
          </View>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Price */}
        {priceValue ? (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{priceLabel}</Text>
            <View style={styles.priceValueRow}>
              <Text style={styles.price}>{formatCurrency(priceValue)}</Text>
              {retailPrice && mrp && mrp > retailPrice ? (
                <Text style={styles.mrp}>{formatCurrency(mrp)}</Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.enquireRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={13} color={Colors.secondary} />
            <Text style={styles.enquireText}>Price on Enquiry</Text>
          </View>
        )}

        {/* Unit / GST */}
        {(unit || gstPercent != null) ? (
          <Text style={styles.metaText} numberOfLines={1}>
            {unit || ''}{unit && gstPercent != null ? '  ·  ' : ''}{gstPercent != null ? `GST ${gstPercent}%` : ''}
          </Text>
        ) : null}

        {/* Dealer price (full-width mode only) */}
        {!compact && dealerPrice ? (
          <Text style={styles.dealerText}>Dealer: {formatCurrency(dealerPrice)}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.card,
    overflow: 'hidden',
    ...Shadows.sm,
  },

  imageContainer: { position: 'relative', height: 160, backgroundColor: Colors.background },
  imageContainerCompact: { height: 130 },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.borderLight, gap: 4 },
  placeholderText: { ...Typography.caption, color: Colors.textTertiary },

  imageCount: {
    position: 'absolute', bottom: 8, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: BorderRadius.badge,
  },
  imageCountText: { color: Colors.white, fontSize: 10, fontWeight: '600' },

  content: { padding: Spacing.base },
  contentCompact: { padding: 10 },

  category: {
    ...Typography.caption, color: Colors.primary, fontWeight: '700', fontSize: 10,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  name: { ...Typography.h5, color: Colors.textPrimary, marginBottom: 2, lineHeight: 22 },
  nameCompact: { fontSize: 14, lineHeight: 18, minHeight: 36 },
  code: { ...Typography.caption, color: Colors.textTertiary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 10 },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  brandText: { ...Typography.caption, color: Colors.textSecondary, fontSize: 11, flex: 1 },

  specRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginBottom: 6 },
  specTag: { backgroundColor: Colors.secondaryBg, borderRadius: BorderRadius.xs, paddingHorizontal: 7, paddingVertical: 2 },
  specTagText: { ...Typography.caption, color: Colors.secondary, fontSize: 10, fontWeight: '500' },

  packingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  packingText: { ...Typography.caption, color: Colors.textSecondary, fontSize: 11 },

  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 8 },

  priceRow: {},
  priceLabel: { ...Typography.caption, color: Colors.textTertiary, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 1 },
  priceValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  price: { ...Typography.h5, color: Colors.primary },
  mrp: { ...Typography.caption, color: Colors.textTertiary, textDecorationLine: 'line-through', fontSize: 11 },

  enquireRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  enquireText: { ...Typography.caption, color: Colors.secondary, fontWeight: '600' },

  metaText: { ...Typography.caption, color: Colors.textTertiary, fontSize: 10, marginTop: 3 },
  dealerText: { ...Typography.caption, color: Colors.textSecondary, fontSize: 11, marginTop: 6 },
});

export default ProductCard;
