import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import { useAuth } from '../../context/AuthContext';
import { SCREENS } from '../../constants';

const LOGO = require('../../assets/logo.jpeg');

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [showLogout, setShowLogout] = useState(false);

  const ownerName = user?.name || user?.company?.owner_name || '—';
  const email     = user?.email || '—';
  const mobile    = user?.mobile || '—';
  const company   = {
    name:         user?.company?.name || user?.company_name || '—',
    businessType: user?.company?.biz_type || '—',
    gstNumber:    user?.company?.gst_number || '',
    panNumber:    user?.company?.pan_number || '',
    city:         user?.company?.city || '—',
    state:        user?.company?.state || '—',
    pincode:      user?.company?.pin_code || '—',
  };
  const subscription = {
    plan:      user?.subscription_plan || user?.company?.subscription_plan || 'Free',
    status:    user?.company_status || '—',
    startDate: '',
    expiryDate: '',
    price:     0,
  };

  const handleLogout = async () => {
    setShowLogout(false);
    await logout();
    navigation.replace(SCREENS.LOGIN);
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* ═══ HEADER ═══ */}
      <View style={st.header}>
        <View style={st.headerTopRow}>
          <TouchableOpacity
            style={st.backBtn}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('HomeTab'))}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={st.headerTitle}>My Profile</Text>
          <View style={st.backBtn} />
        </View>

        {/* Profile card inside header — sticks out below */}
        <View style={st.profileCard}>
          <View style={st.avatar}>
            <Text style={st.avatarTxt}>{ownerName?.charAt(0)}</Text>
          </View>
          <View style={st.profileInfo}>
            <Text style={st.profileName}>{ownerName}</Text>
            <Text style={st.profileCompany}>{company.name}</Text>
            <View style={st.profileMeta}>
              <View style={st.profileMetaRow}>
                <Ionicons name="call-outline" size={14} color={Colors.primary} />
                <Text style={st.profileMetaText}>{mobile}</Text>
              </View>
              <View style={st.profileMetaRow}>
                <Ionicons name="mail-outline" size={14} color={Colors.primary} />
                <Text style={st.profileMetaText}>{email}</Text>
              </View>
            </View>
          </View>
          <View style={st.planBadge}>
            <Ionicons name="star" size={10} color="#F59E0B" />
            <Text style={st.planBadgeText}>{subscription.plan}</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Spacer for card overlap */}
        <View style={{ height: 50 }} />

        {/* ═══ COMPANY DETAILS ═══ */}
        <Text style={st.secTitle}>Company Details</Text>
        <View style={st.detailsCard}>
          <DetailItem icon="business" color="#2980B9" bg="#EBF5FB" label="Company Name" value={company.name} />
          <DetailItem icon="briefcase" color="#27AE60" bg="#E8F8EF" label="Business Type" value={company.businessType} />
          <DetailItem icon="location" color="#E74C3C" bg="#FDEDEC" label="City" value={company.city} />
          <DetailItem icon="map" color="#1A2340" bg="#EEF0F5" label="State" value={company.state} />
          <DetailItem icon="keypad" color="#F39C12" bg="#FEF9E7" label="PIN Code" value={company.pincode} />
          <DetailItem icon="document-text" color={Colors.primary} bg="#FFF3EE" label="GST Number" value={company.gstNumber || 'Not Registered'} />
          <DetailItem icon="card" color="#8E44AD" bg="#F5EEF8" label="PAN Number" value={company.panNumber || 'Not Provided'} last />
        </View>

        {/* ═══ SUBSCRIPTION ═══ */}
        <Text style={st.secTitle}>Subscription</Text>
        <View style={st.subCard}>
          <View style={st.subRow}>
            <View>
              <Text style={st.subPlan}>{subscription.plan}</Text>
              <Text style={st.subStatus}>Status: {subscription.status}</Text>
            </View>
            <View style={st.activeBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#27AE60" />
              <Text style={st.activeText}>{subscription.status}</Text>
            </View>
          </View>
          <View style={st.subDates}>
            <View style={st.subDateItem}>
              <Text style={st.subDateLbl}>Start Date</Text>
              <Text style={st.subDateVal}>{subscription.startDate || '—'}</Text>
            </View>
            <View style={st.subDateItem}>
              <Text style={st.subDateLbl}>Validity</Text>
              <Text style={st.subDateVal}>{subscription.expiryDate || 'Forever'}</Text>
            </View>
            <View style={st.subDateItem}>
              <Text style={st.subDateLbl}>Price</Text>
              <Text style={st.subDateVal}>{subscription.price === 0 ? 'Free' : `₹${subscription.price}/mo`}</Text>
            </View>
          </View>
        </View>

        {/* ═══ BILLING ═══ */}
        <Text style={st.secTitle}>Billing</Text>
        <View style={st.menuCard}>
          <MenuItem icon="receipt-outline" color={Colors.primary} label="Invoices & Payments" onPress={() => navigation.navigate(SCREENS.INVOICES)} last />
        </View>

        {/* ═══ MENU ═══ */}
        <Text style={st.secTitle}>Settings</Text>
        <View style={st.menuCard}>
          <MenuItem icon="create-outline"          color="#2980B9"       label="Edit Company"      onPress={() => navigation.navigate(SCREENS.COMPANY_DETAILS)} />
          <MenuItem icon="document-attach-outline" color="#27AE60"       label="Documents"         onPress={() => navigation.navigate(SCREENS.DOCUMENTS)} />
          <MenuItem icon="people-outline"          color={Colors.secondary} label="My Staff"       onPress={() => navigation.navigate(SCREENS.STAFF_LIST)} />
          <MenuItem icon="star-outline"            color="#F59E0B"       label="Subscription"      onPress={() => navigation.navigate(SCREENS.SUBSCRIPTION)} />
          <MenuItem icon="notifications-outline"   color="#8E44AD"       label="Notifications"     onPress={() => navigation.navigate(SCREENS.NOTIFICATION_SETTINGS)} />
          <MenuItem icon="help-circle-outline"     color="#06B6D4"       label="Help & Support"    onPress={() => navigation.navigate(SCREENS.HELP_SUPPORT)} />
          <MenuItem icon="log-out-outline"         color="#E74C3C"       label="Logout"            onPress={() => setShowLogout(true)} last />
        </View>

        {/* App info */}
        <View style={st.appInfo}>
          <Image source={LOGO} style={st.appLogo} resizeMode="cover" />
          <Text style={st.appName}>EzyEnquiry · v1.0.0</Text>
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>

      <ConfirmationModal
        visible={showLogout}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmTitle="LOGOUT"
        cancelTitle="CANCEL"
        confirmVariant="danger"
        onCancel={() => setShowLogout(false)}
        onConfirm={handleLogout}
      />
    </SafeAreaView>
  );
}

/* ── Sub-components ── */
const DetailItem = ({ icon, color, bg, label, value, last }) => (
  <View style={[st.detailItem, !last && st.detailBorder]}>
    <View style={[st.detailIcon, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={16} color={color} />
    </View>
    <View style={st.detailText}>
      <Text style={st.detailLabel}>{label}</Text>
      <Text style={st.detailValue}>{value}</Text>
    </View>
  </View>
);

const MenuItem = ({ icon, color, label, onPress, last }) => (
  <TouchableOpacity style={[st.menuItem, !last && st.detailBorder]} onPress={onPress} activeOpacity={0.8}>
    <View style={[st.menuIcon, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={16} color={color} />
    </View>
    <Text style={[st.menuLabel, color === '#E74C3C' && { color }]}>{label}</Text>
    <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
  </TouchableOpacity>
);

/* ── Styles ── */
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F4F7' },

  /* Header */
  header: { backgroundColor: Colors.secondary, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24, alignItems: 'center', overflow: 'visible', zIndex: 10 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', marginBottom: 18 },
  backBtn: { width: 32, height: 32, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFF' },

  /* Profile card — inside header, sticks out */
  profileCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    borderRadius: 16, padding: 18, gap: 14,
    marginBottom: -44,
    ...Shadows.md, elevation: 8,
  },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  profileCompany: { fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },
  profileMeta: { gap: 5 },
  profileMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  profileMetaText: { fontSize: 13, color: Colors.textSecondary },
  planBadge: { position: 'absolute', top: 12, right: 14, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFFBEB', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  planBadgeText: { fontSize: 9, fontWeight: '700', color: '#D97706' },

  /* Section title */
  secTitle: { fontSize: 14, fontWeight: '700', color: '#FFF', backgroundColor: Colors.secondary, paddingHorizontal: 16, paddingVertical: 10, marginTop: 16, marginHorizontal: 16, borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden' },

  /* Details card */
  detailsCard: { backgroundColor: '#FFF', borderBottomLeftRadius: 14, borderBottomRightRadius: 14, marginHorizontal: 16, ...Shadows.sm, overflow: 'hidden' },
  detailItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  detailBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F6F8' },
  detailIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  detailText: { flex: 1 },
  detailLabel: { fontSize: 10, color: Colors.textTertiary, fontWeight: '600', letterSpacing: 0.3 },
  detailValue: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600', marginTop: 2 },

  /* Subscription */
  subCard: { backgroundColor: '#FFF', borderRadius: 14, marginHorizontal: 16, ...Shadows.sm, overflow: 'hidden' },
  subRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F5F6F8' },
  subPlan: { fontSize: 18, fontWeight: '800', color: Colors.secondary },
  subStatus: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8F8EF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  activeText: { fontSize: 10, fontWeight: '700', color: '#27AE60' },
  subDates: { flexDirection: 'row', padding: 14 },
  subDateItem: { flex: 1, alignItems: 'center' },
  subDateLbl: { fontSize: 9, color: Colors.textTertiary, fontWeight: '600', marginBottom: 3 },
  subDateVal: { fontSize: 12, color: Colors.textPrimary, fontWeight: '700' },

  /* Menu */
  menuCard: { backgroundColor: '#FFF', borderRadius: 14, marginHorizontal: 16, ...Shadows.sm, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  menuIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.textPrimary },

  /* App info */
  appInfo: { alignItems: 'center', marginTop: 20, gap: 6 },
  appLogo: { width: 32, height: 32, borderRadius: 8 },
  appName: { fontSize: 11, color: Colors.textTertiary },
});
