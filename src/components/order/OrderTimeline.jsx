import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { formatDateTime } from '../../utils/formatters';

const ORDER_STATUSES = ['New', 'Accepted', 'Processing', 'Ready', 'Dispatched', 'Delivered'];

const OrderTimeline = ({ timeline }) => {
  return (
    <View style={styles.container}>
      {ORDER_STATUSES.map((status, index) => {
        const step = timeline?.find(t => t.status === status);
        const isCompleted = step?.completed === true;
        const isCurrent =
          isCompleted &&
          (index === timeline.filter(t => t.completed).length - 1);

        return (
          <View key={status} style={styles.stepRow}>
            {/* Line + Dot */}
            <View style={styles.lineContainer}>
              {index > 0 ? (
                <View
                  style={[
                    styles.lineTop,
                    isCompleted ? styles.lineActive : styles.lineInactive,
                  ]}
                />
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
                {isCompleted ? (
                  <Text style={styles.checkIcon}>✓</Text>
                ) : (
                  <View style={styles.dotInner} />
                )}
              </View>
              {index < ORDER_STATUSES.length - 1 ? (
                <View
                  style={[
                    styles.lineBottom,
                    isCompleted ? styles.lineActive : styles.lineInactive,
                  ]}
                />
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
                {status}
              </Text>
              {step?.date ? (
                <Text style={styles.dateText}>{formatDateTime(step.date)}</Text>
              ) : (
                <Text style={styles.pendingText}>Pending</Text>
              )}
            </View>

            {/* Current indicator */}
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
  container: {
    paddingVertical: Spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 60,
  },
  lineContainer: {
    width: 40,
    alignItems: 'center',
  },
  lineTop: {
    flex: 1,
    width: 2,
    maxHeight: 16,
  },
  lineBottom: {
    flex: 1,
    width: 2,
  },
  lineTopEmpty: {
    height: 16,
  },
  lineBottomEmpty: {
    flex: 1,
  },
  lineActive: {
    backgroundColor: Colors.primary,
  },
  lineInactive: {
    backgroundColor: Colors.border,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dotCompleted: {
    backgroundColor: Colors.primary,
  },
  dotPending: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  dotCurrent: {
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: Colors.primaryLight,
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  checkIcon: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingLeft: Spacing.md,
    paddingVertical: Spacing.xs,
    justifyContent: 'center',
  },
  statusText: {
    ...Typography.body2,
    fontWeight: '600',
    marginBottom: 2,
  },
  statusActive: {
    color: Colors.textPrimary,
  },
  statusInactive: {
    color: Colors.textDisabled,
  },
  statusCurrent: {
    color: Colors.primary,
    fontWeight: '700',
  },
  dateText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  pendingText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  currentBadge: {
    alignSelf: 'center',
    backgroundColor: Colors.primaryBg,
    borderRadius: BorderRadius.badge,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 4,
  },
  currentBadgeText: {
    ...Typography.label,
    color: Colors.primary,
    fontSize: 9,
    letterSpacing: 0.5,
  },
});

export default OrderTimeline;
