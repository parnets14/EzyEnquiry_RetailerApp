import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import PrimaryButton from '../../components/common/PrimaryButton';
import AppHeader from '../../components/common/AppHeader';
import { SCREENS } from '../../constants';
import { authApi, session } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

const OTPScreen = ({ navigation, route }) => {
  const { setUser } = useAuth();
  const { mobile, context = 'register' } = route.params || {};
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const inputs = useRef([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const handleChange = (val, index) => {
    if (!/^\d*$/.test(val)) return;
    const updated = [...otp];
    updated[index] = val.slice(-1);
    setOtp(updated);
    setError('');
    if (val && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) { setError('Please enter the complete OTP'); return; }
    setLoading(true);

    // Password-reset flow is not backed by an API yet — keep local behaviour.
    if (context === 'forgot') {
      setLoading(false);
      navigation.replace(SCREENS.RESET_PASSWORD, { mobile });
      return;
    }

    try {
      // Both register and login flows verify a login-purpose OTP, which returns
      // a JWT token + user. The account is created during registration, so this
      // logs the (new or returning) user in.
      const data = await authApi.verifyOtp(mobile, code, 'login');
      await session.save(data?.token, data?.user);
      setUser(data?.user || null);
      setLoading(false);
      navigation.replace(SCREENS.HOME);
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Invalid OTP. Please try again.');
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setOtp(Array(OTP_LENGTH).fill(''));
    setError('');
    setCountdown(RESEND_SECONDS);
    try {
      await authApi.sendOtp(mobile, 'login');
    } catch (err) {
      setError(err.message || 'Could not resend OTP. Please try again.');
    }
  };

  const maskedMobile = mobile ? `+91 XXXXX ${mobile.slice(-5)}` : '+91 XXXXXXXXXX';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AppHeader title="OTP Verification" showBack onBack={() => navigation.goBack()} centerTitle />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <Text style={styles.sendIcon}>📱</Text>
          <Text style={styles.title}>Enter Verification Code</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit OTP to{'\n'}
            <Text style={styles.mobile}>{maskedMobile}</Text>
          </Text>

          {/* OTP Inputs */}
          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={r => (inputs.current[index] = r)}
                style={[
                  styles.otpBox,
                  digit ? styles.otpFilled : null,
                  error ? styles.otpError : null,
                ]}
                value={digit}
                onChangeText={v => handleChange(v, index)}
                onKeyPress={e => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                selectTextOnFocus
                autoFocus={index === 0}
              />
            ))}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <PrimaryButton
            title="VERIFY OTP"
            onPress={handleVerify}
            loading={loading}
            size="lg"
            style={styles.verifyBtn}
          />

          {/* Resend */}
          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>Didn't receive the OTP? </Text>
            <TouchableOpacity onPress={handleResend} disabled={countdown > 0}>
              <Text style={[styles.resendLink, countdown > 0 && styles.resendDisabled]}>
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  flex: { flex: 1 },
  container: { flex: 1, alignItems: 'center', padding: Spacing.xl, paddingTop: Spacing['2xl'] },
  sendIcon: { fontSize: 52, marginBottom: Spacing.base },
  title: { ...Typography.h3, color: Colors.textPrimary, marginBottom: 8 },
  subtitle: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing['2xl'] },
  mobile: { color: Colors.secondary, fontWeight: '700' },
  otpRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.sm },
  otpBox: {
    width: 46, height: 54, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.background,
    fontSize: Typography['2xl'], fontWeight: '700', color: Colors.textPrimary,
    ...Shadows.sm,
  },
  otpFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  otpError: { borderColor: Colors.error, backgroundColor: Colors.errorBg },
  errorText: { ...Typography.caption, color: Colors.error, marginBottom: Spacing.base },
  verifyBtn: { width: '100%', marginTop: Spacing.lg },
  resendRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.lg },
  resendLabel: { ...Typography.body2, color: Colors.textSecondary },
  resendLink: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },
  resendDisabled: { color: Colors.textDisabled },
});

export default OTPScreen;
