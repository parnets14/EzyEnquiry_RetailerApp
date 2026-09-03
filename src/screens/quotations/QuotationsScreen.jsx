import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { getQuotationStatusLabel } from '../../utils/statusHelpers';
import { enquiryApi, notificationApi } from '../../utils/api';
import { SCREENS } from '../../constants';

const TABS = ['All', 'New', 'Viewed', 'Replied', 'Negotiation', 'Confirmed', 'Cancelled'];

// Map a backend enquiry into a quotation-shaped record for the retailer.
function mapQuotation(e) {
  return {
    id: e.id,
    quotationCode: e.enquiry_code || e.id,
    productName: e.product?.name || e.product_name || '',
    productCode: e.product?.code || e.product_code || '',
    quantity: e.qty,
    unit: e.unit,
    status: e.status,
    unitPrice: e.accepted_offer_price ?? null,
    total: e.accepted_offer_price ? Number(e.accepted_offer_price) * Number(e.qty || 0) : null,
    seller: e.seller ? { name: e.seller.name, location: [e.seller.city, e.seller.state].filter(Boolean).join(', ') } : null,
    orderId: e.order_id || null,
    createdAt: e.created_at,
  };
}

export default function QuotationsScreen({ navigation }) {
  const [activeTab, setActiveTab]   = useState('All');
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState('');
  const [unread, setUnread]         = useState(0);

  const loadUnread = useCallback(async () => {
    try {
      const data = await notificationApi.list({ unread: 'true', limit: 1 });
      setUnread(data?.unread_count || 0);
    } catch { /* silent */ }
  }, []);

  const load = useCallback(async (tab = 'All') => {
    setError('');
    try {
      const params = tab !== 'All' ? { status: tab, limit: 100 } : { limit: 100 };
      const data = await enquiryApi.list(params);
      setQuotations((data?.enquiries || []).map(mapQuotation));
    } catch (err) {
      setError(err.message || 'Could not load quotations.');
    }
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await Promise.all([load(activeTab), loadUnread()]); setLoading(false); })();
  }, [load, loadUnread, activeTab]);

  // Refresh on focus so deleted/updated quotations reflect immediately.
  useFocusEffect(
    useCallback(() => { load(activeTab); loadUnread(); }, [load, loadUnread, activeTab]),
  );

  const onRefresh = async () => { setRefreshing(true); await Promise.all([load(activeTab), loadUnread()]); setRefreshing(false); };
  const onTabChange = (tab) => { setActiveTab(tab); setLoading(true); load(tab).then(() => setLoading(false)); };

  const confirmedCount = quotations.filter(q => q.status === 'Confirmed').length;
  const openCount = quotations.filter(q => !['Confirmed', 'Cancelled'].includes(q.status)).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* ── Blue header ─────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="document-text" size={18} color="#FFF" />
            </View>
            <Text style={styles.headerTitle}>My Quotations</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={() => navigation.navigate(SCREENS.NOTIFICATIONS)}>
            <Ionicons name="notifications-outline" size={22} color="#FFF" />
            {unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View>}
          </TouchableOpacity>
        </View>

        {/* Stat hero */}
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{quotations.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#FFD9C7' }]}>{openCount}</Text>
            <Text style={styles.statLabel}>Open</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#9FE7C0' }]}>{confirmedCount}</Text>
            <Text style={styles.statLabel}>Confirmed</Text>
          </View>
        </View>
      </View>

      <View style={styles.bodyWrap}>
      {/* Flow banner */}
      <View style={styles.flowBanner}>
        <Ionicons name="information-circle-outline" size={15} color={Colors.infoText} />
        <Text style={styles.flowText}>
          Every Send Enquiry becomes a Quotation. Once the wholesaler confirms, a Sales Order is created automatically.
        </Text>
      </View>

      {/* Tabs */}
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
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /><Text style={styles.loadingText}>Loading quotations…</Text></View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh}><Text style={styles.retryText}>Tap to retry</Text></TouchableOpacity>
        </View>
      ) : quotations.length === 0 ? (
        <EmptyState
          iconName="document-outline"
          title="No Quotations"
          message={`You have no ${activeTab !== 'All' ? activeTab.toLowerCase() + ' ' : ''}quotations yet. Send an enquiry to create one.`}
          buttonTitle="SEARCH PRODUCTS"
          onButtonPress={() => navigation.navigate(SCREENS.SEARCH)}
        />
      ) : (
        <FlatList
          data={quotations}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          renderItem={({ item }) => (
            <QuotationCard
              quotation={item}
              onPress={() => navigation.navigate(SCREENS.ENQUIRY_DETAILS, { enquiryId: item.id })}
              onViewOrder={item.orderId ? () => navigation.navigate(SCREENS.ORDER_DETAILS, { orderId: item.orderId }) : null}
            />
          )}
        />
      )}
      </View>
    </SafeAreaView>
  );
}

const QuotationCard = ({ quotation, onPress, onViewOrder }) => {
  const { quotationCode, productName, productCode, quantity, unit, status, total, seller, createdAt } = quotation;
  return (
    <View style={styles.card}>
      <TouchableOpacity activeOpacity={0.88} onPress={onPress}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.quoteId}>{quotationCode}</Text>
            <Text style={styles.quoteStatusLabel}>{getQuotationStatusLabel(status)}</Text>
          </View>
          <StatusBadge status={status} type="enquiry" />
        </View>

        {/* Origin badge (matches Staff app framing) */}
        <View style={styles.originBadge}>
          <Ionicons name="storefront-outline" size={15} color={Colors.primary} />
          <Text style={styles.originText}>SEND ENQUIRY → QUOTATION</Text>
        </View>

        <View style={styles.productRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.productName} numberOfLines={2}>{productName}</Text>
            <Text style={styles.productMeta}>{productCode} · {quantity} {unit}</Text>
          </View>
          {total != null ? <Text style={styles.total}>{formatCurrency(total)}</Text> : null}
        </View>

        <View style={styles.footer}>
          {seller ? (
            <View style={styles.footerItem}>
              <Ionicons name="business-outline" size={13} color={Colors.textTertiary} />
              <Text style={styles.footerText} numberOfLines={1}>{seller.name}</Text>
            </View>
          ) : <View style={styles.footerItem} />}
          <View style={styles.footerItem}>
            <Ionicons name="calendar-outline" size={13} color={Colors.textTertiary} />
            <Text style={styles.footerText}>{formatDate(createdAt)}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {onViewOrder ? (
        <TouchableOpacity style={styles.orderLinkBtn} onPress={onViewOrder} activeOpacity={0.85}>
          <Ionicons name="cube-outline" size={14} color={Colors.success} />
          <Text style={styles.orderLinkText}>Sales Order created — view order</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.success} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  bodyWrap: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.h4, color: '#FFF' },
  notifBtn: { position: 'relative', padding: 4 },
  badge: { position: 'absolute', top: 0, right: 0, backgroundColor: Colors.primary, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.secondary },
  badgeText: { color: Colors.white, fontSize: 9, fontWeight: '800' },
  statRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, marginTop: Spacing.base },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { ...Typography.h3, color: '#FFF', fontWeight: '800' },
  statLabel: { ...Typography.caption, color: 'rgba(255,255,255,0.65)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 10 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.14)' },
  flowBanner: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: Colors.infoBg, paddingHorizontal: Spacing.screenPadding, paddingVertical: 10 },
  flowText: { ...Typography.caption, color: Colors.infoText, flex: 1, lineHeight: 17 },
  tabsWrapper: { backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  tabs: { paddingHorizontal: Spacing.screenPadding, paddingVertical: 10, gap: 6 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: BorderRadius.chip, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  tabActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  tabText: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: Colors.white, fontWeight: '700' },
  list: { padding: Spacing.screenPadding, paddingBottom: 90, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  loadingText: { ...Typography.body2, color: Colors.textSecondary },
  errorText: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  retryText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },

  card: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm, borderLeftWidth: 3, borderLeftColor: Colors.primary },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  quoteId: { ...Typography.label, color: Colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  quoteStatusLabel: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  originBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primaryBg, borderRadius: BorderRadius.sm, paddingHorizontal: 8, paddingVertical: 5, marginTop: 8, alignSelf: 'flex-start' },
  originText: { ...Typography.caption, color: Colors.primary, fontWeight: '800', fontSize: 10, letterSpacing: 0.4 },
  productRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 10 },
  productName: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '700' },
  productMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  total: { ...Typography.h4, color: Colors.primary },
  footer: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 10 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  footerText: { ...Typography.caption, color: Colors.textTertiary, flexShrink: 1 },
  orderLinkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  orderLinkText: { ...Typography.caption, color: Colors.successText, fontWeight: '700', flex: 1 },
});
