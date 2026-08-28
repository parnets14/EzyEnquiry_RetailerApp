import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch,
  TouchableOpacity, StatusBar, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import AppHeader from '../../components/common/AppHeader';
import TextInput from '../../components/common/TextInput';
import PrimaryButton from '../../components/common/PrimaryButton';
import { profileApi } from '../../utils/api';

const LOGO = require('../../assets/logo.jpeg');

// ─── Notification Settings ─────────────────────────────────────────────────────
export const NotificationSettingsScreen = ({ navigation }) => {
  const [settings, setSettings] = useState({
    enquiryReplies: true,
    orderUpdates:   true,
    orderDispatched:true,
    orderDelivered: true,
    systemAlerts:   false,
    promotions:     false,
  });

  const toggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

  const items = [
    { key: 'enquiryReplies',  icon: 'document-text-outline', label: 'Enquiry Replies',      sub: 'When a seller responds to your enquiry' },
    { key: 'orderUpdates',    icon: 'cube-outline',           label: 'Order Status Updates', sub: 'Accepted, Processing, Ready alerts' },
    { key: 'orderDispatched', icon: 'car-outline',            label: 'Order Dispatched',     sub: 'When your order is on the way' },
    { key: 'orderDelivered',  icon: 'checkmark-circle-outline',label: 'Order Delivered',     sub: 'Delivery confirmation' },
    { key: 'systemAlerts',    icon: 'alert-circle-outline',   label: 'System Alerts',        sub: 'Platform updates and maintenance' },
    { key: 'promotions',      icon: 'pricetag-outline',       label: 'Offers & Promotions',  sub: 'New deals and discounts' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AppHeader title="Notification Settings" showBack onBack={() => navigation.goBack()} centerTitle />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {items.map((item, idx) => (
            <View key={item.key}>
              <View style={styles.switchRow}>
                <View style={[styles.switchIconBox, { backgroundColor: settings[item.key] ? Colors.primaryBg : Colors.background }]}>
                  <Ionicons name={item.icon} size={18} color={settings[item.key] ? Colors.primary : Colors.textSecondary} />
                </View>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchLabel}>{item.label}</Text>
                  <Text style={styles.switchSub}>{item.sub}</Text>
                </View>
                <Switch
                  value={settings[item.key]}
                  onValueChange={() => toggle(item.key)}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={settings[item.key] ? Colors.primary : Colors.white}
                />
              </View>
              {idx < items.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
        <View style={styles.noteBox}>
          <Ionicons name="phone-portrait-outline" size={14} color={Colors.textTertiary} />
          <Text style={styles.note}>Manage push notification permissions in your device settings.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Change Password ─────────────────────────────────────────────────────────
export const ChangePasswordScreen = ({ navigation }) => {
  const [form, setForm]     = useState({ current: '', newPass: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.current) e.current = 'Current password is required';
    if (!form.newPass || form.newPass.length < 6) e.newPass = 'Minimum 6 characters';
    if (form.newPass !== form.confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await profileApi.changePassword(form.current, form.newPass);
      setLoading(false);
      setSuccess(true);
      setTimeout(() => navigation.goBack(), 1500);
    } catch (err) {
      setLoading(false);
      setErrors({ current: err.message || 'Password change failed.' });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AppHeader title="Change Password" showBack onBack={() => navigation.goBack()} centerTitle />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
          {success ? (
            <View style={styles.successBox}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark" size={32} color={Colors.success} />
              </View>
              <Text style={styles.successText}>Password changed successfully!</Text>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.hintBox}>
                <Ionicons name="shield-checkmark-outline" size={16} color={Colors.info} />
                <Text style={styles.hintText}>Choose a strong password with at least 6 characters.</Text>
              </View>
              <TextInput label="Current Password" placeholder="Enter current password" value={form.current} onChangeText={v => set('current', v)} error={errors.current} secureTextEntry required />
              <TextInput label="New Password" placeholder="Minimum 6 characters" value={form.newPass} onChangeText={v => set('newPass', v)} error={errors.newPass} secureTextEntry required />
              <TextInput label="Confirm New Password" placeholder="Re-enter new password" value={form.confirm} onChangeText={v => set('confirm', v)} error={errors.confirm} secureTextEntry required />
              <PrimaryButton title="UPDATE PASSWORD" onPress={handleChange} loading={loading} size="lg" />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─── Help & Support ────────────────────────────────────────────────────────────
export const HelpSupportScreen = ({ navigation }) => {
  const [expanded, setExpanded] = useState(null);

  const faqs = [
    { q: 'How do I send an enquiry?', a: 'Search for a product, open its details and tap "Send Enquiry". Fill in quantity, delivery location and remarks, then submit.' },
    { q: 'How long does it take to get a response?', a: 'Seller response time varies. You will receive a notification as soon as the seller responds.' },
    { q: 'Can I negotiate the quoted price?', a: 'Yes. Open the enquiry details and tap "Negotiate" to exchange counter offers with the seller.' },
    { q: 'How do I track my order?', a: 'Go to My Orders, open the order and tap "Track Order" to see the full timeline and dispatch details.' },
    { q: 'How do I upload my documents?', a: 'Go to Profile → Documents and tap "Choose File" to upload your GST certificate or business registration.' },
  ];

  const contacts = [
    { icon: 'mail-outline',      label: 'Email Support', value: 'support@ezyenquiry.com' },
    { icon: 'call-outline',      label: 'Phone Support', value: '+91 98765 43210' },
    { icon: 'logo-whatsapp',     label: 'WhatsApp',      value: '+91 98765 43210' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AppHeader title="Help & Support" showBack onBack={() => navigation.goBack()} centerTitle />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>CONTACT US</Text>
          {contacts.map(c => (
            <View key={c.label} style={styles.contactRow}>
              <View style={styles.contactIconBox}>
                <Ionicons name={c.icon} size={18} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.contactLabel}>{c.label}</Text>
                <Text style={styles.contactValue}>{c.value}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>FREQUENTLY ASKED QUESTIONS</Text>
          {faqs.map((faq, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.faqItem}
              onPress={() => setExpanded(expanded === idx ? null : idx)}
              activeOpacity={0.8}
            >
              <View style={styles.faqHeader}>
                <Ionicons name="help-circle-outline" size={16} color={Colors.primary} style={styles.faqIcon} />
                <Text style={styles.faqQ} numberOfLines={expanded === idx ? 0 : 2}>{faq.q}</Text>
                <Ionicons name={expanded === idx ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textTertiary} />
              </View>
              {expanded === idx && <Text style={styles.faqA}>{faq.a}</Text>}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.appInfoCard}>
          <Image source={LOGO} style={styles.appInfoLogo} resizeMode="contain" />
          <Text style={styles.appInfoTitle}>EzyEnquiry</Text>
          <Text style={styles.appInfoSub}>Retailer App v1.0.0</Text>
          <Text style={styles.appInfoSub}>B2B Tiles Platform</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Shared Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.screenPadding, paddingBottom: 40 },
  card: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm, marginBottom: Spacing.base },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, gap: 12 },
  switchIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  switchInfo: { flex: 1 },
  switchLabel: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '600' },
  switchSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2, lineHeight: 17 },
  divider: { height: 1, backgroundColor: Colors.borderLight },
  noteBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  note: { ...Typography.caption, color: Colors.textTertiary, lineHeight: 18, flex: 1 },
  hintBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Colors.infoBg, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.base },
  hintText: { ...Typography.caption, color: Colors.infoText, lineHeight: 18, flex: 1 },
  successBox: { alignItems: 'center', paddingVertical: 60 },
  successIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.successBg, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successText: { ...Typography.h4, color: Colors.success, textAlign: 'center' },
  sectionLabel: { ...Typography.label, color: Colors.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.md },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  contactIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { ...Typography.caption, color: Colors.textSecondary },
  contactValue: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '600' },
  faqItem: { paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  faqHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  faqIcon: { marginTop: 1, flexShrink: 0 },
  faqQ: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '600', flex: 1 },
  faqA: { ...Typography.body2, color: Colors.textSecondary, marginTop: 8, lineHeight: 22, paddingLeft: 24 },
  appInfoCard: { alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl, ...Shadows.sm },
  appInfoLogo: { width: 52, height: 52, borderRadius: 12, marginBottom: 10 },
  appInfoTitle: { ...Typography.h4, color: Colors.secondary },
  appInfoSub: { ...Typography.caption, color: Colors.textTertiary, marginTop: 3 },
});
