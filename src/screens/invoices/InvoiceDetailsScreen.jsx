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
import { formatDate, formatCurrency } from '../../utils/formatters';
import { invoiceApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { SCREENS } from '../../constants';

export default function InvoiceDetailsScreen({ navigation, route }) {
  const { invoiceId } = route.params || {};
  const { user } = useAuth();

  const [invoice, setInvoice]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    if (!invoiceId) return;
    setError('');
    try {
      const data = await invoiceApi.get(invoiceId);
      setInvoice(data);
    } catch (err) {
      setError(err.message || 'Could not load invoice.');
    }
  }, [invoiceId]);

  useEffect(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <AppHeader title="Invoice" showBack onBack={() => navigation.goBack()} centerTitle variant="primary" />
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!invoice) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <AppHeader title="Invoice" showBack onBack={() => navigation.goBack()} centerTitle variant="primary" />
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorTextFull}>{error || 'Invoice not available yet.'}</Text>
          <TouchableOpacity onPress={onRefresh}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const paymentStatus = invoice.payment_status || 'Pending';
  const isPaid = paymentStatus === 'Paid';
  const charges = (invoice.charges?.transport || 0) + (invoice.charges?.packing || 0) + (invoice.charges?.other || 0);
  const paidAmount = Number(invoice.paid_amount || 0);
  const totalAmount = Number(invoice.total_amount || invoice.amount || 0);
  const due = Math.max(totalAmount - paidAmount, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AppHeader title="Invoice" showBack onBack={() => navigation.goBack()} centerTitle variant="primary" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── Tax invoice document ─────────────────────────── */}
        <View style={styles.doc}>
          {/* Document header */}
          <View style={styles.docHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.docBrand}>TAX INVOICE</Text>
              <Text style={styles.docNumber}>{invoice.invoice_number || 'Invoice'}</Text>
            </View>
            <StatusBadge status={paymentStatus} type="payment" size="md" />
          </View>

          {/* Meta grid */}
          <View style={styles.docMetaGrid}>
            <DocMeta label="Date" value={formatDate(invoice.invoice_date || invoice.created_at)} />
            <DocMeta label="Order Ref." value={invoice.order_code || '—'} onPress={() => invoice.order_id && navigation.navigate(SCREENS.ORDER_DETAILS, { orderId: invoice.order_id })} />
          </View>

          {/* Customer — the end-customer this order was created for by the retailer. */}
          <View style={styles.billTo}>
            <Text style={styles.billToLabel}>CUSTOMER</Text>
            <Text style={styles.billToName}>
              {invoice.customer?.name || user?.company?.name || user?.company_name || 'Customer'}
            </Text>
            {invoice.customer?.mobile ? <Text style={styles.billToLine}>+91 {invoice.customer.mobile}</Text> : null}
            {invoice.customer?.email ? <Text style={styles.billToLine}>{invoice.customer.email}</Text> : null}
            {invoice.customer?.address ? <Text style={styles.billToLine}>{invoice.customer.address}</Text> : null}

            {/* Created By — the person/company who generated this invoice */}
            {(invoice.created_by?.name || invoice.created_by?.company || invoice.created_by?.mobile) ? (
              <View style={styles.createdByBox}>
                <Text style={styles.createdByLabel}>CREATED BY{invoice.created_by?.type ? ` (${invoice.created_by.type})` : ''}</Text>
                {invoice.created_by?.name ? <Text style={styles.billToLine}>{invoice.created_by.name}</Text> : null}
                {invoice.created_by?.company ? <Text style={styles.billToLine}>{invoice.created_by.company}</Text> : null}
                {invoice.created_by?.mobile ? <Text style={styles.billToLine}>+91 {invoice.created_by.mobile}</Text> : null}
                {invoice.created_by?.email ? <Text style={styles.billToLine}>{invoice.created_by.email}</Text> : null}
              </View>
            ) : null}
          </View>

          {/* Items table */}
          <View style={styles.tableHead}>
            <Text style={[styles.tHead, styles.colItem]}>ITEM</Text>
            <Text style={[styles.tHead, styles.colQty]}>QTY</Text>
            <Text style={[styles.tHead, styles.colRate]}>RATE</Text>
            <Text style={[styles.tHead, styles.colAmt]}>AMOUNT</Text>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.colItem, styles.itemCell]}>
              <Text style={styles.itemName} numberOfLines={2}>{invoice.product_name || invoice.product?.name || 'Item'}</Text>
              {invoice.dispatch_code ? <Text style={styles.itemSub}>From {invoice.dispatch_code}</Text> : null}
            </View>
            <Text style={[styles.tCell, styles.colQty]}>{invoice.qty || 0} {invoice.unit || ''}</Text>
            <Text style={[styles.tCell, styles.colRate]}>{formatCurrency(invoice.unit_price)}</Text>
            <Text style={[styles.tCell, styles.colAmt, styles.itemAmt]}>{formatCurrency(invoice.amount)}</Text>
          </View>

          {/* Totals */}
          <View style={styles.totalsBlock}>
            <View style={styles.tRow}>
              <Text style={styles.tLabel}>Subtotal</Text>
              <Text style={styles.tValue}>{formatCurrency(invoice.amount)}</Text>
            </View>
            {invoice.gst_amount != null ? (
              <View style={styles.tRow}>
                <Text style={styles.tLabel}>GST{invoice.gst_percent ? ` (${invoice.gst_percent}%)` : ''}</Text>
                <Text style={styles.tValue}>{formatCurrency(invoice.gst_amount)}</Text>
              </View>
            ) : null}
            {charges > 0 && (
              <View style={styles.tRow}>
                <Text style={styles.tLabel}>Delivery charges</Text>
                <Text style={styles.tValue}>{formatCurrency(charges)}</Text>
              </View>
            )}
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>Grand Total</Text>
              <Text style={styles.grandValue}>{formatCurrency(totalAmount)}</Text>
            </View>
          </View>

          {/* Amount due strip */}
          <View style={[styles.dueStrip, isPaid && styles.dueStripPaid]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dueLabel, isPaid && styles.dueLabelPaid]}>{isPaid ? 'AMOUNT PAID' : 'AMOUNT DUE'}</Text>
              <Text style={styles.dueSub}>Paid {formatCurrency(paidAmount)} of {formatCurrency(totalAmount)}</Text>
            </View>
            <Text style={[styles.dueValue, isPaid && styles.dueValuePaid]} numberOfLines={1}>
              {formatCurrency(isPaid ? totalAmount : due)}
            </Text>
          </View>
        </View>

        {/* Payment method/date — only when there's something to show */}
        {(invoice.payment_method || invoice.paid_at) ? (
          <InfoCard title="Payment">
            {invoice.payment_method ? <Row label="Method" value={invoice.payment_method} /> : null}
            {invoice.paid_at ? <Row label="Paid On" value={formatDate(invoice.paid_at)} /> : null}
          </InfoCard>
        ) : null}

        {isPaid ? (
          <View style={styles.paidBanner}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.paidText}>This invoice has been paid in full.</Text>
          </View>
        ) : null}
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

const DocMeta = ({ label, value, onPress }) => {
  const content = (
    <>
      <Text style={styles.docMetaLabel}>{label}</Text>
      <Text style={[styles.docMetaValue, onPress && value !== '—' && styles.docMetaLink]} numberOfLines={1}>{value}</Text>
    </>
  );
  if (onPress && value !== '—') {
    return <TouchableOpacity style={styles.docMetaItem} onPress={onPress}>{content}</TouchableOpacity>;
  }
  return <View style={styles.docMetaItem}>{content}</View>;
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.screenPadding, paddingBottom: 40, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorTextFull: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  retryText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },

  headerCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm, borderLeftWidth: 3, borderLeftColor: Colors.secondary },
  invNo: { ...Typography.h4, color: Colors.textPrimary },
  invDate: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2 },
  orderLink: { ...Typography.caption, color: Colors.primary, fontWeight: '700', marginTop: 3 },

  noticeBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: Colors.infoBg, borderRadius: BorderRadius.md, padding: Spacing.md },
  noticeText: { ...Typography.caption, color: Colors.infoText, flex: 1, lineHeight: 18 },
  errorBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: Colors.errorBg, borderRadius: BorderRadius.md, padding: Spacing.md },
  errorText: { ...Typography.caption, color: Colors.error, flex: 1 },

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

  // Tax invoice document
  doc: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm },
  docHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: Spacing.md },
  docBrand: { ...Typography.caption, color: Colors.primary, fontWeight: '800', letterSpacing: 1 },
  docNumber: { ...Typography.h4, color: Colors.textPrimary, marginTop: 2 },
  docMetaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.md },
  docMetaItem: { width: '50%', paddingVertical: 5 },
  docMetaLabel: { ...Typography.caption, color: Colors.textTertiary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '700' },
  docMetaValue: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '700', marginTop: 2 },
  docMetaLink: { color: Colors.primary },
  billTo: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.md },
  billToLabel: { ...Typography.caption, color: Colors.textTertiary, fontWeight: '800', letterSpacing: 0.5, fontSize: 10 },
  billToName: { ...Typography.body1, color: Colors.textPrimary, fontWeight: '800', marginTop: 4 },
  billToLine: { ...Typography.caption, color: Colors.textSecondary, lineHeight: 19, marginTop: 2 },
  forCustomer: { marginTop: Spacing.sm },
  createdByBox: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  createdByLabel: { ...Typography.caption, color: Colors.textTertiary, fontWeight: '800', letterSpacing: 0.5, fontSize: 10, marginBottom: 2 },
  tableHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, marginTop: Spacing.lg, paddingBottom: Spacing.sm },
  tHead: { ...Typography.caption, color: Colors.textTertiary, fontWeight: '800', fontSize: 10, letterSpacing: 0.3 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: Spacing.md },
  tCell: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '600' },
  colItem: { flex: 1, paddingRight: Spacing.sm },
  colQty: { width: 62, textAlign: 'center' },
  colRate: { width: 70, textAlign: 'right' },
  colAmt: { width: 82, textAlign: 'right' },
  itemCell: { justifyContent: 'center' },
  itemName: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '700' },
  itemSub: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2 },
  itemAmt: { fontWeight: '800' },
  totalsBlock: { marginTop: Spacing.md },
  tRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  tLabel: { ...Typography.caption, color: Colors.textSecondary },
  tValue: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '700' },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4, paddingTop: Spacing.sm },
  grandLabel: { ...Typography.h5, color: Colors.textPrimary },
  grandValue: { ...Typography.h5, color: Colors.textPrimary },
  dueStrip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.errorBg, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.lg },
  dueStripPaid: { backgroundColor: Colors.successBg },
  dueLabel: { ...Typography.caption, color: Colors.error, fontWeight: '800', letterSpacing: 0.5 },
  dueLabelPaid: { color: Colors.successText },
  dueSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  dueValue: { ...Typography.h3, color: Colors.error, marginLeft: Spacing.sm, maxWidth: '46%', textAlign: 'right' },
  dueValuePaid: { color: Colors.successText },

  actionBtn: { marginTop: 4 },
  collectNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md },
  collectText: { ...Typography.caption, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  paidBanner: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: Colors.successBg, borderRadius: BorderRadius.md, padding: Spacing.base },
  paidText: { ...Typography.body2, color: Colors.successText, fontWeight: '600', flex: 1 },
});
