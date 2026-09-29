/**
 * src/screens/erp/ExpenseEntryScreen.jsx  (Retailer app)
 *
 * Create or edit an expense. Reachable as
 *   navigation.navigate(SCREENS.EXPENSE_ENTRY)              → create
 *   navigation.navigate(SCREENS.EXPENSE_ENTRY, { expense }) → edit
 *
 * Backend contract:
 *   POST /api/retailer/erp/expenses        (expenseController.createExpense)
 *   PUT  /api/retailer/erp/expenses/:id    (expenseController.updateExpense)
 *   body → { category, amount, description, expense_date, payment_mode, reference }
 *
 * Category picker matches the wholesaler's layout: the same 12 fixed categories
 * rendered as coloured icon tiles with a "selected" confirmation bar, taken from
 * the shared `expenseCategories` module. The retailer's own edit/delete flow,
 * date quick-fill and preview card are kept.
 *
 * No date-picker dependency exists in this app, so the date is a YYYY-MM-DD text
 * field with a "Today" quick-fill — matching how the rest of the app handles
 * dates without pulling in a native module.
 */
import React, { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { erpApi } from '../../utils/api';
import { formatCurrency } from '../../utils/formatters';
import { EXPENSE_CATEGORIES } from './expenseCategories';
import {
  ErpHeader, ErpCard, ErpSectionLabel, ErpField, ErpInput,
  ErpPrimaryAction, ERP,
} from '../../components/erp';

const MODES = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card', 'Other'];

const todayISO = () => new Date().toISOString().slice(0, 10);

const numOnly = v => String(v ?? '').replace(/[^0-9.]/g, '');

export default function ExpenseEntryScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const editing = route?.params?.expense || null;

  // Unknown/legacy categories (a free-text value stored before this screen) stay
  // selectable by falling back to the first tile rather than leaving nothing on.
  const initialCat = EXPENSE_CATEGORIES.some(c => c.key === editing?.category)
    ? editing.category
    : editing?.category || 'Transport';

  const [category, setCategory]   = useState(initialCat);
  const [amount, setAmount]       = useState(editing?.amount != null ? String(editing.amount) : '');
  const [date, setDate]           = useState(
    editing?.expense_date ? String(editing.expense_date).slice(0, 10) : todayISO(),
  );
  const [mode, setMode]           = useState(editing?.payment_mode || 'Cash');
  const [reference, setReference] = useState(editing?.reference || '');
  const [description, setDesc]    = useState(editing?.description || '');

  const [saving, setSaving]       = useState(false);
  const [errors, setErrors]       = useState({});

  const validate = () => {
    const e = {};
    if (!category.trim()) e.category = 'Category is required';
    if (!amount || Number(amount) <= 0) e.amount = 'Enter an amount greater than 0';
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) e.date = 'Use YYYY-MM-DD';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = {
        category:     category.trim(),
        amount:       Number(amount),
        description:  description.trim(),
        expense_date: date || null,
        payment_mode: mode,
        reference:    reference.trim(),
      };
      if (editing?._id) await erpApi.updateExpense(editing._id, body);
      else              await erpApi.createExpense(body);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const selectedCat = EXPENSE_CATEGORIES.find(c => c.key === category) || null;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader
        title={editing ? 'Edit Expense' : 'Add Expense'}
        subtitle={editing ? 'Update this entry' : 'Record an operating cost'}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[st.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Category tiles ─────────────────────────────────────────── */}
          <ErpCard>
            <ErpSectionLabel>Expense category</ErpSectionLabel>
            <View style={st.catGrid}>
              {EXPENSE_CATEGORIES.map(cat => {
                const on = category === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[st.catTile, on && { backgroundColor: cat.color, borderColor: cat.color }]}
                    onPress={() => { setCategory(cat.key); setErrors(p => ({ ...p, category: '' })); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={cat.icon} size={16} color={on ? '#FFF' : cat.color} />
                    <Text style={[st.catTileTxt, on && { color: '#FFF' }]} numberOfLines={1}>
                      {cat.key}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedCat ? (
              <View style={[st.selectedBar, { backgroundColor: selectedCat.bg }]}>
                <Ionicons name={selectedCat.icon} size={17} color={selectedCat.color} />
                <Text style={[st.selectedBarTxt, { color: selectedCat.color }]}>
                  {selectedCat.key} selected
                </Text>
              </View>
            ) : (
              <View style={[st.selectedBar, { backgroundColor: Colors.warningBg }]}>
                <Ionicons name="alert-circle-outline" size={17} color={Colors.warningText} />
                <Text style={[st.selectedBarTxt, { color: Colors.warningText }]} numberOfLines={1}>
                  “{category}” — custom category
                </Text>
              </View>
            )}
            {errors.category ? <Text style={st.catErr}>{errors.category}</Text> : null}
          </ErpCard>

          {/* ── Amount & payment ───────────────────────────────────────── */}
          <ErpCard>
            <ErpSectionLabel>Amount & date</ErpSectionLabel>
            <ErpField label="Amount" required error={errors.amount}>
              <ErpInput
                value={amount}
                onChangeText={v => { setAmount(numOnly(v)); if (errors.amount) setErrors(p => ({ ...p, amount: '' })); }}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
            </ErpField>

            <ErpField label="Expense date" error={errors.date}>
              <ErpInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
            </ErpField>

            <TouchableOpacity style={st.todayBtn} onPress={() => setDate(todayISO())} activeOpacity={0.8}>
              <Ionicons name="today-outline" size={14} color={Colors.primary} />
              <Text style={st.todayTxt}>Use today's date</Text>
            </TouchableOpacity>
          </ErpCard>

          <ErpCard>
            <ErpSectionLabel>Payment mode</ErpSectionLabel>
            <View style={st.modePills}>
              {MODES.map(m => {
                const on = mode === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[st.pill, on && st.pillOn]}
                    onPress={() => setMode(m)}
                    activeOpacity={0.8}
                  >
                    <Text style={[st.pillTxt, on && st.pillTxtOn]}>{m}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ErpCard>

          {/* ── Details ────────────────────────────────────────────────── */}
          <ErpCard>
            <ErpSectionLabel>Details</ErpSectionLabel>
            <ErpField label="Note">
              <ErpInput
                value={description}
                onChangeText={setDesc}
                placeholder="What was this for?"
                multiline
                style={st.textarea}
              />
            </ErpField>

            <ErpField label="Reference / bill no.">
              <ErpInput value={reference} onChangeText={setReference} placeholder="Optional" />
            </ErpField>
          </ErpCard>

          {amount && Number(amount) > 0 ? (
            <ErpCard>
              <ErpSectionLabel>Preview</ErpSectionLabel>
              <View style={st.previewRow}>
                <Text style={st.previewLbl}>{category.trim() || 'Expense'}</Text>
                <Text style={st.previewAmt}>{formatCurrency(Number(amount))}</Text>
              </View>
              <Text style={st.previewMeta}>{mode} · {date || 'no date'}</Text>
            </ErpCard>
          ) : null}

          {/* Action lives INSIDE the ScrollView (like DispatchEntryScreen) so it
              scrolls with the form and the insets.bottom padding on `content`
              keeps it clear of the home indicator / Android nav bar. A pinned
              footer outside the ScrollView has no inset and gets clipped. */}
          <ErpPrimaryAction
            label={saving ? 'Saving…' : editing ? 'Save changes' : 'Record expense'}
            icon="checkmark"
            onPress={save}
            disabled={saving}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  content: { padding: 16, paddingBottom: 32 },

  /* Category tiles — 12 fixed categories, two or three per row */
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  catTile: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#FFF',
    minWidth: '30%', flexGrow: 1,
  },
  catTileTxt: { fontSize: 11, fontWeight: '700', color: ERP.muted, flexShrink: 1 },
  selectedBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
  },
  selectedBarTxt: { fontSize: 13, fontWeight: '700', flex: 1 },
  catErr: { fontSize: 11, color: Colors.error, marginTop: 6 },

  /* Payment-mode pills */
  modePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#FFF',
  },
  pillOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillTxt: { fontSize: 12.5, fontWeight: '700', color: ERP.muted },
  pillTxtOn: { color: '#FFF' },

  todayBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: -4, marginBottom: 4 },
  todayTxt: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  textarea: { height: 84, textAlignVertical: 'top', paddingTop: 11 },

  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewLbl: { fontSize: 14, fontWeight: '700', color: ERP.text, flex: 1, marginRight: 10 },
  previewAmt: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  previewMeta: { fontSize: 11.5, color: ERP.muted, marginTop: 4 },
});
