import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import AppHeader from '../../components/common/AppHeader';
import { subscriptionApi } from '../../utils/api';
import { formatDate } from '../../utils/formatters';

export default function SubscriptionScreen({ navigation }) {
  const [current, setCurrent]   = useState(null);
  const [plans, setPlans]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [cur, cat] = await Promise.all([
        subscriptionApi.current(),
        subscriptionApi.plans(),
      ]);
      setCurrent(cur);
      setPlans(cat?.plans || []);
    } catch (err) {
      setError(err.message || 'Could not load subscription.');
    }
  }, []);

  useEffect(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) {
    return (
      <SafeAreaView style={st.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <AppHeader title="Subscription" showBack onBack={() => navigation.goBack()} centerTitle />
        <View style={st.center}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const plan       = current?.plan || { id: 'Free', name: 'Free', price_inr: 0 };
  const usage      = current?.usage || {};
  const sub        = current?.subscription;
  const isActive   = sub?.status === 'Active' || plan.id === 'Free';
  const purchaseOn = current?.purchase_available === true;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AppHeader title="Subscription" showBack onBack={() => navigation.goBack()} centerTitle />

      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {/* ═══ CURRENT PLAN ═══ */}
        <View style={st.planCard}>
          <View style={st.planTop}>
            <View style={st.planBadge}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={st.planBadgeText}>CURRENT PLAN</Text>
            </View>
            <View style={[st.statusPill, isActive ? st.statusActive : st.statusExpired]}>
              <Ionicons name={isActive ? 'checkmark-circle' : 'close-circle'} size={12} color={isActive ? '#27AE60' : Colors.error} />
              <Text style={[st.statusText, isActive ? st.statusActiveText : st.statusExpiredText]}>
                {isActive ? 'Active' : 'Expired'}
              </Text>
            </View>
          </View>

          <Text style={st.planName}>{plan.name}</Text>
          <Text style={st.planDesc}>
            {plan.price_inr === 0
              ? 'Basic access with limited enquiries. Upgrade to unlock more features.'
              : `₹${plan.price_inr}/${plan.billing_period || 'month'}`}
          </Text>

          {/* Dates */}
          <View style={st.datesRow}>
            <View style={st.dateBox}>
              <Ionicons name="calendar-outline" size={14} color={Colors.textTertiary} />
              <Text style={st.dateLbl}>Start</Text>
              <Text style={st.dateVal}>{sub?.starts_at ? formatDate(sub.starts_at) : '—'}</Text>
            </View>
            <View style={st.dateSep} />
            <View style={st.dateBox}>
              <Ionicons name={sub?.expires_at ? 'calendar' : 'infinite-outline'} size={14} color={Colors.primary} />
              <Text style={st.dateLbl}>{sub?.expires_at ? 'Expiry' : 'Validity'}</Text>
              <Text style={st.dateVal}>{sub?.expires_at ? formatDate(sub.expires_at) : 'Forever'}</Text>
            </View>
          </View>
        </View>

        {/* ═══ USAGE ═══ */}
        <View style={st.card}>
          <View style={st.cardHeader}>
            <Ionicons name="bar-chart-outline" size={16} color={Colors.secondary} />
            <Text style={st.cardTitle}>Usage This Month</Text>
          </View>
          <UsageRow icon="document-text-outline" label="Enquiries" used={usage.enquiries?.used ?? 0} limit={usage.enquiries?.limit} color="#2980B9" />
          <UsageRow icon="cube-outline" label="Orders" used={usage.orders?.used ?? 0} limit={usage.orders?.limit} color={Colors.primary} />
        </View>

        {/* ═══ FEATURES ═══ */}
        {plan.features?.length > 0 && (
          <View style={st.card}>
            <View style={st.cardHeader}>
              <Ionicons name="list-outline" size={16} color={Colors.secondary} />
              <Text style={st.cardTitle}>Plan Includes</Text>
            </View>
            {plan.features.map((f, i) => (
              <View key={i} style={st.featureRow}>
                <Ionicons name="checkmark-circle" size={14} color="#27AE60" />
                <Text style={st.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ═══ ALL PLANS ═══ */}
        {plans.length > 1 && (
          <>
            <View style={st.cardHeader}>
              <Ionicons name="layers-outline" size={16} color={Colors.secondary} />
              <Text style={st.cardTitle}>All Plans</Text>
            </View>
            {plans.map(p => (
              <PlanCard
                key={p.id}
                plan={p}
                isCurrent={p.id === plan.id}
              />
            ))}
          </>
        )}

        {!purchaseOn && (
          <View style={st.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color="#1A6E9F" />
            <Text style={st.infoText}>Online plan purchase is not available yet. Contact support to upgrade.</Text>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const PlanCard = ({ plan, isCurrent }) => (
  <View style={[st.planItem, isCurrent && { borderColor: Colors.primary, backgroundColor: Colors.primaryBg }]}>
    {isCurrent && <View style={[st.currentTag, { backgroundColor: Colors.primary }]}><Text style={st.currentText}>CURRENT</Text></View>}
    <Text style={st.planItemName}>{plan.name}</Text>
    <Text style={st.planItemPrice}>
      {plan.price_inr === 0 ? 'Free' : `₹${plan.price_inr}`}
      {plan.billing_period ? <Text style={st.planItemPeriod}> /{plan.billing_period}</Text> : null}
    </Text>
    {plan.features?.map((f, i) => (
      <View key={i} style={st.planFeatureRow}>
        <Ionicons name="checkmark-circle" size={13} color={Colors.primary} />
        <Text style={st.planFeatureText}>{f}</Text>
      </View>
    ))}
  </View>
);

const UsageRow = ({ icon, label, used, limit, color }) => {
  const pct = limit ? Math.min((used / limit) * 100, 100) : (used > 0 ? 10 : 0);
  const limitText = limit == null ? 'Unlimited' : `${used} / ${limit}`;
  return (
    <View style={st.usageRow}>
      <View style={st.usageInfo}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={st.usageLabel}>{label}</Text>
        <Text style={st.usageCount}>{limitText}</Text>
      </View>
      <View style={st.usageTrack}>
        <View style={[st.usageFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F4F7' },
  scroll: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  planCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 14, ...Shadows.md },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  planBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  planBadgeText: { fontSize: 10, fontWeight: '700', color: '#D97706', letterSpacing: 0.8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusActive: { backgroundColor: '#E8F8EF' },
  statusExpired: { backgroundColor: '#FDEDEC' },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusActiveText: { color: '#27AE60' },
  statusExpiredText: { color: Colors.error },
  planName: { fontSize: 26, fontWeight: '800', color: Colors.secondary, marginBottom: 4 },
  planDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18, marginBottom: 16 },
  datesRow: { flexDirection: 'row', backgroundColor: '#F8F9FB', borderRadius: 12, padding: 14 },
  dateBox: { flex: 1, alignItems: 'center', gap: 4 },
  dateSep: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  dateLbl: { fontSize: 9, fontWeight: '600', color: Colors.textTertiary, letterSpacing: 0.4 },
  dateVal: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },

  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 14, ...Shadows.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },

  usageRow: { marginBottom: 14 },
  usageInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  usageLabel: { flex: 1, fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },
  usageCount: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  usageTrack: { height: 6, backgroundColor: '#F0F2F5', borderRadius: 3, overflow: 'hidden' },
  usageFill: { height: '100%', borderRadius: 3 },

  featureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 8 },
  featureText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },

  planItem: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1.5, borderLeftWidth: 4, borderColor: '#F0F2F5', ...Shadows.sm, position: 'relative', overflow: 'hidden' },
  currentTag: { position: 'absolute', top: 10, right: 10, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  currentText: { fontSize: 8, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  planItemName: { fontSize: 16, fontWeight: '800', color: Colors.secondary, marginBottom: 2 },
  planItemPrice: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  planItemPeriod: { fontSize: 12, fontWeight: '400', color: Colors.textSecondary },
  planFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  planFeatureText: { fontSize: 12, color: Colors.textSecondary },

  infoBox: { flexDirection: 'row', gap: 10, backgroundColor: '#EBF5FB', borderRadius: 12, padding: 14, alignItems: 'flex-start', marginTop: 8 },
  infoText: { fontSize: 11, color: '#1A6E9F', lineHeight: 17, flex: 1 },
});
