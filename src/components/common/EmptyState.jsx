import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import PrimaryButton from './PrimaryButton';

const EmptyState = ({
  iconName = 'document-outline',
  title = 'Nothing here yet',
  message,
  buttonTitle,
  onButtonPress,
  buttonVariant = 'primary',
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <Ionicons name={iconName} size={44} color={Colors.border} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {buttonTitle ? (
        <PrimaryButton
          title={buttonTitle}
          onPress={onButtonPress}
          variant={buttonVariant}
          fullWidth={false}
          style={styles.button}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['3xl'] },
  iconCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.background, alignItems: 'center',
    justifyContent: 'center', marginBottom: Spacing.lg,
  },
  title: { ...Typography.h4, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.sm },
  message: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
  button: { paddingHorizontal: Spacing.xl },
});

export default EmptyState;
