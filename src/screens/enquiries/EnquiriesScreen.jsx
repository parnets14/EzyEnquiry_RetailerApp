import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import EnquiryCard from '../../components/enquiry/EnquiryCard';
import EmptyState from '../../components/common/EmptyState';
import { enquiryApi, notificationApi } from '../../utils/api';
import { SCREENS } from '../../constants';

const TABS = ['All', 'New', 'Viewed', 'Replied', 'Negotiation', 'Confirmed', 'Cancelled'];

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
    status:          e.status,
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
      const params = tab !== 'All' ? { status: tab, limit: 100 } : { limit: 100 };
      const data = await enquiryApi.list(params);
      setEnquiries((data?.enquiries || []).map(mapEnquiry));
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="document-text-outline" size={20} color="#FFF" style={styles.headerIcon} />
          <Text style={styles.headerTitle}>My Enquiries</Text>
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
      ) : enquiries.length === 0 ? (
        <EmptyState
          iconName="document-outline"
          title="No Enquiries"
          message={`You have no ${activeTab !== 'All' ? activeTab.toLowerCase() + ' ' : ''}enquiries yet.`}
          buttonTitle="SEARCH PRODUCTS"
          onButtonPress={() => navigation.navigate(SCREENS.SEARCH)}
        />
      ) : (
        <FlatList
          data={enquiries}
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
  headerIcon: { marginRight: 8 },
  headerTitle: { ...Typography.h4, color: '#FFF' },
  headerCount: { ...Typography.caption, color: 'rgba(255,255,255,0.6)' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifBtn: { position: 'relative', padding: 4 },
  badge: { position: 'absolute', top: 0, right: 0, backgroundColor: Colors.primary, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.secondary },
  badgeText: { color: Colors.white, fontSize: 9, fontWeight: '800' },
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
