import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import AppHeader from '../../components/common/AppHeader';
import PrimaryButton from '../../components/common/PrimaryButton';
import { orderApi } from '../../utils/api';
import { SCREENS } from '../../constants';

const OTP_LENGTH = 6;

export default function DeliveryOTPScreen({ navigation, route }) {
  const { orderId, dispatchId } = route.params || {};

  const [digits, setDigits]     = useState(Array(OTP_LENGTH).fill(''));
  const [sending, setSending]   = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpSent, setOtpSent]   = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');
  const inputs = useRef([]);

  const otp = digits.join('');

  const handleRequestOtp = async () => {
    setSending(true);
    setError('');
    setInfo('');
    try {
      await orderApi.requestDeliveryOtp(orderId, dispatchId);
      setOtpSent(true);
      setInfo('OTP sent to your registered mobile number.');
    } catch (err) {
      // If backend not ready, still let the retailer enter an OTP shared by the driver.
      if (err.status === 404) {
        setOtpSent(true);
        setInfo('Enter the delivery OTP shared with you to confirm delivery.');
      } else {
        setError(err.message || 'Could not send OTP. Please try again.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleChange = (text, index) => {
    const clean = text.replace(/\D/g, '');
    const next = [...digits];
    if (clean.length > 1) {
      // Handle paste
      const chars = clean.slice(0, OTP_LENGTH).split('');
      for (let i = 0; i < OTP_LENGTH; i++) next[i] = chars[i] || '';
      setDigits(next);
      inputs.current[Math.min(chars.length, OTP_LENGTH - 1)]?.focus();
      return;
    }
    next[index] = clean;
    setDigits(next);
    if (clean && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (otp.length !== OTP_LENGTH) {
      setError(`Please enter the ${OTP_LENGTH}-digit OTP.`);
      return;
    }
    setVerifying(true);
    setError('');
    try {
      await orderApi.confirmDeliveryOtp(orderId, dispatchId, otp);
      setVerified(true);
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  if (verified) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <AppHeader title="Delivery Confirmed" showBack onBack={() => navigation.goBack()} centerTitle />
        <View style={styles.successWrap}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={44} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Delivery Confirmed</Text>
          <Text style={styles.successSub}>The OTP was verified and this shipment is marked as delivered.</Text>
          <PrimaryButton
            title="VIEW ORDER"
            onPress={() => navigation.navigate(SCREENS.ORDER_DETAILS, { orderId })}
            variant="primary"
            size="lg"
            style={{ marginTop: Spacing.xl, width: '100%' }}
          />
          <PrimaryButton
            title="BACK TO ORDERS"
            onPress={() => navigation.navigate(SCREENS.HOME)}
            variant="outline"
            size="lg"
            style={{ marginTop: 10, width: '100%' }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AppHeader title="Delivery OTP" showBack onBack={() => navigation.goBack()} centerTitle />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark-outline" size={40} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Confirm Delivery</Text>
          <Text style={styles.subtitle}>
            {otpSent
              ? 'Enter the 6-digit OTP to confirm you have received this shipment.'
              : 'Request a delivery OTP. It will be sent to your registered mobile number. Share it with the driver, or enter it here to confirm delivery.'}
          </Text>

          {!otpSent ? (
            <PrimaryButton
              title="SEND DELIVERY OTP"
              onPress={handleRequestOtp}
              loading={sending}
              variant="primary"
              size="lg"
              style={{ marginTop: Spacing.xl }}
            />
          ) : (
            <>
              <View style={styles.otpRow}>
                {digits.map((d, i) => (
                  <TextInput
                    key={i}
                    ref={(el) => { inputs.current[i] = el; }}
                    style={[styles.otpBox, d ? styles.otpBoxFilled : null]}
                    keyboardType="number-pad"
                    maxLength={OTP_LENGTH}
                    value={d}
                    onChangeText={(t) => handleChange(t, i)}
                    onKeyPress={(e) => handleKeyPress(e, i)}
                    autoFocus={i === 0}
                  />
                ))}
              </View>

              <PrimaryButton
                title="CONFIRM DELIVERY"
                onPress={handleVerify}
                loading={verifying}
                variant="primary"
                size="lg"
                style={{ marginTop: Spacing.lg }}
              />

              <TouchableOpacity onPress={handleRequestOtp} disabled={sending} style={styles.resend}>
                <Text style={styles.resendText}>{sending ? 'Sending…' : 'Resend OTP'}</Text>
              </TouchableOpacity>
            </>
          )}

          {info ? (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.infoText} />
              <Text style={styles.infoText}>{info}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.screenPadding, paddingBottom: 40, alignItems: 'center' },
  iconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl },
  title: { ...Typography.h3, color: Colors.textPrimary, marginTop: Spacing.lg },
  subtitle: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: Spacing.sm, paddingHorizontal: Spacing.md },
  otpRow: { flexDirection: 'row', gap: 8, marginTop: Spacing.xl, justifyContent: 'center' },
  otpBox: {
    width: 46, height: 56, borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white, textAlign: 'center', fontSize: 22, fontWeight: '700', color: Colors.textPrimary, ...Shadows.sm,
  },
  otpBoxFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  resend: { marginTop: Spacing.base, alignSelf: 'center' },
  resendText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },
  infoBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: Colors.infoBg, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.lg, width: '100%' },
  infoText: { ...Typography.caption, color: Colors.infoText, flex: 1, lineHeight: 18 },
  errorBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: Colors.errorBg, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.md, width: '100%' },
  errorText: { ...Typography.caption, color: Colors.error, flex: 1 },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  successCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: Colors.successBg, alignItems: 'center', justifyContent: 'center' },
  successTitle: { ...Typography.h3, color: Colors.textPrimary, marginTop: Spacing.lg },
  successSub: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 22 },
});
