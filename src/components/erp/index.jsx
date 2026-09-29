/**
 * src/components/erp/index.jsx
 *
 * Shared building blocks for the retailer app's ERP screens (sales, expense,
 * purchase, inventory, payments, accounts, reports).
 *
 * The wholesaler app has its own kit (`components/FormField`, `components/Icon`,
 * `EmptyState`, …) but the two apps deliberately do NOT share components — the
 * retailer uses Ionicons and the `Colors`/`Shadows` theme. These are the retailer
 * equivalents, so the ~25 ported screens stay visually consistent instead of each
 * re-declaring its own StyleSheet.
 *
 * Style language: navy header (Colors.secondary) with an orange accent
 * (Colors.primary), matching HomeScreen and the rest of the retailer app.
 */
import React from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';

export const ERP = {
  bg:      '#F2F4F7',
  surface: '#FFFFFF',
  text:    Colors.textPrimary,
  muted:   Colors.textSecondary,
  faint:   Colors.textTertiary,
  border:  Colors.border,
};

/* ── Header ─────────────────────────────────────────────────────────────────
   Navy bar with back arrow, title/subtitle and up to two right-hand actions. */
export function ErpHeader({ title, subtitle, onBack, actions = [], children }) {
  return (
    <View style={h.wrap}>
      <View style={h.decor} />
      <View style={h.row}>
        {onBack ? (
          <TouchableOpacity style={h.back} onPress={onBack} activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={h.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={h.sub} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {actions.map(a => (
          <TouchableOpacity key={a.key} style={h.action} onPress={a.onPress} activeOpacity={0.85}>
            <Ionicons name={a.icon} size={19} color="#FFF" />
          </TouchableOpacity>
        ))}
      </View>
      {children}
    </View>
  );
}

/* ── Summary strip (4 numbers inside the header) ─────────────────────────── */
export function ErpSummaryStrip({ items = [] }) {
  const shown = items.filter(Boolean);
  if (!shown.length) return null;
  return (
    <View style={h.strip}>
      {shown.map((it, i) => (
        <React.Fragment key={it.label}>
          {i > 0 ? <View style={h.stripDiv} /> : null}
          <View style={h.stripItem}>
            <Text style={[h.stripVal, it.color && { color: it.color }]} numberOfLines={1}>{it.value}</Text>
            <Text style={h.stripLbl}>{it.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

/* ── Search box that sits inside the header ──────────────────────────────── */
export function ErpSearchBox({ value, onChangeText, placeholder }) {
  return (
    <View style={h.search}>
      <Ionicons name="search" size={17} color={ERP.muted} style={{ marginLeft: 12 }} />
      <TextInput
        style={h.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={ERP.faint}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value ? (
        <TouchableOpacity onPress={() => onChangeText('')} style={{ marginRight: 10 }}>
          <Ionicons name="close-circle" size={17} color={ERP.muted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/* ── Filter chips row ────────────────────────────────────────────────────── */
export function ErpTabs({ tabs, active, onChange }) {
  return (
    <View style={h.tabsWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={h.tabsContent}>
        {tabs.map(t => {
          const on = active === t;
          return (
            <TouchableOpacity key={t} style={[h.tab, on && h.tabOn]} onPress={() => onChange(t)} activeOpacity={0.8}>
              <Text style={[h.tabTxt, on && h.tabTxtOn]}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ── Card ────────────────────────────────────────────────────────────────── */
export function ErpCard({ children, style }) {
  return <View style={[h.card, style]}>{children}</View>;
}

/* ── Section label inside a card ─────────────────────────────────────────── */
export function ErpSectionLabel({ children }) {
  return <Text style={h.sectionLabel}>{children}</Text>;
}

/* ── Label / value row ───────────────────────────────────────────────────── */
export function ErpInfoRow({ label, value, bold, color, last }) {
  return (
    <View style={[h.infoRow, last && { borderBottomWidth: 0 }]}>
      <Text style={h.infoLabel}>{label}</Text>
      <Text style={[h.infoValue, bold && h.infoBold, color && { color }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

/* ── Status pill ─────────────────────────────────────────────────────────── */
export function ErpBadge({ label, color, bg, dot }) {
  return (
    <View style={[h.badge, { backgroundColor: bg || `${color}18` }]}>
      {dot ? <View style={[h.badgeDot, { backgroundColor: color }]} /> : null}
      <Text style={[h.badgeTxt, { color }]}>{label}</Text>
    </View>
  );
}

/* ── Meta chip (code / invoice / warehouse) ──────────────────────────────── */
export function ErpMetaChip({ icon, label }) {
  return (
    <View style={h.chip}>
      {icon ? <Ionicons name={icon} size={11} color={ERP.muted} /> : null}
      <Text style={h.chipTxt} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/* ── Loading / error / empty ─────────────────────────────────────────────── */
export function ErpLoading({ label = 'Loading…' }) {
  return (
    <View style={h.center}>
      <ActivityIndicator color={Colors.primary} />
      <Text style={h.centerTxt}>{label}</Text>
    </View>
  );
}

export function ErpError({ message, onRetry }) {
  return (
    <View style={h.center}>
      <Ionicons name="cloud-offline-outline" size={32} color={ERP.faint} />
      <Text style={h.centerTxt}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry}>
          <Text style={h.retry}>Tap to retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function ErpEmpty({ icon = 'document-text-outline', title, subtitle }) {
  return (
    <View style={h.center}>
      <View style={h.emptyIcon}>
        <Ionicons name={icon} size={28} color={Colors.primary} />
      </View>
      <Text style={h.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={h.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

/* ── Bottom action button (replaces the wholesaler's FAB) ────────────────── */
export function ErpPrimaryAction({ label, icon = 'add', onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[h.primaryAction, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.88}>
      <Ionicons name={icon} size={19} color="#FFF" />
      <Text style={h.primaryActionTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ── Field primitives for entry forms ────────────────────────────────────── */
export function ErpField({ label, required, error, children, half }) {
  return (
    <View style={[h.field, half && h.half]}>
      {label ? <Text style={h.fieldLabel}>{label}{required ? ' *' : ''}</Text> : null}
      {children}
      {error ? <Text style={h.fieldErr}>{error}</Text> : null}
    </View>
  );
}

export function ErpInput(props) {
  return (
    <TextInput
      {...props}
      style={[h.input, props.style]}
      placeholderTextColor={ERP.faint}
    />
  );
}

export function ErpPicker({ label, value, onPress, placeholder = 'Select…', error }) {
  return (
    <TouchableOpacity style={[h.input, h.picker, error && h.inputErr]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[h.pickerTxt, !value && { color: ERP.faint }]} numberOfLines={1}>
        {value || placeholder}
      </Text>
      <Ionicons name="chevron-down" size={16} color={ERP.muted} />
    </TouchableOpacity>
  );
}

/* ── Shared status colour maps (wholesaler parity) ───────────────────────── */
export const PAY_STATUS = {
  Paid:    { bg: '#ECFDF5', color: '#059669' },
  Partial: { bg: '#EFF6FF', color: '#2563EB' },
  Pending: { bg: '#FFF7ED', color: '#D97706' },
  Overdue: { bg: '#FEF2F2', color: '#DC2626' },
};

export const SALE_STATUS = {
  Confirmed:            { bg: '#EFF6FF', color: '#2563EB' },
  Reserved:             { bg: '#FEF3C7', color: '#D97706' },
  Picking:              { bg: '#F5F3FF', color: '#7C3AED' },
  Packed:               { bg: '#E0F2FE', color: '#0891B2' },
  'Ready for Dispatch': { bg: '#FFF7ED', color: '#EA580C' },
  Dispatched:           { bg: '#FFF0EA', color: '#FF6B35' },
  Delivered:            { bg: '#ECFDF5', color: '#059669' },
  Cancelled:            { bg: '#FEF2F2', color: '#DC2626' },
  Draft:                { bg: '#F3F4F6', color: '#6B7280' },
};

const h = StyleSheet.create({
  /* Header */
  wrap: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
  },
  decor: {
    position: 'absolute', top: -40, right: -40,
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(244,80,10,0.12)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  sub:   { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  action: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Summary strip */
  strip: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 12, borderRadius: 14, paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  stripItem: { flex: 1, alignItems: 'center' },
  stripVal:  { fontSize: 14, fontWeight: '800', color: '#FFF' },
  stripLbl:  { fontSize: 9, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  stripDiv:  { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.2)' },

  /* Search */
  search: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 12,
    marginTop: 12, height: 42,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, paddingHorizontal: 10, paddingVertical: 0 },

  /* Tabs */
  tabsWrap: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabsContent: { paddingHorizontal: 12, paddingVertical: 9, gap: 8 },
  tab: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 18, backgroundColor: '#F0F2F7' },
  tabOn: { backgroundColor: Colors.secondary },
  tabTxt: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  tabTxtOn: { color: '#FFF' },

  /* Card */
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10, ...Shadows.sm },
  sectionLabel: {
    fontSize: 10.5, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  infoLabel: { fontSize: 12.5, color: Colors.textSecondary, flexShrink: 0, marginRight: 10 },
  infoValue: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right', flex: 1 },
  infoBold:  { fontWeight: '800', fontSize: 15, color: Colors.primary },

  /* Badge */
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeTxt: { fontSize: 10, fontWeight: '700' },

  /* Chip */
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F4F5F8', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  chipTxt: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },

  /* States */
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 8, paddingHorizontal: 28 },
  centerTxt: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  retry: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  emptyIcon: {
    width: 58, height: 58, borderRadius: 18, backgroundColor: Colors.primaryBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  emptySub: { fontSize: 11.5, color: Colors.textSecondary, textAlign: 'center', lineHeight: 17 },

  /* Primary action */
  primaryAction: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, ...Shadows.md,
  },
  primaryActionTxt: { color: '#FFF', fontWeight: '800', fontSize: 15 },

  /* Fields */
  field: { marginBottom: 12 },
  half: { width: '48%' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 },
  fieldErr: { fontSize: 11, color: Colors.error, marginTop: 4 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    height: 46, paddingHorizontal: 12, fontSize: 14.5, color: Colors.textPrimary,
    backgroundColor: '#F8FAFC',
  },
  inputErr: { borderColor: Colors.error },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerTxt: { fontSize: 14.5, color: Colors.textPrimary, flex: 1 },
});

export { h as erpStyles };
