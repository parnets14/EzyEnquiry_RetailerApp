import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

const TextInput = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  helperText,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  multiline = false,
  numberOfLines = 1,
  editable = true,
  leftIcon,
  rightIcon,
  onRightIconPress,
  required = false,
  style,
  inputStyle,
  maxLength,
  onBlur,
  onFocus,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleFocus = (e) => {
    setIsFocused(true);
    onFocus && onFocus(e);
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur && onBlur();
  };

  const isSecure = secureTextEntry && !showPassword;

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.focused,
          error && styles.errorBorder,
          !editable && styles.disabled,
          multiline && styles.multilineWrapper,
        ]}
      >
        {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}

        <RNTextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithLeft,
            (rightIcon || secureTextEntry) && styles.inputWithRight,
            multiline && styles.multilineInput,
            !editable && styles.disabledText,
            inputStyle,
          ]}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : 1}
          editable={editable}
          onFocus={(e) => handleFocus(e)}
          onBlur={handleBlur}
          maxLength={maxLength}
          textAlignVertical={multiline ? 'top' : 'center'}
        />

        {secureTextEntry ? (
          <TouchableOpacity
            style={styles.rightIcon}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Text style={styles.eyeIcon}>{showPassword ? '👁' : '👁‍🗨'}</Text>
          </TouchableOpacity>
        ) : rightIcon ? (
          <TouchableOpacity
            style={styles.rightIcon}
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
          >
            {rightIcon}
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.base,
  },
  label: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 11,
  },
  required: {
    color: Colors.error,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.input,
    overflow: 'hidden',
  },
  focused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  errorBorder: {
    borderColor: Colors.error,
  },
  disabled: {
    backgroundColor: Colors.background,
    borderColor: Colors.borderLight,
  },
  multilineWrapper: {
    alignItems: 'flex-start',
    paddingTop: 4,
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: 13,
    ...Typography.body1,
    color: Colors.textPrimary,
    minHeight: 48,
  },
  inputWithLeft: {
    paddingLeft: 8,
  },
  inputWithRight: {
    paddingRight: 8,
  },
  multilineInput: {
    minHeight: 90,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  disabledText: {
    color: Colors.textPrimary,
  },
  leftIcon: {
    paddingLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightIcon: {
    paddingRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    minHeight: 48,
  },
  eyeIcon: {
    fontSize: 16,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: 4,
  },
  helperText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 4,
  },
});

export default TextInput;
