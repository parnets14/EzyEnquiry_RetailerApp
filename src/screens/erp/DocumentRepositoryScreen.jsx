/**
 * src/screens/erp/DocumentRepositoryScreen.jsx  (Retailer app)
 *
 * Document repository — wholesaler parity for the retailer app.
 *
 *   GET    /api/retailer/erp/documents        listDocuments
 *   POST   /api/retailer/erp/documents        uploadDocument   (multipart)
 *   DELETE /api/retailer/erp/documents/:id    deleteDocument
 *
 * ── WHAT THIS IS (AND ISN'T) ─────────────────────────────────────────────────
 * This is a free-form document STORE, mirroring the wholesaler's
 * `screens/settings/DocumentListScreen.jsx`: any number of files, each tagged
 * with a doc_type, filterable by tab, openable and deletable.
 *
 * It is NOT the KYC flow. Retailer KYC — the four fixed slots the CRM reviews
 * for company approval — is a separate screen at `screens/profile/DocumentsScreen.jsx`
 * (`SCREENS.DOCUMENTS`), backed by /api/retailer/kyc/documents. The two are
 * deliberately kept apart: KYC has a fixed shape and a review status, this one
 * is a filing cabinet.
 *
 * ── BACKEND ──────────────────────────────────────────────────────────────────
 * Reuses the shared `documentController`, which is company-generic — every
 * query filters on `{ company_id: req.user.company_id }` — so the retailer sees
 * only its own files. `entity_type` is required by the controller; we send
 * 'company'.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, FlatList, Linking, Modal, RefreshControl, StatusBar, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { erpApi, mediaUrl } from '../../utils/api';
import { formatDate } from '../../utils/formatters';
import {
  ErpHeader, ErpSummaryStrip, ErpSearchBox, ErpTabs,
  ErpLoading, ErpError, ErpEmpty, ErpPrimaryAction, ERP,
} from '../../components/erp';

// Same tag set the wholesaler offers, so the two apps stay interchangeable.
const DOC_TYPES = [
  'GST Certificate', 'Purchase Bill', 'Sales Bill',
  'Product Catalogue', 'Price List', 'Other',
];
const TABS = ['All', ...DOC_TYPES];

const isPdfDoc = (d) => /\.pdf$/i.test(d?.file_name || d?.file_url || '');
const fileLabel = (d) => d?.title || d?.file_name || 'Document';

/** 1_234_567 bytes → "1.2 MB" */
function humanSize(bytes) {
  const n = Number(bytes);
  if (!n || n <= 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentRepositoryScreen({ navigation }) {
  const [docs,       setDocs]       = useState([]);
  const [tab,        setTab]        = useState('All');
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading,  setUploading]  = useState(false);

  // Device safe-area insets (notch / home indicator). Used to keep the FAB and
  // the tag-picker sheet clear of the bottom edge on phones that clip content.
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      // doc_type is filtered server-side; the search box filters client-side
      // because the controller has no free-text query.
      const params = tab === 'All' ? {} : { doc_type: tab };
      const res  = await erpApi.listDocuments(params);
      const data = res?.data ?? res;
      setDocs(Array.isArray(data) ? data : data?.documents ?? []);
    } catch (e) {
      setError(e?.message || 'Failed to load documents');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(d =>
      `${fileLabel(d)} ${d.doc_type || ''}`.toLowerCase().includes(q));
  }, [docs, search]);

  const counts = useMemo(() => ({
    total: docs.length,
    pdf:   docs.filter(isPdfDoc).length,
    image: docs.filter(d => !isPdfDoc(d)).length,
  }), [docs]);

  /** Choose the tag first, then pick the file — the tag is required server-side. */
  const uploadWith = async (docType) => {
    setPickerOpen(false);
    let file;
    try {
      const results = await pick({
        allowMultiSelection: false,
        type: [types.pdf, types.images],
        mode: 'import',
      });
      if (!results || results.length === 0) return;
      file = results[0];
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      Alert.alert('Could not pick file', err?.message || 'Please try again.');
      return;
    }

    setUploading(true);
    try {
      await erpApi.uploadDocument(
        { uri: file.uri, name: file.name, type: file.type },
        docType,
      );
      Alert.alert('Uploaded', `${docType} saved.`);
      // Jump to the tab it landed in, otherwise a filtered view hides the result.
      if (tab !== 'All' && tab !== docType) setTab('All');
      else load();
    } catch (err) {
      Alert.alert('Upload failed', err?.message || 'Could not upload the document.');
    } finally {
      setUploading(false);
    }
  };

  const openDoc = (d) => {
    const url = mediaUrl(d.file_url);
    if (!url) {
      Alert.alert('Cannot open', 'This document has no file attached.');
      return;
    }
    Linking.openURL(url).catch(() =>
      Alert.alert('Cannot open', 'No app on this device can open this file type.'));
  };

  const removeDoc = (d) => {
    Alert.alert(
      'Delete document',
      `Delete "${fileLabel(d)}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await erpApi.deleteDocument(d._id);
              setDocs(prev => prev.filter(x => x._id !== d._id));
            } catch (e) {
              Alert.alert('Failed', e?.message || 'Could not delete the document.');
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }) => {
    const pdf  = isPdfDoc(item);
    const size = humanSize(item.file_size);
    const when = formatDate(item.created_at);

    return (
      <TouchableOpacity style={st.card} activeOpacity={0.85} onPress={() => openDoc(item)}>
        <View style={[st.cardIcon, { backgroundColor: pdf ? '#FEF2F2' : '#EFF6FF' }]}>
          <Ionicons
            name={pdf ? 'document-text-outline' : 'image-outline'}
            size={20}
            color={pdf ? '#DC2626' : '#2563EB'}
          />
        </View>

        <View style={st.cardBody}>
          <Text style={st.cardName} numberOfLines={1}>{fileLabel(item)}</Text>
          <Text style={st.cardTag} numberOfLines={1}>{item.doc_type || 'Other'}</Text>
          {(size || when) ? (
            <Text style={st.cardMeta} numberOfLines={1}>
              {[size, when].filter(Boolean).join('  ·  ')}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={() => removeDoc(item)}
          style={st.trash}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const filtered = search.trim() || tab !== 'All';

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {/* Blue OS status bar to match the navy ErpHeader. */}
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} translucent={false} />

      <ErpHeader
        title="Documents"
        subtitle="GST, bills, catalogues & price lists"
        onBack={() => navigation.goBack()}
        actions={[{
          key: 'upload',
          icon: uploading ? 'cloud-upload-outline' : 'add',
          onPress: () => setPickerOpen(true),
        }]}>
        <ErpSummaryStrip items={[
          { label: 'Total',  value: counts.total },
          { label: 'PDF',    value: counts.pdf,   color: '#FCA5A5' },
          { label: 'Images', value: counts.image, color: '#93C5FD' },
        ]} />
        <ErpSearchBox
          value={search}
          onChangeText={setSearch}
          placeholder="Search file name or type…"
        />
      </ErpHeader>

      <ErpTabs tabs={TABS} active={tab} onChange={setTab} />

      {loading && !docs.length ? (
        <ErpLoading label="Loading documents…" />
      ) : error ? (
        <ErpError message={error} onRetry={load} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(i, idx) => i._id || String(idx)}
          renderItem={renderItem}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <ErpEmpty
              icon={filtered ? 'search-outline' : 'folder-open-outline'}
              title={filtered ? 'No matches' : 'No documents yet'}
              subtitle={
                filtered
                  ? 'Try a different tab or search term.'
                  : 'Tap Upload to store a GST certificate, bill, catalogue or price list.'
              }
            />
          }
        />
      )}

      <View style={[st.fabWrap, { bottom: insets.bottom + 18 }]}>
        <ErpPrimaryAction
          label={uploading ? 'Uploading…' : 'Upload Document'}
          icon="cloud-upload-outline"
          onPress={() => setPickerOpen(true)}
          disabled={uploading}
        />
      </View>

      {/* Tag picker — the backend needs a doc_type before the file is stored. */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}>
        <View style={st.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPickerOpen(false)} />
          <View style={[st.sheet, { paddingBottom: insets.bottom + 26 }]}>
            <View style={st.sheetHandle} />
            <Text style={st.sheetTitle}>What kind of document?</Text>
            <Text style={st.sheetSub}>Pick a tag, then choose the file from your device.</Text>

            {DOC_TYPES.map(dt => (
              <TouchableOpacity key={dt} style={st.typeRow} onPress={() => uploadWith(dt)} activeOpacity={0.75}>
                <View style={st.typeIcon}>
                  <Ionicons name="document-outline" size={16} color={Colors.secondary} />
                </View>
                <Text style={st.typeText}>{dt}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={st.cancelBtn} onPress={() => setPickerOpen(false)} activeOpacity={0.85}>
              <Text style={st.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  list: { padding: 14, paddingBottom: 100 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 14, padding: 13, marginBottom: 9,
    ...Shadows.sm,
  },
  cardIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardName: { fontSize: 13.5, fontWeight: '800', color: Colors.textPrimary },
  cardTag:  { fontSize: 11, fontWeight: '600', color: Colors.primary, marginTop: 2 },
  cardMeta: { fontSize: 10.5, color: Colors.textTertiary, marginTop: 3 },
  trash: { padding: 4 },

  fabWrap: { position: 'absolute', left: 16, right: 16, bottom: 18 },

  /* Tag-picker sheet */
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 26,
  },
  sheetHandle: {
    alignSelf: 'center', width: 38, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, marginBottom: 14,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  sheetSub:   { fontSize: 12, color: Colors.textSecondary, marginTop: 3, marginBottom: 12 },
  typeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  typeIcon: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: '#F0F2F7',
    alignItems: 'center', justifyContent: 'center',
  },
  typeText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  cancelBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: '#F2F4F7' },
  cancelTxt: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
});
