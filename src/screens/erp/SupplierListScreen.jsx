/**
 * src/screens/erp/SupplierListScreen.jsx  (Retailer app)
 *
 * Supplier directory with create / edit / delete.
 *   GET    /api/retailer/erp/suppliers        (supplierController.listSuppliers)
 *   POST   /api/retailer/erp/suppliers        (createSupplier)
 *   PUT    /api/retailer/erp/suppliers/:id    (updateSupplier)
 *   DELETE /api/retailer/erp/suppliers/:id    (deleteSupplier)
 *
 * `listSuppliers` returns a BARE ARRAY (not { suppliers }), so the unwrap handles
 * both shapes defensively.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { SCREENS } from '../../constants';
import { erpApi } from '../../utils/api';
import { formatCurrency } from '../../utils/formatters';
import {
  ErpHeader, ErpSummaryStrip, ErpSearchBox, ErpCard, ErpSectionLabel, ErpField,
  ErpInput, ErpLoading, ErpError, ErpEmpty, ErpPrimaryAction, ErpInfoRow, ERP,
} from '../../components/erp';

const numOnly = v => String(v ?? '').replace(/[^0-9]/g, '');

export default function SupplierListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [suppliers,  setSuppliers]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');
  const [search,     setSearch]     = useState('');
  const [editing,    setEditing]    = useState(null);
  const [detail,     setDetail]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await erpApi.listSuppliers();
      const data = res?.data ?? res;
      setSuppliers(Array.isArray(data) ? data : data?.suppliers ?? []);
    } catch (e) {
      setError(e?.message || 'Failed to load suppliers');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.mobile || '').includes(q) ||
      (s.city || '').toLowerCase().includes(q));
  }, [suppliers, search]);

  const totalOutstanding = useMemo(
    () => suppliers.reduce((s, x) => s + (x.outstanding || 0), 0),
    [suppliers],
  );

  const confirmDelete = (sup) => {
    Alert.alert(
      'Delete supplier?',
      `${sup.name} will be removed from your directory.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await erpApi.deleteSupplier(sup._id);
              setDetail(null);
              load();
            } catch (e) {
              Alert.alert('Could not delete', e?.message || 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={st.card} onPress={() => setDetail(item)} activeOpacity={0.85}>
      <View style={st.avatar}>
        <Text style={st.avatarTxt}>
          {String(item.name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
        </Text>
      </View>
      <View style={st.cardBody}>
        <Text style={st.name} numberOfLines={1}>{item.name}</Text>
        <Text style={st.meta} numberOfLines={1}>
          {[item.mobile, item.city].filter(Boolean).join(' · ') || 'No contact details'}
        </Text>
        {item.gst_number ? <Text style={st.gst} numberOfLines={1}>GSTIN {item.gst_number}</Text> : null}
        {item.outstanding > 0 ? (
          <View style={st.dueRow}>
            <Ionicons name="alert-circle-outline" size={12} color="#DC2626" />
            <Text style={st.dueTxt}>Outstanding {formatCurrency(item.outstanding)}</Text>
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color="#B0B5C3" style={{ alignSelf: 'center' }} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader
        title="Suppliers"
        subtitle="Who you buy from"
        onBack={() => navigation.goBack()}
        actions={[{ key: 'purchase', icon: 'cart-outline', onPress: () => navigation.navigate(SCREENS.PURCHASE_LIST) }]}>
        <ErpSummaryStrip items={[
          { label: 'Suppliers',   value: suppliers.length },
          { label: 'Outstanding', value: formatCurrency(totalOutstanding), color: '#FCA5A5' },
        ]} />
        <ErpSearchBox value={search} onChangeText={setSearch} placeholder="Search name, mobile, city…" />
      </ErpHeader>

      {loading && !suppliers.length ? (
        <ErpLoading label="Loading suppliers…" />
      ) : error ? (
        <ErpError message={error} onRetry={load} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i._id}
          renderItem={renderItem}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          ListEmptyComponent={
            <ErpEmpty
              icon="people-outline"
              title={search ? 'No matches' : 'No suppliers yet'}
              subtitle={search ? 'Try a different search.' : 'Add the businesses you buy stock from.'}
            />
          }
        />
      )}

      <View style={[st.fabWrap, { bottom: 16 + insets.bottom }]}>
        <ErpPrimaryAction label="Add Supplier" onPress={() => setEditing({})} />
      </View>

      {editing ? (
        <SupplierEditor
          supplier={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      ) : null}

      {detail ? (
        <Modal visible animationType="slide" onRequestClose={() => setDetail(null)}>
          <SafeAreaView style={st.safe} edges={['top']}>
            <ErpHeader title="Supplier Detail" onBack={() => setDetail(null)} />
            <ScrollView contentContainerStyle={st.modalContent} showsVerticalScrollIndicator={false}>
              <ErpCard>
                <ErpSectionLabel>Contact</ErpSectionLabel>
                <ErpInfoRow label="Name"   value={detail.name || '—'} />
                <ErpInfoRow label="Mobile" value={detail.mobile || '—'} />
                <ErpInfoRow label="Email"  value={detail.email || '—'} />
                <ErpInfoRow label="GSTIN"  value={detail.gst_number || '—'} last />
              </ErpCard>
              <ErpCard>
                <ErpSectionLabel>Location</ErpSectionLabel>
                <ErpInfoRow label="City"    value={detail.city || '—'} />
                <ErpInfoRow label="State"   value={detail.state || '—'} />
                <ErpInfoRow label="Address" value={detail.address || '—'} last />
              </ErpCard>
              <ErpCard>
                <ErpSectionLabel>Commercials</ErpSectionLabel>
                <ErpInfoRow label="Credit days" value={`${detail.credit_days ?? 30} days`} />
                <ErpInfoRow label="Outstanding" value={formatCurrency(detail.outstanding || 0)}
                  color={detail.outstanding > 0 ? '#DC2626' : '#059669'} last />
              </ErpCard>
              <View style={st.actionRow}>
                <TouchableOpacity style={[st.actionBtn, st.editBtn]} onPress={() => { const s = detail; setDetail(null); setEditing(s); }}>
                  <Ionicons name="create-outline" size={16} color="#FFF" />
                  <Text style={st.actionTxt}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.actionBtn, st.delBtn]} onPress={() => confirmDelete(detail)}>
                  <Ionicons name="trash-outline" size={16} color={Colors.error} />
                  <Text style={[st.actionTxt, { color: Colors.error }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

/* ── Create / edit ──────────────────────────────────────────────────────── */
function SupplierEditor({ supplier, onClose, onSaved }) {
  const insets = useSafeAreaInsets();
  const isEdit = !!supplier._id;
  const [name, setName]       = useState(supplier.name || '');
  const [mobile, setMobile]   = useState(supplier.mobile || '');
  const [email, setEmail]     = useState(supplier.email || '');
  const [gst, setGst]         = useState(supplier.gst_number || '');
  const [city, setCity]       = useState(supplier.city || '');
  const [state, setState]     = useState(supplier.state || '');
  const [address, setAddress] = useState(supplier.address || '');
  const [credit, setCredit]   = useState(String(supplier.credit_days ?? 30));
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const save = async () => {
    if (!name.trim()) { setError('Supplier name is required'); return; }
    setSaving(true);
    try {
      const body = {
        name: name.trim(), mobile: mobile.trim(), email: email.trim(), gst_number: gst.trim(),
        city: city.trim(), state: state.trim(), address: address.trim(),
        credit_days: credit ? Number(credit) : 30,
      };
      if (isEdit) await erpApi.updateSupplier(supplier._id, body);
      else        await erpApi.createSupplier(body);
      onSaved();
    } catch (e) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={st.safe} edges={['top']}>
        <ErpHeader title={isEdit ? 'Edit Supplier' : 'Add Supplier'} onBack={onClose} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <ErpCard>
              <ErpSectionLabel>Contact</ErpSectionLabel>
              <ErpField label="Name" required error={error}>
                <ErpInput value={name} onChangeText={t => { setName(t); if (error) setError(''); }} placeholder="Business name" />
              </ErpField>
              <ErpField label="Mobile">
                <ErpInput value={mobile} onChangeText={setMobile} placeholder="Phone" keyboardType="phone-pad" />
              </ErpField>
              <ErpField label="Email">
                <ErpInput value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" />
              </ErpField>
              <ErpField label="GSTIN">
                <ErpInput value={gst} onChangeText={setGst} placeholder="GST number" autoCapitalize="characters" />
              </ErpField>
            </ErpCard>

            <ErpCard>
              <ErpSectionLabel>Location</ErpSectionLabel>
              <View style={st.splitRow}>
                <ErpField label="City" half>
                  <ErpInput value={city} onChangeText={setCity} placeholder="City" />
                </ErpField>
                <ErpField label="State" half>
                  <ErpInput value={state} onChangeText={setState} placeholder="State" />
                </ErpField>
              </View>
              <ErpField label="Address">
                <ErpInput value={address} onChangeText={setAddress} placeholder="Street address" multiline style={st.textarea} />
              </ErpField>
            </ErpCard>

            <ErpCard>
              <ErpSectionLabel>Terms</ErpSectionLabel>
              <ErpField label="Credit days">
                <ErpInput value={credit} onChangeText={v => setCredit(numOnly(v))} keyboardType="number-pad" placeholder="30" />
              </ErpField>
            </ErpCard>
          </ScrollView>

          {/* Pinned action bar — pad past the home indicator / Android nav bar */}
          <View style={[st.footer, { paddingBottom: insets.bottom + 16 }]}>
            <ErpPrimaryAction
              label={saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add supplier'}
              icon="checkmark"
              onPress={save}
              disabled={saving}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  list: { padding: 14, paddingBottom: 96 },
  content: { padding: 16, paddingBottom: 24 },
  footer: { padding: 16, backgroundColor: ERP.bg },
  modalContent: { padding: 16, paddingBottom: 40 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#FFF',
    borderRadius: 14, padding: 13, marginBottom: 10, ...Shadows.sm,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 13, backgroundColor: Colors.primaryBg,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  cardBody: { flex: 1, gap: 3 },
  name: { fontSize: 14, fontWeight: '800', color: ERP.text },
  meta: { fontSize: 11.5, color: ERP.muted },
  gst: { fontSize: 10.5, color: ERP.faint, letterSpacing: 0.3 },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dueTxt: { fontSize: 11, fontWeight: '700', color: '#DC2626' },

  fabWrap: { position: 'absolute', left: 16, right: 16, bottom: 16 },

  splitRow: { flexDirection: 'row', justifyContent: 'space-between' },
  textarea: { height: 72, textAlignVertical: 'top', paddingTop: 11 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 12 },
  editBtn: { backgroundColor: Colors.primary },
  delBtn: { backgroundColor: Colors.errorBg, borderWidth: 1, borderColor: '#F5C6C0' },
  actionTxt: { color: '#FFF', fontWeight: '800', fontSize: 14 },
});
