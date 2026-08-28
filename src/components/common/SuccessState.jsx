import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import PrimaryButton from './PrimaryButton';

const SuccessState = ({
  title,
  subtitle,
  referenceLabel,
  referenceValue,
  message,
  primaryButtonTitle,
  onPrimaryPress,
  secondaryButtonTitle,
  onSecondaryPress,
  tertiaryButtonTitle,
  onTertiaryPress,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="checkmark" size={40} color={Colors.success} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {referenceLabel && referenceValue ? (
        <View style={styles.refBox}>
          <Text style={styles.refLabel}>{referenceLabel}</Text>
          <Text style={styles.refValue}>{referenceValue}</Text>
        </View>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.actions}>
        {primaryButtonTitle ? (
          <PrimaryButton title={primaryButtonTitle} onPress={onPrimaryPress} variant="primary" />
        ) : null}
        {secondaryButtonTitle ? (
          <PrimaryButton title={secondaryButtonTitle} onPress={onSecondaryPress} variant="secondary" style={styles.actionGap} />
        ) : null}
        {tertiaryButtonTitle ? (
          <PrimaryButton title={tertiaryButtonTitle} onPress={onTertiaryPress} variant="ghost" style={styles.actionGap} />
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, backgroundColor: Colors.white },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.successBg, alignItems: 'center',
    justifyContent: 'center', marginBottom: Spacing.xl,
  },
  title: { ...Typography.h3, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.sm },
  subtitle: { ...Typography.body1, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg },
  refBox: {
    backgroundColor: Colors.background, borderRadius: BorderRadius.md,
    padding: Spacing.base, alignItems: 'center',
    marginVertical: Spacing.base, minWidth: 200,
  },
  refLabel: {
    ...Typography.caption, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  refValue: { ...Typography.h4, color: Colors.primary },
  message: {
    ...Typography.body2, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 22,
    marginVertical: Spacing.base, paddingHorizontal: Spacing.base,
  },
  actions: { width: '100%', marginTop: Spacing.xl, gap: 10 },
  actionGap: {},
});

export default SuccessState;
