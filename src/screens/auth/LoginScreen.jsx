import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar, Image,
  TextInput as RNTextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import PrimaryButton from '../../components/common/PrimaryButton';
import { SCREENS } from '../../constants';
import { authApi, session } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const LOGO = require('../../assets/logo.jpeg');
const OTP_LENGTH = 6;

export default function LoginScreen({ navigation }) {
  const { setUser } = useAuth();
  const [step, setStep]       = useState('phone');
  const [phone, setPhone]     = useState('');
  const [error, setError]     = useState('');
  const [otp, setOtp]         = useState(Array(OTP_LENGTH).fill(''));
  const [otpErr, setOtpErr]   = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer]     = useState(0);
  const [devOtp, setDevOtp]   = useState('');
  const [notRegistered, setNotRegistered] = useState(false);
  const refs   = useRef([]);
  const intRef = useRef(null);

  const startTimer = () => {
    setTimer(30);
    intRef.current = setInterval(() => setTimer(p => {
      if (p <= 1) { clearInterval(intRef.current); return 0; }
      return p - 1;
    }), 1000);
  };

  // Step 1 — send login OTP to the registered mobile number
  const sendOtp = async () => {
    if (phone.length < 10) { setError('Enter a valid 10-digit mobile number'); return; }
    setError('');
    setNotRegistered(false);
    setLoading(true);
    try {
      const data = await authApi.sendOtp(phone, 'login');
      setDevOtp(data?.otp || '');   // dev-mode OTP (OTP_DEV_RETURN=true)
      setLoading(false);
      setStep('otp');
      startTimer();
    } catch (err) {
      setLoading(false);
      // Backend returns 404 when the mobile has never registered, or 403 when company not found
      if (err.status === 404 || (err.status === 403 && /not registered/i.test(err.message))) {
        setNotRegistered(true);
        setError('This mobile number is not registered. Please create an account first.');
      } else {
        setError(err.message || 'Could not send OTP. Please try again.');
      }
    }
  };

  // Step 2 — verify OTP → save token + user → Home
  const verify = async () => {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) { setOtpErr('Enter the 6-digit OTP'); return; }
    setOtpErr('');
    setLoading(true);
    try {
      const data = await authApi.verifyOtp(phone, code, 'login');
      await session.save(data?.token, data?.user);
      setUser(data?.user || null);
      setLoading(false);
      const u = data?.user;
      const approved = u?.is_approved || u?.company?.status === 'Approved' || u?.company_status === 'Approved';
      navigation.replace(approved ? SCREENS.HOME : SCREENS.PENDING_APPROVAL);
    } catch (err) {
      setLoading(false);
      setOtpErr(err.message || 'Invalid OTP. Please try again.');
    }
  };

  const otpChange = (v, i) => {
    if (!/^\d*$/.test(v)) return;
    const a = [...otp]; a[i] = v.slice(-1); setOtp(a); setOtpErr('');
    if (v && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
  };
  const otpKey = (e, i) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[i] && i > 0) refs.current[i - 1]?.focus();
  };
  const resend = async () => {
    if (timer > 0) return;
    setOtp(Array(OTP_LENGTH).fill('')); setOtpErr(''); startTimer();
    try {
      const data = await authApi.sendOtp(phone, 'login');
      setDevOtp(data?.otp || '');
    } catch (err) { setOtpErr(err.message || 'Could not resend OTP.'); }
  };
  const changeNumber = () => {
    setStep('phone'); setOtp(Array(OTP_LENGTH).fill('')); setOtpErr('');
    clearInterval(intRef.current); setTimer(0);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1A2340" />

      <SafeAreaView style={s.flex} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets={true}>

            {/* ═══ BIG LOGO + BRAND ═══ */}
            <View style={s.logoArea}>
              <Image source={LOGO} style={s.logo} resizeMode="cover" />
              <Text style={s.brandName}>
                <Text style={s.brandOrange}>Ezy</Text>
                <Text style={s.brandWhite}>Enquiry</Text>
              </Text>
              <Text style={s.brandSub}>Tiles Business Platform</Text>
            </View>

            {/* ═══ GLASS FORM CARD ═══ */}
            <View style={s.glass}>
              {/* Glass top edge */}
              <View style={s.glassEdge} />

              {/* Title */}
              <Text style={s.title}>{step === 'phone' ? 'Sign In' : 'Verify OTP'}</Text>
              <Text style={s.subtitle}>
                {step === 'phone'
                  ? 'Enter your registered mobile number'
                  : `OTP sent to +91 ${phone}`}
              </Text>

              {/* ─── Step 1: Phone ─── */}
              {step === 'phone' && (
                <>
                  <View style={[s.field, error && s.fieldErr]}>
                    <Text style={s.fieldPrefix}>+91</Text>
                    <View style={s.fieldDivider} />
                    <RNTextInput
                      style={s.fieldInput}
                      value={phone}
                      onChangeText={v => { setPhone(v.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                      placeholder="Mobile Number"
                      placeholderTextColor="rgba(255,255,255,0.30)"
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                  </View>
                  {error ? <Text style={s.err}>{error}</Text> : null}
                  <PrimaryButton title="Get OTP" onPress={sendOtp} loading={loading} size="lg" style={s.btn} />
                </>
              )}

              {/* ─── Step 2: OTP ─── */}
              {step === 'otp' && (
                <>
                  {devOtp ? (
                    <View style={s.devOtpBox}>
                      <Text style={s.devOtpLabel}>Your OTP (dev)</Text>
                      <Text style={s.devOtpCode}>{devOtp}</Text>
                    </View>
                  ) : null}
                  <View style={s.otpRow}>
                    {otp.map((d, i) => (
                      <RNTextInput
                        key={i}
                        ref={r => (refs.current[i] = r)}
                        style={[s.otpBox, d && s.otpFill, otpErr && s.otpErrB]}
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
                  {otpErr ? <Text style={s.err}>{otpErr}</Text> : null}
                  <PrimaryButton title="Verify & Login" onPress={verify} loading={loading} size="lg" style={s.btn} />
                  <View style={s.otpLinks}>
                    <TouchableOpacity onPress={resend} disabled={timer > 0}>
                      <Text style={[s.link, timer > 0 && s.linkOff]}>
                        {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={changeNumber}>
                      <Text style={s.link}>Change Number</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>

            {/* ═══ REGISTER ═══ */}
            <View style={s.regRow}>
              <Text style={s.regText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate(SCREENS.REGISTER)}>
                <Text style={s.regLink}>Register</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A2340' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32, paddingBottom: 80 },

  /* ═══ Logo ═══ */
  logoArea: { alignItems: 'center', marginBottom: 36 },
  logo: {
    width: 100, height: 100, borderRadius: 26, marginBottom: 16,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.15)',
  },
  brandName: { fontSize: 30, fontWeight: '800', marginBottom: 6 },
  brandOrange: { color: Colors.primary },
  brandWhite: { color: '#FFFFFF' },
  brandSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.8 },

  /* ═══ Glass Card ═══ */
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 28,
  },
  glassEdge: {
    position: 'absolute', top: 0, left: 24, right: 24,
    height: 1, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 1,
  },

  title: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.50)', marginBottom: 24 },

  /* ═══ Input field (glass style) ═══ */
  field: {
    flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  fieldErr: { borderColor: Colors.error },
  fieldPrefix: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', paddingLeft: 16 },
  fieldDivider: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 12 },
  fieldInput: { flex: 1, fontSize: 16, color: '#FFFFFF', letterSpacing: 1, paddingRight: 16 },

  /* ═══ OTP ═══ */
  otpRow: { flexDirection: 'row', gap: 8 },
  otpBox: {
    flex: 1, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    fontSize: 20, fontWeight: '700', color: '#FFFFFF',
  },
  otpFill: { borderColor: Colors.primary, backgroundColor: 'rgba(244,80,10,0.10)' },
  otpErrB: { borderColor: Colors.error },
  otpLinks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  link: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  linkOff: { color: 'rgba(255,255,255,0.30)' },

  /* ═══ Not-registered prompt ═══ */
  registerPrompt: { marginTop: 10, alignItems: 'center' },
  registerPromptText: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  registerPromptLink: { color: Colors.primary, fontWeight: '700' },

  /* ═══ Dev OTP banner ═══ */
  devOtpBox: {
    alignItems: 'center', marginBottom: 16, paddingVertical: 10,
    borderRadius: 12, backgroundColor: 'rgba(244,80,10,0.10)',
    borderWidth: 1, borderColor: 'rgba(244,80,10,0.35)',
  },
  devOtpLabel: { fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5 },
  devOtpCode: { fontSize: 24, fontWeight: '800', color: Colors.primary, letterSpacing: 6, marginTop: 2 },

  /* ═══ Common ═══ */
  err: { fontSize: 12, color: Colors.error, marginTop: 6 },
  btn: { marginTop: 20 },

  /* ═══ Register ═══ */
  regRow: { flexDirection: 'row', justifyContent: 'center' },
  regText: { fontSize: 14, color: 'rgba(255,255,255,0.50)' },
  regLink: { fontSize: 14, fontWeight: '700', color: Colors.primary },
});
