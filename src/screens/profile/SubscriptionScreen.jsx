// src/screens/profile/SubscriptionScreen.jsx
//
// Rebuilt to match wholesalerapp/src/screens/settings/SubscriptionPlanScreen.jsx:
// heading → "Current Plan" box → one card per plan (name + price + features +
// "Upgrade to X" button, or a "Current Plan" badge).
//
// The wholesaler hardcodes its plan list; the retailer fetches the same catalogue
// from GET /api/retailer/subscription/plans so plan names/prices stay server-owned
// (the ids here are what Company.subscription_plan stores).
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import AppHeader from '../../components/common/AppHeader';
import { useAuth } from '../../hooks/useAuth';
import { subscriptionApi } from '../../utils/api';

// Plan accent colours, in catalogue order — mirrors the wholesaler's palette
// (Free grey → Silver → Gold → Platinum blue).
const PLAN_COLORS = ['#757575', '#9E9E9E', '#FBBC04', '#1A73E8'];

const priceLabel = (plan) =>
  plan?.price_inr > 0 ? `₹${plan.price_inr}/${plan.billing_period || 'month'}` : '₹0';

export default function SubscriptionScreen({ navigation }) {
  const { refresh } = useAuth();

  const [current, setCurrent]       = useState(null);
  const [plans, setPlans]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState('');
  const [busy, setBusy]             = useState('');

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

  const currentPlanId   = current?.plan?.id   || 'Free';
  const currentPlanName = current?.plan?.name || 'Free';

  const upgrade = (plan) => {
    Alert.alert(
      `Upgrade to ${plan.name}?`,
      `${priceLabel(plan)} — your plan will be activated for 1 month.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setBusy(plan.id);
            try {
              await subscriptionApi.subscribe({
                plan: plan.id,
                months: 1,
                amount_paid: plan.price_inr || 0,
              });
              await load();
              await refresh?.().catch(() => {});
              Alert.alert('Activated', `You are now on the ${plan.name} plan.`);
            } catch (e) {
              Alert.alert('Failed', e?.message || 'Could not update plan.');
            } finally { setBusy(''); }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={st.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <AppHeader title="Subscription" showBack onBack={() => navigation.goBack()} centerTitle />
        <View style={st.center}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AppHeader title="Subscription" showBack onBack={() => navigation.goBack()} centerTitle />

      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        <Text style={st.heading}>Subscription Plans</Text>

        {/* ═══ CURRENT PLAN ═══ */}
        <View style={st.currentBox}>
          <Text style={st.currentLabel}>Current Plan</Text>
          <Text style={st.currentPlan}>{currentPlanName}</Text>
        </View>

        {error ? (
          <View style={st.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={Colors.errorText} />
            <Text style={st.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ═══ PLANS ═══ */}
        {plans.map((plan, i) => {
          const color     = PLAN_COLORS[i % PLAN_COLORS.length];
          const isCurrent = plan.id === currentPlanId;
          const isBusy    = busy === plan.id;
          return (
            <View key={plan.id} style={[st.planCard, { borderColor: color }, isCurrent && st.activePlan]}>
              <View style={st.planHeader}>
                <Text style={[st.planName, { color }]}>{plan.name}</Text>
                <Text style={st.planPrice}>{priceLabel(plan)}</Text>
              </View>

              {(plan.features || []).map(f => (
                <View key={f} style={st.featureRow}>
                  <Text style={st.checkmark}>✓</Text>
                  <Text style={st.featureText}>{f}</Text>
                </View>
              ))}

              {!isCurrent && (
                <TouchableOpacity
                  style={[st.upgradeBtn, { backgroundColor: color }, isBusy && st.upgradeBtnBusy]}
                  onPress={() => upgrade(plan)}
                  disabled={!!busy}
                  activeOpacity={0.85}
                >
                  <Text style={st.upgradeBtnText}>
                    {isBusy ? 'Activating…' : `Upgrade to ${plan.name}`}
                  </Text>
                </TouchableOpacity>
              )}

              {isCurrent && <Text style={st.activeBadge}>✓ Current Plan</Text>}
            </View>
          );
        })}

        <View style={st.tail} />
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.screenPadding, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tail:   { height: 24 },

  heading: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.md },

  currentBox:   { backgroundColor: Colors.secondary, borderRadius: BorderRadius.lg, padding: Spacing.base, alignItems: 'center', marginBottom: Spacing.base },
  currentLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  currentPlan:  { color: Colors.white, fontSize: 22, fontWeight: '800' },

  errorBox:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.errorBg, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.base },
  errorText: { flex: 1, fontSize: 12, color: Colors.errorText, lineHeight: 17 },

  planCard:   { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1.5, padding: Spacing.base, marginBottom: Spacing.md, ...Shadows.sm },
  activePlan: { borderWidth: 2, ...Shadows.md },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  planName:   { fontSize: 18, fontWeight: '800' },
  planPrice:  { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },

  featureRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  checkmark:   { color: Colors.primary, fontWeight: '700', marginRight: Spacing.sm },
  featureText: { flex: 1, fontSize: 13, color: Colors.textSecondary },

  upgradeBtn:     { marginTop: Spacing.md, paddingVertical: 11, borderRadius: BorderRadius.md, alignItems: 'center' },
  upgradeBtnBusy: { opacity: 0.6 },
  upgradeBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },

  activeBadge: { marginTop: Spacing.md, fontSize: 13, fontWeight: '700', color: Colors.primary, textAlign: 'center' },
});
