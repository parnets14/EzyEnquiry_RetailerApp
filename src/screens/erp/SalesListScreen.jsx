/**
 * src/screens/erp/SalesListScreen.jsx  (Retailer app)
 *
 * Sales list with payment-status filters, search, summary strip and a detail
 * sheet. Ported from `wholesalerapp/src/screens/sales/SalesListScreen.jsx` —
 * same structure and status maps, but rebuilt on the retailer's Ionicons/theme
 * and pointed at the retailer ERP API (/api/retailer/erp/sales).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList, Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { SCREENS } from '../../constants';
import { erpApi } from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  ErpHeader, ErpSummaryStrip, ErpSearchBox, ErpTabs, ErpCard, ErpSectionLabel,
  ErpInfoRow, ErpBadge, ErpMetaChip, ErpLoading, ErpError, ErpEmpty, ErpPrimaryAction,
  PAY_STATUS, SALE_STATUS, ERP,
} from '../../components/erp';

const FILTER_TABS = ['All', 'Pending', 'Partial', 'Paid', 'Overdue'];

export default function SalesListScreen({ navigation }) {
  const [sales,      setSales]      = useState([]);
  const [summary,    setSummary]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');
  const [filterTab,  setFilterTab]  = useState('All');
  const [search,     setSearch]     = useState('');
  const [detailId,   setDetailId]   = useState(null);
  const searchTimer = useRef(null);
  const insets = useSafeAreaInsets();

  const load = useCallback(async (q = '') => {
    setLoading(true); setError('');
    try {
      const params = {};
      if (filterTab !== 'All') params.payment_status = filterTab;
      if (q.trim()) params.search = q.trim();
      const res = await erpApi.listSales(params);
      const data = res?.data ?? res;
      setSales(Array.isArray(data) ? data : data?.sales ?? []);
      if (data?.summary) setSummary(data.summary);
    } catch (e) {
      setError(e?.message || 'Failed to load sales');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [filterTab]);

  useEffect(() => { load(search); }, [filterTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(search), 380);
    return () => clearTimeout(searchTimer.current);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = () => { setRefreshing(true); load(search); };

  const s = summary || {};

  const renderItem = ({ item }) => {
    const pMeta = PAY_STATUS[item.payment_status] || PAY_STATUS.Pending;
    const sMeta = SALE_STATUS[item.sale_status] || null;
    return (
      <TouchableOpacity style={st.card} onPress={() => setDetailId(item._id)} activeOpacity={0.82}>
        <View style={[st.cardAccent, { backgroundColor: pMeta.color }]} />
        <View style={st.cardBody}>
          <View style={st.cardTop}>
            <View style={st.cardLeft}>
              <Text style={st.custName} numberOfLines={1}>{item.customer_name || '—'}</Text>
              <Text style={st.saleDate}>{formatDate(item.sale_date || item.created_at)}</Text>
            </View>
            <View style={st.cardRight}>
              <Text style={st.amount}>{formatCurrency(item.grand_total || item.total_amount || 0)}</Text>
              <ErpBadge label={item.payment_status || 'Pending'} {...pMeta} dot />
            </View>
          </View>

          <View style={st.cardMeta}>
            {item.sale_code ? <ErpMetaChip icon="receipt-outline" label={item.sale_code} /> : null}
            {item.invoice_number ? <ErpMetaChip icon="document-text-outline" label={`Inv #${item.invoice_number}`} /> : null}
            {item.warehouse_name ? <ErpMetaChip icon="business-outline" label={item.warehouse_name} /> : null}
            {item.sales_staff_name ? <ErpMetaChip icon="person-outline" label={item.sales_staff_name} /> : null}
            {sMeta ? <ErpBadge label={item.sale_status} {...sMeta} /> : null}
          </View>

          {item.outstanding > 0 ? (
            <View style={st.outRow}>
              <Ionicons name="alert-circle-outline" size={12} color="#DC2626" />
              <Text style={st.outTxt}>Outstanding: {formatCurrency(item.outstanding)}</Text>
            </View>
          ) : null}
        </View>
        <View style={st.cardArrow}>
          <Ionicons name="chevron-forward" size={16} color="#B0B5C3" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader
        title="Sales"
        subtitle="Revenue & transactions"
        // Sales is now a bottom tab (wholesaler parity), so as a tab root there is
        // nothing to go back to — ErpHeader hides the button when onBack is undefined.
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        actions={[
          { key: 'report', icon: 'bar-chart-outline', onPress: () => navigation.navigate(SCREENS.SALES_REPORT) },
          { key: 'add',    icon: 'add',               onPress: () => navigation.navigate(SCREENS.SALES_ENTRY) },
        ]}>
        {s.total_sales > 0 ? (
          <ErpSummaryStrip items={[
            { label: 'Revenue', value: formatCurrency(s.total_revenue || 0) },
            { label: 'Sales',   value: s.total_sales || 0 },
            { label: 'Paid',    value: s.paid_count || 0,    color: '#4ADE80' },
            { label: 'Pending', value: s.pending_count || 0, color: '#FCD34D' },
          ]} />
        ) : null}
        <ErpSearchBox value={search} onChangeText={setSearch} placeholder="Search customer, invoice, code…" />
      </ErpHeader>

      <ErpTabs tabs={FILTER_TABS} active={filterTab} onChange={setFilterTab} />

      {loading && !sales.length ? (
        <ErpLoading label="Loading sales…" />
      ) : error ? (
        <ErpError message={error} onRetry={() => load(search)} />
      ) : (
        <FlatList
          data={sales}
          keyExtractor={i => i._id || String(Math.random())}
          renderItem={renderItem}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          ListEmptyComponent={
            <ErpEmpty
              icon="trending-up-outline"
              title="No sales found"
              subtitle="Sales appear here once you record one, or when a marketplace order is delivered."
            />
          }
        />
      )}

      <View style={[st.fabWrap, { bottom: 16 + insets.bottom }]}>
        <ErpPrimaryAction label="New Sale" onPress={() => navigation.navigate(SCREENS.SALES_ENTRY)} />
      </View>

      <SaleDetailModal
        visible={!!detailId}
        saleId={detailId}
        onClose={() => setDetailId(null)}
      />
    </SafeAreaView>
  );
}

/* ── Detail sheet ───────────────────────────────────────────────────────── */
function SaleDetailModal({ visible, saleId, onClose }) {
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !saleId) return;
    setLoading(true);
    erpApi.getSale(saleId)
      .then(r => setSale(r?.data ?? r))
      .catch(() => setSale(null))
      .finally(() => setLoading(false));
  }, [visible, saleId]);

  if (!visible) return null;

  const pMeta = PAY_STATUS[sale?.payment_status] || PAY_STATUS.Pending;
  const sMeta = SALE_STATUS[sale?.sale_status] || SALE_STATUS.Confirmed;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={st.safe} edges={['top']}>
        <ErpHeader title="Sale Detail" onBack={onClose} />

        {loading ? <ErpLoading /> : !sale ? (
          <ErpEmpty icon="alert-circle-outline" title="Sale not found" />
        ) : (
          <ScrollView contentContainerStyle={st.modalContent} showsVerticalScrollIndicator={false}>
            <ErpCard>
              <View style={st.detailRow}>
                <Text style={st.saleCode}>{sale.sale_code || '—'}</Text>
                <ErpBadge label={sale.payment_status || 'Pending'} {...pMeta} dot />
              </View>
              <Text style={st.detailDate}>{formatDate(sale.sale_date || sale.created_at)}</Text>
              {sale.sale_status ? (
                <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                  <ErpBadge label={sale.sale_status} {...sMeta} />
                </View>
              ) : null}
              {sale.sales_staff_name ? (
                <View style={{ marginTop: 10 }}>
                  <ErpInfoRow label="Sales staff" value={sale.sales_staff_name} last />
                </View>
              ) : null}
            </ErpCard>

            <ErpCard>
              <ErpSectionLabel>Customer information</ErpSectionLabel>
              <ErpInfoRow label="Name" value={sale.customer_name || '—'} />
              {sale.customer_id?.mobile ? <ErpInfoRow label="Phone" value={sale.customer_id.mobile} /> : null}
              {sale.customer_id?.gstin ? <ErpInfoRow label="GSTIN" value={sale.customer_id.gstin} /> : null}
              {sale.billing_address ? <ErpInfoRow label="Billing address" value={sale.billing_address} /> : null}
              {sale.delivery_address ? <ErpInfoRow label="Delivery address" value={sale.delivery_address} last /> : null}
            </ErpCard>

            {sale.order_id ? (
              <ErpCard>
                <ErpSectionLabel>Order information</ErpSectionLabel>
                <ErpInfoRow label="Order #" value={sale.order_id?.order_code || '—'} />
                <ErpInfoRow label="Order status" value={sale.order_id?.status || '—'} />
                {sale.invoice_number ? <ErpInfoRow label="Invoice #" value={sale.invoice_number} /> : null}
                {sale.warehouse_name ? <ErpInfoRow label="Warehouse" value={sale.warehouse_name} last /> : null}
              </ErpCard>
            ) : null}

            <ErpCard>
              <ErpSectionLabel>Product details</ErpSectionLabel>
              <Text style={st.prodName}>{sale.product_name || '—'}</Text>
              {sale.product_code ? <Text style={st.prodCode}>{sale.product_code}</Text> : null}
              <View style={{ marginTop: 8 }}>
                <ErpInfoRow label="Quantity" value={String(sale.qty || 0)} />
                <ErpInfoRow label="Rate" value={formatCurrency(sale.rate || 0)} />
                <ErpInfoRow label="Amount" value={formatCurrency(sale.amount || 0)} />
                <ErpInfoRow label={`GST (${sale.gst_percent || 18}%)`} value={formatCurrency(sale.gst_amount || 0)} last />
              </View>
            </ErpCard>

            <ErpCard>
              <ErpSectionLabel>Financial summary</ErpSectionLabel>
              <ErpInfoRow label="Subtotal" value={formatCurrency(sale.amount || 0)} />
              <ErpInfoRow label="GST" value={formatCurrency(sale.gst_amount || 0)} />
              {sale.discount > 0 ? (
                <ErpInfoRow label="Discount" value={`-${formatCurrency(sale.discount)}`} color={Colors.error} />
              ) : null}
              <ErpInfoRow label="Grand total" value={formatCurrency(sale.grand_total || sale.total_amount || 0)} bold />
              <ErpInfoRow label="Paid amount" value={formatCurrency(sale.paid_amount || 0)} color="#059669" />
              <ErpInfoRow
                label="Outstanding"
                value={formatCurrency(sale.outstanding || 0)}
                color={sale.outstanding > 0 ? '#DC2626' : '#059669'}
                last
              />
            </ErpCard>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  list: { padding: 14, paddingBottom: 96 },

  card: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: '#FFF', borderRadius: 14, marginBottom: 10,
    overflow: 'hidden', ...Shadows.sm,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 13, gap: 6 },
  cardArrow: { width: 30, alignItems: 'center', justifyContent: 'center' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flex: 1, marginRight: 8 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  custName: { fontSize: 14, fontWeight: '800', color: ERP.text, marginBottom: 2 },
  saleDate: { fontSize: 11, color: ERP.muted },
  amount: { fontSize: 15, fontWeight: '800', color: Colors.primary },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  outRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  outTxt: { fontSize: 11, color: '#DC2626', fontWeight: '600' },

  fabWrap: { position: 'absolute', left: 16, right: 16, bottom: 16 },

  modalContent: { padding: 16, paddingBottom: 40 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  saleCode: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  detailDate: { fontSize: 12, color: ERP.muted, marginTop: 4 },
  prodName: { fontSize: 14, fontWeight: '700', color: ERP.text },
  prodCode: { fontSize: 11, color: ERP.muted, marginTop: 2 },
});
