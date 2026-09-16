import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import EnquiryCard from '../../components/enquiry/EnquiryCard';
import EmptyState from '../../components/common/EmptyState';
import { enquiryApi, notificationApi } from '../../utils/api';
import { SCREENS } from '../../constants';

const TABS = ['All', 'New', 'In Progress', 'Accepted', 'Rejected'];

// App tab → one or more backend enquiry statuses.
// 'In Progress' covers the mid-stage statuses: Viewed, Replied, Negotiation.
const TAB_TO_STATUS = {
  New:         'New',
  'In Progress': null,   // handled separately — multi-status filter
  Accepted:    'Confirmed',
  Rejected:    'Cancelled',
};
const IN_PROGRESS_STATUSES = ['Viewed', 'Replied', 'Negotiation'];

// Backend status → human-readable label shown to the retailer.
const STATUS_LABEL = {
  New:         'New',
  Viewed:      'Viewed',
  Replied:     'Replied',
  Negotiation: 'Negotiation',
  Confirmed:   'Accepted',
  Cancelled:   'Rejected',
};
const toLabel = (s) => STATUS_LABEL[s] || s || 'New';

// Map backend enquiry response → shape EnquiryCard expects
function mapEnquiry(e) {
  return {
    id:              e.id,
    enquiryId:       e.enquiry_code || e.id,
    productName:     e.product?.name || e.product_name || '',
    productCode:     e.product?.code || e.product_code || '',
    quantity:        e.qty,
    unit:            e.unit,
    deliveryLocation: e.location || '',
    remarks:         e.remarks || '',
    status:          toLabel(e.status),
    rawStatus:       e.status,
    sellerReply:     e.seller_reply || '',
    seller:          e.seller ? { name: e.seller.name, location: [e.seller.city, e.seller.state].filter(Boolean).join(', ') } : null,
    createdAt:       e.created_at,
    updatedAt:       e.updated_at,
    orderId:         e.order_id,
    // raw for detail screen
    _raw: e,
  };
}

export default function EnquiriesScreen({ navigation }) {
  const [activeTab, setActiveTab]     = useState('All');
  const [enquiries, setEnquiries]     = useState([]);
  const [search, setSearch]           = useState('');
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [error, setError]             = useState('');
  const [unread, setUnread]           = useState(0);

  const loadUnread = useCallback(async () => {
    try {
      const data = await notificationApi.list({ unread: 'true', limit: 1 });
      setUnread(data?.unread_count || 0);
    } catch { /* silent */ }
  }, []);

  const load = useCallback(async (tab = 'All') => {
    setError('');
    try {
      let params = { limit: 100 };
      if (tab === 'In Progress') {
        // Send multiple status values; backend filters with $in when array passed
        params.status = IN_PROGRESS_STATUSES.join(',');
      } else {
        const backendStatus = TAB_TO_STATUS[tab];
        if (backendStatus) params.status = backendStatus;
      }
      const data = await enquiryApi.list(params);
      let list = data?.enquiries || [];
      // Client-side filter for 'In Progress' if backend doesn't support comma-separated status
      if (tab === 'In Progress') {
        list = list.filter(e => IN_PROGRESS_STATUSES.includes(e.status));
      }
      setEnquiries(list.map(mapEnquiry));
    } catch (err) {
      setError(err.message || 'Could not load enquiries.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([load(activeTab), loadUnread()]);
      setLoading(false);
    })();
  }, [load, loadUnread, activeTab]);

  // Re-fetch whenever the screen regains focus, so deleted/updated enquiries
  // reflect immediately instead of showing a stale cached list.
  useFocusEffect(
    useCallback(() => {
      load(activeTab);
      loadUnread();
    }, [load, loadUnread, activeTab]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(activeTab), loadUnread()]);
    setRefreshing(false);
  };

  const onTabChange = (tab) => {
    setActiveTab(tab);
    setLoading(true);
    load(tab).then(() => setLoading(false));
  };

  // Client-side search over enquiry code / product name.
  const q = search.trim().toLowerCase();
  const visibleEnquiries = q
    ? enquiries.filter(e =>
        (e.enquiryId || '').toLowerCase().includes(q) ||
        (e.productName || '').toLowerCase().includes(q) ||
        (e.productCode || '').toLowerCase().includes(q))
    : enquiries;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {navigation.canGoBack() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>
          )}
          <Ionicons name="document-text-outline" size={20} color="#FFF" style={styles.headerIcon} />
          <Text style={styles.headerTitle}>My Quotations</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerCount}>{enquiries.length} total</Text>
          <TouchableOpacity style={styles.notifBtn} onPress={() => navigation.navigate(SCREENS.NOTIFICATIONS)}>
            <Ionicons name="notifications-outline" size={22} color="#FFF" />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search quotation code or product…"
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
              <TouchableOpacity
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => onTabChange(item)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.loadingText}>Loading enquiries…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh}><Text style={styles.retryText}>Tap to retry</Text></TouchableOpacity>
        </View>
      ) : visibleEnquiries.length === 0 ? (
        <EmptyState
          iconName="document-outline"
          title={q ? 'No matches' : 'No Enquiries'}
          message={q
            ? `No enquiries match “${search.trim()}”.`
            : `You have no ${activeTab !== 'All' ? activeTab.toLowerCase() + ' ' : ''}enquiries yet.`}
          buttonTitle={q ? undefined : 'SEARCH PRODUCTS'}
          onButtonPress={q ? undefined : () => navigation.navigate(SCREENS.SEARCH)}
        />
      ) : (
        <FlatList
          data={visibleEnquiries}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          renderItem={({ item }) => (
            <EnquiryCard
              enquiry={item}
              onPress={() => navigation.navigate(SCREENS.ENQUIRY_DETAILS, { enquiryId: item.id })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.screenPadding, paddingVertical: Spacing.base, backgroundColor: Colors.secondary },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 8 },
  headerIcon: { marginRight: 8 },
  headerTitle: { ...Typography.h4, color: '#FFF' },
  headerCount: { ...Typography.caption, color: 'rgba(255,255,255,0.6)' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifBtn: { position: 'relative', padding: 4 },
  badge: { position: 'absolute', top: 0, right: 0, backgroundColor: Colors.primary, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.secondary },
  badgeText: { color: Colors.white, fontSize: 9, fontWeight: '800' },
  searchWrap: { backgroundColor: Colors.white, paddingHorizontal: Spacing.screenPadding, paddingTop: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 42 },
  searchInput: { flex: 1, ...Typography.body2, color: Colors.textPrimary, paddingVertical: 0 },
  tabsWrapper: { backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  tabs: { paddingHorizontal: Spacing.screenPadding, paddingVertical: 10, gap: 6 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: BorderRadius.chip, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  tabActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  tabText: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: Colors.white, fontWeight: '700' },
  list: { padding: Spacing.screenPadding, paddingBottom: 90 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  loadingText: { ...Typography.body2, color: Colors.textSecondary },
  errorText: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  retryText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },
});
