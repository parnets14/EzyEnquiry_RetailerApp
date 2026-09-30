// src/components/product/CatalogProductCard.jsx
//
// The wholesaler-parity catalogue card: thumbnail, source badge, spec chips,
// category · brand and the full price breakup. Shared by SearchScreen and
// MyProductsScreen so both surfaces stay identical.
//
// Pass `onMenuPress` to get an ellipsis button (edit / delete) — only ever wired
// up for products the retailer owns (`can_manage`).

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/spacing';
import { STATUS_BADGE, money, resolveImg, sourceOf } from './catalogShared';

const nameOf = (v) => (v && typeof v === 'object' ? (v.name || '—') : (v || '—'));

function PriceRow({ label, value }) {
  return (
    <View style={st.priceRow}>
      <Text style={st.priceLabel}>{label}</Text>
      <Text style={st.priceVal}>{value}</Text>
    </View>
  );
}

export default function CatalogProductCard({ item, onPress, onMenuPress }) {
  const imageUrl = resolveImg(item.image_urls?.[0]);

  const catName = nameOf(item.category_id) !== '—' ? nameOf(item.category_id) : nameOf(item.category);
  const brandName = nameOf(item.brand_id) !== '—' ? nameOf(item.brand_id) : nameOf(item.brand);
  const unit = item.unit || 'Sq Ft';
  const source = sourceOf(item);

  // Prefer category-specific attributes; fall back to legacy columns.
  const a = item.attributes && typeof item.attributes === 'object' ? item.attributes : {};
  const chips = [];
  const push = (v) => { if (v != null && String(v).trim() && chips.length < 4) chips.push(String(v)); };
  push(a.variety || a.design || a.block_type || a.product_type);
  push(a.granite_type || a.tile_type || a.material);
  push(a.size || item.size);
  push(a.thickness || item.thickness);
  push(a.finish || item.finish);
  push(a.colour || a.color || item.color);
  const seen = new Set();
  const specChips = chips
    .filter(c => { const k = c.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 3);

  return (
    <TouchableOpacity style={st.card} onPress={onPress} activeOpacity={0.85}>
      {/* Manage (edit / delete) — own listings only */}
      {onMenuPress ? (
        <TouchableOpacity
          style={st.menuBtn}
          onPress={(event) => { event.stopPropagation?.(); onMenuPress(item); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Manage ${item.name || 'product'}`}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      ) : null}

      <View style={st.cardTop}>
        <View style={st.thumb}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={st.thumbImg} resizeMode="cover" />
          ) : (
            <View style={st.thumbPlaceholder}>
              <Ionicons name="image-outline" size={26} color={Colors.textDisabled} />
            </View>
          )}
        </View>

        <View style={[st.cardBody, onMenuPress && st.cardBodyWithMenu]}>
          <Text style={st.cardName} numberOfLines={1}>{item.name || '—'}</Text>

          <View style={st.cardCodeRow}>
            <Text style={st.cardCode}>{item.code || '—'}</Text>
            {item.is_active === false ? (
              <View style={[st.srcBadge, { backgroundColor: '#F3F4F6' }]}>
                <Text style={[st.srcBadgeText, { color: '#6B7280' }]}>Inactive</Text>
              </View>
            ) : STATUS_BADGE[item.status] ? (
              <View style={[st.srcBadge, { backgroundColor: STATUS_BADGE[item.status].bg }]}>
                <Text style={[st.srcBadgeText, { color: STATUS_BADGE[item.status].color }]}>
                  {STATUS_BADGE[item.status].label}
                </Text>
              </View>
            ) : null}
            <View style={[st.srcBadge, { backgroundColor: source.bg }]}>
              <Text style={[st.srcBadgeText, { color: source.color }]}>{source.label}</Text>
            </View>
          </View>

          {specChips.length > 0 && (
            <View style={st.chipRow}>
              {specChips.map((c, i) => (
                <View key={i} style={st.specChip}><Text style={st.specChipText}>{c}</Text></View>
              ))}
            </View>
          )}

          <Text style={st.cardCat} numberOfLines={1}>{catName} · {brandName}</Text>
        </View>
      </View>

      {/* Price breakup — same four rows as the wholesaler's card.
          The catalogue DTO ships these flat, so they render as-is. Only the
          seller's cost/margin columns are withheld: the retailer is the BUYER,
          and showing purchase/selling would expose a wholesaler's margin. The
          row structure stays identical to the wholesaler's card. */}
      <View style={st.priceBox}>
        <Text style={st.priceBoxTitle}>Price Breakup (per {unit})</Text>
        <PriceRow label="Wholesale" value={money(item.wholesale_rate)} />
        <PriceRow label="MRP"       value={money(item.mrp)} />
        <PriceRow label="Retail"    value={money(item.retail_price)} />
        <PriceRow label="Dealer"    value={money(item.dealer_price)} />
        <View style={st.priceDivider} />
        <PriceRow label="GST" value={`${item.gst_percent ?? 18}%`} />
        {(item.pcs_per_box || item.sqft_per_box) ? (
          <PriceRow label="Per Box"
            value={`${item.pcs_per_box || '—'} pcs · ${item.sqft_per_box || '—'} sqft`} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: '#FFF', borderRadius: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  menuBtn: {
    position: 'absolute', top: 8, right: 8, zIndex: 2,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1, borderColor: Colors.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  thumb: { width: 78, height: 92 },
  thumbPlaceholder: {
    width: 78, height: 92, backgroundColor: '#F0EEF8',
    justifyContent: 'center', alignItems: 'center',
  },
  thumbImg: { width: 78, height: 92 },
  cardBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  cardBodyWithMenu: { paddingRight: 42 },
  cardName: { fontSize: 14.5, fontWeight: '800', color: Colors.textPrimary },
  cardCode: { fontSize: 11, color: Colors.textSecondary },
  cardCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 1, flexWrap: 'wrap' },
  srcBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  srcBadgeText: { fontSize: 9.5, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  specChip: { backgroundColor: '#F0EEF8', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  specChipText: { fontSize: 10, color: Colors.textSecondary, fontWeight: '500' },
  cardCat: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  priceBox: {
    backgroundColor: '#FAFBFC',
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  priceBoxTitle: {
    fontSize: 10.5, fontWeight: '800', color: Colors.primary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  priceLabel: { fontSize: 12.5, color: Colors.textSecondary },
  priceVal: { fontSize: 12.5, fontWeight: '700', color: Colors.textPrimary },
  priceDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 6 },
});
