import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { Colors } from '../../theme/colors';
import TextInput from '../../components/common/TextInput';
import PrimaryButton from '../../components/common/PrimaryButton';
import { SCREENS } from '../../constants';
import { authApi, session } from '../../utils/api';

const LOGO = require('../../assets/logo.jpeg');
const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024;
const REGISTRATION_DOCUMENTS = [
  { key: 'gst', field: 'gst', label: 'GST Certificate', hint: 'If GST registered', required: false, icon: 'receipt-outline', color: '#2980B9', bg: '#EBF5FB' },
  { key: 'pan', field: 'pan', label: 'PAN Card', hint: 'Identity and tax proof', required: true, icon: 'card-outline', color: '#8E44AD', bg: '#F5EEF8' },
  { key: 'reg', field: 'reg', label: 'Address Proof', hint: 'Shop or business address proof', required: true, icon: 'home-outline', color: '#E67E22', bg: '#FDF2E9' },
  { key: 'trade', field: 'trade', label: 'Business Registration', hint: 'Optional', required: false, icon: 'business-outline', color: '#27AE60', bg: '#E8F8EF' },
];

export default function RegisterScreen({ navigation }) {
  // Steps: 1 = Details, 2 = Documents, 3 = Success
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
  const [documents, setDocuments] = useState({});
  const [documentErrors, setDocumentErrors] = useState({});
  const [documentUploadError, setDocumentUploadError] = useState('');

  const set = (key, val) => { setForm(p => ({ ...p, [key]: val })); setErrors(p => ({ ...p, [key]: undefined })); };

  const saveSelectedDocument = (document, file) => {
    if (!file?.uri) return;
    if (file.size && file.size > MAX_DOCUMENT_SIZE) {
      Alert.alert('File too large', 'Each document must be 5 MB or smaller.');
      return;
    }
    setDocuments(current => ({
      ...current,
      [document.key]: {
        uri: file.uri,
        type: file.type || 'application/octet-stream',
        name: file.name || `${document.key}.jpg`,
      },
    }));
    setDocumentErrors(current => ({ ...current, [document.key]: undefined }));
    setDocumentUploadError('');
  };

  const chooseDocument = (document) => {
    const options = [
      {
        text: 'Choose Photo',
        onPress: async () => {
          const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.85, selectionLimit: 1 });
          if (result.didCancel) return;
          if (result.errorCode) {
            Alert.alert('Gallery error', result.errorMessage || 'Could not select the image.');
            return;
          }
          const asset = result.assets?.[0];
          if (asset) saveSelectedDocument(document, {
            uri: asset.uri,
            type: asset.type || 'image/jpeg',
            name: asset.fileName || `${document.key}.jpg`,
            size: asset.fileSize,
          });
        },
      },
      {
        text: 'Choose PDF / File',
        onPress: async () => {
          try {
            const [file] = await pick({ type: [types.pdf, types.images] });
            if (file) saveSelectedDocument(document, file);
          } catch (error) {
            if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) return;
            Alert.alert('File error', error?.message || 'Could not select the document.');
          }
        },
      },
    ];
    if (documents[document.key]) {
      options.push({
        text: 'Remove Selected File',
        style: 'destructive',
        onPress: () => setDocuments(current => {
          const next = { ...current };
          delete next[document.key];
          return next;
        }),
      });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(document.label, 'Upload a clear image or PDF (maximum 5 MB).', options, { cancelable: true });
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

  // ── Step 1 → Documents ──
  const handleContinueToDocuments = () => {
    setApiError('');
    if (!validate()) return;
    setStep(2);
  };

  const validateDocuments = () => {
    const nextErrors = {};
    REGISTRATION_DOCUMENTS.forEach(document => {
      if (document.required && !documents[document.key]) {
        nextErrors[document.key] = `${document.label} is required`;
      }
    });
    setDocumentErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // ── Step 2 → Register & Upload Documents ──
  const handleRegister = async () => {
    if (loading) return;
    setApiError('');
    if (!validateDocuments()) return;

    setLoading(true);
    let accountCreated = false;
    try {
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
      });
      accountCreated = true;

      if (!regData?.token) {
        throw new Error('Account created, but sign-in could not be completed. Please return to login.');
      }
      await session.save(regData.token, regData.user);
      // Save company code to form state so Step 3 can display it
      const code = regData.user?.company?.company_code || regData.user?.company_code || '';
      if (code) setForm(f => ({ ...f, _companyCode: code }));

      const selectedDocuments = REGISTRATION_DOCUMENTS.reduce((selected, document) => {
        const file = documents[document.key];
        if (file) selected[document.key] = { field: document.field, file };
        return selected;
      }, {});

      // Registration is already complete at this point. If document upload
      // fails, do not retry registration; show a retry-later message instead.
      if (Object.keys(selectedDocuments).length > 0) {
        try {
          await authApi.uploadRegistrationDocs(selectedDocuments);
          setDocumentUploadError('');
        } catch (uploadError) {
          setDocumentUploadError(
            uploadError.message || 'Your account was created, but documents could not be uploaded. Sign in and upload them from Profile > Documents.',
          );
        }
      }

      setStep(3);
    } catch (err) {
      if (accountCreated) {
        setDocumentUploadError(err.message || 'Your account was created, but setup could not be completed. Please sign in and retry your document upload.');
        setStep(3);
      } else {
        setApiError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // STEP 3 — Success Screen
  // ═══════════════════════════════════════════════════════════════
  if (step === 3) {
    // Extract company code from the registered user data
    const companyCode = form._companyCode || '';

    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor="#1A2340" />
        <SafeAreaView style={s.flex} edges={['top', 'bottom']}>
          <View style={s.successContainer}>
            {/* Success icon */}
            <View style={s.successIconWrap}>
              <View style={s.successIconCircle}>
                <Ionicons name="checkmark-circle" size={80} color="#4ADE80" />
              </View>
            </View>

            <Text style={s.successTitle}>Registration Successful!</Text>
            <Text style={s.successSubtitle}>
              Your business{form.companyName ? ` "${form.companyName.trim()}"` : ''} has been submitted for review.
            </Text>

            {/* Unique Company Code card */}
            {!!companyCode && (
              <View style={s.codeCard}>
                <View style={s.codeCardLeft}>
                  <Ionicons name="barcode-outline" size={22} color="#F59E0B" />
                  <View>
                    <Text style={s.codeLabel}>Your Unique Company Code</Text>
                    <Text style={s.codeHint}>Use this code to identify your account</Text>
                  </View>
                </View>
                <Text style={s.codeValue}>{companyCode}</Text>
              </View>
            )}

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

            {documentUploadError ? (
              <View style={s.successUploadWarning}>
                <Ionicons name="warning-outline" size={18} color="#F59E0B" />
                <Text style={s.successUploadWarningText}>
                  Account created, but document upload needs attention. Sign in and retry from Profile → Documents.
                </Text>
              </View>
            ) : null}

            {/* Info bullets */}
            <View style={s.infoBullets}>
              <InfoBullet icon="notifications-outline" text="You'll receive a notification once approved" />
              <InfoBullet icon="log-in-outline" text="Sign in with your mobile number after approval" />
              <InfoBullet
                icon="document-text-outline"
                text={documentUploadError
                  ? 'Document upload is pending; retry after signing in'
                  : Object.keys(documents).length > 0
                    ? `${Object.keys(documents).length} document${Object.keys(documents).length === 1 ? '' : 's'} submitted for admin review`
                    : 'You can upload KYC documents later from Profile > Documents'}
              />
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
  // STEP 2 — Registration Documents
  // ═══════════════════════════════════════════════════════════════
  if (step === 2) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor="#1A2340" />
        <SafeAreaView style={s.flex} edges={['top', 'bottom']}>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={s.header}>
              <TouchableOpacity style={s.backBtn} onPress={() => setStep(1)}>
                <Ionicons name="arrow-back" size={22} color="#FFF" />
              </TouchableOpacity>

              <View style={s.headerContent}>
                <View style={s.documentHeaderIcon}>
                  <Ionicons name="document-attach" size={34} color="#FFFFFF" />
                </View>
                <Text style={s.headerTitle}>Upload Documents</Text>
                <Text style={s.headerSubtitle}>
                  Submit clear business documents for faster and secure admin verification
                </Text>
              </View>

              <RegistrationSteps current={2} />
            </View>

            <View style={s.formArea}>
              <View style={s.requiredSummary}>
                <Ionicons name="information-circle" size={20} color="#2563EB" />
                <Text style={s.requiredSummaryText}>
                  PAN Card and Address Proof are required. GST Certificate and Business Registration are optional.
                </Text>
              </View>

              <View style={s.card}>
                <View style={s.cardHeader}>
                  <View style={[s.cardIconWrap, s.documentCardIcon]}>
                    <Ionicons name="shield-checkmark" size={16} color="#F59E0B" />
                  </View>
                  <View style={s.documentHeaderCopy}>
                    <Text style={s.cardTitle}>Registration Documents</Text>
                    <Text style={s.documentIntro}>Tap a document to choose an image or PDF.</Text>
                  </View>
                  <View style={s.documentCountBadge}>
                    <Text style={s.documentCountText}>{Object.keys(documents).length}/4</Text>
                  </View>
                </View>

                <View style={s.documentList}>
                  {REGISTRATION_DOCUMENTS.map(document => {
                    const file = documents[document.key];
                    const error = documentErrors[document.key];
                    return (
                      <View key={document.key}>
                        <TouchableOpacity
                          style={[
                            s.documentRow,
                            file && s.documentRowSelected,
                            error && s.documentRowError,
                          ]}
                          activeOpacity={0.75}
                          onPress={() => chooseDocument(document)}
                        >
                          <View style={[s.documentIcon, { backgroundColor: file ? '#22C55E' : document.bg }]}>
                            <Ionicons name={file ? 'checkmark' : document.icon} size={17} color={file ? '#FFFFFF' : document.color} />
                          </View>
                          <View style={s.documentCopy}>
                            <View style={s.documentTitleRow}>
                              <Text style={s.documentLabel}>{document.label}</Text>
                              <Text style={document.required ? s.requiredTag : s.optionalTag}>
                                {document.required ? 'Required' : 'Optional'}
                              </Text>
                            </View>
                            <Text style={[s.documentHint, file && s.documentHintSelected]} numberOfLines={1}>
                              {file ? file.name : document.hint}
                            </Text>
                          </View>
                          <View style={[s.documentStatus, file && s.documentStatusSelected]}>
                            <Text style={[s.documentStatusText, file && s.documentStatusTextSelected]}>
                              {file ? 'Selected' : 'Add'}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={15} color="#9CA3AF" />
                        </TouchableOpacity>
                        {error ? <Text style={s.documentErrorText}>{error}</Text> : null}
                      </View>
                    );
                  })}
                </View>

                <View style={s.documentNote}>
                  <Ionicons name="shield-checkmark-outline" size={14} color="#3B82F6" />
                  <Text style={s.documentNoteText}>
                    JPEG, PNG, WebP or PDF · Maximum 5 MB each · Visible only to authorized reviewers.
                  </Text>
                </View>
              </View>

              {apiError ? (
                <View style={s.apiErrBox}>
                  <Ionicons name="alert-circle" size={16} color={Colors.error} />
                  <Text style={s.apiErrText}>{apiError}</Text>
                </View>
              ) : null}

              <PrimaryButton
                title="REGISTER & SUBMIT"
                onPress={handleRegister}
                loading={loading}
                size="lg"
                style={s.submitBtn}
              />
              <TouchableOpacity style={s.secondaryBackButton} onPress={() => setStep(1)}>
                <Ionicons name="arrow-back" size={16} color="#3B82F6" />
                <Text style={s.secondaryBackText}>Back to details</Text>
              </TouchableOpacity>
              <View style={s.bottomSpace} />
            </View>
          </ScrollView>
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
              <RegistrationSteps current={1} />
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
                title="CONTINUE TO DOCUMENTS"
                onPress={handleContinueToDocuments}
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

              <View style={s.bottomSpace} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/* ── Sub-components ── */
const REGISTRATION_STEPS = ['Details', 'Documents', 'Done'];

const RegistrationSteps = ({ current }) => (
  <View style={s.stepsRow}>
    {REGISTRATION_STEPS.map((label, index) => {
      const number = index + 1;
      return (
        <React.Fragment key={label}>
          {index > 0 ? (
            <View style={[s.stepConnector, current >= number && s.stepConnectorActive]} />
          ) : null}
          <StepPill num={String(number)} label={label} active={current >= number} />
        </React.Fragment>
      );
    })}
  </View>
);

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
    width: 18, height: 2, backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 4, borderRadius: 1,
  },
  stepConnectorActive: { backgroundColor: '#3B82F6' },

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

  // ── Registration documents ──
  documentHeaderIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(59,130,246,0.20)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  requiredSummary: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9,
    padding: 13, marginBottom: 14, borderRadius: 12,
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
  },
  requiredSummaryText: { flex: 1, fontSize: 11.5, lineHeight: 17, color: '#1E40AF' },
  documentCardIcon: { backgroundColor: '#FFF7ED' },
  documentHeaderCopy: { flex: 1 },
  documentIntro: { marginTop: 2, fontSize: 10.5, color: '#6B7280', lineHeight: 15 },
  documentCountBadge: {
    minWidth: 34, height: 25, paddingHorizontal: 8, borderRadius: 13,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  documentCountText: { fontSize: 10.5, fontWeight: '800', color: '#2563EB' },
  documentList: { gap: 8 },
  documentRow: {
    minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 11, paddingVertical: 9, borderRadius: 11,
    borderWidth: 1.2, borderColor: '#E5E7EB', backgroundColor: '#FAFBFC',
  },
  documentRowSelected: { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
  documentRowError: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  documentIcon: {
    width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
  documentRowSelectedIcon: { backgroundColor: '#22C55E' },
  documentCopy: { flex: 1, minWidth: 0 },
  documentTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  documentLabel: { fontSize: 12.5, fontWeight: '700', color: '#1F2937' },
  requiredTag: { fontSize: 8.5, fontWeight: '800', color: '#B91C1C', textTransform: 'uppercase' },
  optionalTag: { fontSize: 8.5, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' },
  documentHint: { marginTop: 2, fontSize: 10.5, color: '#9CA3AF' },
  documentHintSelected: { color: '#15803D' },
  documentStatus: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  documentStatusSelected: { backgroundColor: '#DCFCE7' },
  documentStatusText: { fontSize: 9.5, fontWeight: '700', color: '#6B7280' },
  documentStatusTextSelected: { color: '#15803D' },
  documentErrorText: { marginTop: 4, marginLeft: 4, fontSize: 10.5, color: Colors.error },
  documentNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 11,
    padding: 9, borderRadius: 9, backgroundColor: '#EFF6FF',
  },
  documentNoteText: { flex: 1, fontSize: 9.5, lineHeight: 14, color: '#4B5563' },

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
  secondaryBackButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 44, marginTop: 10,
  },
  secondaryBackText: { fontSize: 13, fontWeight: '700', color: '#3B82F6' },
  bottomSpace: { height: 120 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  loginLabel: { fontSize: 14, color: '#6B7280' },
  loginLink: { fontSize: 14, color: '#3B82F6', fontWeight: '700' },

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
  successUploadWarning: {
    width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 9,
    padding: 12, marginTop: -12, marginBottom: 20, borderRadius: 11,
    backgroundColor: 'rgba(245,158,11,0.10)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.28)',
  },
  successUploadWarningText: { flex: 1, fontSize: 11, lineHeight: 16, color: '#FCD34D' },

  infoBullets: { width: '100%', gap: 12, marginBottom: 28 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bulletIcon: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: 'rgba(59,130,246,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  bulletText: { fontSize: 13, color: 'rgba(255,255,255,0.65)', flex: 1 },

  successBtn: { width: '100%' },

  // Unique company code card
  codeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#F59E0B',
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 16, width: '100%',
  },
  codeCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  codeLabel:   { fontSize: 12, fontWeight: '700', color: '#F59E0B' },
  codeHint:    { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  codeValue:   { fontSize: 20, fontWeight: '900', color: '#F59E0B', letterSpacing: 1, fontFamily: 'monospace' },
});
