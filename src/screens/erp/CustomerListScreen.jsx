/**
 * src/screens/erp/CustomerListScreen.jsx  (Retailer app)
 *
 * Customer directory — visual parity with the wholesaler's customer screen:
 *   - search box
 *   - flat white cards: name + "mobile • city" + an Outstanding figure (right)
 *   - bottom-right pill FAB "+ Add Customer"
 *   - add/edit sheet (Name, Mobile, Email, GSTIN, Address, City, State, Pincode)
 *   - detail view with the Outstanding balance, contact info and a ledger link
 *
 *   GET    /api/retailer/erp/erp-customers        (customerController.listCustomers)
 *   POST   /api/retailer/erp/erp-customers        (createCustomer)
 *   PUT    /api/retailer/erp/erp-customers/:id    (updateCustomer)
 *   DELETE /api/retailer/erp/erp-customers/:id    (deleteCustomer)
 *
 * `listCustomers` now attaches `outstanding` per customer (mirrors getCustomer),
 * so the card shows the same figure the wholesaler UI expects.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl,
  ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { SCREENS } from '../../constants';
import { erpApi } from '../../utils/api';
import { formatCurrency } from '../../utils/formatters';
import {
  ErpHeader, ErpSearchBox, ErpCard, ErpSectionLabel, ErpField, ErpInput,
  ErpInfoRow, ErpLoading, ErpError, ErpEmpty, ErpPrimaryAction, ERP,
} from '../../components/erp';

const numOnly = v => String(v ?? '').replace(/[^0-9]/g, '');

export default function CustomerListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [customers,  setCustomers]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');
  const [search,     setSearch]     = useState('');
  const [editing,    setEditing]    = useState(null);
  const [detail,     setDetail]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await erpApi.listErpCustomers({ limit: 200 });
      const data = res?.data ?? res;
      setCustomers(Array.isArray(data) ? data : data?.customers ?? []);
    } catch (e) {
      setError(e?.message || 'Failed to load customers');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter(c => {
      if (!q) return true;
      return (c.name || '').toLowerCase().includes(q) ||
             (c.mobile || '').includes(q) ||
             (c.city || '').toLowerCase().includes(q) ||
             (c.gst_number || '').toLowerCase().includes(q);
    });
  }, [customers, search]);

  const openLedger = (c) => {
    setDetail(null);
    navigation.navigate(SCREENS.CUSTOMER_LEDGER, {
      partyId: c._id, partyName: c.name, kind: 'customer',
    });
  };

  const confirmDelete = (cust) => {
    Alert.alert(
      'Delete customer?',
      `${cust.name} will be removed from your directory.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await erpApi.deleteErpCustomer(cust._id);
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

  const renderItem = ({ item }) => {
    const out = item.outstanding || 0;
    const outColor = out > 0 ? Colors.error : Colors.success;
    return (
      <TouchableOpacity style={st.card} onPress={() => setDetail(item)} activeOpacity={0.85}>
        <View style={st.cardBody}>
          <Text style={st.name} numberOfLines={1}>{item.name}</Text>
          <Text style={st.meta} numberOfLines={1}>
            {[item.mobile, item.city].filter(Boolean).join(' · ') || 'No contact details'}
          </Text>
        </View>
        <View style={st.outstanding}>
          <Text style={[st.amount, { color: outColor }]}>{formatCurrency(out)}</Text>
          <Text style={st.outLabel}>Outstanding</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={st.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />

      <ErpHeader
        title="Customers"
        onBack={() => navigation.goBack()}
        actions={[{ key: 'add', icon: 'add-outline', onPress: () => setEditing({}) }]}
      />

      <ErpSearchBox value={search} onChangeText={setSearch} placeholder="Search name, mobile, city…" />

      {loading && !customers.length ? (
        <ErpLoading label="Loading customers…" />
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
              icon="person-add-outline"
              title={search ? 'No matches' : 'No customers yet'}
              subtitle={search ? 'Try a different search.' : 'Add the businesses you sell to.'}
            />
          }
        />
      )}

      <TouchableOpacity style={[st.fab, { bottom: 20 + insets.bottom }]} onPress={() => setEditing({})} activeOpacity={0.85}>
        <Text style={st.fabText}>+  Add Customer</Text>
      </TouchableOpacity>

      {editing ? (
        <CustomerEditor
          customer={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      ) : null}

      {detail ? (
        <Modal visible animationType="slide" onRequestClose={() => setDetail(null)}>
          <SafeAreaView style={st.safe} edges={['top']}>
            <ErpHeader title="Customer" onBack={() => setDetail(null)} />
            <ScrollView contentContainerStyle={[st.modalContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
              <View style={st.avatarBox}>
                <View style={st.avatar}>
                  <Text style={st.avatarText}>{(detail.name || 'C')[0].toUpperCase()}</Text>
                </View>
                <Text style={st.dName}>{detail.name}</Text>
                <Text style={st.dMobile}>{detail.mobile || '—'}</Text>
              </View>

              <View style={[st.outBox, { borderColor: (detail.outstanding || 0) > 0 ? Colors.error : Colors.success }]}>
                <Text style={st.outLabel2}>Outstanding Balance</Text>
                <Text style={[st.outAmt, { color: (detail.outstanding || 0) > 0 ? Colors.error : Colors.success }]}>
                  {formatCurrency(detail.outstanding || 0)}
                </Text>
              </View>

              <ErpCard>
                <ErpSectionLabel>Contact</ErpSectionLabel>
                <ErpInfoRow label="Email"  value={detail.email || '—'} />
                <ErpInfoRow label="City"   value={detail.city || '—'} />
                <ErpInfoRow label="State"  value={detail.state || '—'} />
                <ErpInfoRow label="GSTIN"  value={detail.gst_number || '—'} last />
              </ErpCard>

              <TouchableOpacity style={st.ledgerBtn} onPress={() => openLedger(detail)} activeOpacity={0.88}>
                <Ionicons name="book-outline" size={17} color={Colors.primary} />
                <Text style={st.ledgerTxt}>View ledger</Text>
              </TouchableOpacity>

              <View style={st.actionRow}>
                <TouchableOpacity style={[st.actionBtn, st.editBtn]} onPress={() => { const c = detail; setDetail(null); setEditing(c); }}>
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
function CustomerEditor({ customer, onClose, onSaved }) {
  const insets = useSafeAreaInsets();
  const isEdit = !!customer._id;
  const [name, setName]       = useState(customer.name || '');
  const [mobile, setMobile]   = useState(customer.mobile || '');
  const [email, setEmail]     = useState(customer.email || '');
  const [gst, setGst]         = useState(customer.gst_number || '');
  const [city, setCity]       = useState(customer.city || '');
  const [state, setState]     = useState(customer.state || '');
  const [pincode, setPincode] = useState(customer.pincode || '');
  const [address, setAddress] = useState(customer.address || '');
  const [saving, setSaving]   = useState(false);
  const [errField, setErrField] = useState('');
  const [error, setError]     = useState('');

  const fail = (f, m) => { setErrField(f); setError(m); };
  const clear = () => { if (error) { setError(''); setErrField(''); } };

  const save = async () => {
    if (!name.trim())   { fail('name', 'Customer name is required'); return; }
    if (!mobile.trim()) { fail('mobile', 'Mobile number is required'); return; }
    setSaving(true);
    try {
      const body = {
        name: name.trim(), mobile: mobile.trim(), email: email.trim(), gst_number: gst.trim(),
        city: city.trim(), state: state.trim(), pincode: pincode.trim(), address: address.trim(),
      };
      if (isEdit) await erpApi.updateErpCustomer(customer._id, body);
      else        await erpApi.createErpCustomer(body);
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
        <ErpHeader title={isEdit ? 'Edit Customer' : 'Add Customer'} onBack={onClose} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <ErpCard>
              <ErpSectionLabel>Contact</ErpSectionLabel>
              <ErpField label="Name" required error={errField === 'name' ? error : ''}>
                <ErpInput value={name} onChangeText={t => { setName(t); clear(); }} placeholder="Business name" />
              </ErpField>
              <ErpField label="Mobile" required error={errField === 'mobile' ? error : ''}>
                <ErpInput value={mobile} onChangeText={t => { setMobile(t); clear(); }} placeholder="Phone" keyboardType="phone-pad" />
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
              <ErpField label="Pincode">
                <ErpInput value={pincode} onChangeText={v => setPincode(numOnly(v))} keyboardType="number-pad" placeholder="Pincode" />
              </ErpField>
              <ErpField label="Address">
                <ErpInput value={address} onChangeText={setAddress} placeholder="Street address" multiline style={st.textarea} />
              </ErpField>
            </ErpCard>
          </ScrollView>

          <View style={[st.footer, { paddingBottom: insets.bottom + 16 }]}>
            <ErpPrimaryAction
              label={saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add customer'}
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
  list: { padding: 12, paddingBottom: 96 },
  content: { padding: 16, paddingBottom: 24 },
  footer: { padding: 16, backgroundColor: ERP.bg },
  modalContent: { padding: 16, paddingBottom: 40 },

  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: ERP.border,
  },
  cardBody: { flex: 1, marginRight: 10 },
  name: { fontSize: 15, fontWeight: '800', color: ERP.text },
  meta: { fontSize: 12.5, color: ERP.muted, marginTop: 2 },
  outstanding: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontWeight: '800' },
  outLabel: { fontSize: 11, color: ERP.muted, marginTop: 1 },

  fab: {
    position: 'absolute', right: 16, backgroundColor: Colors.primary,
    borderRadius: 26, paddingHorizontal: 20, paddingVertical: 14,
    shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6, elevation: 4,
  },
  fabText: { color: '#FFF', fontWeight: '800', fontSize: 14 },

  avatarBox: { alignItems: 'center', marginBottom: 14 },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  avatarText: { fontSize: 30, color: '#FFF', fontWeight: '800' },
  dName: { fontSize: 20, fontWeight: '800', color: ERP.text },
  dMobile: { fontSize: 14, color: ERP.muted, marginTop: 2 },

  outBox: { borderWidth: 2, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  outLabel2: { fontSize: 12, color: ERP.muted },
  outAmt: { fontSize: 26, fontWeight: '800', marginTop: 2 },

  splitRow: { flexDirection: 'row', justifyContent: 'space-between' },
  textarea: { height: 72, textAlignVertical: 'top', paddingTop: 11 },

  ledgerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primaryBg, borderRadius: 12, paddingVertical: 13, marginBottom: 10,
  },
  ledgerTxt: { color: Colors.primary, fontWeight: '800', fontSize: 14 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 12 },
  editBtn: { backgroundColor: Colors.primary },
  delBtn: { backgroundColor: Colors.errorBg, borderWidth: 1, borderColor: '#F5C6C0' },
  actionTxt: { color: '#FFF', fontWeight: '800', fontSize: 14 },
});
