import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { timeAgo } from '../../utils/formatters';

const TYPE_CONFIG = {
  enquiry:  { icon: 'document-text-outline', color: Colors.info,      bgColor: Colors.infoBg      },
  order:    { icon: 'cube-outline',           color: Colors.secondary, bgColor: Colors.secondaryBg },
  delivery: { icon: 'car-outline',            color: Colors.primary,   bgColor: Colors.primaryBg   },
  system:   { icon: 'information-circle-outline', color: Colors.textSecondary, bgColor: Colors.background },
};

const NotificationCard = ({ notification, onPress }) => {
  const { type, title, message, isRead, createdAt } = notification;
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.system;

  return (
    <TouchableOpacity
      style={[styles.card, !isRead && styles.unread]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Unread indicator bar */}
      {!isRead && <View style={styles.unreadBar} />}

      <View style={[styles.iconContainer, { backgroundColor: config.bgColor }]}>
        <Ionicons name={config.icon} size={20} color={config.color} />
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, !isRead && styles.titleUnread]} numberOfLines={1}>
            {title}
          </Text>
          {!isRead && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.message} numberOfLines={2}>{message}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={11} color={Colors.textTertiary} />
          <Text style={styles.time}>{timeAgo(createdAt)}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} style={styles.arrow} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.base,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    alignItems: 'center',
    position: 'relative',
  },
  unread: {
    backgroundColor: '#FFF8F5',
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    flexShrink: 0,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    gap: 6,
  },
  title: {
    ...Typography.body2,
    color: Colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  titleUnread: {
    fontWeight: '700',
    color: Colors.secondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    flexShrink: 0,
  },
  message: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  time: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 11,
  },
  arrow: {
    marginLeft: Spacing.sm,
    flexShrink: 0,
  },
});

export default NotificationCard;
