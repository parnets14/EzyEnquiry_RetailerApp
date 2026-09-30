/**
 * src/screens/orders/OrderDetailsScreen.jsx  (Retailer app)
 *
 * Literal structural port of the wholesaler's `order/OrderDetailScreen.jsx`.
 * Section order and content are the wholesaler's:
 *
 *   [ header card: order code · date · status chip ]
 *   [ SECTION  label + primary value + sub value   ]
 *   [ SECTION  label + one row per line item       ]
 *   [ TOTALS   Subtotal / GST / Discount / Grand   ]
 *   [ action block                                 ]
 *
 * ── Removed to match the wholesaler ─────────────────────────────────────────
 * The previous version carried a progress stepper, ordered/dispatched/remaining
 * counters, a dispatch list, an invoice list, a delivery-OTP entry button and a
 * created-by block. The wholesaler has none of those, so they are gone.
 * Nothing became unreachable: tracking is still entered from OrderSuccess, the
 * delivery OTP from OrderTracking, and invoices from the Invoices screen.
 *
 * ── Deliberate deviations, and why ──────────────────────────────────────────
 * 1. PARTY SECTION — the wholesaler's "Customer" block shows the party it is
 *    fulfilling for. The retailer is the BUYER, and `createOrder` writes the
 *    retailer's OWN company name into `customer_name`
 *    (retailerMarketplaceController ~line 1321), so rendering `customer.name`
 *    would print the retailer to itself. The meaningful counterparty is the
 *    seller, so this section is labelled "Seller" and reads `order.seller`.
 *    Same slot, same styling, correct party.
 *
 * 2. ACTION BLOCK — the wholesaler's four buttons are seller actions
 *    (Accept / Reject, Update Status, Generate GST Invoice, Create Dispatch) and
 *    have no buyer-side endpoints on the retailer API. The wholesaler's own row
 *    is Accept + Reject; the retailer is the buyer, so both collapse to the one
 *    action it actually has: Cancel (New or Accepted). Remove the block entirely
 *    if you want the order to be read-only.
 *
 *    The previous "Track Order" button is gone, along with OrderTrackingScreen
 *    and DeliveryOTPScreen. The wholesaler has NO order-tracking feature at all
 *    — its only tracking screen is the seller-side Dispatch Tracking, and that
 *    one never links to Order Detail either. Parity means not having it here.
 *
 * 3. DELIVERY — a "Delivery" section renders the shipping address when present.
 *    The wholesaler's order has no delivery address to show; the retailer's DTO
 *    does, and a buyer needs it.
 *
 * The retailer DTO carries a single product per order (`product`, `qty`,
 * `unit_price`, `amount`, `gst_amount`), not an `items[]` array, so the products
 * section renders one row — in the wholesaler's item-row shape.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import AppHeader from '../../components/common/AppHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { orderApi } from '../../utils/api';

export default function OrderDetailsScreen({ navigation, route }) {
  const { orderId, order: passedOrder } = route.params || {};
  const resolvedId = orderId || passedOrder?.id;

  const [order, setOrder]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const load = useCallback(async () => {
    if (!resolvedId) { setLoading(false); return; }
    setError('');
    try {
      setOrder(await orderApi.get(resolvedId));
    } catch (err) {
      setError(err.message || 'Could not load order.');
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);

  useEffect(() => { load(); }, [load]);

  const onCancel = () => {
    Alert.alert('Cancel Order?', 'Mark this order as cancelled?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Order',
        style: 'destructive',
        onPress: async () => {
          setCancelLoading(true);
          try {
            await orderApi.cancel(resolvedId);
            await load();
          } catch (err) {
            Alert.alert('Failed', err.message || 'Could not cancel the order.');
          } finally {
            setCancelLoading(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
        <AppHeader title="Order Details" showBack onBack={() => navigation.goBack()} centerTitle variant="primary" />
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
        <AppHeader title="Order Details" showBack onBack={() => navigation.goBack()} centerTitle variant="primary" />
        <View style={styles.center}>
          <Text style={styles.errorTextFull}>{error || 'Order not found.'}</Text>
          <TouchableOpacity onPress={load}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const status   = order.status || '';
  const canCancel = ['New', 'Accepted'].includes(status);

  // Line total, in the wholesaler's "qty x rate + gst" shape.
  const qty   = Number(order.qty || 0);
  const rate  = Number(order.unit_price || 0);
  const lineGst = Number(order.gst_amount || 0);
  const lineTotal = (qty * rate) + lineGst;

  const subtotal = Number(order.amount || 0);
  const gst      = lineGst;
  const discount = Number(order.discount || 0);
  const grand    = Number(order.total_amount || 0);

  const seller = order.seller || {};
  const partyName = seller.name || order.created_by?.company || order.customer?.name || '—';
  const partySub  = [seller.city, seller.state].filter(Boolean).join(', ');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
      <AppHeader title="Order Details" showBack onBack={() => navigation.goBack()} centerTitle variant="primary" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {error ? <View style={styles.errorInline}><Text style={styles.errorInlineText}>{error}</Text></View> : null}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.orderNo}>{order.order_code || '—'}</Text>
          <Text style={styles.date}>{formatDate(order.created_at)}</Text>
          <View style={styles.statusWrap}>
            <StatusBadge status={status} type="order" size="md" />
          </View>
        </View>

        {/* Party — see header note #1 */}
        <View style={styles.section}>
          <Text style={styles.label}>Seller</Text>
          <Text style={styles.value}>{partyName}</Text>
          {partySub ? <Text style={styles.sub}>{partySub}</Text> : null}
        </View>

        {/* Products */}
        <View style={styles.section}>
          <Text style={styles.label}>Products</Text>
          <View style={styles.itemRow}>
            <Text style={styles.itemName}>{order.product?.name || '—'}</Text>
            {order.product?.code ? <Text style={styles.itemCode}>{order.product.code}</Text> : null}
            <Text style={styles.itemDetail}>
              {qty} {order.unit || ''} × {formatCurrency(rate)} + {formatCurrency(lineGst)} GST = {formatCurrency(lineTotal)}
            </Text>
          </View>
        </View>

        {/* Delivery — see header note #3 */}
        {order.delivery_address ? (
          <View style={styles.section}>
            <Text style={styles.label}>Delivery</Text>
            <Text style={styles.sub}>{order.delivery_address}</Text>
          </View>
        ) : null}

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>GST</Text>
            <Text style={styles.totalValue}>{formatCurrency(gst)}</Text>
          </View>
          {discount > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={[styles.totalValue, styles.discountValue]}>-{formatCurrency(discount)}</Text>
            </View>
          ) : null}
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={styles.grandLabel}>Grand Total</Text>
            <Text style={styles.grandValue}>{formatCurrency(grand)}</Text>
          </View>
        </View>

        {/* Actions — see header note #2 */}
        {canCancel ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.rejectBtn, cancelLoading && styles.btnOff]}
              disabled={cancelLoading}
              onPress={onCancel}
              activeOpacity={0.85}
            >
              {cancelLoading
                ? <ActivityIndicator size="small" color={Colors.error} />
                : <Text style={styles.rejectBtnText}>Cancel Order</Text>}
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.base, paddingBottom: 40, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorTextFull: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  retryText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },
  errorInline: { backgroundColor: Colors.errorBg, borderRadius: BorderRadius.md, padding: Spacing.sm },
  errorInlineText: { ...Typography.caption, color: Colors.error },

  header: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, ...Shadows.sm },
  orderNo: { ...Typography.h4, fontWeight: '800', color: Colors.secondary },
  date: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  statusWrap: { marginTop: Spacing.sm, alignItems: 'flex-start' },

  section: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md + 2, ...Shadows.sm },
  label: {
    ...Typography.caption, fontSize: 11, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  value: { ...Typography.body1, fontWeight: '700', color: Colors.textPrimary },
  sub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2, lineHeight: 19 },
  itemRow: {},
  itemName: { ...Typography.body2, fontWeight: '600', color: Colors.textPrimary },
  itemCode: { ...Typography.caption, fontSize: 10.5, color: Colors.textTertiary, marginTop: 1 },
  itemDetail: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },

  totals: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md + 2, ...Shadows.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  totalLabel: { ...Typography.caption, color: Colors.textSecondary },
  totalValue: { ...Typography.caption, fontWeight: '600', color: Colors.textPrimary },
  discountValue: { color: Colors.error },
  grandTotal: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: 4, marginBottom: 0 },
  grandLabel: { ...Typography.body2, fontWeight: '700', color: Colors.textPrimary },
  grandValue: { ...Typography.h5, fontWeight: '800', color: Colors.primary },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: Spacing.sm },
  rejectBtn: {
    flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: Colors.error,
  },
  rejectBtnText: { color: Colors.error, ...Typography.body1, fontWeight: '800' },
  btnOff: { opacity: 0.6 },
});
