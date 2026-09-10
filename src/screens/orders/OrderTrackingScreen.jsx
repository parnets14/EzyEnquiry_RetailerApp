import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import AppHeader from '../../components/common/AppHeader';
import StatusBadge from '../../components/common/StatusBadge';
import PrimaryButton from '../../components/common/PrimaryButton';
import SalesOrderStepper from '../../components/order/SalesOrderStepper';
import { formatDate } from '../../utils/formatters';
import { orderApi } from '../../utils/api';
import { SCREENS } from '../../constants';

export default function OrderTrackingScreen({ navigation, route }) {
  const { orderId } = route.params || {};

  const [tracking, setTracking]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState('');

  const load = useCallback(async () => {
    if (!orderId) return;
    setError('');
    try {
      const data = await orderApi.tracking(orderId);
      setTracking(data);
    } catch (err) {
      setError(err.message || 'Could not load tracking info.');
    }
  }, [orderId]);

  useEffect(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <AppHeader title="Track Order" showBack onBack={() => navigation.goBack()} centerTitle variant="primary" />
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!tracking) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <AppHeader title="Track Order" showBack onBack={() => navigation.goBack()} centerTitle variant="primary" />
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || 'Tracking not found.'}</Text>
          <TouchableOpacity onPress={onRefresh}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const dispatchList = (tracking.dispatches && tracking.dispatches.length)
    ? tracking.dispatches
    : (tracking.dispatch ? [tracking.dispatch] : []);
  const dispatch = dispatchList[0] || null;
  const history  = tracking.history || [];
  const status   = tracking.status;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AppHeader title="Track Order" showBack onBack={() => navigation.goBack()} centerTitle variant="primary" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {/* Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <Text style={styles.orderId}>{tracking.order_code}</Text>
            <Text style={styles.statusLabel}>Current Status</Text>
          </View>
          <StatusBadge status={status} type="order" size="md" />
        </View>

        {/* Progress stepper */}
        <View style={styles.timelineCard}>
          <View style={styles.timelineHeader}>
            <View style={styles.timelineBar} />
            <Text style={styles.timelineTitle}>Order Progress</Text>
          </View>
          <SalesOrderStepper status={status} />
        </View>

        {/* Quantity summary */}
        {tracking.ordered_qty != null && (
          <View style={styles.qtyCard}>
            <QtyStat label="Ordered" value={`${tracking.ordered_qty}`} unit={tracking.unit} color={Colors.secondary} />
            <View style={styles.qtyDivider} />
            <QtyStat label="Dispatched" value={`${tracking.dispatched_qty || 0}`} unit={tracking.unit} color={Colors.primary} />
            <View style={styles.qtyDivider} />
            <QtyStat label="Remaining" value={`${tracking.remaining_qty || 0}`} unit={tracking.unit} color={(tracking.remaining_qty || 0) > 0 ? Colors.warning : Colors.success} />
          </View>
        )}

        {/* Dispatch Info — one card per shipment */}
        {dispatchList.length > 0 ? (
          dispatchList.map((d, i) => (
            <View style={styles.dispatchCard} key={d.id || d.dispatch_code || i}>
              <View style={styles.dispatchHeader}>
                <Ionicons name="car-outline" size={20} color={Colors.secondary} />
                <Text style={styles.dispatchTitle}>
                  {dispatchList.length > 1 ? `Shipment ${i + 1}` : 'Shipment Details'}
                </Text>
                <StatusBadge status={d.status || 'Dispatched'} type="order" />
              </View>
              <View style={styles.dispatchGrid}>
                {d.qty ? <DispatchItem icon="cube-outline" label="Quantity" value={`${d.qty} ${d.unit || tracking.unit || ''}`} /> : null}
                {d.driver_name ? <DispatchItem icon="person-outline" label="Driver" value={d.driver_name} /> : null}
                {d.driver_phone ? <DispatchItem icon="call-outline" label="Driver Phone" value={d.driver_phone} /> : null}
                {d.vehicle_number ? <DispatchItem icon="car-outline" label="Vehicle" value={d.vehicle_number} /> : null}
                {d.transport_name ? <DispatchItem icon="business-outline" label="Transporter" value={d.transport_name} /> : null}
                {d.lr_number ? <DispatchItem icon="document-outline" label="LR Number" value={d.lr_number} /> : null}
                {d.invoice_number ? <DispatchItem icon="receipt-outline" label="Invoice" value={d.invoice_number} /> : null}
                {d.dispatch_date ? <DispatchItem icon="calendar-outline" label="Dispatched" value={formatDate(d.dispatch_date)} /> : null}
                {d.expected_delivery ? <DispatchItem icon="flag-outline" label="Expected" value={formatDate(d.expected_delivery)} /> : null}
                {d.delivered_date ? <DispatchItem icon="checkmark-circle-outline" label="Delivered" value={formatDate(d.delivered_date)} /> : null}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.noDispatch}>
            <Ionicons name="time-outline" size={36} color={Colors.border} />
            <Text style={styles.noDispatchTitle}>Not Yet Dispatched</Text>
            <Text style={styles.noDispatchSub}>Dispatch details will appear here once the seller ships your order.</Text>
          </View>
        )}

        {/* Timeline */}
        {history.length > 0 && (
          <View style={styles.timelineCard}>
            <View style={styles.timelineHeader}>
              <View style={styles.timelineBar} />
              <Text style={styles.timelineTitle}>Order Timeline</Text>
            </View>
            {history.map((h, idx) => (
              <View key={idx} style={styles.tlItem}>
                <View style={[styles.tlDot, idx === 0 && styles.tlDotActive]} />
                <View style={styles.tlContent}>
                  <Text style={styles.tlStatus}>{h.status}</Text>
                  <Text style={styles.tlDate}>{formatDate(h.timestamp)}</Text>
                  {h.remarks ? <Text style={styles.tlRemarks}>{h.remarks}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {(status === 'Dispatched' || status === 'Out for Delivery' || status === 'InTransit') && (
          <View style={styles.otpNote}>
            <Ionicons name="shield-checkmark-outline" size={16} color={Colors.primary} />
            <Text style={styles.otpNoteText}>
              When the driver arrives, you'll receive a delivery OTP on your registered mobile. Share it with the driver to confirm delivery.
            </Text>
          </View>
        )}

        {!tracking.capabilities?.live_gps_tracking && (
          <View style={styles.infoNote}>
            <Ionicons name="information-circle-outline" size={14} color="#1A6E9F" />
            <Text style={styles.infoNoteText}>Live GPS tracking is not available. Status updates are provided by the seller.</Text>
          </View>
        )}

        {(status === 'Dispatched' || status === 'Out for Delivery' || status === 'InTransit') && (
          <PrimaryButton
            title="ENTER DELIVERY OTP"
            onPress={() => navigation.navigate(SCREENS.DELIVERY_OTP, { orderId, dispatchId: dispatch?.id })}
            variant="primary"
            style={styles.detailsBtn}
          />
        )}

        <PrimaryButton
          title="VIEW ORDER DETAILS"
          onPress={() => navigation.navigate(SCREENS.ORDER_DETAILS, { orderId })}
          variant="outline"
          style={styles.detailsBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const DispatchItem = ({ icon, label, value }) => (
  <View style={styles.dispatchItem}>
    <Ionicons name={icon} size={16} color={Colors.primary} style={{ marginBottom: 2 }} />
    <Text style={styles.dispatchItemLabel}>{label}</Text>
    <Text style={styles.dispatchItemValue}>{value}</Text>
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
  errorText: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  retryText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },
  summaryCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm, borderLeftWidth: 3, borderLeftColor: Colors.secondary },
  summaryLeft: { flex: 1, marginRight: 10 },
  orderId: { ...Typography.h5, color: Colors.textPrimary },
  statusLabel: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2 },
  qtyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm },
  qtyStat: { flex: 1, alignItems: 'center' },
  qtyValue: { ...Typography.h3, fontWeight: '800' },
  qtyUnit: { ...Typography.caption, color: Colors.textTertiary, fontSize: 10 },
  qtyLabel: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 10 },
  qtyDivider: { width: 1, height: 40, backgroundColor: Colors.borderLight },
  dispatchCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm },
  dispatchHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.base },
  dispatchTitle: { ...Typography.h5, color: Colors.textPrimary, flex: 1 },
  dispatchGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dispatchItem: { width: '50%', paddingVertical: 8, paddingRight: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  dispatchItemLabel: { ...Typography.caption, color: Colors.textTertiary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  dispatchItemValue: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '600' },
  noDispatch: { alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl, ...Shadows.sm, gap: 8 },
  noDispatchTitle: { ...Typography.h5, color: Colors.textPrimary },
  noDispatchSub: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  timelineCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  timelineBar: { width: 3, height: 16, backgroundColor: Colors.primary, borderRadius: 2, marginRight: 8 },
  timelineTitle: { ...Typography.h5, color: Colors.textPrimary },
  tlItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  tlDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.border, marginTop: 4 },
  tlDotActive: { backgroundColor: Colors.primary },
  tlContent: { flex: 1 },
  tlStatus: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '600' },
  tlDate: { ...Typography.caption, color: Colors.textTertiary, marginTop: 1 },
  tlRemarks: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  infoNote: { flexDirection: 'row', gap: 8, backgroundColor: '#EBF5FB', borderRadius: BorderRadius.lg, padding: Spacing.sm, alignItems: 'flex-start' },
  infoNoteText: { fontSize: 11, color: '#1A6E9F', flex: 1, lineHeight: 17 },
  otpNote: { flexDirection: 'row', gap: 8, backgroundColor: Colors.primaryBg, borderRadius: BorderRadius.lg, padding: Spacing.base, alignItems: 'flex-start', borderWidth: 1, borderColor: Colors.primary + '30' },
  otpNoteText: { fontSize: 12, color: Colors.secondary, flex: 1, lineHeight: 18 },
  detailsBtn: { marginTop: 4 },
});
