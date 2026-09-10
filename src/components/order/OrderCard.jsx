import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing, Shadows } from '../../theme/spacing';
import StatusBadge from '../common/StatusBadge';
import { formatDate, formatCurrency } from '../../utils/formatters';

// Statuses where tracking makes sense
const TRACKABLE = ['Accepted', 'Packing', 'Dispatched', 'Out for Delivery', 'Delivered',
  // legacy backward-compat
  'Processing', 'Ready', 'ReadyForDispatch', 'InTransit'];

const OrderCard = ({ order, onPress, onTrack }) => {
  const {
    id,
    orderCode,
    productName,
    productCode,
    quantity,
    dispatchedQty,
    unit,
    total,
    status,
    orderDate,
    createdAt,
    paymentStatus,
    expectedDelivery,
  } = order;

  const canTrack = TRACKABLE.includes(status);
  const isDispatched = status === 'Dispatched' || status === 'Out for Delivery'
    || status === 'InTransit' || status === 'In Transit';
  const displayCode = orderCode || id;
  const displayDate = orderDate || createdAt;

  // Partial dispatch: show remaining when some (but not all) has shipped
  const dispatched = Number(dispatchedQty || 0);
  const ordered = Number(quantity || 0);
  const remaining = Math.max(ordered - dispatched, 0);
  const showPartial = dispatched > 0 && remaining > 0;

  // Accent colour on the left border tracks order urgency
  const accentColor =
    status === 'New'             ? Colors.orderNew :
    status === 'Dispatched'
    || status === 'Out for Delivery' ? Colors.primary :
    status === 'Delivered'       ? Colors.success :
    Colors.secondary;

  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]}>
      {/* Header row */}
      <View style={styles.header}>
        <Text style={styles.id}>{displayCode}</Text>
        <StatusBadge status={status} type="order" />
      </View>

      <Text style={styles.productName} numberOfLines={1}>{productName}</Text>
      <Text style={styles.productCode}>{productCode}</Text>

      {/* Info chips */}
      <View style={styles.infoRow}>
        <InfoChip icon="cube-outline"     label="Qty"   value={`${ordered} ${unit}`} />
        <InfoChip icon="cash-outline"     label="Total" value={formatCurrency(total)} valueColor={Colors.primary} />
        <InfoChip icon="calendar-outline" label="Date"  value={formatDate(displayDate)} />
      </View>

      {/* Partial dispatch summary */}
      {showPartial && (
        <View style={styles.partialRow}>
          <Ionicons name="git-branch-outline" size={13} color={Colors.warning} />
          <Text style={styles.partialText}>
            Dispatched <Text style={styles.partialStrong}>{dispatched}</Text> · Remaining{' '}
            <Text style={styles.partialStrong}>{remaining}</Text> {unit}
          </Text>
        </View>
      )}

      {/* Expected delivery if not yet delivered */}
      {expectedDelivery && status !== 'Delivered' && (
        <View style={styles.expectedRow}>
          <Ionicons name="time-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.expectedText}>
            Expected by <Text style={styles.expectedDate}>{formatDate(expectedDelivery)}</Text>
          </Text>
        </View>
      )}

      {/* Payment */}
      {paymentStatus && (
        <View style={styles.paymentRow}>
          <Ionicons
            name={paymentStatus === 'Paid' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
            size={13}
            color={paymentStatus === 'Paid' ? Colors.success : Colors.warning}
          />
          <Text style={[
            styles.paymentText,
            paymentStatus === 'Paid' ? styles.paymentPaid : styles.paymentPending,
          ]}>
            Payment {paymentStatus}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.viewBtn} onPress={onPress} activeOpacity={0.8}>
          <Text style={styles.viewBtnText}>View Details</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.secondary} />
        </TouchableOpacity>

        {canTrack && (
          <TouchableOpacity
            style={[styles.trackBtn, isDispatched && styles.trackBtnActive]}
            onPress={onTrack}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isDispatched ? 'car' : 'location-outline'}
              size={14}
              color={isDispatched ? Colors.white : Colors.primary}
            />
            <Text style={[styles.trackBtnText, isDispatched && styles.trackBtnTextActive]}>
              Track
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const InfoChip = ({ icon, label, value, valueColor }) => (
  <View style={styles.infoChip}>
    <Ionicons name={icon} size={13} color={Colors.textTertiary} style={{ marginBottom: 2 }} />
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, valueColor && { color: valueColor }]} numberOfLines={1}>
      {value}
    </Text>
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
  infoRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  infoChip: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  infoLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  infoValue: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 11,
  },
  partialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
    backgroundColor: Colors.warningBg,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  partialText: {
    ...Typography.caption,
    color: Colors.warningText,
    flex: 1,
  },
  partialStrong: {
    fontWeight: '800',
    color: Colors.warningText,
  },
  expectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  expectedText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  expectedDate: {
    color: Colors.secondary,
    fontWeight: '700',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  paymentText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  paymentPaid: { color: Colors.success },
  paymentPending: { color: Colors.warning },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  viewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  viewBtnText: {
    ...Typography.caption,
    color: Colors.secondary,
    fontWeight: '600',
  },
  trackBtn: {
    flex: 0.65,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryBg,
  },
  trackBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  trackBtnText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '700',
  },
  trackBtnTextActive: {
    color: Colors.white,
  },
});

export default OrderCard;
