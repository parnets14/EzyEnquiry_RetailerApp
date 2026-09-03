import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity,
  Linking, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import AppHeader from '../../components/common/AppHeader';
import StatusBadge from '../../components/common/StatusBadge';
import PrimaryButton from '../../components/common/PrimaryButton';
import { formatDate } from '../../utils/formatters';
import { orderApi } from '../../utils/api';
import { SCREENS } from '../../constants';

export default function DispatchDetailsScreen({ navigation, route }) {
  const { orderId } = route.params || {};

  const [tracking, setTracking] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    if (!orderId) return;
    setError('');
    try {
      const data = await orderApi.tracking(orderId);
      setTracking(data);
    } catch (err) {
      setError(err.message || 'Could not load dispatch details.');
    }
  }, [orderId]);

  useEffect(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <AppHeader title="Dispatch Details" showBack onBack={() => navigation.goBack()} centerTitle variant="primary" />
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const dispatches = (tracking?.dispatches && tracking.dispatches.length)
    ? tracking.dispatches
    : (tracking?.dispatch ? [tracking.dispatch] : []);
  const status   = tracking?.status || '';
  const unit     = tracking?.unit || '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AppHeader title="Dispatch Details" showBack onBack={() => navigation.goBack()} centerTitle variant="primary" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Order Banner */}
        <View style={styles.orderBanner}>
          <View style={styles.bannerLeft}>
            <Text style={styles.orderId}>{tracking?.order_code || orderId}</Text>
          </View>
          <StatusBadge status={status} type="order" size="md" />
        </View>

        {/* Quantity summary */}
        {tracking?.ordered_qty != null && (
          <View style={styles.qtyCard}>
            <QtyStat label="Ordered" value={`${tracking.ordered_qty}`} unit={unit} color={Colors.secondary} />
            <View style={styles.qtyDivider} />
            <QtyStat label="Dispatched" value={`${tracking.dispatched_qty || 0}`} unit={unit} color={Colors.primary} />
            <View style={styles.qtyDivider} />
            <QtyStat label="Remaining" value={`${tracking.remaining_qty || 0}`} unit={unit} color={(tracking.remaining_qty || 0) > 0 ? Colors.warning : Colors.success} />
          </View>
        )}

        {/* Shipment Details — one card per dispatch batch */}
        {dispatches.length > 0 ? (
          dispatches.map((dispatch, i) => (
            <View style={styles.card} key={dispatch.id || dispatch.dispatch_code || i}>
              <View style={styles.cardHeader}>
                <View style={styles.cardBar} />
                <Text style={styles.cardTitle}>
                  {dispatches.length > 1 ? `Shipment ${i + 1}` : 'Shipment Details'}
                  {dispatch.dispatch_code ? `  ·  ${dispatch.dispatch_code}` : ''}
                </Text>
                <View style={{ flex: 1 }} />
                <StatusBadge status={dispatch.status || 'Dispatched'} type="order" />
              </View>
              {dispatch.qty ? <DispatchRow icon="cube-outline" label="Quantity" value={`${dispatch.qty} ${dispatch.unit || unit}`} /> : null}
              {dispatch.vehicle_number ? <DispatchRow icon="car-outline" label="Vehicle Number" value={dispatch.vehicle_number} /> : null}
              {dispatch.transport_name ? <DispatchRow icon="business-outline" label="Transporter" value={dispatch.transport_name} /> : null}
              {dispatch.driver_name ? <DispatchRow icon="person-outline" label="Driver" value={dispatch.driver_name} /> : null}
              {dispatch.lr_number ? <DispatchRow icon="document-outline" label="LR Number" value={dispatch.lr_number} /> : null}
              {dispatch.invoice_number ? <DispatchRow icon="receipt-outline" label="Invoice" value={dispatch.invoice_number} /> : null}
              {dispatch.dispatch_date ? <DispatchRow icon="calendar-outline" label="Dispatch Date" value={formatDate(dispatch.dispatch_date)} /> : null}
              {dispatch.expected_delivery ? <DispatchRow icon="flag-outline" label="Expected Delivery" value={formatDate(dispatch.expected_delivery)} isLast /> : null}
            </View>
          ))
        ) : (
          <View style={styles.noDispatch}>
            <Ionicons name="time-outline" size={44} color={Colors.border} />
            <Text style={styles.noDispatchTitle}>Not Yet Dispatched</Text>
            <Text style={styles.noDispatchSub}>Dispatch details will appear here once the seller ships your order.</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <PrimaryButton
            title="TRACK ORDER"
            onPress={() => navigation.navigate(SCREENS.ORDER_TRACKING, { orderId })}
            variant="primary"
            size="lg"
          />
          <PrimaryButton
            title="VIEW ORDER DETAILS"
            onPress={() => navigation.navigate(SCREENS.ORDER_DETAILS, { orderId })}
            variant="outline"
            size="lg"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const DispatchRow = ({ icon, label, value, isLast }) => (
  <View style={[styles.dispatchRow, !isLast && styles.dispatchRowBorder]}>
    <View style={styles.dispatchIconBox}>
      <Ionicons name={icon} size={18} color={Colors.primary} />
    </View>
    <View style={styles.dispatchContent}>
      <Text style={styles.dispatchLabel}>{label}</Text>
      <Text style={styles.dispatchValue}>{value || '—'}</Text>
    </View>
  </View>
);

const QtyStat = ({ label, value, unit, color }) => (
  <View style={styles.qtyStat}>
    <Text style={[styles.qtyValue, { color }]}>{value}</Text>
    <Text style={styles.qtyUnit}>{unit}</Text>
    <Text style={styles.qtyLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.screenPadding, paddingBottom: 40, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  orderBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm, borderLeftWidth: 3, borderLeftColor: Colors.primary },
  bannerLeft: { flex: 1 },
  orderId: { ...Typography.h5, color: Colors.textPrimary },
  qtyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm },
  qtyStat: { flex: 1, alignItems: 'center' },
  qtyValue: { ...Typography.h3, fontWeight: '800' },
  qtyUnit: { ...Typography.caption, color: Colors.textTertiary, fontSize: 10 },
  qtyLabel: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 10 },
  qtyDivider: { width: 1, height: 40, backgroundColor: Colors.borderLight },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.primaryBg, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm, borderWidth: 1, borderColor: Colors.primary + '30' },
  statusIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', ...Shadows.sm },
  statusInfo: { flex: 1 },
  statusTitle: { ...Typography.h4, color: Colors.secondary, marginBottom: 4 },
  expectedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  expectedText: { ...Typography.caption, color: Colors.textSecondary },
  expectedDate: { color: Colors.primary, fontWeight: '700' },
  deliveredRow: { flexDirection: 'row', alignItems: 'center' },
  deliveredText: { ...Typography.caption, color: Colors.success, fontWeight: '600' },
  card: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  cardBar: { width: 3, height: 16, backgroundColor: Colors.secondary, borderRadius: 2, marginRight: 8 },
  cardTitle: { ...Typography.h5, color: Colors.textPrimary },
  dispatchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, gap: 12 },
  dispatchRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  dispatchIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  dispatchContent: { flex: 1 },
  dispatchLabel: { ...Typography.caption, color: Colors.textTertiary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  dispatchValue: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '600' },
  noDispatch: { alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl, ...Shadows.sm, gap: 10 },
  noDispatchTitle: { ...Typography.h5, color: Colors.textPrimary },
  noDispatchSub: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  actions: { gap: 10 },
});
