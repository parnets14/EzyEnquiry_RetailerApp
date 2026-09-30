// src/components/product/CatalogFilterSheet.jsx
//
// The wholesaler-parity filter bottom sheet (Size / Finish / Material / Color /
// Category / Brand). Shared by SearchScreen and MyProductsScreen.

import React, { useEffect, useState } from 'react';
import {
  Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { EMPTY_FILTERS, FILTER_KEYS, OPT_KEY } from './catalogShared';

const NAV = Colors.secondary;

export default function CatalogFilterSheet({
  visible, onClose, filterOptions, activeFilters, onApply,
}) {
  const [local, setLocal] = useState({ ...activeFilters });

  useEffect(() => {
    if (visible) setLocal({ ...activeFilters });
  }, [visible, activeFilters]);

  const toggle = (key, val) =>
    setLocal(prev => ({ ...prev, [key]: prev[key] === val ? '' : val }));

  const clearAll = () => setLocal({ ...EMPTY_FILTERS });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.sheetOverlay}>
        <TouchableOpacity style={st.sheetDismiss} onPress={onClose} activeOpacity={1} />
        <View style={st.sheet}>
          <View style={st.sheetHandle} />

          <View style={st.sheetHeader}>
            <Text style={st.sheetTitle}>Filter Products</Text>
            <TouchableOpacity onPress={clearAll}>
              <Text style={st.clearAll}>Clear All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
            {FILTER_KEYS.map(({ key, label }) => (
              <View key={key} style={st.filterGroup}>
                <Text style={st.filterGroupLabel}>{label}</Text>
                <View style={st.filterOptions}>
                  {(filterOptions[OPT_KEY[key]] || []).length === 0 ? (
                    <Text style={st.noOpts}>No options</Text>
                  ) : (
                    (filterOptions[OPT_KEY[key]] || []).map(opt => {
                      const active = local[key] === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          style={[st.filterOpt, active && st.filterOptActive]}
                          onPress={() => toggle(key, opt)}
                          activeOpacity={0.75}
                        >
                          <Text style={[st.filterOptText, active && st.filterOptTextActive]}>
                            {opt}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={st.applyBtn} onPress={() => { onApply(local); onClose(); }}>
            <Ionicons name="checkmark" size={18} color="#FFF" />
            <Text style={st.applyBtnText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheetDismiss: { flex: 1 },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, paddingBottom: 34,
    maxHeight: '82%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB',
    alignSelf: 'center', marginTop: 10, marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  clearAll: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  filterGroup: { marginBottom: 18 },
  filterGroupLabel: {
    fontSize: 11, fontWeight: '800', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  noOpts: { fontSize: 12, color: Colors.textDisabled, fontStyle: 'italic' },
  filterOpt: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: '#F4F6FA',
  },
  filterOptActive: { backgroundColor: NAV, borderColor: NAV },
  filterOptText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  filterOptTextActive: { color: '#FFF' },
  applyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: NAV, borderRadius: 14, height: 50, marginTop: 10,
  },
  applyBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
