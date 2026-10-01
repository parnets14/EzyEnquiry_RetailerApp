/**
 * src/screens/enquiries/EnquiriesScreen.jsx  (Retailer app)
 *
 * Structural parity with the wholesaler's `enquiry/EnquiryListScreen.jsx`:
 *
 *   [ navy navbar: "Enquiries" · "N total · M new" · unread pill · search · refresh ]
 *   [ inline search bar (toggled by the search icon)                              ]
 *   [ status pills: All · New · Viewed · Replied · Negotiation · Confirmed · Cancelled
 *                   each with a live count badge                                 ]
 *   [ cards: orange strip when New · code + status chip · party · product ·
 *            qty / price / location · date + chevron                              ]
 *
 * ── Changes from the previous version ───────────────────────────────────────
 * The old screen had 5 relabelled tabs (All / New / In Progress / Accepted /
 * Rejected) with NO counts, an always-visible search bar, a notifications bell,
 * and delegated cards to `<EnquiryCard>`. The wholesaler has 7 raw-status tabs
 * WITH counts, a toggled search bar, and renders its cards inline — so this now
 * matches. Confirmed/Cancelled are no longer relabelled to Accepted/Rejected,
 * matching the wholesaler's vocabulary.
 *
 * The notifications bell is gone (the wholesaler has none). Notifications stay
 * reachable from Home and from the Quotations screen.
 *
 * ── Field mapping (the DTOs differ) ─────────────────────────────────────────
 * The wholesaler reads flat fields (`enq_code`, `retailer_name`, `product_name`,
 * `offered_price`) because its backend returns them flat. The retailer's
 * `enquiryResponse` returns `enquiry_code`, `product{}`, `customer{}`,
 * `seller{}` and `accepted_offer_price`. Same slots, mapped to the real fields.
 *
 * The party line: the wholesaler shows the RETAILER who enquired — its
 * counterparty. The retailer is the buyer here, and its own company name is what
 * `created_by.company` holds, so that would print the retailer to itself. The
 * meaningful party is the end-customer this enquiry is for, falling back to the
 * seller. Same slot, correct party — the same rule used on the Orders screen.
 *
 * ── Logic parity ────────────────────────────────────────────────────────────
 * State now comes from `hooks/useEnquiries` — the mirrored twin of the
 * wholesaler's hook — instead of an inline loader. That is what the wholesaler's
 * list screen does (`const { enquiries, loading, error, refetch, unreadCount } =
 * useEnquiries();`), and it keeps the "load ALL, filter client-side, count per
 * tab" rule in one place. `newCount` is that hook's `unreadCount` (i.e. how many
 * are status `New`), NOT the notification counter.
 */
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import EmptyState from '../../components/common/EmptyState';
import useEnquiries from '../../hooks/useEnquiries';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { SCREENS } from '../../constants';

// The backend's raw status vocabulary, in lifecycle order — same 7 tabs as the
// wholesaler. Confirmed/Cancelled are shown as-is, not relabelled.
const STATUS_TABS = ['All', 'New', 'Viewed', 'Replied', 'Negotiation', 'Confirmed', 'Cancelled'];

// Same palette as the wholesaler's STATUS_META.
const STATUS_META = {
  New:         { bg: '#EFF6FF', text: '#2563EB', dot: '#3B82F6' },
  Viewed:      { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' },
  Replied:     { bg: '#FFF7ED', text: '#D97706', dot: '#F59E0B' },
  Negotiation: { bg: '#F5F3FF', text: '#7C3AED', dot: '#8B5CF6' },
  Confirmed:   { bg: '#F0FDF4', text: '#059669', dot: '#10B981' },
  Cancelled:   { bg: '#FEF2F2', text: '#DC2626', dot: '#F87171' },
};

// One broadcast = ONE card.
// A retailer's broadcast is N sibling enquiries — one per wholesaler plus the
// Admin — all sharing an `enq_code`. Without grouping the Sent tab shows N
// near-identical cards for a single action, which reads as "it created it many
// times". Group by code and summarise: how many sellers, how many replied, and
// the best quote so far.
const STATUS_RANK = { Cancelled: 0, New: 1, Viewed: 2, Replied: 3, Negotiation: 4, Confirmed: 5 };

const rowHasReplied = (r) =>
  ['Replied', 'Negotiation', 'Confirmed'].includes(r.status)
  || !!(r.distributor_reply || '').trim()
  || r.accepted_offer_price != null
  || r.available_quantity != null;

function groupBroadcasts(rows) {
  const byCode = new Map();
  for (const r of rows) {
    const key = r.enquiry_code || String(r.id);
    if (!byCode.has(key)) byCode.set(key, []);
    byCode.get(key).push(r);
  }
  return [...byCode.values()].map(members => {
    if (members.length === 1) return members[0];
    const status = members
      .map(m => m.status)
      .sort((a, b) => (STATUS_RANK[b] ?? 1) - (STATUS_RANK[a] ?? 1))[0];
    const prices = members.map(m => +(m.accepted_offer_price || 0)).filter(Boolean);
    return {
      ...members[0],
      __group: true,
      __count: members.length,
      __replied: members.filter(rowHasReplied).length,
      status,
      accepted_offer_price: prices.length ? Math.min(...prices) : null,
    };
  });
}

export default function EnquiriesScreen({ navigation }) {
  const [tabIdx, setTabIdx]         = useState(0);
  const [search, setSearch]         = useState('');
  const [showSearch, setShowSearch] = useState(false);
  // 'received' = sent TO this retailer (we owe a reply)
  // 'sent'     = raised BY this retailer (we are waiting on answers)
  const [dirTab,     setDirTab]     = useState('received');
  const [refreshing, setRefreshing] = useState(false);

  // Same hook the wholesaler uses. It loads ALL enquiries once (limit 100) and
  // exposes the "new" count — that is what keeps every tab badge accurate.
  // We keep a focus reload on top so returning from a detail screen (where the
  // status may have moved New → Viewed) refreshes the list.
  const { enquiries, loading, error, refetch, unreadCount } = useEnquiries();

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // The create screen is a stack screen, so returning here re-fires the
  // focus-effect refetch above and the brand-new enquiry appears immediately.
  const goToCreate = useCallback(
    () => navigation.navigate(SCREENS.CREATE_ENQUIRY),
    [navigation],
  );

  const list         = Array.isArray(enquiries) ? enquiries : [];
  const activeStatus = STATUS_TABS[tabIdx];
  const newCount     = unreadCount;

  // `is_recipient` comes from the backend: a broadcast row carries the RECIPIENT
  // as `company_id`, so the same document is "received" in one app and "sent" in
  // another. Splitting here keeps the status pills scoped to the visible tab.
  const isSentOf     = (e) => e.is_recipient !== true;
  const byDirection  = list.filter(e => (dirTab === 'received' ? !isSentOf(e) : isSentOf(e)));
  // Received stays one card per enquiry (each is addressed to us and needs its
  // own reply); Sent collapses each broadcast into a single card.
  const dirRows      = dirTab === 'sent' ? groupBroadcasts(byDirection) : byDirection;

  const q = search.trim().toLowerCase();
  const filtered = dirRows.filter(e => {
    const matchTab = activeStatus === 'All' || e.status === activeStatus;
    const matchSearch = !q
      || (e.enquiry_code || '').toLowerCase().includes(q)
      || (e.customer?.name || '').toLowerCase().includes(q)
      || (e.product?.name || '').toLowerCase().includes(q)
      || (e.product?.code || '').toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />

      {/* ══ Navbar ══ */}
      <View style={styles.navbar}>
        <View style={styles.navCircle1} />
        <View style={styles.navCircle2} />

        <View style={styles.navRow}>
          <View style={styles.navTitleWrap}>
            <Text style={styles.navTitle}>Enquiries</Text>
            <Text style={styles.navSub}>
              {(() => {
                const sentGrouped = groupBroadcasts(list.filter(e => isSentOf(e))).length;
                const received = list.filter(e => !isSentOf(e)).length;
                const total = sentGrouped + received;
                return `${total} total${newCount > 0 ? `  ·  ${newCount} new` : ''}`;
              })()}
            </Text>
          </View>

          {newCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {newCount > 99 ? '99+' : newCount} New
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.navIconBtn}
            onPress={() => { setShowSearch(v => !v); setSearch(''); }}
            activeOpacity={0.8}
          >
            <Ionicons name={showSearch ? 'close' : 'search-outline'} size={20} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.navIconBtn} onPress={refetch} activeOpacity={0.8}>
            <Ionicons name="refresh-outline" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        {showSearch && (
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={17} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, product, code…"
              placeholderTextColor={Colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              autoFocus
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* ══ Received / Sent ══ */}
      {/* Two lists, not one: what was ASKED of us (and needs a reply) versus
          what we ASKED (and are waiting on answers for). */}
      <View style={styles.dirBar}>
        {[
          { key: 'received', label: 'Received' },
          { key: 'sent',     label: 'Sent' },
        ].map(t => {
          const active = dirTab === t.key;
          // For 'sent', count grouped broadcasts (1 per broadcast, not 1 per recipient row)
          const rawRows = list.filter(e => (t.key === 'received' ? !isSentOf(e) : isSentOf(e)));
          const n = t.key === 'sent' ? groupBroadcasts(rawRows).length : rawRows.length;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.dirBtn, active && styles.dirBtnActive]}
              onPress={() => { setDirTab(t.key); setTabIdx(0); }}
              activeOpacity={0.85}
            >
              <Text style={[styles.dirBtnText, active && styles.dirBtnTextActive]}>
                {t.label} ({n})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ══ Status tabs ══ */}
      <View style={styles.tabBarWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_TABS}
          keyExtractor={t => t}
          contentContainerStyle={styles.tabList}
          renderItem={({ item: tab, index }) => {
            const active = index === tabIdx;
            const count = tab === 'All'
              ? dirRows.length
              : dirRows.filter(e => e.status === tab).length;
            return (
              <TouchableOpacity
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTabIdx(index)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab}</Text>
                {count > 0 && (
                  <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
                      {count > 99 ? '99+' : count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* ══ List ══ */}
      {loading && list.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refetch}><Text style={styles.retryText}>Tap to retry</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          renderItem={({ item }) => <EnquiryCardRow item={item} navigation={navigation} />}
          ListEmptyComponent={
            <EmptyState
              iconName="mail-open-outline"
              title={`No ${activeStatus === 'All' ? '' : activeStatus + ' '}enquiries`}
              message={q ? 'Try a different search term.' : 'Raise one to get a price from the seller.'}
              buttonTitle={q ? undefined : 'New Enquiry'}
              onButtonPress={q ? undefined : goToCreate}
            />
          }
        />
      )}

      {/* ══ New enquiry FAB ══ */}
      {/* The navbar is already carrying a title, a "new" pill and two icon
          buttons, so the create action lives here instead of crowding it. */}
      {!showSearch && (
        <TouchableOpacity
          style={styles.fab}
          onPress={goToCreate}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={26} color="#FFF" />
          <Text style={styles.fabLabel}>Enquiry</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const EnquiryCardRow = ({ item, navigation }) => {
  const meta  = STATUS_META[item.status] || STATUS_META.New;
  const isNew = item.status === 'New';
  const isReceived = item.is_recipient === true;

  // For received: show who sent it (the wholesaler/admin company name)
  // For sent grouped: product name is the primary label (handled in sent tab)
  const senderName = isReceived
    ? (item.sender?.name || item.retailer_name || '—')
    : (item.customer?.name || item.seller?.name || null);
  const senderMobile = isReceived
    ? (item.sender?.mobile || item.retailer_mobile || '')
    : '';

  const productName = item.product?.name || item.product?.code || item.product_name || '—';
  const offeredPrice = item.accepted_offer_price || item.offered_price || null;
  const availQty = item.available_quantity ?? null;

  return (
    <TouchableOpacity
      style={[styles.card, isNew && styles.cardNew]}
      onPress={() => navigation.navigate(SCREENS.ENQUIRY_DETAILS, { enquiryId: item.id })}
      activeOpacity={0.78}
    >
      {isNew && <View style={styles.newStrip} />}

      <View style={styles.cardInner}>

        {/* ── Row 1: Code + Status chip ── */}
        <View style={styles.cardRow}>
          <View style={styles.codeWrap}>
            <Ionicons name="pricetag-outline" size={12} color={Colors.textTertiary} />
            <Text style={styles.enqCode}>
              {item.enquiry_code || item.enq_code || `#${String(item.id || '').slice(-6)}`}
            </Text>
          </View>
          <View style={[styles.chip, { backgroundColor: meta.bg }]}>
            <View style={[styles.chipDot, { backgroundColor: meta.dot }]} />
            <Text style={[styles.chipText, { color: meta.text }]}>{item.status}</Text>
          </View>
        </View>

        {/* ── Row 2: From (received) or product (sent grouped) ── */}
        {isReceived ? (
          <View style={{ marginTop: 6, marginBottom: 2 }}>
            <Text style={styles.partyName} numberOfLines={1}>{senderName}</Text>
            {senderMobile ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Ionicons name="call-outline" size={11} color={Colors.textTertiary} />
                <Text style={styles.metaText}>{senderMobile}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <>
            {senderName ? <Text style={styles.partyName} numberOfLines={1}>{senderName}</Text> : null}
            {item.__group && item.__replied > 0 ? (
              <Text style={[styles.groupSub, { color: '#10b981' }]}>
                {item.__replied} {item.__replied === 1 ? 'reply' : 'replies'} received
              </Text>
            ) : null}
          </>
        )}

        {/* ── Row 3: Product ── */}
        <View style={[styles.productRow, { marginTop: 6 }]}>
          <Ionicons name="cube-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.productText} numberOfLines={1}>{productName}</Text>
        </View>

        {/* ── Row 4: Qty · Location ── */}
        <View style={[styles.metaRow, { marginTop: 4 }]}>
          <View style={styles.metaItem}>
            <Ionicons name="layers-outline" size={12} color={Colors.textTertiary} />
            <Text style={styles.metaText}>{item.qty || 0} {item.unit || ''}</Text>
          </View>
          {item.location ? (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
              <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Row 5: Offered ₹ + Availability (mirrors CRM "Offered ₹" column) ── */}
        {(offeredPrice || availQty != null) ? (
          <View style={[styles.metaRow, { marginTop: 4 }]}>
            {offeredPrice ? (
              <View style={styles.metaItem}>
                <Ionicons name="cash-outline" size={12} color="#10b981" />
                <Text style={[styles.metaText, { color: '#10b981', fontWeight: '700' }]}>
                  ₹{Number(offeredPrice).toLocaleString('en-IN')}
                </Text>
              </View>
            ) : null}
            {availQty != null ? (
              <View style={styles.metaItem}>
                <Ionicons name="archive-outline" size={12} color="#10b981" />
                <Text style={[styles.metaText, { color: '#10b981', fontWeight: '600' }]}>
                  Avail: {availQty} {item.unit || ''}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Row 6: Date + chevron ── */}
        <View style={[styles.cardRow, styles.cardRowLast, { marginTop: 6 }]}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={11} color={Colors.textTertiary} />
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={styles.arrowBtn}>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </View>
        </View>

      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  /* ── Navbar ── */
  navbar: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.base,
    paddingTop: 12,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  navCircle1: {
    position: 'absolute', top: -30, right: -30,
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  navCircle2: {
    position: 'absolute', bottom: -20, left: -20,
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navTitleWrap: { flex: 1 },
  navTitle: { ...Typography.h4, fontWeight: '800', color: '#FFF', letterSpacing: 0.2 },
  navSub: { ...Typography.caption, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  unreadBadge: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  unreadBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  navIconBtn: {
    width: 36, height: 36, borderRadius: BorderRadius.button,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white, borderRadius: BorderRadius.button,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 10,
  },
  searchInput: { flex: 1, ...Typography.body2, color: Colors.textPrimary, paddingVertical: 0 },

  /* ── Received / Sent ── */
  dirBar: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4,
    backgroundColor: Colors.white,
  },
  dirBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 9,
    borderRadius: BorderRadius.button,
    backgroundColor: Colors.background,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  dirBtnActive: { backgroundColor: Colors.primaryBg, borderColor: Colors.primary },
  dirBtnText: { fontSize: 12.5, fontWeight: '700', color: Colors.textSecondary },
  dirBtnTextActive: { color: Colors.primary, fontWeight: '800' },

  /* ── Tabs ── */
  tabBarWrap: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    ...Shadows.sm,
  },
  tabList: { paddingHorizontal: 10, paddingVertical: 10, gap: 7, flexDirection: 'row' },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 13, paddingVertical: 6,
    borderRadius: 20, backgroundColor: Colors.background,
    borderWidth: 1, borderColor: 'transparent',
  },
  tabActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  tabText: { ...Typography.caption, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: '#FFF', fontWeight: '700' },
  tabBadge: { backgroundColor: Colors.border, borderRadius: 8, minWidth: 18, paddingHorizontal: 4, alignItems: 'center' },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.textSecondary },
  tabBadgeTextActive: { color: '#FFF' },

  /* ── Cards ── */
  // Extra bottom padding keeps the last card clear of the floating button.
  list: { padding: 12, paddingBottom: 96 },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  cardNew: { borderColor: Colors.primary },
  newStrip: {
    width: 4, backgroundColor: Colors.primary,
    borderTopLeftRadius: 14, borderBottomLeftRadius: 14,
  },
  cardInner: { flex: 1, padding: 13 },

  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardRowLast: { marginTop: 4, marginBottom: 0 },
  codeWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  enqCode: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, letterSpacing: 0.3 },

  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 11, fontWeight: '700' },

  partyName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 5 },
  groupSub: { fontSize: 11.5, color: Colors.primary, fontWeight: '700', marginBottom: 5 },

  productRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  productText: { ...Typography.caption, fontSize: 13, color: Colors.textSecondary, flex: 1 },

  metaRow: { flexDirection: 'row', gap: 14, marginBottom: 2, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12, color: Colors.textTertiary },

  dateText: { fontSize: 11, color: Colors.textTertiary, marginLeft: 2 },

  arrowBtn: {
    width: 26, height: 26, borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorText: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  retryText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },

  /* ── Floating "New Enquiry" button ── */
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    paddingLeft: 14,
    paddingRight: 18,
    paddingVertical: 13,
    borderRadius: 28,
    ...Shadows.lg,
  },
  fabLabel: { fontSize: 13.5, fontWeight: '800', color: '#FFF', letterSpacing: 0.2 },
});
