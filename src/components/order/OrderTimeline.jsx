import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { formatDateTime } from '../../utils/formatters';
import { ORDER_LIFECYCLE, ORDER_STATUS_LABEL } from '../../constants';

/**
 * Retailer Sales-Order lifecycle timeline.
 *
 * Props:
 *  - currentStatus: the order's current Android status (e.g. 'Dispatched')
 *  - history: [{ status, timestamp, remarks }] using Android statuses
 *
 * Renders the fixed lifecycle:
 *   Order Placed → Order Confirmed → Processing → Ready/Picking
 *   → Dispatched → Out for Delivery → Delivered
 */
const OrderTimeline = ({ currentStatus, history = [] }) => {
  const currentIndex = Math.max(ORDER_LIFECYCLE.indexOf(currentStatus), 0);

  // Map latest timestamp per status from history
  const historyMap = {};
  (history || []).forEach((h) => {
    if (h?.status) historyMap[h.status] = h;
  });

  return (
    <View style={styles.container}>
      {ORDER_LIFECYCLE.map((status, index) => {
        const step = historyMap[status];
        const isCompleted = index < currentIndex || (index === currentIndex);
        const isPast = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <View key={status} style={styles.stepRow}>
            {/* Line + Dot */}
            <View style={styles.lineContainer}>
              {index > 0 ? (
                <View style={[styles.lineTop, isCompleted ? styles.lineActive : styles.lineInactive]} />
              ) : (
                <View style={styles.lineTopEmpty} />
              )}
              <View
                style={[
                  styles.dot,
                  isCompleted ? styles.dotCompleted : styles.dotPending,
                  isCurrent && styles.dotCurrent,
                ]}
              >
                {isPast ? (
                  <Text style={styles.checkIcon}>✓</Text>
                ) : (
                  <View style={styles.dotInner} />
                )}
              </View>
              {index < ORDER_LIFECYCLE.length - 1 ? (
                <View style={[styles.lineBottom, isPast ? styles.lineActive : styles.lineInactive]} />
              ) : (
                <View style={styles.lineBottomEmpty} />
              )}
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text
                style={[
                  styles.statusText,
                  isCompleted ? styles.statusActive : styles.statusInactive,
                  isCurrent && styles.statusCurrent,
                ]}
              >
                {ORDER_STATUS_LABEL[status] || status}
              </Text>
              {step?.timestamp ? (
                <Text style={styles.dateText}>{formatDateTime(step.timestamp)}</Text>
              ) : (
                <Text style={styles.pendingText}>{isCurrent ? 'In progress' : 'Pending'}</Text>
              )}
              {step?.remarks ? <Text style={styles.remarksText}>{step.remarks}</Text> : null}
            </View>

            {isCurrent ? (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>CURRENT</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingVertical: Spacing.sm },
  stepRow: { flexDirection: 'row', alignItems: 'stretch', minHeight: 58 },
  lineContainer: { width: 40, alignItems: 'center' },
  lineTop: { flex: 1, width: 2, maxHeight: 16 },
  lineBottom: { flex: 1, width: 2 },
  lineTopEmpty: { height: 16 },
  lineBottomEmpty: { flex: 1 },
  lineActive: { backgroundColor: Colors.primary },
  lineInactive: { backgroundColor: Colors.border },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  dotCompleted: { backgroundColor: Colors.primary },
  dotPending: { backgroundColor: Colors.white, borderWidth: 2, borderColor: Colors.border },
  dotCurrent: { backgroundColor: Colors.primary, borderWidth: 3, borderColor: Colors.primaryLight, width: 32, height: 32, borderRadius: 16 },
  dotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  checkIcon: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  content: { flex: 1, paddingLeft: Spacing.md, paddingVertical: Spacing.xs, justifyContent: 'center' },
  statusText: { ...Typography.body2, fontWeight: '600', marginBottom: 2 },
  statusActive: { color: Colors.textPrimary },
  statusInactive: { color: Colors.textDisabled },
  statusCurrent: { color: Colors.primary, fontWeight: '700' },
  dateText: { ...Typography.caption, color: Colors.textSecondary },
  pendingText: { ...Typography.caption, color: Colors.textTertiary, fontStyle: 'italic' },
  remarksText: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  currentBadge: { alignSelf: 'center', backgroundColor: Colors.primaryBg, borderRadius: BorderRadius.badge, paddingHorizontal: 8, paddingVertical: 3, marginRight: 4 },
  currentBadgeText: { ...Typography.label, color: Colors.primary, fontSize: 9, letterSpacing: 0.5 },
});

export default OrderTimeline;
