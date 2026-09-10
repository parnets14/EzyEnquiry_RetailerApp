import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';

/**
 * Compact horizontal fulfilment stepper for a Sales Order.
 * Unified 6-stage flow: New → Accepted → Packing → Dispatched → Out for Delivery → Delivered
 */
const STEPS = [
  { key: 'New',             label: 'Placed',    icon: 'receipt-outline'          },
  { key: 'Accepted',        label: 'Accepted',  icon: 'checkmark-circle-outline' },
  { key: 'Packing',         label: 'Packing',   icon: 'cube-outline'             },
  { key: 'Dispatched',      label: 'Dispatched',icon: 'car-outline'              },
  { key: 'Out for Delivery',label: 'On Way',    icon: 'navigate-outline'         },
  { key: 'Delivered',       label: 'Delivered', icon: 'flag-outline'             },
];

// Map every status string (current + legacy) → STEPS array index
const STAGE_INDEX = {
  // Current 6-stage statuses
  'New':             0,
  'Accepted':        1,
  'Packing':         2,
  'Dispatched':      3,
  'Out for Delivery':4,
  'Delivered':       5,
  // Legacy statuses (backward compat with existing orders in DB)
  'Processing':       2,
  'Ready':            3,
  'ReadyForDispatch': 3,
  'Ready for Dispatch':3,
  'Partially Dispatched':3,
  'InTransit':        4,
  'In Transit':       4,
};

const SalesOrderStepper = ({ status }) => {
  if (status === 'Cancelled') {
    return (
      <View style={styles.cancelledWrap}>
        <View style={styles.cancelledDot}>
          <Ionicons name="close" size={15} color={Colors.white} />
        </View>
        <Text style={styles.cancelledText}>Order Cancelled</Text>
      </View>
    );
  }

  const currentStep = STAGE_INDEX[status] ?? 0;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.wrap}
    >
      {STEPS.map((step, index) => {
        const done = index < currentStep;
        const active = index === currentStep;
        const reached = done || active;
        const isLast = index === STEPS.length - 1;
        return (
          <React.Fragment key={step.key}>
            <View style={styles.step}>
              <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
                <Ionicons
                  name={done ? 'checkmark' : step.icon}
                  size={16}
                  color={reached ? Colors.white : Colors.textTertiary}
                />
              </View>
              <Text style={[styles.label, reached && styles.labelReached, active && styles.labelActive]} numberOfLines={1}>
                {step.label}
              </Text>
            </View>
            {!isLast && <View style={[styles.line, done && styles.lineDone]} />}
          </React.Fragment>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Spacing.xs, paddingRight: Spacing.sm },
  step: { alignItems: 'center', width: 62 },
  dot: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border,
  },
  dotDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  dotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  label: { ...Typography.caption, color: Colors.textTertiary, fontSize: 10, marginTop: 5, textAlign: 'center' },
  labelReached: { color: Colors.textPrimary, fontWeight: '600' },
  labelActive: { color: Colors.primary, fontWeight: '800' },
  line: { width: 22, height: 2.5, backgroundColor: Colors.border, marginTop: 17, borderRadius: 2 },
  lineDone: { backgroundColor: Colors.success },

  cancelledWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: Spacing.sm },
  cancelledDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.error },
  cancelledText: { ...Typography.body2, color: Colors.error, fontWeight: '700' },
});

export default SalesOrderStepper;
