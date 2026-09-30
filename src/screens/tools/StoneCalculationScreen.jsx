/**
 * src/screens/tools/StoneCalculationScreen.jsx  (Retailer app)
 *
 * Stone measurement tool — ported from the wholesaler app.
 *
 * ── THERE IS NO BACKEND FOR THIS ─────────────────────────────────────────────
 * Unlike every other ERP screen, this one is deliberately client-side only:
 * `grep -r stone EzyEnquiry-backend/src` returns nothing but the seeder. Sheets
 * persist to AsyncStorage (`services/stoneService.js`) so the tool works offline
 * with no route/controller to add.
 *
 * ── ADAPTATIONS FROM THE WHOLESALER VERSION ──────────────────────────────────
 * 1. Icons: MaterialCommunityIcons → Ionicons. `view-grid-outline` does NOT
 *    exist in Ionicons (the "Italian" product) — `apps-outline` replaces it.
 * 2. Share: the wholesaler uses `react-native-share`, which is NOT a dependency
 *    of this app. Swapped to React Native's built-in `Share` API.
 * 3. Theme: the retailer palette (Colors) + the shared `components/erp` kit
 *    (ErpHeader / ErpSummaryStrip / ErpPrimaryAction) so it matches the other
 *    ERP screens instead of carrying the wholesaler's own header markup.
 * 4. Date picker stays a self-contained month grid — no date-picker dependency.
 *
 * Real calc: convert L & W to the OUTPUT unit, then multiply.
 *   122 in × 38 in → feet = 10.16667 × 3.16667 = 32.1944 ft²
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  Share, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { stoneService } from '../../services/stoneService';
import {
  UNITS, AREA_SYMBOL, unitLabel, rowArea, sumArea, fmtArea,
  STONE_PRODUCTS, productMeta,
} from '../../utils/stoneCalc';
import {
  ErpHeader, ErpSummaryStrip, ErpSectionLabel, ERP,
} from '../../components/erp';

const NAVY   = Colors.secondary;      // #1A2340
const ORANGE = Colors.primary;        // #F4500A
const ORANGE_LT = Colors.primaryBg;   // #FFF3EE
const BG     = ERP.bg;
const TEXT   = Colors.textPrimary;
const MUTED  = Colors.textSecondary;
const BORDER = Colors.border;

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* ═══════════════════════════════════════════════════════════ */
export default function StoneCalculationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [view, setView]     = useState('list');
  const [sheets, setSheets] = useState([]);
  const [active, setActive] = useState(null);
  const [search, setSearch] = useState('');
  const [newFor, setNewFor] = useState(null);

  const refresh = useCallback(async () => {
    setSheets(await stoneService.list());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sheets;
    return sheets.filter(s =>
      (s.party || '').toLowerCase().includes(q) ||
      (s.name || '').toLowerCase().includes(q) ||
      (s.product || '').toLowerCase().includes(q),
    );
  }, [sheets, search]);

  const openEdit = (sheet) => { setActive(sheet); setView('edit'); };
  const openView = (sheet) => { setActive(sheet); setView('view'); };

  const handleBack = () => {
    if (view === 'list') { navigation.goBack(); return; }
    setView('list');
    refresh();
  };

  const handleDelete = (sheet) => {
    Alert.alert(
      'Delete Sheet',
      `Delete "${sheet.party}" (${productMeta(sheet.product).label})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { await stoneService.remove(sheet.id); refresh(); } },
      ],
    );
  };

  const handleShare = async (sheet) => {
    const meta = productMeta(sheet.product);
    const sym = AREA_SYMBOL[sheet.outputUnit];
    const amount = Number(sheet.amount || (Number(sheet.total) || 0) * (Number(sheet.price) || 0));
    const lines = [
      `${sheet.party} — ${meta.label}${sheet.name ? ` (${sheet.name})` : ''}`,
      `Date: ${fmtDate(sheet.date)}`,
      '',
      ...sheet.rows.map((r, i) =>
        `${i + 1}. ${r.length} x ${r.width} = ${fmtArea(rowArea(r.length, r.width, sheet.inputUnit, sheet.outputUnit))} ${sym}`),
      '',
      `Total: ${fmtArea(sheet.total)} ${sym}`,
      // Rate / amount only when a rate was actually entered — same as the wholesaler.
      ...(Number(sheet.price) > 0
        ? [
            `Rate: ₹${Number(sheet.price).toLocaleString('en-IN', { maximumFractionDigits: 2 })} / ${sym}`,
            `Amount: ₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
          ]
        : []),
    ];
    try {
      // Built-in Share — the wholesaler's react-native-share is not a dep here.
      await Share.share({ title: 'Stone Sheet', message: lines.join('\n') });
    } catch { /* user dismissed the sheet */ }
  };

  const totalArea = sheets.reduce((a, s) => a + (Number(s.total) || 0), 0);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ErpHeader
        title="Stone Calculator"
        subtitle={view === 'list' ? 'Measurements & area' : view === 'edit' ? 'Editing sheet' : 'Sheet detail'}
        onBack={handleBack}>
        {view === 'list' ? (
          <ErpSummaryStrip items={[
            { label: 'Sheets',     value: sheets.length },
            { label: 'Total Area', value: fmtArea(totalArea, 2) },
          ]} />
        ) : null}
      </ErpHeader>

      {view === 'list' && (
        <ListView
          sheets={filtered}
          search={search} setSearch={setSearch}
          onNew={setNewFor}
          onView={openView} onEdit={openEdit}
          onDelete={handleDelete} onShare={handleShare}
        />
      )}

      {view === 'edit' && active && (
        <EditView sheet={active} onSaved={() => { refresh(); setView('list'); }} />
      )}

      {view === 'view' && active && (
        <SheetView sheet={active} onShare={() => handleShare(active)} onEdit={() => openEdit(active)} />
      )}

      <NewSheetModal
        productKey={newFor}
        onClose={() => setNewFor(null)}
        onCreate={(sheet) => { setNewFor(null); openEdit(sheet); }}
      />
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════
   LIST VIEW
═══════════════════════════════════════════════════════════ */
function ListView({ sheets, search, setSearch, onNew, onView, onEdit, onDelete, onShare }) {
  return (
    <ScrollView contentContainerStyle={st.listContent} showsVerticalScrollIndicator={false}>
      {/* Product select — full-width accent rows */}
      <ErpSectionLabel>Start a New Sheet</ErpSectionLabel>
      <View style={{ gap: 10, marginBottom: 24 }}>
        {STONE_PRODUCTS.map(p => (
          <TouchableOpacity key={p.key} activeOpacity={0.85} onPress={() => onNew(p.key)} style={st.productRow}>
            <View style={[st.productStripe, { backgroundColor: p.color }]} />
            <View style={[st.productIcon, { backgroundColor: p.bg }]}>
              <Ionicons name={p.icon} size={24} color={p.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.productName}>{p.label}</Text>
              <Text style={st.productHint}>Tap to create a {p.label.toLowerCase()} sheet</Text>
            </View>
            <View style={[st.productPlus, { backgroundColor: p.color }]}>
              <Ionicons name="add" size={18} color="#fff" />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* My Sheets */}
      <ErpSectionLabel>My Sheets</ErpSectionLabel>
      <View style={st.searchBox}>
        <Ionicons name="search" size={18} color={MUTED} />
        <TextInput
          style={st.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search customer or product…"
          placeholderTextColor={MUTED}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={17} color={MUTED} />
          </TouchableOpacity>
        ) : null}
      </View>

      {sheets.length === 0 ? (
        <View style={st.empty}>
          <View style={st.emptyIcon}>
            <Ionicons name="document-text-outline" size={34} color={ORANGE} />
          </View>
          <Text style={st.emptyTitle}>No sheets yet</Text>
          <Text style={st.emptyText}>Pick a product above to create your first measurement sheet.</Text>
        </View>
      ) : (
        sheets.map(s => {
          const meta = productMeta(s.product);
          return (
            <View key={s.id} style={st.ticket}>
              <View style={[st.ticketStripe, { backgroundColor: meta.color }]} />
              <View style={{ flex: 1, padding: 14 }}>
                <View style={st.ticketTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.ticketParty} numberOfLines={1}>{s.party || '—'}</Text>
                    <View style={st.ticketTagRow}>
                      <View style={[st.ticketTag, { backgroundColor: meta.bg }]}>
                        <Ionicons name={meta.icon} size={12} color={meta.color} />
                        <Text style={[st.ticketTagText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                      {!!s.name && <Text style={st.ticketName} numberOfLines={1}>{s.name}</Text>}
                    </View>
                  </View>
                  <View style={st.ticketTotalBox}>
                    <Text style={st.ticketTotal}>{fmtArea(s.total, 2)}</Text>
                    <Text style={st.ticketUnit}>{AREA_SYMBOL[s.outputUnit]}</Text>
                  </View>
                </View>

                <View style={st.ticketMetaRow}>
                  <Ionicons name="calendar-outline" size={12} color={MUTED} />
                  <Text style={st.ticketDate}>{fmtDate(s.date)}</Text>
                  <View style={st.metaDot} />
                  <Ionicons name="list-outline" size={12} color={MUTED} />
                  <Text style={st.ticketDate}>{s.rows.length} rows</Text>
                </View>

                <View style={st.ticketActions}>
                  <TouchableOpacity style={st.ticketBtn} onPress={() => onView(s)}>
                    <Ionicons name="eye-outline" size={16} color="#2563EB" />
                    <Text style={[st.ticketBtnText, { color: '#2563EB' }]}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.ticketBtn} onPress={() => onEdit(s)}>
                    <Ionicons name="create-outline" size={16} color="#059669" />
                    <Text style={[st.ticketBtnText, { color: '#059669' }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.ticketBtn} onPress={() => onShare(s)}>
                    <Ionicons name="share-social-outline" size={16} color={NAVY} />
                    <Text style={[st.ticketBtnText, { color: NAVY }]}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.ticketBtn} onPress={() => onDelete(s)}>
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    <Text style={[st.ticketBtnText, { color: '#DC2626' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

/* ═══════════════════════════════════════════════════════════
   CALENDAR PICKER — self-contained month grid (no extra libs)
═══════════════════════════════════════════════════════════ */
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const toISO = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function CalendarPicker({ visible, value, onClose, onSelect }) {
  const init = value ? new Date(value) : new Date();
  const safe = isNaN(init) ? new Date() : init;
  const [vy, setVy] = useState(safe.getFullYear());
  const [vm, setVm] = useState(safe.getMonth());

  useEffect(() => {
    if (visible) {
      const d = value ? new Date(value) : new Date();
      const s = isNaN(d) ? new Date() : d;
      setVy(s.getFullYear()); setVm(s.getMonth());
    }
  }, [visible, value]);

  const firstDay = new Date(vy, vm, 1).getDay();
  const days = new Date(vy, vm + 1, 0).getDate();
  const todayIso = todayISO();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  const prev = () => (vm === 0 ? (setVm(11), setVy(y => y - 1)) : setVm(m => m - 1));
  const next = () => (vm === 11 ? (setVm(0), setVy(y => y + 1)) : setVm(m => m + 1));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={st.modalOverlay} onPress={onClose}>
        <Pressable style={st.calCard} onPress={() => {}}>
          <View style={st.calHeader}>
            <TouchableOpacity style={st.calNavBtn} onPress={prev} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={22} color={NAVY} />
            </TouchableOpacity>
            <Text style={st.calTitle}>{MONTHS[vm]} {vy}</Text>
            <TouchableOpacity style={st.calNavBtn} onPress={next} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-forward" size={22} color={NAVY} />
            </TouchableOpacity>
          </View>
          <View style={st.calWeekRow}>
            {WEEKDAYS.map(w => <Text key={w} style={st.calWeekday}>{w}</Text>)}
          </View>
          <View style={st.calGrid}>
            {cells.map((d, i) => {
              if (d === null) return <View key={`b${i}`} style={st.calCell} />;
              const iso = toISO(vy, vm, d);
              const selected = iso === value;
              const isToday = iso === todayIso;
              return (
                <TouchableOpacity key={iso} style={st.calCell} onPress={() => onSelect(iso)} activeOpacity={0.7}>
                  <View style={[st.calDay, isToday && !selected && st.calDayToday, selected && st.calDaySelected]}>
                    <Text style={[st.calDayText, isToday && !selected && { color: ORANGE, fontWeight: '800' }, selected && { color: '#fff', fontWeight: '800' }]}>{d}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={st.calFooter}>
            <TouchableOpacity onPress={() => onSelect(todayIso)}><Text style={st.calTodayLink}>Today</Text></TouchableOpacity>
            <TouchableOpacity onPress={onClose}><Text style={st.calCloseLink}>Close</Text></TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   NEW SHEET MODAL
═══════════════════════════════════════════════════════════ */
function NewSheetModal({ productKey, onClose, onCreate }) {
  const meta = productKey ? productMeta(productKey) : null;
  const [name, setName]   = useState('');
  const [party, setParty] = useState('');
  const [date, setDate]   = useState(todayISO());
  const [rows, setRows]   = useState('1');
  const [err, setErr]     = useState('');
  const [showCal, setShowCal] = useState(false);

  useEffect(() => {
    if (productKey) { setName(''); setParty(''); setDate(todayISO()); setRows('1'); setErr(''); setShowCal(false); }
  }, [productKey]);

  const create = () => {
    if (!name.trim())  return setErr(`${meta.label} name is required`);
    if (!party.trim()) return setErr('Party name is required');
    if (!date.trim())  return setErr('Please choose a date');
    const n = Math.max(1, Math.min(200, parseInt(rows, 10) || 1));
    onCreate({
      id: null, product: productKey, name: name.trim(), party: party.trim(), date: date.trim(),
      inputUnit: 'inch', outputUnit: 'feet',
      rows: Array.from({ length: n }, () => ({ length: '', width: '' })), total: 0, price: 0,
    });
  };

  return (
    <Modal visible={!!productKey} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={st.centerOverlay} onPress={onClose}>
          <Pressable style={st.centerCard} onPress={() => {}}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 20 }}
            >
              <View style={st.modalHeader}>
                {meta && (
                  <View style={[st.modalIconLg, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={24} color={meta.color} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={st.modalTitle}>New {meta?.label} Sheet</Text>
                  <Text style={st.modalSub}>Enter the sheet details</Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color={MUTED} />
                </TouchableOpacity>
              </View>

              <Text style={st.fieldLabel}>{meta?.label} Name *</Text>
              <TextInput style={st.input} value={name} onChangeText={t => { setName(t); setErr(''); }} placeholder="e.g. Kajria" placeholderTextColor={MUTED} returnKeyType="next" />

              <Text style={st.fieldLabel}>Party Name *</Text>
              <TextInput style={st.input} value={party} onChangeText={t => { setParty(t); setErr(''); }} placeholder="e.g. Shubham" placeholderTextColor={MUTED} returnKeyType="next" />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1.3 }}>
                  <Text style={st.fieldLabel}>Choose Date *</Text>
                  <TouchableOpacity style={st.dateField} activeOpacity={0.7} onPress={() => setShowCal(true)}>
                    <Ionicons name="calendar-outline" size={18} color={ORANGE} />
                    <Text style={st.dateFieldText}>{fmtDate(date)}</Text>
                    <Ionicons name="chevron-down" size={18} color={MUTED} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.fieldLabel}>Rows</Text>
                  <TextInput style={st.input} value={rows} onChangeText={t => setRows(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="1" placeholderTextColor={MUTED} />
                </View>
              </View>

              {!!err && <Text style={st.errText}>{err}</Text>}

              <View style={st.modalBtnRow}>
                <TouchableOpacity style={st.btnGhost} onPress={onClose}>
                  <Text style={st.btnGhostText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.btnPrimary} onPress={create}>
                  <Ionicons name="arrow-forward" size={17} color="#fff" />
                  <Text style={st.btnPrimaryText}>Create Sheet</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <CalendarPicker
              visible={showCal}
              value={date}
              onClose={() => setShowCal(false)}
              onSelect={(iso) => { setDate(iso); setErr(''); setShowCal(false); }}
            />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   EDIT VIEW — per-row cards (not a spreadsheet)
═══════════════════════════════════════════════════════════ */
function EditView({ sheet, onSaved }) {
  const insets = useSafeAreaInsets();
  const meta = productMeta(sheet.product);
  const [rows, setRows]           = useState(sheet.rows.length ? sheet.rows : [{ length: '', width: '' }]);
  const [inputUnit, setInputUnit] = useState(sheet.inputUnit || 'inch');
  const [outputUnit, setOutput]   = useState(sheet.outputUnit || 'feet');
  const [price, setPrice]         = useState(String(sheet.price || ''));
  const [saving, setSaving]       = useState(false);
  const [pickerFor, setPickerFor] = useState(null);

  const sym = AREA_SYMBOL[outputUnit];
  const total = useMemo(() => sumArea(rows, inputUnit, outputUnit), [rows, inputUnit, outputUnit]);
  // Amount is DERIVED, never stored independently — total × rate per unit area.
  const amount = useMemo(() => {
    const p = parseFloat(price);
    return isFinite(p) && p > 0 ? total * p : 0;
  }, [total, price]);

  const setCell = (i, field, val) => setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  const addRow = () => setRows(rs => [...rs, { length: '', width: '' }]);
  const removeRow = (i) => setRows(rs => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs));
  const copyPrevious = () => setRows(rs => rs.map((r, i) => {
    if (i === 0) return r;
    const prev = rs[i - 1];
    return { ...r, length: r.length === '' ? prev.length : r.length, width: r.width === '' ? prev.width : r.width };
  }));

  const save = async () => {
    setSaving(true);
    const payload = {
      product: sheet.product, name: sheet.name, party: sheet.party, date: sheet.date,
      inputUnit, outputUnit, rows, total,
      price: parseFloat(price) || 0,
      amount,
    };
    if (sheet.id) await stoneService.update(sheet.id, payload);
    else          await stoneService.create(payload);
    setSaving(false);
    onSaved();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 200 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {/* sheet meta banner */}
        <View style={st.editBanner}>
          <View style={[st.modalIconLg, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon} size={22} color={meta.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.editParty}>{sheet.party}</Text>
            <Text style={st.editSub}>{sheet.name} · {meta.label} · {fmtDate(sheet.date)}</Text>
          </View>
        </View>

        {/* units */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <UnitField label="Input unit"  value={inputUnit}  accent={NAVY}   onPress={() => setPickerFor('input')} />
          <UnitField label="Output unit" value={outputUnit} accent={ORANGE} onPress={() => setPickerFor('output')} />
        </View>

        {/* Rate per unit area → derived Total Amount (optional). Same as the
            wholesaler: enter a rate and the amount appears live beside it. */}
        <View style={st.priceRow}>
          <View style={st.priceIconWrap}>
            <Ionicons name="cash-outline" size={20} color={ORANGE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.fieldLabel}>Rate per {sym} (optional)</Text>
            <TextInput
              style={st.priceInput}
              value={price}
              onChangeText={t => setPrice(t.replace(/[^\d.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="e.g. 350"
              placeholderTextColor={MUTED}
            />
          </View>
          {parseFloat(price) > 0 && (
            <View style={st.amountBadge}>
              <Text style={st.amountBadgeLabel}>Total Amount</Text>
              <Text style={st.amountBadgeValue}>
                ₹ {amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Text>
            </View>
          )}
        </View>

        {/* per-row cards */}
        {rows.map((r, i) => {
          const area = rowArea(r.length, r.width, inputUnit, outputUnit);
          return (
            <View key={i} style={st.rowCard}>
              <View style={st.rowNum}><Text style={st.rowNumText}>{i + 1}</Text></View>
              <View style={st.rowInputWrap}>
                <Text style={st.rowFieldLabel}>L</Text>
                <TextInput style={st.rowInput} value={String(r.length)} onChangeText={t => setCell(i, 'length', t.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#CBD5E1" />
              </View>
              <Ionicons name="close" size={13} color="#CBD5E1" />
              <View style={st.rowInputWrap}>
                <Text style={st.rowFieldLabel}>W</Text>
                <TextInput style={st.rowInput} value={String(r.width)} onChangeText={t => setCell(i, 'width', t.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#CBD5E1" />
              </View>
              <View style={st.rowAreaChip}>
                <Text style={st.rowAreaText}>{area ? fmtArea(area, 2) : '—'}</Text>
                <Text style={st.rowAreaUnit}>{sym}</Text>
              </View>
              <TouchableOpacity onPress={() => removeRow(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color="#E2E8F0" />
              </TouchableOpacity>
            </View>
          );
        })}

        {/* add / copy */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
          <TouchableOpacity style={st.dashBtn} onPress={addRow}>
            <Ionicons name="add" size={16} color={ORANGE} />
            <Text style={st.dashBtnText}>Add Row</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.dashBtn} onPress={copyPrevious}>
            <Ionicons name="copy-outline" size={15} color={ORANGE} />
            <Text style={st.dashBtnText}>Copy Previous</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* sticky footer: total + save */}
      <View style={[st.stickyFooter, { paddingBottom: 14 + insets.bottom }]}>
        <View>
          <Text style={st.footerLabel}>Sum Total</Text>
          <Text style={st.footerTotal}>{fmtArea(total, 2)} <Text style={st.footerUnit}>{sym}</Text></Text>
          {parseFloat(price) > 0 && (
            <Text style={st.footerAmount}>₹ {amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
          )}
        </View>
        <TouchableOpacity style={[st.footerSave, saving && { opacity: 0.7 }]} onPress={save} disabled={saving}>
          <Ionicons name="save-outline" size={18} color="#fff" />
          <Text style={st.footerSaveText}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      {/* unit picker */}
      <Modal visible={!!pickerFor} transparent animationType="fade" onRequestClose={() => setPickerFor(null)}>
        <Pressable style={st.modalOverlay} onPress={() => setPickerFor(null)}>
          <Pressable style={st.calCard} onPress={() => {}}>
            <Text style={st.modalTitle}>{pickerFor === 'input' ? 'Input Unit' : 'Output Unit'}</Text>
            {UNITS.map(u => {
              const selected = (pickerFor === 'input' ? inputUnit : outputUnit) === u.key;
              return (
                <TouchableOpacity key={u.key} style={[st.pickerRow, selected && { backgroundColor: ORANGE_LT }]} onPress={() => {
                  if (pickerFor === 'input') setInputUnit(u.key); else setOutput(u.key);
                  setPickerFor(null);
                }}>
                  <Text style={[st.pickerText, selected && { color: ORANGE, fontWeight: '800' }]}>{u.label}</Text>
                  {selected && <Ionicons name="checkmark" size={18} color={ORANGE} />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function UnitField({ label, value, accent, onPress }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={st.fieldLabel}>{label}</Text>
      <TouchableOpacity style={[st.unitSelect, { borderColor: `${accent}55` }]} onPress={onPress} activeOpacity={0.7}>
        <Text style={[st.unitSelectText, { color: accent }]}>{unitLabel(value)}</Text>
        <Ionicons name="chevron-down" size={18} color={accent} />
      </TouchableOpacity>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
   SHEET VIEW — read-only
═══════════════════════════════════════════════════════════ */
function SheetView({ sheet, onShare, onEdit }) {
  const insets = useSafeAreaInsets();
  const meta = productMeta(sheet.product);
  const sym = AREA_SYMBOL[sheet.outputUnit];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={st.editBanner}>
          <View style={[st.modalIconLg, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon} size={22} color={meta.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.editParty}>{sheet.party}</Text>
            <Text style={st.editSub}>{sheet.name} · {meta.label} · {fmtDate(sheet.date)}</Text>
            <Text style={st.editSub}>Input {unitLabel(sheet.inputUnit)} → Output {unitLabel(sheet.outputUnit)}</Text>
          </View>
        </View>

        {sheet.rows.map((r, i) => {
          const area = rowArea(r.length, r.width, sheet.inputUnit, sheet.outputUnit);
          return (
            <View key={i} style={st.viewRow}>
              <View style={st.rowNum}><Text style={st.rowNumText}>{i + 1}</Text></View>
              <Text style={st.viewDim}>{r.length} <Text style={st.viewX}>×</Text> {r.width}</Text>
              <View style={st.rowAreaChip}>
                <Text style={st.rowAreaText}>{fmtArea(area, 2)}</Text>
                <Text style={st.rowAreaUnit}>{sym}</Text>
              </View>
            </View>
          );
        })}

        <View style={st.viewTotalCard}>
          <Text style={st.footerLabel}>Sum Total</Text>
          <Text style={st.viewTotalValue}>{fmtArea(sheet.total, 2)} <Text style={st.footerUnit}>{sym}</Text></Text>
          {/* Rate / amount breakdown — only when a rate was saved. */}
          {Number(sheet.price) > 0 && (
            <>
              <View style={st.viewPriceDivider} />
              <View style={st.viewPriceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={st.footerLabel}>Rate per {sym}</Text>
                  <Text style={st.viewPriceValue}>
                    ₹ {Number(sheet.price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={st.viewAmountBox}>
                  <Text style={st.viewAmountLabel}>TOTAL AMOUNT</Text>
                  <Text style={st.viewAmountValue}>
                    ₹ {Number(sheet.amount || (Number(sheet.total) || 0) * Number(sheet.price))
                        .toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <View style={[st.stickyFooter, { paddingBottom: 14 + insets.bottom }]}>
        <TouchableOpacity style={[st.footerSave, { flex: 1, backgroundColor: NAVY, marginRight: 10 }]} onPress={onEdit}>
          <Ionicons name="create-outline" size={17} color="#fff" />
          <Text style={st.footerSaveText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[st.footerSave, { flex: 1 }]} onPress={onShare}>
          <Ionicons name="share-social-outline" size={17} color="#fff" />
          <Text style={st.footerSaveText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════ */
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  listContent: { padding: 16, paddingTop: 18, paddingBottom: 40 },

  /* Product select rows */
  productRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF',
    borderRadius: 14, overflow: 'hidden', paddingRight: 14, ...Shadows.sm,
  },
  productStripe: { width: 5, alignSelf: 'stretch' },
  productIcon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  productName: { fontSize: 15, fontWeight: '800', color: TEXT },
  productHint: { fontSize: 11, color: MUTED, marginTop: 1 },
  productPlus: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  /* Search */
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF',
    borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 14, ...Shadows.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: TEXT, paddingVertical: 0 },

  /* Empty */
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 6 },
  emptyIcon: {
    width: 66, height: 66, borderRadius: 20, backgroundColor: ORANGE_LT,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: TEXT },
  emptyText: { fontSize: 12, color: MUTED, textAlign: 'center', lineHeight: 18 },

  /* Ticket card */
  ticket: {
    flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 14,
    overflow: 'hidden', marginBottom: 12, ...Shadows.sm,
  },
  ticketStripe: { width: 5, alignSelf: 'stretch' },
  ticketTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ticketParty: { fontSize: 15, fontWeight: '800', color: TEXT },
  ticketTagRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 },
  ticketTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 7 },
  ticketTagText: { fontSize: 10, fontWeight: '800' },
  ticketName: { fontSize: 11.5, color: MUTED, flexShrink: 1 },
  ticketTotalBox: { alignItems: 'flex-end', paddingLeft: 8 },
  ticketTotal: { fontSize: 17, fontWeight: '800', color: ORANGE },
  ticketUnit: { fontSize: 10, color: MUTED, fontWeight: '700' },
  ticketMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9 },
  ticketDate: { fontSize: 11, color: MUTED, fontWeight: '600' },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#CBD5E1', marginHorizontal: 3 },
  ticketActions: {
    flexDirection: 'row', gap: 6, marginTop: 12, paddingTop: 11,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  ticketBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 9, backgroundColor: '#F8FAFC' },
  ticketBtnText: { fontSize: 11, fontWeight: '800' },

  /* Calendar */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,41,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  calCard: { width: '100%', maxWidth: 360, backgroundColor: '#FFF', borderRadius: 18, padding: 18, ...Shadows.lg },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calNavBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  calTitle: { fontSize: 15, fontWeight: '800', color: TEXT },
  calWeekRow: { flexDirection: 'row', marginBottom: 6 },
  calWeekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: MUTED },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  calDay: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  calDayToday: { backgroundColor: ORANGE_LT },
  calDaySelected: { backgroundColor: ORANGE },
  calDayText: { fontSize: 13, color: TEXT, fontWeight: '600' },
  calFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  calTodayLink: { fontSize: 13.5, fontWeight: '800', color: ORANGE },
  calCloseLink: { fontSize: 13.5, fontWeight: '700', color: MUTED },

  /* New sheet modal */
  centerOverlay: { flex: 1, backgroundColor: 'rgba(15,23,41,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  centerCard: { width: '100%', maxWidth: 400, maxHeight: '90%', backgroundColor: '#FFF', borderRadius: 20, ...Shadows.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  modalIconLg: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: TEXT, marginBottom: 8 },
  modalSub: { fontSize: 11.5, color: MUTED, marginTop: -6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, height: 46,
    paddingHorizontal: 12, fontSize: 14.5, color: TEXT, backgroundColor: '#F8FAFC', marginBottom: 12,
  },
  dateField: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5,
    borderColor: BORDER, borderRadius: 10, height: 46, paddingHorizontal: 12,
    backgroundColor: '#F8FAFC', marginBottom: 12,
  },
  dateFieldText: { flex: 1, fontSize: 14, color: TEXT, fontWeight: '600' },
  errText: { fontSize: 12, color: Colors.error, fontWeight: '700', marginBottom: 8 },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnGhost: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  btnGhostText: { fontSize: 14, fontWeight: '800', color: MUTED },
  btnPrimary: { flex: 1.4, flexDirection: 'row', gap: 7, paddingVertical: 13, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 14, fontWeight: '800', color: '#FFF' },

  /* Edit banner */
  editBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF',
    borderRadius: 14, padding: 14, marginBottom: 16, ...Shadows.sm,
  },
  editParty: { fontSize: 15, fontWeight: '800', color: TEXT },
  editSub: { fontSize: 11.5, color: MUTED, marginTop: 2 },

  /* Row cards */
  rowCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF',
    borderRadius: 13, padding: 10, marginBottom: 9, ...Shadows.sm,
  },
  rowNum: { width: 24, height: 24, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  rowNumText: { fontSize: 11.5, fontWeight: '800', color: MUTED },
  rowInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F8FAFC', borderRadius: 9, paddingHorizontal: 9, height: 42 },
  rowFieldLabel: { fontSize: 11, fontWeight: '800', color: '#94A3B8' },
  rowInput: { flex: 1, fontSize: 14.5, color: TEXT, paddingVertical: 0, fontWeight: '700' },
  rowAreaChip: { minWidth: 74, alignItems: 'center', backgroundColor: ORANGE_LT, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 8 },
  rowAreaText: { fontSize: 12.5, fontWeight: '800', color: ORANGE },
  rowAreaUnit: { fontSize: 8.5, color: ORANGE, fontWeight: '700' },

  dashBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 11, borderWidth: 1.5, borderStyle: 'dashed', borderColor: ORANGE,
  },
  dashBtnText: { fontSize: 12.5, fontWeight: '800', color: ORANGE },

  /* Sticky footer */
  stickyFooter: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF', paddingHorizontal: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: BORDER, ...Shadows.lg,
  },
  footerLabel: { fontSize: 10.5, fontWeight: '700', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  footerTotal: { fontSize: 21, fontWeight: '800', color: TEXT },
  footerUnit: { fontSize: 12, color: MUTED, fontWeight: '700' },
  footerSave: {
    flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: ORANGE,
    borderRadius: 12, paddingVertical: 13, paddingHorizontal: 22,
  },
  footerSaveText: { fontSize: 14, fontWeight: '800', color: '#FFF' },

  /* Unit picker */
  unitSelect: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderRadius: 10, height: 46, paddingHorizontal: 12, backgroundColor: '#FFF',
  },
  unitSelectText: { fontSize: 14.5, fontWeight: '800' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 12, borderRadius: 10 },
  pickerText: { fontSize: 14.5, color: TEXT, fontWeight: '600' },

  /* Sheet view */
  viewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF',
    borderRadius: 12, padding: 12, marginBottom: 8, ...Shadows.sm,
  },
  viewDim: { flex: 1, fontSize: 14.5, fontWeight: '700', color: TEXT },
  viewX: { color: MUTED, fontWeight: '600' },
  viewTotalCard: {
    backgroundColor: NAVY, borderRadius: 16, padding: 18, marginTop: 12,
    // Column + stretch so the rate/amount row spans the full card width once a
    // rate is set (the wholesaler uses the same column layout). Without a rate
    // the single centred total still reads correctly.
    flexDirection: 'column', alignItems: 'stretch',
  },
  viewTotalValue: { fontSize: 26, fontWeight: '800', color: '#FFF', marginTop: 4 },
  viewPriceDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 12 },
  viewPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  viewPriceValue: { fontSize: 18, fontWeight: '800', color: '#FFF', marginTop: 2 },
  viewAmountBox: { backgroundColor: ORANGE, borderRadius: 12, padding: 12, alignItems: 'flex-end' },
  viewAmountLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: 'rgba(255,255,255,0.8)' },
  viewAmountValue: { fontSize: 20, fontWeight: '900', color: '#FFF', marginTop: 2 },

  /* Price row in edit view */
  priceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF',
    borderRadius: 14, padding: 14, marginBottom: 16, ...Shadows.sm,
  },
  priceIconWrap: {
    width: 44, height: 44, borderRadius: 13, backgroundColor: ORANGE_LT,
    alignItems: 'center', justifyContent: 'center',
  },
  priceInput: {
    borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, height: 44,
    paddingHorizontal: 12, fontSize: 14.5, fontWeight: '700', color: TEXT,
    backgroundColor: '#F8FAFC', marginTop: 2,
  },
  amountBadge: { alignItems: 'flex-end', backgroundColor: ORANGE_LT, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  amountBadgeLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, color: ORANGE },
  amountBadgeValue: { fontSize: 15, fontWeight: '900', color: ORANGE, marginTop: 2 },
  footerAmount: { fontSize: 14, fontWeight: '800', color: ORANGE, marginTop: 2 },
});
