import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, RefreshControl, ActivityIndicator, TextInput,
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

const TABS = ['All', 'Unpaid', 'Partially Paid', 'Paid'];

export default function InvoicesScreen({ navigation, route }) {
  const { orderId } = route.params || {};

  const [activeTab, setActiveTab]   = useState('All');
  const [invoices, setInvoices]     = useState([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState('');

  const load = useCallback(async (tab = 'All') => {
    setError('');
    try {
      let data;
      if (orderId) {
        data = await invoiceApi.byOrder(orderId);
      } else {
        const params = tab !== 'All' ? { payment_status: tab, limit: 100 } : { limit: 100 };
        data = await invoiceApi.list(params);
      }
      let list = data?.invoices || [];
      if (tab !== 'All') {
        list = list.filter(i => (i.payment_status || 'Unpaid') === tab);
      }
      setInvoices(list);
    } catch (err) {
      if (err.status === 404) {
        setInvoices([]);           // Backend endpoint not available yet
      } else {
        setError(err.message || 'Could not load invoices.');
      }
    }
  }, [orderId]);

  useEffect(() => {
    (async () => { setLoading(true); await load(activeTab); setLoading(false); })();
  }, [load, activeTab]);

  const onRefresh = async () => { setRefreshing(true); await load(activeTab); setRefreshing(false); };
  const onTabChange = (tab) => { setActiveTab(tab); setLoading(true); load(tab).then(() => setLoading(false)); };

  // Client-side search over invoice number / order code / product.
  const q = search.trim().toLowerCase();
  const visibleInvoices = q
    ? invoices.filter(i =>
        (i.invoice_number || i.invoice_no || '').toLowerCase().includes(q) ||
        (i.order_code || '').toLowerCase().includes(q) ||
        (i.product_name || '').toLowerCase().includes(q))
    : invoices;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AppHeader
        title={orderId ? 'Order Invoices' : 'Invoices'}
        showBack
        onBack={() => navigation.goBack()}
        centerTitle
        variant="primary"
      />

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search invoice, order, product…"
            placeholderTextColor={Colors.textTertiary}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.tabsWrapper}>
        <FlatList
          data={TABS}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
          keyExtractor={t => t}
          renderItem={({ item }) => {
            const active = activeTab === item;
            return (
              <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={() => onTabChange(item)}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /><Text style={styles.loadingText}>Loading invoices…</Text></View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh}><Text style={styles.retryText}>Tap to retry</Text></TouchableOpacity>
        </View>
      ) : visibleInvoices.length === 0 ? (
        <EmptyState
          iconName="receipt-outline"
          title={q ? 'No matches' : 'No Invoices'}
          message={q
            ? `No invoices match “${search.trim()}”.`
            : "Invoices are generated once your order is dispatched. They'll appear here for you to view."}
        />
      ) : (
        <FlatList
          data={visibleInvoices}
          keyExtractor={(i, idx) => i.id || i.invoice_number || String(idx)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          renderItem={({ item }) => (
            <InvoiceCard
              invoice={item}
              onPress={() => navigation.navigate(SCREENS.INVOICE_DETAILS, { invoiceId: item.id })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const InvoiceCard = ({ invoice, onPress }) => {
  const paymentStatus = invoice.payment_status || 'Unpaid';
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}><Ionicons name="receipt-outline" size={20} color={Colors.secondary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.invNo}>{invoice.invoice_number || 'Invoice'}</Text>
          <Text style={styles.invMeta}>
            {invoice.order_code ? `${invoice.order_code} · ` : ''}{formatDate(invoice.invoice_date || invoice.created_at)}
          </Text>
        </View>
        <StatusBadge status={paymentStatus} type="payment" />
      </View>

      <View style={styles.cardBody}>
        {invoice.product_name ? <Text style={styles.product} numberOfLines={1}>{invoice.product_name}</Text> : null}
        <View style={styles.amountRow}>
          <View>
            <Text style={styles.amountLabel}>Qty</Text>
            <Text style={styles.amountValue}>{invoice.qty || 0} {invoice.unit || ''}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amountLabel}>Amount</Text>
            <Text style={styles.amountTotal}>{formatCurrency(invoice.total_amount || invoice.amount)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.viewText}>View Invoice</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  searchWrap: { backgroundColor: Colors.white, paddingHorizontal: Spacing.screenPadding, paddingTop: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 42 },
  searchInput: { flex: 1, ...Typography.body2, color: Colors.textPrimary, paddingVertical: 0 },
  tabsWrapper: { backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  tabs: { paddingHorizontal: Spacing.screenPadding, paddingVertical: 10, gap: 6 },
  tab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: BorderRadius.chip, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  tabActive: { borderColor: Colors.secondary, backgroundColor: Colors.secondary },
  tabText: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: Colors.white, fontWeight: '700' },
  list: { padding: Spacing.screenPadding, paddingBottom: 40, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  loadingText: { ...Typography.body2, color: Colors.textSecondary },
  errorText: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  retryText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },

  card: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.secondaryBg, alignItems: 'center', justifyContent: 'center' },
  invNo: { ...Typography.h5, color: Colors.textPrimary },
  invMeta: { ...Typography.caption, color: Colors.textTertiary, marginTop: 1 },
  cardBody: { marginTop: Spacing.md },
  product: { ...Typography.body2, color: Colors.textSecondary, marginBottom: 6 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md },
  amountLabel: { ...Typography.caption, color: Colors.textTertiary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 },
  amountValue: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '700', marginTop: 2 },
  amountTotal: { ...Typography.h4, color: Colors.primary, marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  viewText: { ...Typography.caption, color: Colors.primary, fontWeight: '700' },
});
