/**
 * src/screens/erp/ExpenseListScreen.jsx  (Retailer app)
 *
 * Expense list, laid out like the wholesaler's `expense/ExpenseListScreen.jsx`:
 * header + total banner + search, a horizontally-scrolling category summary
 * strip, category filter tabs, then coloured per-category rows.
 *
 * Backend contract (expenseController.listExpenses):
 *   query  → { category, from_date, to_date, page, limit }
 *   returns→ { expenses, totalAmount, pagination }
 *
 * Kept from the retailer's earlier version (the wholesaler lacks these): the
 * edit/delete detail sheet and the date-range tabs. Category colours and icons
 * come from the shared `expenseCategories` module so they match the entry screen.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, FlatList, Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { SCREENS } from '../../constants';
import { erpApi } from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { EXPENSE_CATEGORIES, getCatConfig } from './expenseCategories';
import {
  ErpHeader, ErpSummaryStrip, ErpSearchBox, ErpTabs, ErpCard, ErpSectionLabel,
  ErpInfoRow, ErpBadge, ErpMetaChip, ErpLoading, ErpError, ErpEmpty, ErpPrimaryAction,
  ERP,
} from '../../components/erp';

const RANGE_TABS = ['All', 'Today', 'Week', 'Month'];

/**
 * Filter tabs: range + the 12 categories. The range control and the category
 * filter are separate pieces of state, so they need separate tab rows —
 * `ErpTabs` takes one `active` value only.
 */
const CATEGORY_TABS = ['All', ...EXPENSE_CATEGORIES.map(c => c.key)];

/** Map a range tab to { from_date, to_date } for the API. */
function rangeParams(tab) {
  const now = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  if (tab === 'Today') return { from_date: iso(now), to_date: iso(now) };
  if (tab === 'Week') {
    const from = new Date(now); from.setDate(from.getDate() - 6);
    return { from_date: iso(from), to_date: iso(now) };
  }
  if (tab === 'Month') {
    return { from_date: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to_date: iso(now) };
  }
  return {};
}

const MODE_ICON = {
  Cash: 'cash-outline',
  'Bank Transfer': 'business-outline',
  UPI: 'phone-portrait-outline',
  Cheque: 'document-text-outline',
  Card: 'card-outline',
  Other: 'ellipsis-horizontal-outline',
};

export default function ExpenseListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [expenses,   setExpenses]   = useState([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');
  const [range,      setRange]      = useState('Month');
  const [category,   setCategory]   = useState('All');
  const [search,     setSearch]     = useState('');
  const [detail,     setDetail]     = useState(null);
  const searchTimer = useRef(null);

  const load = useCallback(async (cat = category, q = search) => {
    setLoading(true); setError('');
    try {
      const params = { ...rangeParams(range), limit: 100 };
      if (cat && cat !== 'All') params.category = cat;
      if (q.trim()) params.search = q.trim();
      const res = await erpApi.listExpenses(params);
      const data = res?.data ?? res;
      setExpenses(Array.isArray(data?.expenses) ? data.expenses : []);
      setTotal(data?.totalAmount || 0);
    } catch (e) {
      setError(e?.message || 'Failed to load expenses');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [range, category, search]);

  useEffect(() => { load(category, ''); }, [range, category]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(category, search), 380);
    return () => clearTimeout(searchTimer.current);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = () => { setRefreshing(true); load(category, search); };

  const count = expenses.length;

  /**
   * Category totals for the current result set — drives the summary strip.
   * Colours come from the shared config so the strip matches the entry tiles.
   */
  const byCategory = useMemo(() => {
    const map = {};
    expenses.forEach(e => {
      const k = e.category || 'Miscellaneous';
      map[k] = (map[k] || 0) + (Number(e.amount) || 0);
    });
    return Object.entries(map)
      .map(([key, amt]) => ({ ...getCatConfig(key), key, total: amt }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  const removeExpense = (item) => {
    Alert.alert(
      'Delete expense?',
      `${item.category} · ${formatCurrency(item.amount)} will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await erpApi.deleteExpense(item._id);
              setDetail(null);
              load(category, search);
            } catch (e) {
              Alert.alert('Could not delete', e?.message || 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }) => {
    const cfg = getCatConfig(item.category);
    return (
      <TouchableOpacity style={st.card} onPress={() => setDetail(item)} activeOpacity={0.82}>
        {/* Per-category accent bar, like the wholesaler's cardAccent */}
        <View style={[st.cardAccent, { backgroundColor: cfg.color }]} />
        <View style={st.cardBody}>
          <View style={st.cardTop}>
            <View style={[st.cardIcon, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon} size={18} color={cfg.color} />
            </View>
            <View style={st.cardInfo}>
              <View style={[st.catBadge, { backgroundColor: cfg.bg }]}>
                <Text style={[st.catBadgeTxt, { color: cfg.color }]} numberOfLines={1}>
                  {item.category || 'Uncategorised'}
                </Text>
              </View>
              {item.description ? (
                <Text style={st.desc} numberOfLines={1}>{item.description}</Text>
              ) : null}
              <View style={st.cardMeta}>
                <ErpMetaChip icon="calendar-outline" label={formatDate(item.expense_date || item.created_at)} />
                {item.payment_mode ? <ErpMetaChip icon={MODE_ICON[item.payment_mode]} label={item.payment_mode} /> : null}
              </View>
            </View>
            <View style={st.amountWrap}>
              <Text style={st.amount}>{formatCurrency(item.amount || 0)}</Text>
              <Ionicons name="chevron-forward" size={15} color="#B0B5C3" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader
        title="Expenses"
        subtitle="Expense Management"
        onBack={() => navigation.goBack()}
        actions={[
          { key: 'report', icon: 'bar-chart-outline', onPress: () => navigation.navigate(SCREENS.EXPENSE_REPORT) },
          { key: 'add',    icon: 'add',               onPress: () => navigation.navigate(SCREENS.EXPENSE_ENTRY) },
        ]}>
        <ErpSummaryStrip items={[
          { label: category === 'All' ? 'Total expenses' : category, value: formatCurrency(total) },
          { label: 'Records', value: count },
          { label: 'Range',   value: range },
        ]} />
        <ErpSearchBox value={search} onChangeText={setSearch} placeholder="Search description, reference…" />
      </ErpHeader>

      {/* ── Category summary strip (hidden while a single category is filtered,
             mirroring the wholesaler's `filterTab === 'All'` guard) ────────── */}
      {category === 'All' && byCategory.length > 0 ? (
        <View style={st.catSummary}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.catSummaryContent}>
            {byCategory.map(c => (
              <TouchableOpacity
                key={c.key}
                style={st.catSummaryCard}
                onPress={() => setCategory(c.key)}
                activeOpacity={0.8}
              >
                <View style={[st.catSummaryIcon, { backgroundColor: c.bg }]}>
                  <Ionicons name={c.icon} size={16} color={c.color} />
                </View>
                <Text style={st.catSummaryAmt}>{formatCurrency(c.total)}</Text>
                <Text style={st.catSummaryLbl} numberOfLines={1}>{c.key}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <ErpTabs tabs={RANGE_TABS} active={range} onChange={setRange} />
      <ErpTabs tabs={CATEGORY_TABS} active={category} onChange={setCategory} />

      {loading && !expenses.length ? (
        <ErpLoading label="Loading expenses…" />
      ) : error ? (
        <ErpError message={error} onRetry={() => load(category, search)} />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={i => i._id}
          renderItem={renderItem}
          contentContainerStyle={[st.list, { paddingBottom: insets.bottom + 96 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          ListEmptyComponent={
            <ErpEmpty
              icon="receipt-outline"
              title="No expenses recorded"
              subtitle="Tap Add Expense to record rent, salaries, transport and other operating costs."
            />
          }
        />
      )}

      <View style={[st.fabWrap, { bottom: 16 + insets.bottom }]}>
        <ErpPrimaryAction label="Add Expense" onPress={() => navigation.navigate(SCREENS.EXPENSE_ENTRY)} />
      </View>

      <ExpenseDetailSheet
        item={detail}
        onClose={() => setDetail(null)}
        onEdit={item => { setDetail(null); navigation.navigate(SCREENS.EXPENSE_ENTRY, { expense: item }); }}
        onDelete={removeExpense}
      />
    </SafeAreaView>
  );
}

/* ── Detail sheet (retailer-only: the wholesaler has no edit/delete) ─────── */
function ExpenseDetailSheet({ item, onClose, onEdit, onDelete }) {
  const insets = useSafeAreaInsets();
  if (!item) return null;
  const cfg = getCatConfig(item.category);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={st.safe} edges={['top']}>
        <ErpHeader title="Expense Detail" onBack={onClose} />
        <ScrollView contentContainerStyle={[st.modalContent, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
          <ErpCard>
            <View style={st.detailTop}>
              <View style={[st.detailIcon, { backgroundColor: cfg.bg }]}>
                <Ionicons name={cfg.icon} size={20} color={cfg.color} />
              </View>
              <Text style={st.detailCat} numberOfLines={1}>{item.category || 'Uncategorised'}</Text>
              <ErpBadge label={item.payment_mode || 'Cash'} color={Colors.primary} bg={Colors.primaryBg} dot />
            </View>
            <Text style={st.detailAmt}>{formatCurrency(item.amount || 0)}</Text>
            <Text style={st.detailDate}>{formatDate(item.expense_date || item.created_at)}</Text>
          </ErpCard>

          <ErpCard>
            <ErpSectionLabel>Details</ErpSectionLabel>
            <ErpInfoRow label="Category"     value={item.category || '—'} />
            <ErpInfoRow label="Amount"       value={formatCurrency(item.amount || 0)} />
            <ErpInfoRow label="Payment mode" value={item.payment_mode || '—'} />
            {item.reference ? <ErpInfoRow label="Reference" value={item.reference} /> : null}
            {item.added_by?.name ? <ErpInfoRow label="Added by" value={item.added_by.name} /> : null}
            {item.description ? <ErpInfoRow label="Note" value={item.description} last /> : null}
          </ErpCard>

          <View style={st.actionRow}>
            <TouchableOpacity style={[st.actionBtn, st.editBtn]} onPress={() => onEdit(item)}>
              <Ionicons name="create-outline" size={17} color="#FFF" />
              <Text style={st.actionTxt}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.actionBtn, st.delBtn]} onPress={() => onDelete(item)}>
              <Ionicons name="trash-outline" size={17} color={Colors.error} />
              <Text style={[st.actionTxt, { color: Colors.error }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  list: { padding: 14 },

  /* Category summary strip */
  catSummary: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: Colors.border },
  catSummaryContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  catSummaryCard: {
    alignItems: 'center', backgroundColor: '#F8F9FC',
    borderRadius: 12, padding: 10, minWidth: 82,
  },
  catSummaryIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 5,
  },
  catSummaryAmt: { fontSize: 12, fontWeight: '800', color: ERP.text },
  catSummaryLbl: { fontSize: 9, color: ERP.muted, fontWeight: '600', textAlign: 'center', marginTop: 2, maxWidth: 72 },

  /* Rows */
  card: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: '#FFF', borderRadius: 14, marginBottom: 10,
    overflow: 'hidden', ...Shadows.sm,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, gap: 4 },
  catBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', maxWidth: '100%' },
  catBadgeTxt: { fontSize: 11, fontWeight: '700' },
  desc: { fontSize: 12, color: ERP.text, fontWeight: '500' },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  amountWrap: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: 15, fontWeight: '800', color: Colors.error },

  fabWrap: { position: 'absolute', left: 16, right: 16, bottom: 16 },

  /* Detail sheet */
  modalContent: { padding: 16 },
  detailTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  detailCat: { fontSize: 16, fontWeight: '800', color: ERP.text, flex: 1 },
  detailAmt: { fontSize: 24, fontWeight: '800', color: Colors.primary, marginTop: 10 },
  detailDate: { fontSize: 12, color: ERP.muted, marginTop: 4 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 13, borderRadius: 12,
  },
  editBtn: { backgroundColor: Colors.primary },
  delBtn:  { backgroundColor: Colors.errorBg, borderWidth: 1, borderColor: '#F5C6C0' },
  actionTxt: { color: '#FFF', fontWeight: '800', fontSize: 14 },
});
