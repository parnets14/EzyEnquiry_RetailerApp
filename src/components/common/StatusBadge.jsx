import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getEnquiryStatusStyle, getOrderStatusStyle, getAvailabilityStyle, getPaymentStatusStyle } from '../../utils/statusHelpers';
import { Typography } from '../../theme/typography';
import { BorderRadius } from '../../theme/spacing';
import { ORDER_STATUS_LABEL } from '../../constants';

const StatusBadge = ({
  status,
  type = 'enquiry', // 'enquiry' | 'order' | 'availability' | 'payment'
  size = 'sm', // 'sm' | 'md'
}) => {
  const getStyle = () => {
    if (type === 'order') return getOrderStatusStyle(status);
    if (type === 'payment') return getPaymentStatusStyle(status);
    if (type === 'availability') return getAvailabilityStyle(status);
    return getEnquiryStatusStyle(status);
  };

  const { color, backgroundColor } = getStyle();
  const displayText = type === 'order' ? (ORDER_STATUS_LABEL[status] || status) : status;

  return (
    <View style={[styles.badge, { backgroundColor }, size === 'md' && styles.badgeMd]}>
      <Text style={[styles.label, { color }, size === 'md' && styles.labelMd]}>
        {displayText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.badge,
    alignSelf: 'flex-start',
  },
  badgeMd: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  label: {
    ...Typography.label,
    fontSize: 11,
    fontWeight: '600',
  },
  labelMd: {
    fontSize: 13,
  },
});

export default StatusBadge;
