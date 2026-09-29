/**
 * src/screens/erp/LeadListScreen.jsx  (Retailer app)
 *
 * CRM lead pipeline with create / edit / convert / delete / follow-up.
 * Visual parity with the wholesaler's leads screen:
 *   - navy header with a "+" add action
 *   - horizontal pill status tabs
 *   - flat white cards: name + colored badge, sub line, notes, action row
 *     (Edit · Follow-up · Convert)
 *   - bottom-right pill FAB "+ Add Lead"
 *   - bottom-sheet add/edit form (with status chips + delete) and a follow-up sheet
 *
 * Backend (retailer ERP):
 *   GET    /api/retailer/erp/leads            (leadController.listLeads)
 *   POST   /api/retailer/erp/leads            (createLead — name + mobile required)
 *   PUT    /api/retailer/erp/leads/:id        (updateLead)
 *   PATCH  /api/retailer/erp/leads/:id/convert(convertLead → creates a Customer)
 *   DELETE /api/retailer/erp/leads/:id        (deleteLead)
 *   POST   /api/retailer/erp/followups        (createFollowup — followup_date required)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl,
  ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { erpApi } from '../../utils/api';
import {
  ErpHeader, ErpTabs, ErpField, ErpInput, ErpLoading, ErpEmpty,
} from '../../components/erp';

// Mirrors models/CRM Management/Lead.js → LEAD_STATUSES, which is kept in sync
// with the wholesaler's leads screen (same 5 stages).
const LEAD_STATUSES = [
  'New', 'Follow-up', 'Interested', 'Not Interested', 'Converted',
];
const TABS = ['All', ...LEAD_STATUSES];

// Colors match the wholesaler's STATUS_COLOR exactly.
const STATUS_META = {
  'New':            { bg: '#EFF6FF', color: '#2563EB' },
  'Follow-up':      { bg: '#FFF7ED', color: '#D97706' },
  'Interested':     { bg: '#F5F3FF', color: '#7C3AED' },
  'Converted':      { bg: '#ECFDF5', color: '#059669' },
  'Not Interested': { bg: '#F3F4F6', color: '#6B7280' },
};
const metaOf = s => STATUS_META[s] || STATUS_META.New;

// Mirrors the wholesaler's lead SOURCES exactly (6 options, no "None").
const SOURCES = ['Website', 'WhatsApp', 'Facebook', 'Instagram', 'Google Ads', 'Referral'];
const EMPTY = { name: '', mobile: '', email: '', source: 'Website', status: 'New', notes: '' };

const NAVY = Colors.secondary;     // navy header, matches ErpHeader / wholesaler
const ORANGE = Colors.primary;     // brand orange FAB + save (wholesaler uses orange accent)
const FOLLOWUP = '#D97706';        // amber, matches wholesaler Follow-up action
const CONVERT = '#059669';         // green, matches wholesaler Convert action

export default function LeadListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [leads,      setLeads]      = useState([]);
  const [status,     setStatus]     = useState('All');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  // Add / edit lead sheet
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(EMPTY);
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState('');

  // Follow-up sheet
  const [fuLead,   setFuLead]   = useState(null);
  const [fuDate,   setFuDate]   = useState('');
  const [fuNote,   setFuNote]   = useState('');
  const [fuSaving, setFuSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await erpApi.listLeads({ limit: 200 });
      const data = res?.data ?? res;
      setLeads(Array.isArray(data) ? data : data?.leads ?? []);
    } catch (e) {
      setError(e?.message || 'Failed to load leads');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = leads.filter(l => (status === 'All' ? true : l.status === status));

  const openAdd = () => {
    setEditing(null); setForm(EMPTY); setFormError(''); setShowForm(true);
  };
  const openEdit = (l) => {
    setEditing(l);
    setForm({
      name:   l.name || '',
      mobile: l.mobile || '',
      email:  l.email || '',
      source: l.source || '',
      status: l.status || 'New',
      notes:  l.notes || '',
    });
    setFormError(''); setShowForm(true);
  };

  const saveLead = async () => {
    if (!form.name.trim()) { setFormError('Lead name is required'); return; }
    if (!form.mobile.trim()) { setFormError('Mobile number is required'); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(), mobile: form.mobile.trim(), email: form.email.trim(),
        source: form.source, status: form.status, notes: form.notes.trim(),
      };
      if (editing) await erpApi.updateLead(editing._id, body);
      else         await erpApi.createLead(body);
      setShowForm(false);
      load();
    } catch (e) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const convert = (l) => {
    Alert.alert(
      'Convert to customer?',
      `${l.name} will be added to your customer directory and marked Converted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Convert',
          onPress: async () => {
            try {
              await erpApi.convertLead(l._id, {});
              load();
              Alert.alert('Converted', `${l.name} is now a customer.`);
            } catch (e) {
              Alert.alert('Could not convert', e?.message || 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const confirmDelete = (l) => {
    Alert.alert(
      'Delete lead?',
      `${l.name} will be removed permanently.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await erpApi.deleteLead(l._id);
              setShowForm(false);
              load();
            } catch (e) {
              Alert.alert('Could not delete', e?.message || 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const openFollowup = (l) => {
    setFuLead(l);
    setFuDate(new Date().toISOString().slice(0, 10)); // default to today
    setFuNote('');
  };

  const saveFollowup = async () => {
    if (!fuDate.trim()) { Alert.alert('Required', 'Pick a follow-up date.'); return; }
    setFuSaving(true);
    try {
      await erpApi.createFollowup({ lead_id: fuLead._id, followup_date: fuDate, notes: fuNote.trim() });
      // Nudge the lead to the Follow-up stage, like the wholesaler does.
      await erpApi.updateLead(fuLead._id, { status: 'Follow-up' }).catch(() => {});
      setFuLead(null);
      load();
      Alert.alert('Scheduled', `${fuLead.name}'s follow-up is set for ${fuDate}.`);
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Could not schedule follow-up.');
    } finally {
      setFuSaving(false);
    }
  };

  const renderItem = ({ item }) => {
    const m = metaOf(item.status);
    return (
      <View style={st.card}>
        <View style={st.cardTop}>
          <Text style={st.leadName} numberOfLines={1}>{item.name}</Text>
          <View style={[st.badge, { backgroundColor: m.bg }]}>
            <Text style={[st.badgeText, { color: m.color }]}>{item.status}</Text>
          </View>
        </View>
        <Text style={st.leadSub}>
          {item.mobile || '—'}{item.source ? `  •  ${item.source}` : ''}
        </Text>
        {item.notes ? <Text style={st.leadNotes} numberOfLines={2}>{item.notes}</Text> : null}
        <View style={st.actions}>
          <TouchableOpacity style={st.actBtn} onPress={() => openEdit(item)} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={15} color={ORANGE} />
            <Text style={[st.actText, { color: ORANGE }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.actBtn} onPress={() => openFollowup(item)} activeOpacity={0.7}>
            <Ionicons name="calendar-outline" size={15} color={FOLLOWUP} />
            <Text style={[st.actText, { color: FOLLOWUP }]}>Follow-up</Text>
          </TouchableOpacity>
          {item.status !== 'Converted' ? (
            <TouchableOpacity style={st.actBtn} onPress={() => convert(item)} activeOpacity={0.7}>
              <Ionicons name="person-add-outline" size={15} color={CONVERT} />
              <Text style={[st.actText, { color: CONVERT }]}>Convert</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={st.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ErpHeader
        title="Leads"
        onBack={() => navigation.goBack()}
        actions={[{ key: 'add', icon: 'add-outline', onPress: openAdd }]}
      />

      <ErpTabs tabs={TABS} active={status} onChange={setStatus} />

      {loading ? (
        <ErpLoading label="Loading leads…" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i._id}
          renderItem={renderItem}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ORANGE]} />}
          ListEmptyComponent={
            <ErpEmpty
              icon="funnel-outline"
              title={error || (status !== 'All' ? 'No leads in this stage' : 'No leads yet')}
              subtitle={status !== 'All' ? 'Try another stage.' : 'Tap + to capture a prospect.'}
            />
          }
        />
      )}

      <TouchableOpacity style={[st.fab, { bottom: 20 + insets.bottom }]} onPress={openAdd} activeOpacity={0.85}>
        <Text style={st.fabText}>+  Add Lead</Text>
      </TouchableOpacity>

      {/* Add / edit lead sheet */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={st.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={() => setShowForm(false)} />
          <View style={[st.sheet, { maxHeight: '88%', paddingBottom: insets.bottom + 20 }]}>
            <View style={st.sheetHandle} />
            <View style={st.sheetHead}>
              <Text style={st.sheetTitle}>{editing ? 'Edit Lead' : 'New Lead'}</Text>
              <TouchableOpacity onPress={() => setShowForm(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-outline" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <ErpField label="Name *" required error={formError}>
                <ErpInput
                  value={form.name}
                  onChangeText={t => { setForm(f => ({ ...f, name: t })); if (formError) setFormError(''); }}
                  placeholder="Lead name"
                />
              </ErpField>
              <ErpField label="Mobile *">
                <ErpInput
                  value={form.mobile}
                  onChangeText={t => { setForm(f => ({ ...f, mobile: t })); if (formError) setFormError(''); }}
                  placeholder="Phone"
                  keyboardType="phone-pad"
                />
              </ErpField>
              <ErpField label="Email">
                <ErpInput
                  value={form.email}
                  onChangeText={t => setForm(f => ({ ...f, email: t }))}
                  placeholder="Optional"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </ErpField>

              <Text style={st.pickLabel}>Lead Source</Text>
              <View style={st.chipWrap}>
                {SOURCES.map(s => {
                  const on = form.source === s;
                  return (
                    <TouchableOpacity key={s || 'none'} style={[st.chip, on && st.chipOn]} onPress={() => setForm(f => ({ ...f, source: s }))} activeOpacity={0.8}>
                      <Text style={[st.chipText, on && st.chipTextOn]}>{s || 'None'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={st.pickLabel}>Status</Text>
              <View style={st.chipWrap}>
                {LEAD_STATUSES.map(s => {
                  const on = form.status === s;
                  return (
                    <TouchableOpacity key={s} style={[st.chip, on && st.chipOn]} onPress={() => setForm(f => ({ ...f, status: s }))} activeOpacity={0.8}>
                      <Text style={[st.chipText, on && st.chipTextOn]}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <ErpField label="Notes">
                <ErpInput
                  value={form.notes}
                  onChangeText={t => setForm(f => ({ ...f, notes: t }))}
                  placeholder="Any detail…"
                  multiline
                  style={st.textarea}
                />
              </ErpField>

              <TouchableOpacity style={[st.saveBtn, saving && st.btnBusy]} onPress={saveLead} disabled={saving} activeOpacity={0.85}>
                <Ionicons name="checkmark" size={17} color="#FFF" />
                <Text style={st.saveBtnText}>{saving ? 'Saving…' : (editing ? 'Save Changes' : 'Add Lead')}</Text>
              </TouchableOpacity>

              {editing ? (
                <TouchableOpacity style={st.delBtn} onPress={() => confirmDelete(editing)} activeOpacity={0.85}>
                  <Ionicons name="trash-outline" size={15} color={Colors.error} />
                  <Text style={st.delBtnText}>Delete Lead</Text>
                </TouchableOpacity>
              ) : null}

              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Follow-up sheet */}
      <Modal visible={!!fuLead} animationType="slide" transparent onRequestClose={() => setFuLead(null)}>
        <KeyboardAvoidingView style={st.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={() => setFuLead(null)} />
          <View style={[st.sheet, { maxHeight: '88%', paddingBottom: insets.bottom + 22 }]}>
            <View style={st.sheetHandle} />
            <View style={st.sheetHead}>
              <Text style={st.sheetTitle}>Schedule Follow-up</Text>
              <TouchableOpacity onPress={() => setFuLead(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-outline" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={st.fuFor}>For: {fuLead?.name}</Text>

            <View style={st.dateRow}>
              <View style={{ flex: 1 }}>
                <ErpField label="Follow-up Date *">
                  <ErpInput
                    value={fuDate}
                    onChangeText={t => setFuDate(t.replace(/[^0-9-]/g, ''))}
                    placeholder="YYYY-MM-DD"
                    maxLength={10}
                  />
                </ErpField>
              </View>
              <TouchableOpacity style={st.todayBtn} onPress={() => setFuDate(new Date().toISOString().slice(0, 10))} activeOpacity={0.85}>
                <Text style={st.todayBtnTxt}>Today</Text>
              </TouchableOpacity>
            </View>

            <ErpField label="Notes">
              <ErpInput
                value={fuNote}
                onChangeText={setFuNote}
                placeholder="Call about pricing…"
                multiline
                style={st.textarea}
              />
            </ErpField>

            <TouchableOpacity style={[st.saveBtn, fuSaving && st.btnBusy]} onPress={saveFollowup} disabled={fuSaving} activeOpacity={0.85}>
              <Ionicons name="calendar-outline" size={17} color="#FFF" />
              <Text style={st.saveBtnText}>{fuSaving ? 'Scheduling…' : 'Schedule Follow-up'}</Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// Light shadow for the FAB (avoids importing Shadows just for one element).
const StyleShadow = {
  shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5,
  elevation: 5,
};

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  list: { padding: 12, paddingBottom: 96 },

  // Card (flat, matches the wholesaler)
  card: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leadName: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  leadSub: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 4 },
  leadNotes: { fontSize: 12, color: Colors.textPrimary, marginTop: 6 },
  actions: {
    flexDirection: 'row', gap: 18, marginTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10,
  },
  actBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actText: { fontSize: 12, fontWeight: '700' },

  // Pill FAB (matches the wholesaler)
  fab: {
    position: 'absolute', right: 16, backgroundColor: ORANGE,
    borderRadius: 26, paddingHorizontal: 20, paddingVertical: 14, ...StyleShadow,
  },
  fabText: { color: '#FFF', fontWeight: '800', fontSize: 14 },

  // Bottom sheets
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 16, paddingTop: 8,
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  fuFor: { fontSize: 13, color: Colors.textSecondary, marginBottom: 12 },

  pickLabel: { fontSize: 12.5, fontWeight: '700', color: Colors.textSecondary, marginTop: 8, marginBottom: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: '#FFF',
  },
  chipOn: { backgroundColor: Colors.primaryBg, borderColor: ORANGE },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  chipTextOn: { color: ORANGE },

  dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  todayBtn: {
    backgroundColor: Colors.primaryBg, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 12, borderWidth: 1, borderColor: ORANGE, marginBottom: 2,
  },
  todayBtnTxt: { color: ORANGE, fontWeight: '800', fontSize: 13 },

  textarea: { height: 88, textAlignVertical: 'top', paddingTop: 11 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ORANGE, borderRadius: 12, paddingVertical: 14, marginTop: 8,
  },
  saveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  btnBusy: { opacity: 0.6 },

  delBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: Colors.errorBg, borderWidth: 1, borderColor: '#F5C6C0',
    borderRadius: 12, paddingVertical: 13, marginTop: 12,
  },
  delBtnText: { color: Colors.error, fontWeight: '800', fontSize: 14 },
});
