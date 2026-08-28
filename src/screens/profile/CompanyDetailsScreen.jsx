import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, StatusBar, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import AppHeader from '../../components/common/AppHeader';
import TextInput from '../../components/common/TextInput';
import PrimaryButton from '../../components/common/PrimaryButton';
import { useAuth } from '../../context/AuthContext';
import { profileApi } from '../../utils/api';

const BIZ_TYPES = ['Retailer', 'Dealer', 'Contractor', 'Distributor', 'Wholesaler'];

export default function CompanyDetailsScreen({ navigation }) {
  const { user, refresh } = useAuth();
  const c = user?.company || {};
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');
  const [form, setForm] = useState({
    ownerName:    user?.name || c.owner_name || '',
    mobile:       user?.mobile || c.mobile || '',
    email:        user?.email || c.email || '',
    companyName:  c.name || user?.company_name || '',
    gstNumber:    c.gst_number || '',
    panNumber:    c.pan_number || '',
    businessType: c.biz_type || '',
    address:      c.address || '',
    city:         c.city || '',
    state:        c.state || '',
    pincode:      c.pin_code || '',
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      // Update user profile (name, email, mobile)
      await profileApi.updateProfile({
        name:   form.ownerName.trim(),
        email:  form.email.trim(),
        mobile: form.mobile.trim(),
      });
      // Update company details
      await profileApi.updateCompany({
        name:       form.companyName.trim(),
        owner_name: form.ownerName.trim(),
        mobile:     form.mobile.trim(),
        email:      form.email.trim(),
        gst_number: form.gstNumber.trim(),
        pan_number: form.panNumber.trim(),
        address:    form.address.trim(),
        city:       form.city.trim(),
        state:      form.state.trim(),
        pin_code:   form.pincode.trim(),
      });
      await refresh();
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AppHeader
        title="Company Details"
        showBack onBack={() => navigation.goBack()}
        centerTitle
        rightComponent={
          !editing ? (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Ionicons name="create-outline" size={18} color="#FFF" />
            </TouchableOpacity>
          ) : null
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>

          {saved && (
            <View style={st.successBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#27AE60" />
              <Text style={st.successText}>Company details saved successfully!</Text>
            </View>
          )}
          {error ? (
            <View style={st.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={st.errorBannerText}>{error}</Text>
            </View>
          ) : null}

          <SectionCard icon="person-outline" title="Owner Information">
            <TextInput label="Owner Name" value={form.ownerName} onChangeText={v => set('ownerName', v)} editable={editing} required />
            <TextInput label="Mobile Number" value={form.mobile} onChangeText={v => set('mobile', v)} editable={editing} keyboardType="phone-pad" required />
            <TextInput label="Email Address" value={form.email} onChangeText={v => set('email', v)} editable={editing} keyboardType="email-address" autoCapitalize="none" />
          </SectionCard>

          <SectionCard icon="business-outline" title="Business Information">
            <TextInput label="Company / Shop Name" value={form.companyName} onChangeText={v => set('companyName', v)} editable={editing} required />
            <TextInput label="GST Number" value={form.gstNumber} onChangeText={v => set('gstNumber', v.toUpperCase())} editable={editing} autoCapitalize="characters" maxLength={15} />
            <TextInput label="PAN Number" value={form.panNumber} onChangeText={v => set('panNumber', v.toUpperCase())} editable={editing} autoCapitalize="characters" maxLength={10} />
            {editing && (
              <>
                <Text style={st.chipLabel}>Business Type</Text>
                <View style={st.chipRow}>
                  {BIZ_TYPES.map(t => (
                    <TouchableOpacity key={t} style={[st.chip, form.businessType === t && st.chipActive]} onPress={() => set('businessType', t)}>
                      <Text style={[st.chipText, form.businessType === t && st.chipActiveText]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            {!editing && <TextInput label="Business Type" value={form.businessType} editable={false} />}
          </SectionCard>

          <SectionCard icon="location-outline" title="Business Address">
            <TextInput label="Address" value={form.address} onChangeText={v => set('address', v)} editable={editing} multiline numberOfLines={2} />
            <View style={st.row}>
              <View style={st.half}><TextInput label="City" value={form.city} onChangeText={v => set('city', v)} editable={editing} required /></View>
              <View style={st.half}><TextInput label="State" value={form.state} onChangeText={v => set('state', v)} editable={editing} required /></View>
            </View>
            <TextInput label="Pincode" value={form.pincode} onChangeText={v => set('pincode', v)} editable={editing} keyboardType="number-pad" maxLength={6} />
          </SectionCard>

          {editing && (
            <View style={st.actions}>
              <PrimaryButton title="Cancel" onPress={() => { setEditing(false); setError(''); }} variant="outline" style={{ flex: 1 }} />
              <PrimaryButton title="Save Changes" onPress={handleSave} loading={loading} style={{ flex: 1 }} />
            </View>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const SectionCard = ({ icon, title, children }) => (
  <View style={st.card}>
    <View style={st.cardHeader}>
      <View style={st.cardIconBg}><Ionicons name={icon} size={16} color={Colors.primary} /></View>
      <Text style={st.cardTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F4F7' },
  scroll: { padding: 16, paddingBottom: 30 },
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E8F8EF', borderRadius: 10, padding: 12, marginBottom: 12 },
  successText: { fontSize: 13, fontWeight: '600', color: '#27AE60' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FDEDEC', borderRadius: 10, padding: 12, marginBottom: 12 },
  errorBannerText: { fontSize: 13, fontWeight: '600', color: Colors.error, flex: 1 },
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 14, ...Shadows.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  cardIconBg: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  chipLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  chipText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  chipActiveText: { color: Colors.primary, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
});
