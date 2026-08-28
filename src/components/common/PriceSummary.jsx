import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/formatters';

const PriceSummary = ({ subtotal, gst, deliveryCharges, total }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Price Summary</Text>
      <View style={styles.divider} />

      <Row label="Subtotal" value={formatCurrency(subtotal)} />
      {gst != null && gst > 0 ? (
        <Row label="GST (5%)" value={formatCurrency(gst)} />
      ) : null}
      {deliveryCharges != null ? (
        <Row
          label="Delivery Charges"
          value={deliveryCharges === 0 ? 'Free' : formatCurrency(deliveryCharges)}
          valueStyle={deliveryCharges === 0 ? styles.freeText : null}
        />
      ) : null}

      <View style={styles.totalDivider} />
      <Row
        label="Total"
        value={formatCurrency(total)}
        labelStyle={styles.totalLabel}
        valueStyle={styles.totalValue}
      />
    </View>
  );
};

const Row = ({ label, value, labelStyle, valueStyle }) => (
  <View style={styles.row}>
    <Text style={[styles.label, labelStyle]}>{label}</Text>
    <Text style={[styles.value, valueStyle]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.card,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heading: {
    ...Typography.h5,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginBottom: Spacing.sm,
  },
  totalDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  label: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  value: {
    ...Typography.body2,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  totalLabel: {
    ...Typography.h5,
    color: Colors.textPrimary,
  },
  totalValue: {
    ...Typography.h4,
    color: Colors.primary,
  },
  freeText: {
    color: Colors.success,
    fontWeight: '600',
  },
});

export default PriceSummary;
