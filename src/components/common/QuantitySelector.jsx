import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

const QuantitySelector = ({
  value,
  onChangeValue,
  unit = 'Boxes',
  min = 1,
  max = 99999,
  step = 1,
}) => {
  const handleDecrement = () => {
    const newVal = Math.max(min, value - step);
    onChangeValue(newVal);
  };

  const handleIncrement = () => {
    const newVal = Math.min(max, value + step);
    onChangeValue(newVal);
  };

  const handleTextChange = (text) => {
    const num = parseInt(text, 10);
    if (!isNaN(num)) {
      const clamped = Math.min(max, Math.max(min, num));
      onChangeValue(clamped);
    } else if (text === '') {
      onChangeValue(min);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.btn, value <= min && styles.btnDisabled]}
        onPress={handleDecrement}
        disabled={value <= min}
        activeOpacity={0.7}
      >
        <Text style={[styles.btnText, value <= min && styles.btnTextDisabled]}>−</Text>
      </TouchableOpacity>

      <View style={styles.valueWrapper}>
        <TextInput
          style={styles.valueInput}
          value={String(value)}
          onChangeText={handleTextChange}
          keyboardType="number-pad"
          textAlign="center"
          selectTextOnFocus
        />
        <Text style={styles.unit}>{unit}</Text>
      </View>

      <TouchableOpacity
        style={[styles.btn, styles.btnAdd, value >= max && styles.btnDisabled]}
        onPress={handleIncrement}
        disabled={value >= max}
        activeOpacity={0.7}
      >
        <Text style={[styles.btnText, styles.btnTextAdd, value >= max && styles.btnTextDisabled]}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  btn: {
    width: 46,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  btnAdd: {
    backgroundColor: Colors.primaryBg,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnText: {
    fontSize: 22,
    fontWeight: '500',
    color: Colors.textPrimary,
    lineHeight: 26,
  },
  btnTextAdd: {
    color: Colors.primary,
  },
  btnTextDisabled: {
    color: Colors.textDisabled,
  },
  valueWrapper: {
    paddingHorizontal: 12,
    alignItems: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
    minWidth: 90,
    height: 52,
    justifyContent: 'center',
  },
  valueInput: {
    ...Typography.h4,
    color: Colors.textPrimary,
    minWidth: 60,
    paddingVertical: 0,
    textAlign: 'center',
  },
  unit: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});

export default QuantitySelector;
