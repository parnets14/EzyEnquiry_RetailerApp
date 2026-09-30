/**
 * src/screens/invoices/InvoicesScreen.jsx  (Retailer app)
 *
 * Structural parity with the wholesaler's `invoice/InvoiceListScreen.jsx`:
 *   [ navy header "My Invoices" ]
 *   [ card: receipt tile · invoice no · "<order> · <date>" · <product/qty>
 *           ─────────────────────────────── total + payment badge ]
 *   [ card foot: "Balance due: ₹x" / "✓ Fully paid"      [ View ] ]
 *   [ empty: receipt icon + "No invoices yet" + hint ]
 *
 * The wholesaler has NO search box and NO status tabs — this list is deliberately
 * unfiltered to match it. The retailer-only `orderId` param mode is kept: opening
 * this screen from an order still scopes the list to that order's invoices.
 *
 * The wholesaler's card shows "N items" from `items[]`; a retailer invoice covers
 * a single product, so the equivalent slot shows the product name + qty.
 *
 * Note: the wholesaler's "Download Invoice" lives on the DETAIL screen and needs
 * `react-native-html-to-pdf` + `react-native-share`, which this app does not have.
 */
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import AppHeader from '../../components/common/AppHeader';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { invoiceApi } from '../../utils/api';
import { SCREENS } from '../../constants';

export default function InvoicesScreen({ navigation, route }) {
  const { orderId } = route.params || {};

  const [invoices, setInvoices]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState('');

  const load = useCallback(async (isRefresh) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const data = orderId ? await invoiceApi.byOrder(orderId) : await invoiceApi.list({ limit: 100 });
      setInvoices(data?.invoices || []);
    } catch (err) {
      // A 404 means the endpoint isn't available for this order yet — show the
      // empty state rather than a scary error, same as the wholesaler's swallow.
      if (err.status === 404) setInvoices([]);
      else setError(err.message || 'Could not load invoices.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [orderId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const renderItem = ({ item }) => <InvoiceCard invoice={item} navigation={navigation} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
      <AppHeader
        title={orderId ? 'Order Invoices' : 'My Invoices'}
        showBack
        onBack={() => navigation.goBack()}
        centerTitle
        variant="primary"
      />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load()}><Text style={styles.retryText}>Tap to retry</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(i, idx) => i.id || i.invoice_number || String(idx)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[Colors.primary]} />}
          ListEmptyComponent={
            <EmptyState
              iconName="receipt-outline"
              title="No invoices yet"
              message="Invoices are generated once your order is dispatched. They'll appear here for you to view."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const InvoiceCard = ({ invoice, navigation }) => {
  const paymentStatus = invoice.payment_status || 'Unpaid';
  const total   = Number(invoice.total_amount || invoice.amount || 0);
  const paid    = Number(invoice.paid_amount || 0);
  const balance = Math.max(total - paid, 0);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.iconBox}>
          <Ionicons name="receipt-outline" size={20} color={Colors.primary} />
        </View>

        <View style={styles.cardMid}>
          <Text style={styles.invNo}>{invoice.invoice_number || 'Invoice'}</Text>
          <Text style={styles.meta}>
            {invoice.order_code ? `${invoice.order_code} · ` : ''}{formatDate(invoice.invoice_date || invoice.created_at)}
          </Text>
          <Text style={styles.metaSub} numberOfLines={1}>
            {[invoice.product_name, invoice.qty ? `${invoice.qty} ${invoice.unit || ''}`.trim() : '']
              .filter(Boolean).join(' · ') || '—'}
          </Text>
        </View>

        <View style={styles.cardRight}>
          <Text style={styles.total}>{formatCurrency(total)}</Text>
          <StatusBadge status={paymentStatus} type="payment" />
        </View>
      </View>

      <View style={styles.cardFoot}>
        {balance > 0 ? (
          <Text style={styles.balDue}>
            Balance due: <Text style={styles.balDueVal}>{formatCurrency(balance)}</Text>
          </Text>
        ) : (
          <Text style={styles.paidText}>✓ Fully paid</Text>
        )}

        <TouchableOpacity
          style={styles.viewBtn}
          onPress={() => navigation.navigate(SCREENS.INVOICE_DETAILS, { invoiceId: invoice.id })}
          activeOpacity={0.85}
        >
          <Ionicons name="eye-outline" size={16} color={Colors.white} />
          <Text style={styles.viewBtnText}>View</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorText: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  retryText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },

  list: { padding: Spacing.screenPadding, paddingBottom: 40, gap: 12 },

  card: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardMid: { flex: 1 },
  cardRight: { alignItems: 'flex-end' },
  iconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center',
  },
  invNo: { ...Typography.h5, color: Colors.textPrimary },
  meta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  metaSub: { ...Typography.caption, color: Colors.textTertiary, marginTop: 1 },
  total: { ...Typography.h4, color: Colors.primary, marginBottom: 4 },

  cardFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  balDue: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  balDueVal: { color: Colors.error, fontWeight: '800' },
  paidText: { ...Typography.caption, fontWeight: '700', color: Colors.successText, flex: 1 },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  viewBtnText: { color: Colors.white, ...Typography.caption, fontWeight: '800' },
});
