import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi } from '../../utils/api';
import { getGreeting, formatCurrency } from '../../utils/formatters';
import { SCREENS } from '../../constants';

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const ownerName   = user?.name || user?.company?.owner_name || 'there';
  const companyName = user?.company?.name || user?.company_name || '';
  const planName    = user?.subscription_plan || user?.company?.subscription_plan || 'Free';
  const companyStatus = user?.company_status || user?.company?.status || '';

  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await dashboardApi.get();
      setData(result);
    } catch (err) {
      setError(err.message || 'Could not load dashboard.');
    }
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const counts       = data?.counts || {};
  const recentOrders = data?.recent_orders || [];
  const unread       = counts.unread_notifications || 0;

  const initials = ownerName.split(' ').map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase();

  const STATUS_COLOR = {
    Delivered:          '#27AE60',
    'Out for Delivery': Colors.primary,
    'Dispatched':       '#F39C12',
    Packing:            '#E67E22',
    Accepted:           '#27AE60',
    New:                Colors.textSecondary,
    Cancelled:          Colors.error,
    // legacy backward-compat
    Ready:              '#F39C12',
    ReadyForDispatch:   '#F39C12',
    InTransit:          Colors.primary,
    'In Transit':       Colors.primary,
    Processing:         '#E67E22',
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* ═══ HEADER ═══ */}
      <View style={st.header}>
        <View style={st.headerRow}>
          <View>
            <Text style={st.greet}>{getGreeting()}</Text>
            <Text style={st.name}>{ownerName}</Text>
            {companyName ? (
              <View style={st.compBadge}>
                <Ionicons name="business" size={9} color="#FFF" />
                <Text style={st.compText}>{companyName}</Text>
              </View>
            ) : null}
          </View>
          <View style={st.headerRight}>
            <TouchableOpacity style={st.bell} onPress={() => navigation.navigate(SCREENS.NOTIFICATIONS)}>
              <Ionicons name="notifications-outline" size={20} color="#FFF" />
              {unread > 0 && (
                <View style={st.dot}>
                  <Text style={st.dotTxt}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={st.avatar}><Text style={st.avatarTxt}>{initials}</Text></View>
          </View>
        </View>

        {/* Stats card */}
        <View style={st.statsCard}>
          <TouchableOpacity style={st.statItem} activeOpacity={0.8} onPress={() => navigation.navigate(SCREENS.ENQUIRIES)}>
            <Text style={st.statNum}>{counts.enquiries ?? '—'}</Text>
            <Text style={st.statLbl}>ENQUIRIES</Text>
          </TouchableOpacity>
          <View style={st.statDiv} />
          <TouchableOpacity style={st.statItem} activeOpacity={0.8} onPress={() => navigation.navigate(SCREENS.ORDERS)}>
            <Text style={st.statNum}>{counts.orders ?? '—'}</Text>
            <Text style={st.statLbl}>ORDERS</Text>
          </TouchableOpacity>
          <View style={st.statDiv} />
          <TouchableOpacity style={st.statItem} activeOpacity={0.8} onPress={() => navigation.navigate(SCREENS.INVOICES)}>
            <Text style={st.statNum}>{counts.invoices ?? '—'}</Text>
            <Text style={st.statLbl}>INVOICES</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        <View style={{ height: 34 }} />

        {/* Account status / plan */}
        <View style={st.infoCard}>
          <Ionicons name="star" size={14} color={Colors.primary} style={{ marginRight: 10 }} />
          <View style={st.infoBody}>
            <Text style={st.infoTitle}>{planName} Plan</Text>
            <Text style={st.infoSub}>{companyStatus ? `Account: ${companyStatus}` : 'Active'}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate(SCREENS.SUBSCRIPTION)}>
            <Text style={st.infoAction}>View</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={st.loadingBox}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={st.loadingText}>Loading dashboard…</Text>
          </View>
        ) : error ? (
          <View style={st.errorCard}>
            <Ionicons name="cloud-offline-outline" size={30} color={Colors.textTertiary} />
            <Text style={st.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => { setLoading(true); load().then(() => setLoading(false)); }}>
              <Text style={st.retryText}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ─── Overview grid ─── */}
            <Text style={st.secTitle}>Overview</Text>
            <View style={st.overviewGrid}>
              <OverviewCard icon="hourglass-outline" label="In Progress" value={counts.in_progress ?? 0} color="#E67E22" bg="#FDF0E4" onPress={() => navigation.navigate(SCREENS.ORDERS)} />
              <OverviewCard icon="checkmark-done-outline" label="Delivered" value={counts.delivered ?? 0} color="#27AE60" bg="#E8F8EF" onPress={() => navigation.navigate(SCREENS.ORDERS)} />
              <OverviewCard icon="card-outline" label="Pending Pay" value={counts.pending_payments ?? 0} sub={counts.pending_amount ? formatCurrency(counts.pending_amount) : ''} color="#C0392B" bg="#FDEDEC" onPress={() => navigation.navigate(SCREENS.INVOICES)} />
              <OverviewCard icon="notifications-outline" label="Alerts" value={unread} color="#2980B9" bg="#EBF5FB" onPress={() => navigation.navigate(SCREENS.NOTIFICATIONS)} />
            </View>

            {/* ─── Quick Actions ─── */}
            <Text style={st.secTitle}>Quick Actions</Text>
            <View style={st.quickRow}>
              <QA icon="search"         label="Search"     color="#2980B9" bg="#EBF5FB" onPress={() => navigation.navigate(SCREENS.SEARCH)} />
              <QA icon="document-text"  label="Quotations" color="#8E44AD" bg="#F5EEF8" onPress={() => navigation.navigate(SCREENS.QUOTATIONS)} />
              <QA icon="cube"           label="Orders"     color="#27AE60" bg="#E8F8EF" onPress={() => navigation.navigate(SCREENS.ORDERS)} />
              <QA icon="receipt"        label="Invoices"   color={Colors.primary} bg="#FFF3EE" onPress={() => navigation.navigate(SCREENS.INVOICES)} />
            </View>

            {/* ─── Recent Orders ─── */}
            {recentOrders.length > 0 && (
              <>
                <View style={st.secRow}>
                  <Text style={st.secTitle}>Recent Orders</Text>
                  <TouchableOpacity onPress={() => navigation.navigate(SCREENS.ORDERS)}>
                    <Text style={st.viewAll}>View All</Text>
                  </TouchableOpacity>
                </View>
                {recentOrders.map(order => (
                  <TouchableOpacity
                    key={order.id}
                    style={st.orderCard}
                    onPress={() => navigation.navigate(SCREENS.ORDER_DETAILS, { orderId: order.id })}
                    activeOpacity={0.85}
                  >
                    <View style={st.orderTop}>
                      <Text style={st.orderId}>{order.order_code}</Text>
                      <View style={[st.orderBdg, { backgroundColor: (STATUS_COLOR[order.status] || Colors.textSecondary) + '18' }]}>
                        <Text style={[st.orderBdgT, { color: STATUS_COLOR[order.status] || Colors.textSecondary }]}>
                          {order.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={st.orderProd} numberOfLines={1}>
                      {order.product?.name || 'Product'}
                    </Text>
                    <Text style={st.orderInfo}>
                      Qty: {order.qty} {order.unit} · {formatCurrency(order.total_amount)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {recentOrders.length === 0 && (
              <View style={st.emptyOrders}>
                <Ionicons name="cube-outline" size={36} color={Colors.border} />
                <Text style={st.emptyText}>No orders yet</Text>
                <TouchableOpacity onPress={() => navigation.navigate(SCREENS.SEARCH)}>
                  <Text style={st.emptyAction}>Browse Products →</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const QA = ({ icon, label, color, bg, onPress }) => (
  <TouchableOpacity style={st.qaBtn} onPress={onPress}>
    <View style={[st.qaIcon, { backgroundColor: bg }]}><Ionicons name={icon} size={22} color={color} /></View>
    <Text style={st.qaLbl}>{label}</Text>
  </TouchableOpacity>
);

const OverviewCard = ({ icon, label, value, sub, color, bg, onPress }) => (
  <TouchableOpacity style={st.ovCard} activeOpacity={0.85} onPress={onPress}>
    <View style={[st.ovIcon, { backgroundColor: bg }]}><Ionicons name={icon} size={18} color={color} /></View>
    <View style={{ flex: 1 }}>
      <Text style={st.ovValue}>{value}</Text>
      <Text style={st.ovLabel}>{label}</Text>
      {sub ? <Text style={[st.ovSub, { color }]} numberOfLines={1}>{sub}</Text> : null}
    </View>
  </TouchableOpacity>
);

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F4F7' },
  header: { backgroundColor: Colors.secondary, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'visible', zIndex: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greet: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  name: { fontSize: 20, fontWeight: '800', color: '#FFF', marginTop: 2 },
  compBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 8, alignSelf: 'flex-start' },
  compText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bell: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -2, right: -2, backgroundColor: Colors.primary, borderRadius: 9, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.secondary },
  dotTxt: { fontSize: 8, fontWeight: '800', color: '#FFF' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  avatarTxt: { fontSize: 14, fontWeight: '800', color: '#FFF' },

  statsCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, marginHorizontal: 0, marginTop: 28, marginBottom: -42, paddingVertical: 16, paddingHorizontal: 8, ...Shadows.md, elevation: 8 },
  statItem: { flex: 1, alignItems: 'center' },
  statDiv: { width: 1, backgroundColor: '#E8EAED', marginVertical: 6 },
  statNum: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  statLbl: { fontSize: 8, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8, marginTop: 4, textAlign: 'center' },

  infoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, marginHorizontal: 16, marginTop: 8, paddingHorizontal: 14, paddingVertical: 10, ...Shadows.sm },
  infoBody: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  infoSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  infoAction: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  loadingBox: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  loadingText: { fontSize: 13, color: Colors.textSecondary },
  errorCard: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, marginHorizontal: 16, marginTop: 16, padding: 24, gap: 8, ...Shadows.sm },
  errorText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  retryText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  secTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  viewAll: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  ovCard: { width: '47.5%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderRadius: 12, padding: 12, ...Shadows.sm },
  ovIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ovValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, lineHeight: 22 },
  ovLabel: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  ovSub: { fontSize: 10, fontWeight: '700', marginTop: 1 },

  quickRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  qaBtn: { flex: 1, alignItems: 'center', gap: 6, backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 10, ...Shadows.sm },
  qaIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  qaLbl: { fontSize: 10, fontWeight: '600', color: Colors.textPrimary },

  orderCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 10, ...Shadows.sm, borderLeftWidth: 3, borderLeftColor: Colors.primary },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderId: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  orderBdg: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  orderBdgT: { fontSize: 10, fontWeight: '700' },
  orderProd: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  orderInfo: { fontSize: 11, color: Colors.textSecondary },

  emptyOrders: { alignItems: 'center', paddingVertical: 32, gap: 8, marginHorizontal: 16, backgroundColor: '#FFF', borderRadius: 12, marginTop: 8, ...Shadows.sm },
  emptyText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  emptyAction: { fontSize: 13, color: Colors.primary, fontWeight: '700' },
});
