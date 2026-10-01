/**
 * src/screens/profile/ProfileScreen.jsx  (Retailer app)
 *
 * Rebuilt 2026-09-30 to mirror the wholesaler's `settings/ProfileScreen.jsx`
 * section-for-section:
 *
 *   header (avatar ring · name · role badge · mobile/email · company · Edit Profile)
 *     → inline edit form (Full Name / Mobile read-only / Email)
 *     → Subscription badge ("Current Plan" + Upgrade)
 *     → 4 grouped menu sections
 *     → Logout button
 *
 * Two differences, both forced by the platform rather than chosen:
 *
 *  1. TITLE. The wholesaler's screen is a STACK screen pushed from its More menu,
 *     so the navigator renders a native navy header ("My Profile") directly above
 *     this screen's own navy header block. Here the screen is the `Profile` BOTTOM
 *     TAB root (`AppNavigator.jsx` → `<Tab.Screen name={SCREENS.PROFILE}>`) with
 *     `headerShown: false`, so the title is drawn inside the header block instead.
 *     Same visual result; no back button, because a tab root has nowhere to go back to.
 *
 *  2. "FOLLOW-UPS" IS OMITTED. It is the only wholesaler row with no retailer
 *     target: the wholesaler points it at `CustomerHistory`, a *per-customer*
 *     screen that destructures `route.params.customerId` — and its own Profile row
 *     passes no params, so that row throws in the wholesaler app too. The retailer
 *     has no customer-history screen at all. Wiring it to nothing would just move
 *     the crash here, so the row is dropped. (Reported, not fixed in the
 *     wholesaler — that app is read-only.)
 *
 * Everything else is 1:1, with route names taken from this app's `SCREENS` and the
 * styling expressed in this app's tokens (Colors / Shadows / Ionicons). The
 * wholesaler's `theme.colors.*` and MaterialCommunityIcons are NOT copied — see
 * SKILL.md → "Parity work: what 'make it exactly like the wholesaler' actually means".
 */
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import TextInput from '../../components/common/TextInput';
import PrimaryButton from '../../components/common/PrimaryButton';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import { useAuth } from '../../context/AuthContext';
import { profileService } from '../../services/profileService';
import { SCREENS } from '../../constants';

/* ── Menu sections ──
 * Mirrors the wholesaler's MENU_SECTIONS (Reports & Alerts / Customers / Finance /
 * Account) and its row order, mapped onto the retailer's own routes:
 *
 *   Reports       → ReportCenter          (same as wholesaler)
 *   Analytics     → Analytics             (same)
 *   Notifications → Notifications         (wholesaler: NotificationList)
 *   Customers     → CustomerList          (same)
 *   Expenses      → ExpenseList           (same)
 *   Profit & Loss → ProfitLoss            (wholesaler: PLDashboard)
 *   Payments      → PaymentReceivable     (same)
 *   Accounts      → Accounts              (wholesaler: CustomerLedger — that screen
 *                                          needs a partyId param this row can't
 *                                          supply; the retailer's own Accounts
 *                                          screen needs none)
 *   Subscription  → Subscription          (wholesaler: SubscriptionPlan)
 *
 * Icons are the Ionicons equivalents of the wholesaler's MaterialCommunityIcons.
 */
const MENU_SECTIONS = [
  {
    key: 'business',
    title: 'Reports & Alerts',
    items: [
      { label: 'Reports',       icon: 'bar-chart-outline',     color: '#2563EB', screen: SCREENS.REPORT_CENTER },
      { label: 'Analytics',     icon: 'pie-chart-outline',     color: '#7C3AED', screen: SCREENS.ANALYTICS },
      { label: 'Notifications', icon: 'notifications-outline', color: Colors.primary, screen: SCREENS.NOTIFICATIONS },
    ],
  },
  {
    key: 'team',
    title: 'Customers',
    items: [
      { label: 'Customers', icon: 'people-outline', color: '#0891B2', screen: SCREENS.CUSTOMER_LIST },
      // "Follow-ups" deliberately absent — see the file header.
    ],
  },
  {
    key: 'finance',
    title: 'Finance',
    items: [
      { label: 'Expenses',      icon: 'receipt-outline',     color: '#DC2626', screen: SCREENS.EXPENSE_LIST },
      { label: 'Profit & Loss', icon: 'stats-chart-outline', color: '#059669', screen: SCREENS.PROFIT_LOSS },
      { label: 'Payments',      icon: 'cash-outline',        color: '#7C3AED', screen: SCREENS.PAYMENT_RECEIVABLE },
      { label: 'Accounts',      icon: 'book-outline',        color: '#0891B2', screen: SCREENS.ACCOUNTS },
    ],
  },
  {
    key: 'account',
    title: 'Account',
    items: [
      { label: 'Subscription', icon: 'star-outline', color: '#D97706', screen: SCREENS.SUBSCRIPTION },
    ],
  },
];

/* ── Small menu row ── */
function MenuRow({ icon, label, color, onPress, isLast }) {
  return (
    <TouchableOpacity
      style={[st.menuRow, !isLast && st.menuRowBorder]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[st.menuIconBox, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={st.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.textDisabled} />
    </TouchableOpacity>
  );
}

/** "Rajesh Kumar" → "RK" (first letter of the first two words). */
function initialsOf(value) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  return ((parts[0][0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

export default function ProfileScreen({ navigation }) {
  const { user, logout, refresh } = useAuth();

  /**
   * Draft-based editing: `null` = read-only.
   *
   * The wholesaler seeds two `useState`s from `user` once, which is fine there
   * because its user is already resolved when the screen mounts. Here
   * AuthContext hydrates the cached user and *then* refreshes from `/auth/me`,
   * so a one-shot initial value can capture the empty pre-hydration state and
   * the form would silently offer blank fields. Holding the draft instead means
   * the read-only view always reads live from `user` and only the edit session
   * is snapshotted.
   */
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [logoutDialog, setLogoutDialog] = useState(false);

  const editMode = draft !== null;
  const name     = editMode ? draft.name  : (user?.name  || '');
  const email    = editMode ? draft.email : (user?.email || '');
  const mobile   = user?.mobile || '';

  const companyName = user?.company?.name || user?.company_name || '';
  const displayName = user?.name || companyName || 'My Account';
  const planName    = user?.subscription_plan || user?.company?.subscription_plan || 'Free';

  // 'Retailer' is the owner role; 'RetailerStaff' is a staff login. The
  // wholesaler prints its raw role in this slot — only the staff case needs
  // wording that reads as a role rather than a business type.
  const roleLabel = user?.role === 'RetailerStaff' ? 'Staff' : 'Company Owner';

  const startEdit  = () => setDraft({ name: user?.name || '', email: user?.email || '' });
  const cancelEdit = () => setDraft(null);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      // PUT /api/retailer/profile — accepts name / mobile / email
      // (retailerAccountController.updateProfile). Mobile is shown read-only:
      // it is the login identifier, so changing it needs a re-verification flow
      // the app does not have yet.
      await profileService.updateProfile({
        name:  draft.name.trim(),
        email: draft.email.trim(),
      });
      await refresh();          // re-read /auth/me so the header updates immediately
      setDraft(null);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLogoutDialog(false);
    await logout();
    // `useSessionGate` in AppNavigator also resets the stack to Login when the
    // user goes set → null, so this is belt-and-braces, not the only path out.
    navigation.replace(SCREENS.LOGIN);
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.scrollContent}
      >
        {/* ══════════════════════════════════
            HEADER — user card
        ══════════════════════════════════ */}
        <View style={st.header}>
          <View style={st.hCircle1} />
          <View style={st.hCircle2} />

          {/* The wholesaler gets this title from the navigator's native header. */}
          <Text style={st.headerTitle}>My Profile</Text>

          {/* Avatar */}
          <View style={st.avatarRing}>
            <View style={st.avatar}>
              <Text style={st.avatarText}>{initialsOf(displayName)}</Text>
            </View>
          </View>

          <Text style={st.displayName}>{displayName}</Text>

          <View style={st.roleBadge}>
            <Ionicons name="shield-checkmark-outline" size={13} color={Colors.primaryLight} />
            <Text style={st.roleText}>{roleLabel}</Text>
          </View>

          {/* Quick info row */}
          <View style={st.infoRow}>
            {mobile ? (
              <View style={st.infoItem}>
                <Ionicons name="call-outline" size={13} color="rgba(255,255,255,0.7)" />
                <Text style={st.infoText}>{mobile}</Text>
              </View>
            ) : null}
            {email ? (
              <View style={st.infoItem}>
                <Ionicons name="mail-outline" size={13} color="rgba(255,255,255,0.7)" />
                <Text style={st.infoText} numberOfLines={1}>{email}</Text>
              </View>
            ) : null}
          </View>

          {/* Company, when it differs from the display name */}
          {companyName && companyName !== displayName ? (
            <View style={st.companyRow}>
              <Ionicons name="business-outline" size={13} color="rgba(255,255,255,0.65)" />
              <Text style={st.companyText}>{companyName}</Text>
            </View>
          ) : null}

          {/* Edit / Save toggle */}
          <TouchableOpacity
            style={st.editBtn}
            onPress={() => (editMode ? handleSave() : startEdit())}
            activeOpacity={0.85}
          >
            <Ionicons
              name={editMode ? 'save-outline' : 'pencil-outline'}
              size={15}
              color="#FFF"
            />
            <Text style={st.editBtnText}>{editMode ? 'Save Changes' : 'Edit Profile'}</Text>
          </TouchableOpacity>
        </View>

        {/* ══════════════════════════════════
            EDIT FORM (shown only in edit mode)
        ══════════════════════════════════ */}
        {editMode ? (
          <View style={st.formCard}>
            <Text style={st.formTitle}>Edit Profile</Text>

            <TextInput
              label="Full Name"
              value={name}
              onChangeText={(v) => setDraft(d => ({ ...d, name: v }))}
              placeholder="Your full name"
              autoCapitalize="words"
              maxLength={150}
            />
            <TextInput
              label="Mobile"
              value={mobile}
              editable={false}
              placeholder="Mobile number"
              helperText="Mobile is your login ID and cannot be changed here."
            />
            <TextInput
              label="Email"
              value={email}
              onChangeText={(v) => setDraft(d => ({ ...d, email: v }))}
              placeholder="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={254}
            />

            <View style={st.formBtns}>
              <PrimaryButton
                title="Cancel"
                variant="outline"
                onPress={cancelEdit}
                style={st.cancelBtn}
              />
              <PrimaryButton
                title="Save"
                onPress={handleSave}
                loading={saving}
                style={st.saveBtn}
              />
            </View>
          </View>
        ) : null}

        {/* ══════════════════════════════════
            SUBSCRIPTION BADGE
        ══════════════════════════════════ */}
        <TouchableOpacity
          style={st.subBadge}
          onPress={() => navigation.navigate(SCREENS.SUBSCRIPTION)}
          activeOpacity={0.85}
        >
          <View style={st.subLeft}>
            <Ionicons name="star" size={22} color="#D97706" />
            <View>
              <Text style={st.subTitle}>Current Plan</Text>
              <Text style={st.subPlan}>{planName}</Text>
            </View>
          </View>
          <View style={st.subUpgrade}>
            <Text style={st.subUpgradeText}>Upgrade</Text>
            <Ionicons name="chevron-forward" size={15} color={Colors.primary} />
          </View>
        </TouchableOpacity>

        {/* ══════════════════════════════════
            MENU SECTIONS
        ══════════════════════════════════ */}
        {MENU_SECTIONS.map(section => (
          <View key={section.key} style={st.section}>
            <Text style={st.sectionTitle}>{section.title}</Text>
            <View style={st.sectionCard}>
              {section.items.map((item, idx) => (
                <MenuRow
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  color={item.color}
                  isLast={idx === section.items.length - 1}
                  onPress={() => navigation.navigate(item.screen)}
                />
              ))}
            </View>
          </View>
        ))}

        {/* ══════════════════════════════════
            LOGOUT BUTTON
        ══════════════════════════════════ */}
        <View style={st.logoutWrap}>
          <TouchableOpacity
            style={st.logoutBtn}
            onPress={() => setLogoutDialog(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="log-out-outline" size={18} color="#DC2626" />
            <Text style={st.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ConfirmationModal
        visible={logoutDialog}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmTitle="LOGOUT"
        cancelTitle="CANCEL"
        confirmVariant="danger"
        onCancel={() => setLogoutDialog(false)}
        onConfirm={handleLogout}
      />
    </SafeAreaView>
  );
}

/* ── Styles ── */
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F4F7' },
  scrollContent: { paddingBottom: 40 },

  /* ── Header ── */
  header: {
    backgroundColor: Colors.secondary,
    paddingTop: 14,
    paddingBottom: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFF', marginBottom: 20 },
  hCircle1: {
    position: 'absolute', top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  hCircle2: {
    position: 'absolute', bottom: -20, left: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  avatarRing: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#FFF' },

  displayName: {
    fontSize: 20, fontWeight: '800', color: '#FFF',
    marginBottom: 6, textAlign: 'center',
  },

  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
    marginBottom: 12,
  },
  roleText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  infoRow: {
    flexDirection: 'row', gap: 18, marginBottom: 6,
    flexWrap: 'wrap', justifyContent: 'center',
  },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },

  companyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 2, marginBottom: 14,
  },
  companyText: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },

  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  /* ── Edit form ── */
  formCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 14, marginTop: 14,
    borderRadius: 16, padding: 16,
    ...Shadows.md,
  },
  formTitle: {
    fontSize: 14, fontWeight: '800',
    color: Colors.textPrimary, marginBottom: 12,
  },
  formBtns: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cancelBtn: { flex: 1 },
  saveBtn: { flex: 1 },

  /* ── Subscription badge ── */
  subBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF',
    marginHorizontal: 14, marginTop: 14,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#FBBF2430',
    ...Shadows.sm,
  },
  subLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  subTitle: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  subPlan: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  subUpgrade: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  subUpgradeText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  /* ── Menu sections ── */
  section: { marginHorizontal: 14, marginTop: 14 },
  sectionTitle: {
    fontSize: 11, fontWeight: '800',
    color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 6, paddingLeft: 2,
  },
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13, gap: 12,
  },
  menuRowBorder: {
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  menuIconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: {
    flex: 1, fontSize: 14, fontWeight: '500',
    color: Colors.textPrimary,
  },

  /* ── Logout ── */
  logoutWrap: { marginHorizontal: 14, marginTop: 14 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#FECACA',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
});
