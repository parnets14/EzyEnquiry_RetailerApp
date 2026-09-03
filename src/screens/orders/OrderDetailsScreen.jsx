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
import { formatDate, formatCurrency } from '../../utils/formatters';
import { orderApi, invoiceApi } from '../../utils/api';
import { SCREENS } from '../../constants';

export default function OrderDetailsScreen({ navigation, route }) {
  const { orderId, order: passedOrder } = route.params || {};
  const resolvedId = orderId || passedOrder?.id;

  const [order, setOrder]           = useState(null);
  const [dispatches, setDispatches] = useState([]);
  const [invoices, setInvoices]     = useState([]);
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

      // Best-effort: dispatches + invoices (endpoints may not exist yet)
      const [disp, inv] = await Promise.allSettled([
        orderApi.dispatches(resolvedId),
        invoiceApi.byOrder(resolvedId),
      ]);
      if (disp.status === 'fulfilled') setDispatches(disp.value?.dispatches || []);
      if (inv.status === 'fulfilled') setInvoices(inv.value?.invoices || []);
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
        <AppHeader title="Order Details" showBack onBack={() => navigation.goBack()} centerTitle variant="primary" />
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <AppHeader title="Order Details" showBack onBack={() => navigation.goBack()} centerTitle variant="primary" />
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

  // Partial dispatch summary — prefer the order's own counters, fall back to
  // summing the dispatch batches.
  const ordered    = Number(order.qty || 0);
  const summedDispatched = dispatches.reduce((sum, d) => sum + Number(d.qty || d.quantity || 0), 0);
  const dispatched = order.dispatched_qty != null ? Number(order.dispatched_qty) : summedDispatched;
  const remaining  = order.remaining_qty != null ? Number(order.remaining_qty) : Math.max(ordered - dispatched, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AppHeader
        title="Order Details"
        showBack
        onBack={() => navigation.goBack()}
        centerTitle
        variant="primary"
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
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>SALES ORDER</Text>
            <Text style={styles.orderId}>{order.order_code}</Text>
            <Text style={styles.orderDate}>Placed on {formatDate(order.created_at)}</Text>
            {order.enquiry_code ? (
              <TouchableOpacity onPress={() => order.enquiry_id && navigation.navigate(SCREENS.ENQUIRY_DETAILS, { enquiryId: order.enquiry_id })}>
                <Text style={styles.quotationLink}>From Quotation {order.enquiry_code}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <StatusBadge status={order.status} type="order" size="md" />
        </View>

        {error ? <View style={styles.errorInline}><Text style={styles.errorInlineText}>{error}</Text></View> : null}

        {/* Fulfilment timeline */}
        <View style={styles.stepperCard}>
          <View style={styles.stepperHeader}>
            <View style={styles.stepperBar} />
            <Text style={styles.stepperTitle}>Order Progress</Text>
          </View>
          <SalesOrderStepper status={order.status} />
        </View>

        {/* Quantity summary — ordered / dispatched / remaining */}
        <View style={styles.qtyCard}>
          <QtyStat label="Ordered" value={`${ordered}`} unit={order.unit} color={Colors.secondary} />
          <View style={styles.qtyDivider} />
          <QtyStat label="Dispatched" value={`${dispatched}`} unit={order.unit} color={Colors.primary} />
          <View style={styles.qtyDivider} />
          <QtyStat label="Remaining" value={`${remaining}`} unit={order.unit} color={remaining > 0 ? Colors.warning : Colors.success} />
        </View>

        {/* Product */}
        <InfoCard title="Product">
          <Row label="Product" value={order.product?.name || '—'} />
          {order.product?.code ? <Row label="Code" value={order.product.code} /> : null}
          <Row label="Unit Price" value={`${formatCurrency(order.unit_price)}/${order.unit}`} />
        </InfoCard>

        {/* Dispatches */}
        {dispatches.length > 0 && (
          <InfoCard title={`Dispatches (${dispatches.length})`}>
            {dispatches.map((d, idx) => (
              <TouchableOpacity
                key={d.id || d.dispatch_code || idx}
                style={styles.dispatchRow}
                activeOpacity={0.8}
                onPress={() => navigation.navigate(SCREENS.ORDER_TRACKING, { orderId: resolvedId })}
              >
                <View style={styles.dispatchIcon}><Ionicons name="car-outline" size={18} color={Colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dispatchCode}>{d.dispatch_code || `Dispatch ${idx + 1}`}</Text>
                  <Text style={styles.dispatchMeta}>
                    {d.qty || d.quantity || 0} {d.unit || order.unit}
                    {d.vehicle_number ? ` · ${d.vehicle_number}` : ''}
                  </Text>
                </View>
                <StatusBadge status={d.status || 'Dispatched'} type="order" />
              </TouchableOpacity>
            ))}
          </InfoCard>
        )}

        {/* Invoices */}
        {invoices.length > 0 && (
          <InfoCard title={`Invoices (${invoices.length})`}>
            {invoices.map((inv, idx) => (
              <TouchableOpacity
                key={inv.id || inv.invoice_number || idx}
                style={styles.invoiceRow}
                activeOpacity={0.8}
                onPress={() => navigation.navigate(SCREENS.INVOICE_DETAILS, { invoiceId: inv.id })}
              >
                <View style={styles.invoiceIcon}><Ionicons name="receipt-outline" size={18} color={Colors.secondary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invoiceCode}>{inv.invoice_number || inv.invoice_no || `Invoice ${idx + 1}`}</Text>
                  <Text style={styles.invoiceMeta}>
                    {inv.qty || 0} {order.unit} · {formatCurrency(inv.total_amount || inv.grand_total || inv.amount)}
                  </Text>
                </View>
                <StatusBadge status={inv.payment_status || 'Unpaid'} type="payment" />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.viewAllInvoices}
              onPress={() => navigation.navigate(SCREENS.INVOICES, { orderId: resolvedId })}
            >
              <Text style={styles.viewAllText}>View all invoices</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </InfoCard>
        )}

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

        {/* Delivery — only when it differs from the customer address (avoid duplication) */}
        {order.delivery_address && order.delivery_address !== order.customer?.address ? (
          <InfoCard title="Delivery Address">
            <View style={styles.addressBox}><Text style={styles.addressText}>{order.delivery_address}</Text></View>
          </InfoCard>
        ) : null}

        {/* Customer — who the retailer created this order for, with the
            Created By (retailer) details nested underneath. */}
        {(order.customer?.name || order.customer?.mobile || order.customer?.address || order.created_by?.name || order.created_by?.company) && (
          <InfoCard title="Customer">
            {order.customer?.name ? <Row label="Name" value={order.customer.name} /> : null}
            {order.customer?.mobile ? <Row label="Mobile" value={order.customer.mobile} /> : null}
            {order.customer?.email ? <Row label="Email" value={order.customer.email} /> : null}
            {order.customer?.address ? <Row label="Address" value={order.customer.address} /> : null}
            {(order.created_by?.name || order.created_by?.company || order.created_by?.mobile || order.created_by?.email) ? (
              <View style={styles.nestedBox}>
                <Text style={styles.nestedTitle}>CREATED BY{order.created_by?.type ? ` (${order.created_by.type})` : ''}</Text>
                {order.created_by?.name ? <Row label="Name" value={order.created_by.name} /> : null}
                {order.created_by?.company ? <Row label="Company" value={order.created_by.company} /> : null}
                {order.created_by?.mobile ? <Row label="Phone" value={order.created_by.mobile} /> : null}
                {order.created_by?.email ? <Row label="Email" value={order.created_by.email} /> : null}
              </View>
            ) : null}
          </InfoCard>
        )}

        {/* Actions */}
        {(order.status === 'Dispatched' || order.status === 'InTransit') && (
          <PrimaryButton
            title="ENTER DELIVERY OTP"
            onPress={() => navigation.navigate(SCREENS.DELIVERY_OTP, { orderId: resolvedId, dispatchId: dispatches[0]?.id })}
            variant="secondary"
            size="lg"
            style={styles.actionBtn}
          />
        )}
        {canTrack && (
          <PrimaryButton
            title="TRACK ORDER"
            onPress={() => navigation.navigate(SCREENS.ORDER_TRACKING, { orderId: resolvedId })}
            variant="outline"
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
  errorTextFull: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  retryText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },
  trackLink: { ...Typography.body2, color: Colors.white, fontWeight: '700' },
  errorInline: { backgroundColor: Colors.errorBg, borderRadius: BorderRadius.md, padding: Spacing.sm },
  errorInlineText: { ...Typography.caption, color: Colors.error },
  statusCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm, borderLeftWidth: 3, borderLeftColor: Colors.secondary },
  eyebrow: { ...Typography.caption, color: Colors.primary, fontWeight: '800', fontSize: 10, letterSpacing: 0.6, marginBottom: 2 },
  stepperCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm },
  stepperHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  stepperBar: { width: 3, height: 16, backgroundColor: Colors.secondary, borderRadius: 2, marginRight: 8 },
  stepperTitle: { ...Typography.h5, color: Colors.textPrimary },
  orderId: { ...Typography.h5, color: Colors.textPrimary },
  orderDate: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2 },
  quotationLink: { ...Typography.caption, color: Colors.primary, fontWeight: '600', marginTop: 3 },

  qtyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm },
  qtyStat: { flex: 1, alignItems: 'center' },
  qtyValue: { ...Typography.h3, fontWeight: '800' },
  qtyUnit: { ...Typography.caption, color: Colors.textTertiary, fontSize: 10 },
  qtyLabel: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 10 },
  qtyDivider: { width: 1, height: 40, backgroundColor: Colors.borderLight },

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
  nestedBox: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.md },
  nestedTitle: { ...Typography.caption, color: Colors.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },

  dispatchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  dispatchIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  dispatchCode: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '700' },
  dispatchMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },

  invoiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  invoiceIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.secondaryBg, alignItems: 'center', justifyContent: 'center' },
  invoiceCode: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '700' },
  invoiceMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
  viewAllInvoices: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 10 },
  viewAllText: { ...Typography.caption, color: Colors.primary, fontWeight: '700' },

  actionBtn: { marginTop: 4 },
});
