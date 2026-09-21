import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import { staffApi } from '../../utils/api';
import { SCREENS } from '../../constants';

// ─── Helper: first-letter avatar initials ────────────────────
function getInitials(name = '') {
  return name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

// ─── Module label map ─────────────────────────────────────────
const MODULE_LABELS = {
  dashboard:     'Dashboard',
  products:      'Products',
  enquiries:     'Enquiries',
  orders:        'Orders',
  invoices:      'Invoices',
  customers:     'Customers',
  notifications: 'Notifications',
  reports:       'Reports',
};

// ─── Single staff card ────────────────────────────────────────
function StaffCard({ item, onEdit, onToggle, onDelete }) {
  const access = item.staff_app_access || [];
  const bd     = item.salary_breakdown || {};

  return (
    <View style={st.card}>
      {/* Top row */}
      <View style={st.cardTop}>
        <View style={[st.avatar, !item.is_active && st.avatarInactive]}>
          <Text style={st.avatarTxt}>{getInitials(item.name)}</Text>
        </View>

        <View style={st.cardMeta}>
          <View style={st.nameRow}>
            <Text style={st.staffName} numberOfLines={1}>{item.name}</Text>
            <View style={[st.statusBadge, item.is_active ? st.badgeActive : st.badgeInactive]}>
              <Text style={[st.statusBadgeTxt, item.is_active ? st.badgeActiveTxt : st.badgeInactiveTxt]}>
                {item.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>

          <View style={st.metaRow}>
            <Ionicons name="call-outline" size={12} color={Colors.textTertiary} />
            <Text style={st.metaTxt}>{item.mobile}</Text>
          </View>

          {!!item.email && (
            <View style={st.metaRow}>
              <Ionicons name="mail-outline" size={12} color={Colors.textTertiary} />
              <Text style={st.metaTxt} numberOfLines={1}>{item.email}</Text>
            </View>
          )}

          {!!item.designation && (
            <View style={st.metaRow}>
              <Ionicons name="briefcase-outline" size={12} color={Colors.textTertiary} />
              <Text style={st.metaTxt}>{item.designation}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Salary info */}
      {(bd.fixed_salary > 0 || bd.incentive_type !== 'none' || bd.sales_percentage > 0) && (
        <View style={st.salaryRow}>
          {bd.fixed_salary > 0 && (
            <View style={st.salaryChip}>
              <Ionicons name="wallet-outline" size={11} color="#27AE60" />
              <Text style={[st.salaryChipTxt, { color: '#27AE60' }]}>₹{bd.fixed_salary}/mo</Text>
            </View>
          )}
          {bd.incentive_type !== 'none' && bd.incentive_value > 0 && (
            <View style={st.salaryChip}>
              <Ionicons name="trending-up-outline" size={11} color="#8E44AD" />
              <Text style={[st.salaryChipTxt, { color: '#8E44AD' }]}>
                {bd.incentive_type === 'percentage' ? `${bd.incentive_value}% bonus` : `₹${bd.incentive_value} bonus`}
              </Text>
            </View>
          )}
          {bd.sales_percentage > 0 && (
            <View style={st.salaryChip}>
              <Ionicons name="pricetag-outline" size={11} color="#F39C12" />
              <Text style={[st.salaryChipTxt, { color: '#F39C12' }]}>{bd.sales_percentage}% commission</Text>
            </View>
          )}
          {bd.discount_access && (
            <View style={st.salaryChip}>
              <Ionicons name="cut-outline" size={11} color={Colors.primary} />
              <Text style={[st.salaryChipTxt, { color: Colors.primary }]}>
                Discount{bd.max_discount_percent > 0 ? ` ≤${bd.max_discount_percent}%` : ''}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Module access pills */}
      {access.length > 0 && (
        <View style={st.modulesRow}>
          {access.map(m => (
            <View key={m} style={st.modulePill}>
              <Text style={st.modulePillTxt}>{MODULE_LABELS[m] || m}</Text>
            </View>
          ))}
        </View>
      )}
      {access.length === 0 && (
        <Text style={st.fullAccessTxt}>
          <Ionicons name="shield-checkmark-outline" size={11} color={Colors.success} /> Full access (all modules)
        </Text>
      )}

      {/* Actions */}
      <View style={st.cardActions}>
        <TouchableOpacity style={st.actionBtn} onPress={() => onEdit(item)}>
          <Ionicons name="create-outline" size={16} color={Colors.secondary} />
          <Text style={[st.actionTxt, { color: Colors.secondary }]}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity style={st.actionBtn} onPress={() => onToggle(item)}>
          <Ionicons
            name={item.is_active ? 'pause-circle-outline' : 'play-circle-outline'}
            size={16}
            color={item.is_active ? Colors.warning : Colors.success}
          />
          <Text style={[st.actionTxt, { color: item.is_active ? Colors.warning : Colors.success }]}>
            {item.is_active ? 'Deactivate' : 'Activate'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={st.actionBtn} onPress={() => onDelete(item)}>
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
          <Text style={[st.actionTxt, { color: Colors.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────
export default function StaffListScreen({ navigation }) {
  const [staff, setStaff]           = useState([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]     = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await staffApi.list({ limit: 200 });
      setStaff(data?.staff || []);
    } catch (err) {
      setError(err.message || 'Could not load staff.');
    }
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]);

  // Refresh when returning from AddEdit screen
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      load();
    });
    return unsub;
  }, [navigation, load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleToggle = async (item) => {
    try {
      await staffApi.toggle(item._id);
      setStaff(prev =>
        prev.map(s => s._id === item._id ? { ...s, is_active: !s.is_active } : s)
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not update status.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await staffApi.remove(deleteTarget._id);
      setStaff(prev => prev.filter(s => s._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not delete staff member.');
    } finally {
      setDeleting(false);
    }
  };

  // Client-side search
  const q = search.trim().toLowerCase();
  const visible = q
    ? staff.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.mobile || '').includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.designation || '').toLowerCase().includes(q)
      )
    : staff;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.secondary} />

      {/* Header */}
      <View style={st.header}>
        <View style={st.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Ionicons name="people-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={st.headerTitle}>My Staff</Text>
        </View>
        <View style={st.headerRight}>
          <Text style={st.headerCount}>{staff.length} members</Text>
          <TouchableOpacity
            style={st.addBtn}
            onPress={() => navigation.navigate(SCREENS.STAFF_ADD_EDIT)}
          >
            <Ionicons name="person-add-outline" size={16} color="#FFF" />
            <Text style={st.addBtnTxt}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={st.searchWrap}>
        <View style={st.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
          <TextInput
            style={st.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, mobile, role…"
            placeholderTextColor={Colors.textTertiary}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={st.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={st.loadingTxt}>Loading staff…</Text>
        </View>
      ) : error ? (
        <View style={st.center}>
          <Ionicons name="cloud-offline-outline" size={44} color={Colors.textTertiary} />
          <Text style={st.errorTxt}>{error}</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={st.retryTxt}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      ) : visible.length === 0 ? (
        <View style={st.center}>
          <Ionicons name="people-outline" size={52} color={Colors.border} />
          <Text style={st.emptyTitle}>{q ? 'No matches' : 'No Staff Added'}</Text>
          <Text style={st.emptyMsg}>
            {q
              ? `No staff match "${search.trim()}"`
              : 'Add your first staff member to get started.'}
          </Text>
          {!q && (
            <TouchableOpacity
              style={st.emptyAddBtn}
              onPress={() => navigation.navigate(SCREENS.STAFF_ADD_EDIT)}
            >
              <Ionicons name="person-add-outline" size={16} color="#FFF" />
              <Text style={st.emptyAddBtnTxt}>Add Staff</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={i => i._id}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          renderItem={({ item }) => (
            <StaffCard
              item={item}
              onEdit={s => navigation.navigate(SCREENS.STAFF_ADD_EDIT, { staff: s })}
              onToggle={handleToggle}
              onDelete={s => setDeleteTarget(s)}
            />
          )}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmationModal
        visible={!!deleteTarget}
        title="Delete Staff"
        message={`Remove ${deleteTarget?.name} from your staff list? This cannot be undone.`}
        confirmTitle={deleting ? 'Deleting…' : 'DELETE'}
        cancelTitle="CANCEL"
        confirmVariant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const st = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.background },

  // Header
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.secondary, paddingHorizontal: 16, paddingVertical: 12 },
  headerLeft:   { flexDirection: 'row', alignItems: 'center' },
  backBtn:      { marginRight: 8 },
  headerTitle:  { fontSize: 18, fontWeight: '800', color: '#FFF' },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerCount:  { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnTxt:    { fontSize: 13, fontWeight: '700', color: '#FFF' },

  // Search
  searchWrap:   { backgroundColor: Colors.white, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  searchBar:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 42 },
  searchInput:  { flex: 1, fontSize: 14, color: Colors.textPrimary, paddingVertical: 0 },

  // List
  list:         { padding: 16, paddingBottom: 100 },

  // Card
  card:         { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 12, ...Shadows.sm, borderLeftWidth: 3, borderLeftColor: Colors.primary },
  cardTop:      { flexDirection: 'row', gap: 12, marginBottom: 10 },
  avatar:       { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarInactive: { backgroundColor: Colors.border },
  avatarTxt:    { fontSize: 17, fontWeight: '800', color: '#FFF' },
  cardMeta:     { flex: 1 },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  staffName:    { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  statusBadge:  { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeActive:  { backgroundColor: Colors.successBg },
  badgeInactive:{ backgroundColor: Colors.errorBg },
  badgeActiveTxt:  { fontSize: 10, fontWeight: '700', color: Colors.successText },
  badgeInactiveTxt:{ fontSize: 10, fontWeight: '700', color: Colors.errorText },
  metaRow:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  metaTxt:      { fontSize: 12, color: Colors.textSecondary, flex: 1 },

  // Salary chips
  salaryRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  salaryChip:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.borderLight },
  salaryChipTxt:{ fontSize: 11, fontWeight: '600' },

  // Module pills
  modulesRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10 },
  modulePill:   { backgroundColor: Colors.secondaryBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  modulePillTxt:{ fontSize: 10, fontWeight: '600', color: Colors.secondary },
  fullAccessTxt:{ fontSize: 11, color: Colors.success, marginBottom: 10 },

  // Card action buttons
  cardActions:  { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 10, gap: 4 },
  actionBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.background },
  actionTxt:    { fontSize: 12, fontWeight: '600' },

  // States
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  loadingTxt:   { fontSize: 13, color: Colors.textSecondary },
  errorTxt:     { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  retryTxt:     { fontSize: 13, fontWeight: '700', color: Colors.primary },
  emptyTitle:   { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  emptyMsg:     { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  emptyAddBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 22, paddingHorizontal: 20, paddingVertical: 10, marginTop: 6 },
  emptyAddBtnTxt: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
