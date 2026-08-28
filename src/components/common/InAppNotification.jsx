import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity, Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';

const NOTIFICATION_ICONS = {
  enquiry: { name: 'chatbubble-ellipses', color: '#3B82F6' },
  offer: { name: 'pricetag', color: '#8B5CF6' },
  order: { name: 'cart', color: '#10B981' },
  delivery: { name: 'bicycle', color: '#F59E0B' },
  system: { name: 'notifications', color: Colors.primary },
  default: { name: 'notifications', color: Colors.primary },
};

/**
 * InAppNotification — slides down from top when a push arrives in foreground.
 *
 * Props:
 * - visible: boolean
 * - title: string
 * - body: string
 * - type: string (enquiry|offer|order|delivery|system)
 * - onPress: function (tap to navigate)
 * - onDismiss: function (auto-dismiss or swipe)
 * - duration: number (ms, default 4000)
 */
export default function InAppNotification({
  visible, title, body, type, onPress, onDismiss, duration = 4000,
}) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    if (visible) {
      // Slide in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: Platform.OS === 'ios' ? 50 : 10,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss
      timerRef.current = setTimeout(() => {
        dismiss();
      }, duration);
    } else {
      translateY.setValue(-120);
      opacity.setValue(0);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onDismiss) onDismiss();
    });
  };

  if (!visible) return null;

  const iconConfig = NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.default;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }], opacity },
      ]}
    >
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          dismiss();
          if (onPress) onPress();
        }}
      >
        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: iconConfig.color + '15' }]}>
          <Ionicons name={iconConfig.name} size={20} color={iconConfig.color} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>{title || 'New Notification'}</Text>
          {body ? <Text style={styles.body} numberOfLines={2}>{body}</Text> : null}
        </View>

        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={dismiss}>
          <Ionicons name="close" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 9999,
    paddingHorizontal: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  iconWrap: {
    width: 40, height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  body: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
  closeBtn: {
    width: 28, height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
