import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';

const AppHeader = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightComponent,
  centerTitle = true,
  variant = 'light', // 'light' (white) | 'primary' (blue)
}) => {
  const isPrimary = variant === 'primary';
  const fg = isPrimary ? Colors.white : Colors.textPrimary;
  return (
    <View style={[styles.container, isPrimary && styles.containerPrimary]}>
      <View style={styles.row}>
        {/* Left */}
        <View style={styles.leftSection}>
          {showBack && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={22} color={fg} />
            </TouchableOpacity>
          )}
        </View>

        {/* Title */}
        <View style={[styles.titleSection, centerTitle && styles.titleCenter]}>
          {title ? (
            <Text style={[styles.title, { color: fg }]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={[styles.subtitle, isPrimary && styles.subtitlePrimary]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Right */}
        <View style={styles.rightSection}>
          {rightComponent}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  containerPrimary: {
    backgroundColor: Colors.secondary,
    borderBottomColor: Colors.secondary,
  },
  subtitlePrimary: {
    color: 'rgba(255,255,255,0.8)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
  },
  leftSection: {
    width: 40,
    alignItems: 'flex-start',
  },
  titleSection: {
    flex: 1,
    justifyContent: 'center',
  },
  titleCenter: {
    alignItems: 'center',
  },
  rightSection: {
    width: 40,
    alignItems: 'flex-end',
  },
  backBtn: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});

export default AppHeader;
