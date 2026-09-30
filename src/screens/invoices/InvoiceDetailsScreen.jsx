/**
 * src/screens/invoices/InvoiceDetailsScreen.jsx  (Retailer app)
 *
 * Structural parity with the wholesaler's `invoice/InvoiceDetailScreen.jsx`:
 *   [ branded sheet: logo + EazyEnquiry wordmark | INVOICE + no + payment badge ]
 *   [ ──── orange rule ──── ]
 *   [ BILLED TO box              | DETAILS box                            ]
 *   [ navy table head: ITEM · QTY · RATE · AMOUNT + item row               ]
 *   [ right-aligned totals: Subtotal / GST / Grand Total / Paid / Balance  ]
 *   [ footnote                                                             ]
 *   [ bottom action bar (absolute) ]
 *
 * ── Deliberate deviations from the wholesaler, and why ───────────────────────
 *
 * 1. FIELD MAPPING. The wholesaler reads `invoice.items[]` and `invoice.company`
 *    because its backend returns those. The retailer's `retailerInvoiceResponse`
 *    (backend/src/controllers/Retailer Management/retailerMarketplaceController.js)
 *    returns NEITHER: it flattens the invoice to a single product
 *    (`product_name`, `qty`, `unit`, `unit_price`, `amount`) and exposes
 *    `retailer` / `created_by` / `customer` blocks instead. A literal copy of the
 *    wholesaler's JSX would render "No items" and "—" everywhere, so the same
 *    layout is bound to the fields that actually exist.
 *
 * 2. HEADER. Uses this app's `AppHeader` (same as the rewritten InvoicesScreen)
 *    rather than the wholesaler's inline header, so the two apps don't look like
 *    two different products stitched together.
 *
 * 3. BOTTOM BAR. Same as the wholesaler's: "Download Invoice", which renders the
 *    branded sheet to a PDF and opens the native share/save sheet. Uses
 *    `src/utils/invoicePdf.js` — the same template as the wholesaler's, fed from
 *    the retailer's DTO fields.
 *
 * Removed from the previous version (dead code — the retailer DTO never returns
 * these): the "Payment" InfoCard (`payment_method` / `paid_at`), the
 * "Linked Dispatch" InfoCard (`dispatch`), and the `docMetaGrid` order-ref link.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, ScrollView, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import AppHeader from '../../components/common/AppHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { invoiceApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { generateAndShareInvoice } from '../../utils/invoicePdf';

const LOGO = require('../../assets/logo.jpeg');

export default function InvoiceDetailsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { invoiceId, invoice: passed } = route.params || {};
  const { user } = useAuth();

  const [invoice, setInvoice]   = useState(passed || null);
  const [loading, setLoading]   = useState(!passed);
  const [error, setError]       = useState('');
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (!invoiceId && !passed?.id) { setLoading(false); return; }
    setError('');
    try {
      const data = await invoiceApi.get(invoiceId || passed.id);
      setInvoice(data);
    } catch (err) {
      // Keep whatever we were handed so the sheet still renders something.
      setError(err.message || 'Could not load invoice.');
    } finally {
      setLoading(false);
    }
  }, [invoiceId, passed]);

  useEffect(() => { load(); }, [load]);

  // The DTO flattens to one product, but stay tolerant of an `items[]` array in
  // case the backend starts returning one (listOrderInvoices already selects it).
  const rawItems = Array.isArray(invoice?.items) && invoice.items.length
    ? invoice.items
    : [{
        product_name: invoice?.product_name || invoice?.product?.name,
        product_code: invoice?.product?.code,
        qty: invoice?.qty,
        unit: invoice?.unit,
        rate: invoice?.unit_price,
        total: invoice?.amount,
      }].filter((it) => it.product_name || it.qty);

  const subtotal = Number(invoice?.subtotal ?? invoice?.amount ?? 0);
  const gst      = Number(invoice?.gst_amount || 0);
  const other    = Number(invoice?.charges?.other || 0);
  const discount = Number(invoice?.discount_amount || 0);
  const grand    = Number(invoice?.grand_total ?? invoice?.total_amount ?? 0);
  const paid     = Number(invoice?.paid_amount || 0);
  const balance  = Number(invoice?.balance_due ?? Math.max(grand - paid, 0));
  const paymentStatus = invoice?.payment_status || 'Unpaid';

  const onDownload = async () => {
    if (!invoice) return;
    setDownloading(true);
    try {
      await generateAndShareInvoice(invoice);
    } catch (e) {
      // A dismissed share sheet is not an error worth alerting about.
      if (e?.message && !/dismiss|cancel/i.test(e.message)) {
        Alert.alert('Download failed', e.message);
      }
    } finally {
      setDownloading(false);
    }
  };

  if (loading && !invoice) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
        <AppHeader title="Invoice" showBack onBack={() => navigation.goBack()} centerTitle variant="primary" />
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!invoice) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
        <AppHeader title="Invoice" showBack onBack={() => navigation.goBack()} centerTitle variant="primary" />
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorTextFull}>{error || 'Invoice not available yet.'}</Text>
          <TouchableOpacity onPress={load}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // BILLED TO = the retailer receiving the invoice. The retailer DTO carries the
  // buyer's own company under `retailer`; fall back to the signed-in company.
  const bill = invoice.retailer || {};
  const billName    = bill.company || bill.name || user?.company?.name || user?.company_name || '—';
  const billOwner   = bill.name && bill.company ? bill.name : (user?.owner_name || '');
  const billMobile  = bill.mobile || user?.mobile || '';
  const billEmail   = bill.email || user?.email || '';
  const issuer      = invoice.created_by || {};
  const customer    = invoice.customer || {};

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
      <AppHeader title="Invoice" showBack onBack={() => navigation.goBack()} centerTitle variant="primary" />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 108 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── Branded invoice sheet ─────────────────────────────── */}
        <View style={styles.sheet}>
          <View style={styles.brandRow}>
            <View style={styles.brandLeft}>
              <Image source={LOGO} style={styles.logo} resizeMode="contain" />
              <View style={styles.brandText}>
                <Text style={styles.brandName}>
                  Eazy<Text style={styles.brandNameAccent}>Enquiry</Text>
                </Text>
                <Text style={styles.brandTag}>Wholesale &amp; Trade Platform</Text>
              </View>
            </View>
            <View style={styles.brandRight}>
              <Text style={styles.invWord}>INVOICE</Text>
              <Text style={styles.invNo} numberOfLines={1}>{invoice.invoice_number || '—'}</Text>
              <StatusBadge status={paymentStatus} type="payment" />
            </View>
          </View>

          <View style={styles.rule} />

          {/* Billed to + details */}
          <View style={styles.metaRow}>
            <View style={styles.metaBox}>
              <Text style={styles.metaHead}>BILLED TO</Text>
              <Text style={styles.metaStrong} numberOfLines={2}>{billName}</Text>
              {billOwner ? <Text style={styles.metaLine}>{billOwner}</Text> : null}
              {billMobile ? <Text style={styles.metaLine}>+91 {billMobile}</Text> : null}
              {billEmail ? <Text style={styles.metaLine}>{billEmail}</Text> : null}
              {customer.name ? (
                <Text style={styles.metaLine}>
                  For: <Text style={styles.b}>{customer.name}</Text>
                </Text>
              ) : null}
            </View>

            <View style={styles.metaBox}>
              <Text style={styles.metaHead}>DETAILS</Text>
              {invoice.order_code ? (
                <Text style={styles.metaLine}>Order: <Text style={styles.b}>{invoice.order_code}</Text></Text>
              ) : null}
              <Text style={styles.metaLine}>
                Date: <Text style={styles.b}>{formatDate(invoice.invoice_date || invoice.created_at)}</Text>
              </Text>
              <Text style={styles.metaLine}>
                Status: <Text style={styles.b}>{paymentStatus}</Text>
              </Text>
              {issuer.company || issuer.name ? (
                <Text style={styles.metaLine} numberOfLines={2}>
                  Issued by: <Text style={styles.b}>{issuer.company || issuer.name}</Text>
                </Text>
              ) : null}
            </View>
          </View>

          {/* Items table */}
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.colItem]}>ITEM</Text>
            <Text style={[styles.th, styles.colQty, styles.tRight]}>QTY</Text>
            <Text style={[styles.th, styles.colRate, styles.tRight]}>RATE</Text>
            <Text style={[styles.th, styles.colAmt, styles.tRight]}>AMOUNT</Text>
          </View>

          {rawItems.length === 0 ? (
            <Text style={styles.noItems}>No items on this invoice.</Text>
          ) : rawItems.map((it, i) => (
            <View key={i} style={styles.tr}>
              <View style={[styles.colItem, styles.itemCell]}>
                <Text style={styles.itemName} numberOfLines={2}>{it.product_name || 'Item'}</Text>
                {it.product_code ? <Text style={styles.itemSub}>{it.product_code}</Text> : null}
                {(it.size || it.finish || it.color) ? (
                  <Text style={styles.itemSub}>
                    {[it.size, it.finish, it.color].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.td, styles.colQty, styles.tRight]}>
                {it.qty || 0} {it.unit || ''}
              </Text>
              <Text style={[styles.td, styles.colRate, styles.tRight]}>{formatCurrency(it.rate)}</Text>
              <Text style={[styles.td, styles.colAmt, styles.tRight, styles.itemAmt]}>
                {formatCurrency(it.total)}
              </Text>
            </View>
          ))}

          {/* Totals */}
          <View style={styles.totalsWrap}>
            <View style={styles.totals}>
              <SumRow label="Subtotal" value={formatCurrency(subtotal)} />
              <SumRow label="GST" value={formatCurrency(gst)} />
              {other > 0 ? <SumRow label="Other charges" value={formatCurrency(other)} /> : null}
              {discount > 0 ? <SumRow label="Discount" value={`- ${formatCurrency(discount)}`} /> : null}

              <View style={styles.grandRow}>
                <Text style={styles.grandLabel}>Grand Total</Text>
                <Text style={styles.grandValue}>{formatCurrency(grand)}</Text>
              </View>

              <SumRow label="Paid" value={formatCurrency(paid)} />
              <SumRow label="Balance Due" value={formatCurrency(balance)} strong danger={balance > 0} />
            </View>
          </View>

          <Text style={styles.footNote}>
            Computer-generated invoice from EazyEnquiry. Thank you for your business.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom action bar — mirrors the wholesaler's */}
      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={[styles.actionBtn, downloading && styles.actionBtnOff]}
          onPress={onDownload}
          disabled={downloading}
          activeOpacity={0.9}
        >
          {downloading ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Ionicons name="download-outline" size={19} color={Colors.white} />
          )}
          <Text style={styles.actionBtnText}>{downloading ? 'Preparing…' : 'Download Invoice'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const SumRow = ({ label, value, strong, danger }) => (
  <View style={styles.sumRow}>
    <Text style={[styles.sumLabel, strong && styles.sumLabelStrong]}>{label}</Text>
    <Text style={[styles.sumValue, strong && styles.sumValueStrong, danger && styles.sumDanger]}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorTextFull: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  retryText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },

  errorBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: Colors.errorBg, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  errorText: { ...Typography.caption, color: Colors.error, flex: 1 },

  // ── Sheet ────────────────────────────────────────────────────
  sheet: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
    padding: Spacing.base, ...Shadows.sm,
  },

  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: Spacing.sm },
  brandText: { flex: 1 },
  logo: { width: 42, height: 42, borderRadius: BorderRadius.button },
  brandName: { ...Typography.h4, color: Colors.textPrimary, fontWeight: '900' },
  brandNameAccent: { color: Colors.primary },
  brandTag: { ...Typography.caption, fontSize: 10, color: Colors.textSecondary, marginTop: 1 },
  brandRight: { alignItems: 'flex-end', maxWidth: '46%' },
  invWord: { ...Typography.h4, fontWeight: '900', letterSpacing: 2, color: Colors.textPrimary },
  invNo: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2, marginBottom: 6 },

  rule: {
    height: 3, backgroundColor: Colors.primary,
    borderRadius: 2, marginVertical: Spacing.md + 2,
  },

  metaRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base },
  metaBox: { flex: 1, backgroundColor: Colors.background, borderRadius: BorderRadius.button, padding: Spacing.md },
  metaHead: {
    ...Typography.caption, fontSize: 10, letterSpacing: 1,
    color: Colors.textSecondary, fontWeight: '800', marginBottom: 6,
  },
  metaStrong: { ...Typography.body2, fontWeight: '800', color: Colors.textPrimary },
  metaLine: { ...Typography.caption, color: Colors.textPrimary, marginTop: 2, lineHeight: 18 },
  b: { fontWeight: '700' },

  // ── Items table ──────────────────────────────────────────────
  tableHead: {
    flexDirection: 'row', backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm,
  },
  th: { color: Colors.white, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 },
  tRight: { textAlign: 'right' },
  tr: {
    flexDirection: 'row', paddingVertical: Spacing.sm + 1, paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight, alignItems: 'flex-start',
  },
  colItem: { flex: 1, paddingRight: Spacing.sm },
  colQty: { width: 56 },
  colRate: { width: 68 },
  colAmt: { width: 82 },
  itemCell: { justifyContent: 'center' },
  itemName: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '700' },
  itemSub: { ...Typography.caption, fontSize: 10.5, color: Colors.textTertiary, marginTop: 1 },
  td: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '600' },
  itemAmt: { fontWeight: '800' },
  noItems: { textAlign: 'center', color: Colors.textSecondary, padding: Spacing.base, ...Typography.caption },

  // ── Totals ───────────────────────────────────────────────────
  totalsWrap: { alignItems: 'flex-end', marginTop: Spacing.base },
  totals: { width: '76%' },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  sumLabel: { ...Typography.caption, color: Colors.textSecondary, flex: 1, paddingRight: Spacing.sm },
  sumLabelStrong: { fontWeight: '800', color: Colors.textPrimary },
  sumValue: { ...Typography.caption, fontWeight: '700', color: Colors.textPrimary },
  sumValueStrong: { fontSize: 14, fontWeight: '900' },
  sumDanger: { color: Colors.error },
  grandRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 2, borderTopColor: Colors.secondary,
    marginTop: 6, paddingTop: Spacing.sm,
  },
  grandLabel: { ...Typography.body2, fontWeight: '900', color: Colors.textPrimary },
  grandValue: { ...Typography.h4, fontWeight: '900', color: Colors.primary },

  footNote: {
    ...Typography.caption, fontSize: 10.5, color: Colors.textTertiary, textAlign: 'center',
    marginTop: Spacing.lg, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },

  // ── Bottom action bar ────────────────────────────────────────
  actionBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, paddingVertical: 15,
  },
  actionBtnOff: { opacity: 0.7 },
  actionBtnText: { color: Colors.white, ...Typography.body1, fontWeight: '800' },
});
