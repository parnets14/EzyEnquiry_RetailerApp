import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar, Image,
  TextInput as RNTextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import TextInput from '../../components/common/TextInput';
import PrimaryButton from '../../components/common/PrimaryButton';
import { SCREENS } from '../../constants';
import { authApi, session } from '../../utils/api';

const LOGO = require('../../assets/logo.jpeg');
const BUSINESS_TYPES = ['Retailer', 'Dealer', 'Contractor', 'Distributor'];
const OTP_LENGTH = 6;

export default function RegisterScreen({ navigation }) {
  // Steps: 1 = Info, 2 = OTP Verify, 3 = Success
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    ownerName: '', mobile: '', email: '',
    companyName: '', gstNumber: '', panNumber: '', businessType: 'Retailer',
    address: '', city: '', state: '', pincode: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [apiError, setApiError] = useState('');

  // OTP state
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [otpErr, setOtpErr] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [timer, setTimer] = useState(0);
  const [verificationToken, setVerificationToken] = useState('');
  const otpRefs = useRef([]);
  const timerRef = useRef(null);

  const set = (key, val) => { setForm(p => ({ ...p, [key]: val })); setErrors(p => ({ ...p, [key]: undefined })); };

  const startTimer = () => {
    setTimer(30);
    timerRef.current = setInterval(() => setTimer(p => {
      if (p <= 1) { clearInterval(timerRef.current); return 0; }
      return p - 1;
    }), 1000);
  };

  // ── Step 1 Validation ──
  const validate = () => {
    const e = {};
    if (!form.ownerName.trim()) e.ownerName = 'Full name is required';
    if (!form.mobile.trim() || form.mobile.replace(/\D/g, '').length < 10)
      e.mobile = 'Valid 10-digit mobile required';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e.email = 'Valid email is required';
    if (!form.companyName.trim()) e.companyName = 'Business name is required';
    if (!form.city.trim()) e.city = 'City is required';
    if (!form.state.trim()) e.state = 'State is required';
    if (!agreed) e.agreed = 'Please accept terms & conditions';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Step 1 → Send OTP ──
  const handleSendOtp = async () => {
    setApiError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await authApi.sendOtp(form.mobile.trim(), 'register');
      setDevOtp(data?.otp || '');
      setLoading(false);
      setStep(2);
      startTimer();
    } catch (err) {
      setLoading(false);
      setApiError(err.message || 'Could not send OTP. Please try again.');
    }
  };

  // ── OTP input handlers ──
  const otpChange = (v, i) => {
    if (!/^\d*$/.test(v)) return;
    const a = [...otp]; a[i] = v.slice(-1); setOtp(a); setOtpErr('');
    if (v && i < OTP_LENGTH - 1) otpRefs.current[i + 1]?.focus();
  };
  const otpKey = (e, i) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  // ── Step 2 → Verify OTP & Register ──
  const handleVerifyAndRegister = async () => {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) { setOtpErr('Enter the complete 6-digit OTP'); return; }
    setOtpErr('');
    setLoading(true);
    try {
      // Verify OTP → get verification token
      const verifyData = await authApi.verifyOtp(form.mobile.trim(), code, 'register');
      const token = verifyData?.verification_token || '';

      // Register with verification token
      const regData = await authApi.register({
        companyName: form.companyName.trim(),
        ownerName: form.ownerName.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
        businessType: form.businessType,
        gstNumber: form.gstNumber.trim(),
        panNumber: form.panNumber.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        verificationToken: token,
      });

      // Save the authenticated retailer session.
      if (regData?.token) {
        await session.save(regData.token, regData.user);
      }

      setLoading(false);
      setStep(3);
    } catch (err) {
      setLoading(false);
      setOtpErr(err.message || 'Verification failed. Please try again.');
    }
  };

  // ── Resend OTP ──
  const resendOtp = async () => {
    if (timer > 0) return;
    setOtp(Array(OTP_LENGTH).fill('')); setOtpErr('');
    startTimer();
    try {
      const data = await authApi.sendOtp(form.mobile.trim(), 'register');
      setDevOtp(data?.otp || '');
    } catch (err) { setOtpErr(err.message || 'Could not resend OTP.'); }
  };

  // ═══════════════════════════════════════════════════════════════
  // STEP 3 — Success Screen
  // ═══════════════════════════════════════════════════════════════
  if (step === 3) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor="#1A2340" />
        <SafeAreaView style={s.flex} edges={['top', 'bottom']}>
          <View style={s.successContainer}>
            {/* Success animation area */}
            <View style={s.successIconWrap}>
              <View style={s.successIconCircle}>
                <Ionicons name="checkmark-circle" size={80} color="#4ADE80" />
              </View>
            </View>

            <Text style={s.successTitle}>Registration Successful!</Text>
            <Text style={s.successSubtitle}>
              Your business{form.companyName ? ` "${form.companyName.trim()}"` : ''} has been submitted for review.
            </Text>

            {/* Pending info card */}
            <View style={s.pendingCard}>
              <View style={s.pendingIconWrap}>
                <Ionicons name="time-outline" size={20} color="#F59E0B" />
              </View>
              <View style={s.pendingTextWrap}>
                <Text style={s.pendingTitle}>Pending Approval</Text>
                <Text style={s.pendingDesc}>
                  Our admin team will verify your details and approve your account within 24-48 hours.
                </Text>
              </View>
            </View>

            {/* Info bullets */}
            <View style={s.infoBullets}>
              <InfoBullet icon="notifications-outline" text="You'll receive a notification once approved" />
              <InfoBullet icon="log-in-outline" text="Sign in with your mobile number after approval" />
              <InfoBullet icon="document-text-outline" text="Keep your KYC documents ready for upload" />
            </View>

            <PrimaryButton
              title="BACK TO LOGIN"
              onPress={() => navigation.replace(SCREENS.LOGIN)}
              size="lg"
              style={s.successBtn}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 2 — OTP Verification
  // ═══════════════════════════════════════════════════════════════
  if (step === 2) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor="#1A2340" />
        <SafeAreaView style={s.flex} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={s.otpScroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>

              {/* Blue Header */}
              <View style={s.otpHeader}>
                <TouchableOpacity style={s.backBtn} onPress={() => { setStep(1); clearInterval(timerRef.current); }}>
                  <Ionicons name="arrow-back" size={22} color="#FFF" />
                </TouchableOpacity>
                <View style={s.otpHeaderIcon}>
                  <Ionicons name="shield-checkmark" size={44} color="rgba(255,255,255,0.9)" />
                </View>
                <Text style={s.otpHeaderTitle}>Verify Your Number</Text>
                <Text style={s.otpHeaderSub}>
                  We've sent a 6-digit OTP to{'\n'}
                  <Text style={s.otpHeaderPhone}>+91 {form.mobile}</Text>
                </Text>
              </View>

              {/* OTP Card */}
              <View style={s.otpCard}>
                {/* Dev OTP Display */}
                {devOtp ? (
                  <View style={s.devOtpBox}>
                    <Ionicons name="code-working-outline" size={14} color={Colors.primary} />
                    <Text style={s.devOtpLabel}>Dev OTP: </Text>
                    <Text style={s.devOtpCode}>{devOtp}</Text>
                  </View>
                ) : null}

                {/* OTP Input Row */}
                <View style={s.otpRow}>
                  {otp.map((d, i) => (
                    <RNTextInput
                      key={i}
                      ref={r => (otpRefs.current[i] = r)}
                      style={[s.otpBox, d && s.otpBoxFill, otpErr && s.otpBoxErr]}
                      value={d}
                      onChangeText={v => otpChange(v, i)}
                      onKeyPress={e => otpKey(e, i)}
                      keyboardType="number-pad"
                      maxLength={1}
                      textAlign="center"
                      selectTextOnFocus
                      autoFocus={i === 0}
                    />
                  ))}
                </View>

                {otpErr ? (
                  <View style={s.otpErrRow}>
                    <Ionicons name="alert-circle" size={14} color={Colors.error} />
                    <Text style={s.otpErrText}>{otpErr}</Text>
                  </View>
                ) : null}

                {/* Verify Button */}
                <PrimaryButton
                  title="VERIFY & REGISTER"
                  onPress={handleVerifyAndRegister}
                  loading={loading}
                  size="lg"
                  style={s.otpBtn}
                />

                {/* Resend / Change */}
                <View style={s.otpActions}>
                  <TouchableOpacity onPress={resendOtp} disabled={timer > 0}>
                    <Text style={[s.otpLink, timer > 0 && s.otpLinkDisabled]}>
                      {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setStep(1); clearInterval(timerRef.current); }}>
                    <Text style={s.otpLink}>Change Number</Text>
                  </TouchableOpacity>
                </View>
              </View>

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 1 — Registration Form
  // ═══════════════════════════════════════════════════════════════
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1A2340" />
      <SafeAreaView style={s.flex} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets={true}
          >
            {/* ═══ Blue Header ═══ */}
            <View style={s.header}>
              <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={22} color="#FFF" />
              </TouchableOpacity>

              <View style={s.headerContent}>
                <Image source={LOGO} style={s.headerLogo} resizeMode="cover" />
                <Text style={s.headerTitle}>Create Your Account</Text>
                <Text style={s.headerSubtitle}>Join EzyEnquiry to discover tiles, send enquiries and grow your business</Text>
              </View>

              {/* Step indicators */}
              <View style={s.stepsRow}>
                <StepPill num="1" label="Details" active />
                <View style={s.stepConnector} />
                <StepPill num="2" label="Verify" />
                <View style={s.stepConnector} />
                <StepPill num="3" label="Done" />
              </View>
            </View>

            {/* ═══ Form Section ═══ */}
            <View style={s.formArea}>

              {/* Owner Details Card */}
              <View style={s.card}>
                <View style={s.cardHeader}>
                  <View style={s.cardIconWrap}>
                    <Ionicons name="person" size={16} color="#3B82F6" />
                  </View>
                  <Text style={s.cardTitle}>Owner Details</Text>
                </View>

                <TextInput
                  label="Full Name"
                  placeholder="Enter your full name"
                  value={form.ownerName}
                  onChangeText={v => set('ownerName', v)}
                  error={errors.ownerName}
                  required
                />
                <TextInput
                  label="Mobile Number"
                  placeholder="10-digit mobile number"
                  value={form.mobile}
                  onChangeText={v => set('mobile', v.replace(/\D/g, '').slice(0, 10))}
                  error={errors.mobile}
                  keyboardType="phone-pad"
                  required
                />
                <TextInput
                  label="Email Address"
                  placeholder="your@email.com"
                  value={form.email}
                  onChangeText={v => set('email', v)}
                  error={errors.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  required
                />
              </View>

              {/* Business Info Card */}
              <View style={s.card}>
                <View style={s.cardHeader}>
                  <View style={[s.cardIconWrap, { backgroundColor: '#EEF2FF' }]}>
                    <Ionicons name="business" size={16} color="#6366F1" />
                  </View>
                  <Text style={s.cardTitle}>Business Information</Text>
                </View>

                <TextInput
                  label="Company / Shop Name"
                  placeholder="Your business name"
                  value={form.companyName}
                  onChangeText={v => set('companyName', v)}
                  error={errors.companyName}
                  required
                />

                {/* Business Type */}
                <TextInput
                  label="Business Type"
                  placeholder="e.g. Retailer, Dealer, Contractor"
                  value={form.businessType}
                  onChangeText={v => set('businessType', v)}
                />

                <TextInput
                  label="GST Number"
                  placeholder="27XXXXX1234F1Z5 (optional)"
                  value={form.gstNumber}
                  onChangeText={v => set('gstNumber', v.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={15}
                />
                <TextInput
                  label="PAN Number"
                  placeholder="AABCP1234F"
                  value={form.panNumber}
                  onChangeText={v => set('panNumber', v.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={10}
                />
              </View>

              {/* Address Card */}
              <View style={s.card}>
                <View style={s.cardHeader}>
                  <View style={[s.cardIconWrap, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="location" size={16} color="#10B981" />
                  </View>
                  <Text style={s.cardTitle}>Business Address</Text>
                </View>

                <TextInput
                  label="Address"
                  placeholder="Shop / building, street"
                  value={form.address}
                  onChangeText={v => set('address', v)}
                  multiline
                  numberOfLines={2}
                />
                <View style={s.row}>
                  <View style={s.half}>
                    <TextInput label="City" placeholder="City" value={form.city} onChangeText={v => set('city', v)} error={errors.city} required />
                  </View>
                  <View style={s.half}>
                    <TextInput label="State" placeholder="State" value={form.state} onChangeText={v => set('state', v)} error={errors.state} required />
                  </View>
                </View>
                <TextInput
                  label="Pincode"
                  placeholder="6-digit pincode"
                  value={form.pincode}
                  onChangeText={v => set('pincode', v.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              {/* Terms */}
              <TouchableOpacity style={s.termsRow} onPress={() => { setAgreed(!agreed); setErrors(p => ({ ...p, agreed: undefined })); }} activeOpacity={0.8}>
                <View style={[s.checkbox, agreed && s.checkboxChecked]}>
                  {agreed && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </View>
                <Text style={s.termsText}>
                  I agree to the <Text style={s.termsLink}>Terms of Service</Text> and <Text style={s.termsLink}>Privacy Policy</Text>
                </Text>
              </TouchableOpacity>
              {errors.agreed ? <Text style={s.errSmall}>{errors.agreed}</Text> : null}

              {/* API Error */}
              {apiError ? (
                <View style={s.apiErrBox}>
                  <Ionicons name="alert-circle" size={16} color={Colors.error} />
                  <Text style={s.apiErrText}>{apiError}</Text>
                </View>
              ) : null}

              {/* Submit Button */}
              <PrimaryButton
                title="CONTINUE & VERIFY"
                onPress={handleSendOtp}
                loading={loading}
                size="lg"
                style={s.submitBtn}
              />

              {/* Login link */}
              <View style={s.loginRow}>
                <Text style={s.loginLabel}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate(SCREENS.LOGIN)}>
                  <Text style={s.loginLink}>Sign In</Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: 120 }} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/* ── Sub-components ── */
const StepPill = ({ num, label, active }) => (
  <View style={s.stepPill}>
    <View style={[s.stepCircle, active && s.stepCircleActive]}>
      <Text style={[s.stepNum, active && s.stepNumActive]}>{num}</Text>
    </View>
    <Text style={[s.stepLabel, active && s.stepLabelActive]}>{label}</Text>
  </View>
);

const InfoBullet = ({ icon, text }) => (
  <View style={s.bulletRow}>
    <View style={s.bulletIcon}>
      <Ionicons name={icon} size={16} color="#3B82F6" />
    </View>
    <Text style={s.bulletText}>{text}</Text>
  </View>
);

/* ═══ Styles ═══ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8FA' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },

  // ── Blue Header ──
  header: {
    backgroundColor: '#1A2340',
    paddingTop: 12,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  headerContent: { alignItems: 'center', marginBottom: 20 },
  headerLogo: {
    width: 60, height: 60, borderRadius: 16,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 6, textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 18, maxWidth: 280,
  },

  // ── Steps ──
  stepsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0,
  },
  stepPill: { alignItems: 'center', gap: 4 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepCircleActive: { backgroundColor: '#3B82F6' },
  stepNum: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
  stepNumActive: { color: '#FFFFFF' },
  stepLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  stepLabelActive: { color: '#3B82F6', fontWeight: '700' },
  stepConnector: {
    width: 36, height: 2, backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 8, borderRadius: 1,
  },

  // ── Form Area ──
  formArea: { padding: 16, paddingTop: 20 },

  // ── Card ──
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  cardIconWrap: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1A2340' },

  // ── Chips ──
  chipLabel: {
    fontSize: 11, fontWeight: '600', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  chipActive: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  chipText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  chipTextActive: { color: '#3B82F6', fontWeight: '700' },

  // ── Layout ──
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },

  // ── Terms ──
  termsRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginTop: 4, marginBottom: 4, paddingHorizontal: 4,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxChecked: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  termsText: { fontSize: 13, color: '#6B7280', flex: 1, lineHeight: 20 },
  termsLink: { color: '#3B82F6', fontWeight: '600' },
  errSmall: { fontSize: 11, color: Colors.error, marginBottom: 8, paddingLeft: 32 },

  // ── API Error ──
  apiErrBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10,
    padding: 12, marginTop: 8, marginBottom: 4,
    borderWidth: 1, borderColor: '#FECACA',
  },
  apiErrText: { fontSize: 12, color: Colors.error, flex: 1 },

  // ── Submit ──
  submitBtn: { marginTop: 12 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  loginLabel: { fontSize: 14, color: '#6B7280' },
  loginLink: { fontSize: 14, color: '#3B82F6', fontWeight: '700' },

  // ═══════════════════════════════════════════════
  // OTP Screen Styles
  // ═══════════════════════════════════════════════
  otpScroll: { flexGrow: 1, paddingBottom: 80 },
  otpHeader: {
    backgroundColor: '#1A2340',
    paddingTop: 12, paddingBottom: 36, paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  otpHeaderIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(59,130,246,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, marginTop: 8,
  },
  otpHeaderTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  otpHeaderSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 20 },
  otpHeaderPhone: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  otpCard: {
    margin: 20, marginTop: -16,
    backgroundColor: '#FFFFFF', borderRadius: 20,
    padding: 24,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  devOtpBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FFF7ED', borderRadius: 10, padding: 10,
    marginBottom: 20, borderWidth: 1, borderColor: '#FED7AA',
  },
  devOtpLabel: { fontSize: 12, color: '#9A3412', fontWeight: '500' },
  devOtpCode: { fontSize: 18, fontWeight: '800', color: Colors.primary, letterSpacing: 4 },

  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 10 },
  otpBox: {
    width: 46, height: 54, borderRadius: 12,
    backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB',
    fontSize: 22, fontWeight: '700', color: '#1A2340',
    textAlign: 'center',
  },
  otpBoxFill: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  otpBoxErr: { borderColor: Colors.error },

  otpErrRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 },
  otpErrText: { fontSize: 12, color: Colors.error },

  otpBtn: { marginTop: 20 },
  otpActions: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 18,
  },
  otpLink: { fontSize: 13, fontWeight: '600', color: '#3B82F6' },
  otpLinkDisabled: { color: '#9CA3AF' },

  // ═══════════════════════════════════════════════
  // Success Screen Styles
  // ═══════════════════════════════════════════════
  successContainer: {
    flex: 1, backgroundColor: '#1A2340',
    alignItems: 'center', justifyContent: 'center',
    padding: 28,
  },
  successIconWrap: { marginBottom: 24 },
  successIconCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(74,222,128,0.10)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(74,222,128,0.20)',
  },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginBottom: 10, textAlign: 'center' },
  successSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 20, marginBottom: 24 },

  pendingCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.20)',
    borderRadius: 14, padding: 16, width: '100%', marginBottom: 24,
  },
  pendingIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  pendingTextWrap: { flex: 1 },
  pendingTitle: { fontSize: 13, fontWeight: '700', color: '#F59E0B', marginBottom: 4 },
  pendingDesc: { fontSize: 12, color: 'rgba(255,255,255,0.50)', lineHeight: 17 },

  infoBullets: { width: '100%', gap: 12, marginBottom: 28 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bulletIcon: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: 'rgba(59,130,246,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  bulletText: { fontSize: 13, color: 'rgba(255,255,255,0.65)', flex: 1 },

  successBtn: { width: '100%' },
});
