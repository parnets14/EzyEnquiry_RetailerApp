import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import AppHeader from '../../components/common/AppHeader';
import StatusBadge from '../../components/common/StatusBadge';
import PrimaryButton from '../../components/common/PrimaryButton';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { orderApi } from '../../utils/api';
import { SCREENS } from '../../constants';

export default function OrderDetailsScreen({ navigation, route }) {
  const { orderId, order: passedOrder } = route.params || {};
  const resolvedId = orderId || passedOrder?.id;

  const [order, setOrder]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const load = useCallback(async () => {
    if (!resolvedId) return;
    setError('');
    try {
      const data = await orderApi.get(resolvedId);
      setOrder(data);
    } catch (err) {
      setError(err.message || 'Could not load order.');
    }
  }, [resolvedId]);

  useEffect(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleCancel = async () => {
    setCancelLoading(true);
    try {
      await orderApi.cancel(resolvedId);
      await load();
    } catch (err) {
      setError(err.message || 'Could not cancel order.');
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <AppHeader title="Order Details" showBack onBack={() => navigation.goBack()} centerTitle />
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <AppHeader title="Order Details" showBack onBack={() => navigation.goBack()} centerTitle />
        <View style={styles.center}>
          <Text style={styles.errorTextFull}>{error || 'Order not found.'}</Text>
          <TouchableOpacity onPress={onRefresh}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const canTrack  = ['Accepted', 'Processing', 'ReadyForDispatch', 'Dispatched', 'InTransit', 'Delivered'].includes(order.status);
  const canCancel = ['New', 'Accepted'].includes(order.status);
  const charges   = (order.charges?.transport || 0) + (order.charges?.packing || 0) + (order.charges?.other || 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AppHeader
        title="Order Details"
        showBack
        onBack={() => navigation.goBack()}
        centerTitle
        rightComponent={canTrack ? (
          <TouchableOpacity onPress={() => navigation.navigate(SCREENS.ORDER_TRACKING, { orderId: resolvedId })}>
            <Text style={styles.trackLink}>Track</Text>
          </TouchableOpacity>
        ) : null}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {/* Status Banner */}
        <View style={styles.statusCard}>
          <View>
            <Text style={styles.orderId}>{order.order_code}</Text>
            <Text style={styles.orderDate}>Placed on {formatDate(order.created_at)}</Text>
          </View>
          <StatusBadge status={order.status} type="order" size="md" />
        </View>

        {error ? <View style={styles.errorInline}><Text style={styles.errorInlineText}>{error}</Text></View> : null}

        {/* Product */}
        <InfoCard title="Product">
          <Row label="Product" value={order.product?.name || '—'} />
          <Row label="Code" value={order.product?.code || '—'} />
          <Row label="Quantity" value={`${order.qty} ${order.unit}`} />
          <Row label="Unit Price" value={`${formatCurrency(order.unit_price)}/${order.unit}`} />
        </InfoCard>

        {/* Price */}
        <InfoCard title="Price Summary">
          <Row label="Subtotal" value={formatCurrency(order.amount)} />
          <Row label={`GST (${order.gst_percent}%)`} value={formatCurrency(order.gst_amount)} />
          {charges > 0 && <Row label="Charges" value={formatCurrency(charges)} />}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(order.total_amount)}</Text>
          </View>
        </InfoCard>

        {/* Delivery */}
        {order.delivery_address ? (
          <InfoCard title="Delivery Address">
            <View style={styles.addressBox}><Text style={styles.addressText}>{order.delivery_address}</Text></View>
          </InfoCard>
        ) : null}

        {/* Seller */}
        {order.seller && (
          <InfoCard title="Seller">
            <Row label="Company" value={order.seller.name} />
            <Row label="Location" value={[order.seller.city, order.seller.state].filter(Boolean).join(', ')} />
          </InfoCard>
        )}

        {/* Status History */}
        {order.status_history?.length > 0 && (
          <InfoCard title="Timeline">
            {order.status_history.map((h, idx) => (
              <View key={idx} style={styles.historyItem}>
                <View style={[styles.historyDot, idx === 0 && styles.historyDotActive]} />
                <View style={styles.historyContent}>
                  <Text style={styles.historyStatus}>{h.status}</Text>
                  <Text style={styles.historyDate}>{formatDate(h.timestamp)}</Text>
                  {h.remarks ? <Text style={styles.historyRemarks}>{h.remarks}</Text> : null}
                </View>
              </View>
            ))}
          </InfoCard>
        )}

        {/* Actions */}
        {canTrack && (
          <PrimaryButton
            title="TRACK ORDER"
            onPress={() => navigation.navigate(SCREENS.ORDER_TRACKING, { orderId: resolvedId })}
            variant="secondary"
            size="lg"
            style={styles.actionBtn}
          />
        )}
        {canCancel && (
          <PrimaryButton
            title="CANCEL ORDER"
            onPress={handleCancel}
            loading={cancelLoading}
            variant="outline"
            size="lg"
            style={styles.actionBtn}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const InfoCard = ({ title, children }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <View style={styles.cardBar} />
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const Row = ({ label, value, valueStyle }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, valueStyle]} numberOfLines={2}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.screenPadding, paddingBottom: 40, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorTextFull: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  retryText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },
  trackLink: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },
  errorInline: { backgroundColor: Colors.errorBg, borderRadius: BorderRadius.md, padding: Spacing.sm },
  errorInlineText: { ...Typography.caption, color: Colors.error },
  statusCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm, borderLeftWidth: 3, borderLeftColor: Colors.secondary },
  orderId: { ...Typography.h5, color: Colors.textPrimary },
  orderDate: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2 },
  card: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  cardBar: { width: 3, height: 16, backgroundColor: Colors.secondary, borderRadius: 2, marginRight: 8 },
  cardTitle: { ...Typography.h5, color: Colors.textPrimary },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  rowLabel: { ...Typography.caption, color: Colors.textSecondary, flex: 0.4 },
  rowValue: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '600', flex: 0.6, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.md, marginTop: 4 },
  totalLabel: { ...Typography.h5, color: Colors.textPrimary },
  totalValue: { ...Typography.h4, color: Colors.primary },
  addressBox: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md },
  addressText: { ...Typography.body2, color: Colors.textSecondary, lineHeight: 22 },
  historyItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  historyDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.border, marginTop: 4 },
  historyDotActive: { backgroundColor: Colors.primary },
  historyContent: { flex: 1 },
  historyStatus: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '600' },
  historyDate: { ...Typography.caption, color: Colors.textTertiary, marginTop: 1 },
  historyRemarks: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  actionBtn: { marginTop: 4 },
});
