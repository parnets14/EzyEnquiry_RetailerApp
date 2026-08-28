import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing, Shadows } from '../../theme/spacing';
import StatusBadge from '../common/StatusBadge';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { getEnquiryStatusStyle } from '../../utils/statusHelpers';

const EnquiryCard = ({ enquiry, onPress }) => {
  const {
    id,
    productName,
    productCode,
    quantity,
    unit,
    deliveryLocation,
    createdAt,
    status,
    quotation,
    seller,
  } = enquiry;

  const { color: statusColor } = getEnquiryStatusStyle(status);

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: statusColor }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.id}>{id}</Text>
        <StatusBadge status={status} type="enquiry" />
      </View>

      {/* Product */}
      <Text style={styles.productName} numberOfLines={1}>{productName}</Text>
      <Text style={styles.productCode}>{productCode}</Text>

      {/* Details Row */}
      <View style={styles.detailsRow}>
        <DetailChip icon="cube-outline"     label="Quantity" value={`${quantity} ${unit}`} />
        <DetailChip icon="location-outline" label="Location" value={deliveryLocation} flex />
        <DetailChip icon="calendar-outline" label="Date"     value={formatDate(createdAt)} />
      </View>

      {/* Seller info if assigned */}
      {seller && (
        <View style={styles.sellerRow}>
          <Ionicons name="business-outline" size={12} color={Colors.textTertiary} />
          <Text style={styles.sellerText} numberOfLines={1}>{seller.name}</Text>
          <Text style={styles.sellerLocation}>· {seller.location}</Text>
        </View>
      )}

      {/* Quotation banner if available */}
      {quotation && (
        <View style={styles.quotationBanner}>
          <View style={styles.quotationLeft}>
            <Ionicons name="document-text-outline" size={14} color={Colors.successText} />
            <Text style={styles.quotationLabel}>Quotation</Text>
          </View>
          <Text style={styles.quotationPrice}>
            {formatCurrency(quotation.unitPrice)}/box
          </Text>
          <Text style={styles.quotationSep}>·</Text>
          <Text style={styles.quotationTotal}>
            Total {formatCurrency(quotation.totalPrice)}
          </Text>
        </View>
      )}

      {/* Footer CTA */}
      <View style={styles.footer}>
        <Text style={styles.viewDetails}>View Details</Text>
        <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
      </View>
    </TouchableOpacity>
  );
};

const DetailChip = ({ icon, label, value, flex }) => (
  <View style={[styles.detailItem, flex && styles.detailItemFlex]}>
    <Ionicons name={icon} size={11} color={Colors.textTertiary} style={{ marginBottom: 2 }} />
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.card,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
    borderLeftWidth: 3,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  id: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  productName: {
    ...Typography.h5,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  productCode: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    letterSpacing: 0.3,
  },

  detailsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  detailItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  detailItemFlex: {
    flex: 1,
  },
  detailLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  detailValue: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 11,
  },

  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  sellerText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  sellerLocation: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },

  quotationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successBg,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    marginBottom: 8,
    gap: 6,
  },
  quotationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quotationLabel: {
    ...Typography.label,
    color: Colors.successText,
    fontSize: 11,
    fontWeight: '700',
  },
  quotationSep: {
    color: Colors.textTertiary,
    fontSize: 12,
  },
  quotationPrice: {
    ...Typography.caption,
    color: Colors.successText,
    fontWeight: '700',
    fontSize: 12,
  },
  quotationTotal: {
    ...Typography.caption,
    color: Colors.successText,
    flex: 1,
    textAlign: 'right',
    fontWeight: '600',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    marginTop: 2,
  },
  viewDetails: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '700',
  },
});

export default EnquiryCard;
