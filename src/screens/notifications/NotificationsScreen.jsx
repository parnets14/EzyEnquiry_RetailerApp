import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import NotificationCard from '../../components/notification/NotificationCard';
import EmptyState from '../../components/common/EmptyState';
import { notificationApi } from '../../utils/api';
import { SCREENS } from '../../constants';

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [error, setError]                 = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await notificationApi.list({ limit: 50 });
      setNotifications(data?.notifications || []);
      setUnreadCount(data?.unread_count || 0);
    } catch (err) {
      setError(err.message || 'Could not load notifications.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const markAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  const handlePress = async (notif) => {
    if (!notif.is_read) {
      try {
        await notificationApi.markRead(notif._id);
        setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(prev - 1, 0));
      } catch { /* silent */ }
    }
    // Navigate based on type
    const type = notif.type || '';
    if (type.includes('enquiry') || type.includes('offer')) {
      if (notif.reference_id) navigation.navigate(SCREENS.ENQUIRY_DETAILS, { enquiryId: notif.reference_id });
    } else if (type.includes('order')) {
      if (notif.reference_id) navigation.navigate(SCREENS.ORDER_DETAILS, { orderId: notif.reference_id });
    }
  };

  // Map backend notification to card shape
  const mapNotif = (n) => ({
    id: n._id,
    ...n,
    isRead: n.is_read,
    title: n.title || '',
    message: n.message || '',
    type: n.type?.includes('enquiry') || n.type?.includes('offer') ? 'enquiry'
        : n.type?.includes('order') ? 'order'
        : n.type?.includes('dispatch') || n.type?.includes('delivery') ? 'delivery'
        : 'system',
    timestamp: n.created_at,
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 8 }}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && <Text style={styles.unreadCount}>{unreadCount} unread</Text>}
          </View>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <Ionicons name="checkmark-done-outline" size={16} color={Colors.primary} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
      ) : notifications.length === 0 ? (
        <EmptyState
          iconName="notifications-outline"
          title="You're all caught up"
          message="No new notifications. We'll let you know when something happens."
        />
      ) : (
        <FlatList
          data={notifications.map(mapNotif)}
          keyExtractor={i => i.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          renderItem={({ item }) => (
            <NotificationCard notification={item} onPress={() => handlePress(item)} />
          )}
          ListFooterComponent={<View style={{ height: 90 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.screenPadding, paddingVertical: Spacing.base, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { ...Typography.h4, color: Colors.textPrimary },
  unreadCount: { ...Typography.caption, color: Colors.primary, fontWeight: '600', marginTop: 1 },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
  markAllText: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
  list: { backgroundColor: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorText: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  retryText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },
});
