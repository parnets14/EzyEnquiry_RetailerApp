import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  ActivityIndicator, Alert, PermissionsAndroid, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { Colors } from '../../theme/colors';
import AppHeader from '../../components/common/AppHeader';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../utils/api';

/**
 * DOC types → backend multipart field names.
 *  gst   → docs_gst
 *  pan   → docs_pan
 *  reg   → docs_address
 *  trade → docs_biz
 */
const DOC_TYPES = [
  { key: 'gst',   field: 'gst',   label: 'GST Certificate',       icon: 'receipt-outline',  required: true,  color: '#2980B9', bg: '#EBF5FB' },
  { key: 'pan',   field: 'pan',   label: 'PAN Card',              icon: 'card-outline',     required: true,  color: '#8E44AD', bg: '#F5EEF8' },
  { key: 'reg',   field: 'reg',   label: 'Address Proof',         icon: 'home-outline',     required: true,  color: '#E67E22', bg: '#FDF2E9' },
  { key: 'trade', field: 'trade', label: 'Business Registration', icon: 'business-outline', required: false, color: '#27AE60', bg: '#E8F8EF' },
];

// which docs_submitted flag corresponds to each doc key
const SUBMITTED_KEY = { gst: 'gst', pan: 'pan', reg: 'address', trade: 'biz' };

export default function DocumentsScreen({ navigation }) {
  const { user, refresh } = useAuth();
  const isApproved = user?.company_status === 'Approved' || user?.is_approved;
  const kycDocs  = user?.kyc_documents || [];
  const [submitted, setSubmitted] = useState(() => {
    // Build submitted map from backend kyc_documents array
    const map = {};
    for (const doc of kycDocs) {
      if (doc.submitted) {
        map[doc.document_type === 'registration' ? 'address' : doc.document_type] = true;
      }
    }
    return { ...map, ...(user?.docs_submitted || {}) };
  });
  const [uploadingKey, setUploadingKey] = useState(null);

  const statusOf = (docKey) => {
    // Prefer per-document state from backend kyc_documents
    const backendDoc = kycDocs.find(d => d.document_type === docKey || (docKey === 'reg' && d.document_type === 'registration'));
    if (backendDoc) {
      if (backendDoc.status === 'Verified') return 'verified';
      if (backendDoc.status === 'Pending' || backendDoc.submitted) return 'pending';
      if (backendDoc.status === 'Rejected') return 'rejected';
    }
    // Fallback to local submitted tracking
    const flag = submitted[SUBMITTED_KEY[docKey]];
    if (!flag) return 'none';
    return isApproved ? 'verified' : 'pending';
  };

  const uploadedCount = DOC_TYPES.filter(d => statusOf(d.key) !== 'none').length;
  const verifiedCount = DOC_TYPES.filter(d => statusOf(d.key) === 'verified').length;
  const pendingCount  = DOC_TYPES.filter(d => statusOf(d.key) === 'pending').length;
  const notUploaded   = DOC_TYPES.length - uploadedCount;

  // file: { uri, type, name }
  const doUpload = async (doc, file) => {
    if (!file?.uri) return;
    setUploadingKey(doc.key);
    try {
      await authApi.uploadDocs(doc.field, {
        uri: file.uri,
        type: file.type || 'application/octet-stream',
        name: file.name || `${doc.key}`,
      });
      // Optimistically mark submitted, then refresh from server
      setSubmitted(prev => ({ ...prev, [SUBMITTED_KEY[doc.key]]: true }));
      await refresh();
      Alert.alert('Uploaded', `${doc.label} uploaded successfully. It will be reviewed shortly.`);
    } catch (err) {
      Alert.alert('Upload failed', err.message || 'Could not upload the document. Please try again.');
    } finally {
      setUploadingKey(null);
    }
  };

  // Ask for the Android camera permission at runtime (required on Android 6+).
  const ensureCameraPermission = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (already) return true;

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'EzyEnquiry needs camera access to photograph your documents.',
          buttonPositive: 'Allow',
          buttonNegative: 'Cancel',
        },
      );

      if (result === PermissionsAndroid.RESULTS.GRANTED) return true;

      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(
          'Camera blocked',
          'Camera permission is turned off. Enable it in Settings to take photos, or choose from your gallery instead.',
          [
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
            { text: 'Cancel', style: 'cancel' },
          ],
        );
      }
      return false;
    } catch {
      return false;
    }
  };

  const pickFor = (doc) => {
    Alert.alert(
      doc.label,
      'Choose how to add this document',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const ok = await ensureCameraPermission();
            if (!ok) return;
            const res = await launchCamera({ mediaType: 'photo', quality: 0.8, saveToPhotos: false });
            if (res.didCancel) return;
            if (res.errorCode) {
              Alert.alert('Camera error', res.errorMessage || `Could not open camera (${res.errorCode}). Try choosing from gallery instead.`);
              return;
            }
            const a = res.assets?.[0];
            if (a) doUpload(doc, { uri: a.uri, type: a.type || 'image/jpeg', name: a.fileName || `${doc.key}.jpg` });
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
            if (res.didCancel) return;
            if (res.errorCode) { Alert.alert('Gallery error', res.errorMessage || res.errorCode); return; }
            const a = res.assets?.[0];
            if (a) doUpload(doc, { uri: a.uri, type: a.type || 'image/jpeg', name: a.fileName || `${doc.key}.jpg` });
          },
        },
        {
          text: 'Upload PDF / File',
          onPress: async () => {
            try {
              const [file] = await pick({
                type: [types.pdf, types.images],
              });
              if (file) {
                doUpload(doc, {
                  uri: file.uri,
                  type: file.type || 'application/pdf',
                  name: file.name || `${doc.key}.pdf`,
                });
              }
            } catch (err) {
              if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
              Alert.alert('File error', err?.message || 'Could not pick the file. Please try again.');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AppHeader title="Documents" showBack onBack={() => navigation.goBack()} centerTitle />

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Progress card ── */}
        <View style={st.progressCard}>
          <View style={st.progressTop}>
            <View>
              <Text style={st.progressTitle}>Verification Progress</Text>
              <Text style={st.progressSub}>{uploadedCount} of {DOC_TYPES.length} documents uploaded</Text>
            </View>
            <View style={[st.statusChip, isApproved ? st.chipApproved : st.chipPending]}>
              <Ionicons
                name={isApproved ? 'shield-checkmark' : 'time-outline'}
                size={13}
                color={isApproved ? '#27AE60' : '#F39C12'}
              />
              <Text style={[st.statusChipText, { color: isApproved ? '#27AE60' : '#F39C12' }]}>
                {isApproved ? 'Verified' : 'Under Review'}
              </Text>
            </View>
          </View>

          <View style={st.progressBarTrack}>
            <View style={[st.progressBarFill, { width: `${(uploadedCount / DOC_TYPES.length) * 100}%` }]} />
          </View>

          <View style={st.miniStatsRow}>
            <MiniStat num={verifiedCount} label="Verified" color="#27AE60" />
            <MiniStat num={pendingCount}  label="Pending"  color="#F39C12" />
            <MiniStat num={notUploaded}   label="Missing"  color={Colors.textTertiary} />
          </View>
        </View>

        {/* ── Info line ── */}
        <View style={st.infoLine}>
          <Ionicons name="information-circle-outline" size={15} color="#2980B9" />
          <Text style={st.infoLineText}>Upload clear photos of your business documents for verification.</Text>
        </View>

        {/* ── Document cards ── */}
        {DOC_TYPES.map(doc => {
          const status = statusOf(doc.key);
          const isUploading = uploadingKey === doc.key;

          return (
            <View key={doc.key} style={st.card}>
              <View style={[st.cardIcon, { backgroundColor: doc.bg }]}>
                <Ionicons name={doc.icon} size={22} color={doc.color} />
              </View>

              <View style={st.cardBody}>
                <View style={st.cardTitleRow}>
                  <Text style={st.cardLabel}>{doc.label}</Text>
                  {doc.required && <View style={st.reqDot}><Text style={st.reqDotText}>Required</Text></View>}
                </View>

                <StatusLine status={status} />
              </View>

              {/* Action */}
              {isUploading ? (
                <View style={st.uploadBtnLoading}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              ) : (
                <TouchableOpacity
                  style={[st.uploadBtn, status !== 'none' && st.replaceBtn]}
                  onPress={() => pickFor(doc)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={status === 'none' ? 'cloud-upload-outline' : 'refresh-outline'}
                    size={16}
                    color={status === 'none' ? '#FFF' : Colors.primary}
                  />
                  <Text style={[st.uploadBtnText, status !== 'none' && st.replaceBtnText]}>
                    {status === 'none' ? 'Upload' : 'Replace'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <View style={st.footNote}>
          <Ionicons name="lock-closed-outline" size={13} color={Colors.textTertiary} />
          <Text style={st.footNoteText}>Your documents are stored securely and used only for verification.</Text>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Sub-components ── */
const MiniStat = ({ num, label, color }) => (
  <View style={st.miniStat}>
    <Text style={[st.miniStatNum, { color }]}>{num}</Text>
    <Text style={st.miniStatLabel}>{label}</Text>
  </View>
);

const StatusLine = ({ status }) => {
  const map = {
    verified: { icon: 'checkmark-circle', color: '#27AE60', text: 'Verified' },
    pending:  { icon: 'time',             color: '#F39C12', text: 'Uploaded · Pending review' },
    none:     { icon: 'ellipse-outline',  color: Colors.textTertiary, text: 'Not uploaded yet' },
  };
  const s = map[status];
  return (
    <View style={st.statusLine}>
      <Ionicons name={s.icon} size={13} color={s.color} />
      <Text style={[st.statusLineText, { color: s.color }]}>{s.text}</Text>
    </View>
  );
};

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F4F7' },
  scroll: { padding: 16 },

  /* Progress card */
  progressCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  progressTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  progressSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  chipApproved: { backgroundColor: '#E8F8EF' },
  chipPending: { backgroundColor: '#FEF9E7' },
  statusChipText: { fontSize: 11, fontWeight: '700' },

  progressBarTrack: { height: 8, backgroundColor: '#EEF0F4', borderRadius: 4, overflow: 'hidden', marginBottom: 16 },
  progressBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },

  miniStatsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  miniStat: { alignItems: 'center' },
  miniStatNum: { fontSize: 20, fontWeight: '800' },
  miniStatLabel: { fontSize: 10, color: Colors.textTertiary, fontWeight: '600', marginTop: 2 },

  /* Info line */
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EBF5FB', borderRadius: 10, padding: 12, marginBottom: 16 },
  infoLineText: { flex: 1, fontSize: 12, color: '#1A6E9F', lineHeight: 17 },

  /* Document card */
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    borderRadius: 14, padding: 14, marginBottom: 10, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  reqDot: { backgroundColor: '#FFF3EE', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  reqDotText: { fontSize: 9, fontWeight: '700', color: Colors.primary },

  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusLineText: { fontSize: 11, fontWeight: '600' },

  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
  },
  uploadBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  replaceBtn: { backgroundColor: Colors.primaryBg, borderWidth: 1, borderColor: Colors.primary + '55' },
  replaceBtnText: { color: Colors.primary },
  uploadBtnLoading: { width: 84, alignItems: 'center', justifyContent: 'center', paddingVertical: 9 },

  /* Footer */
  footNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingHorizontal: 16 },
  footNoteText: { fontSize: 11, color: Colors.textTertiary, textAlign: 'center' },
});
