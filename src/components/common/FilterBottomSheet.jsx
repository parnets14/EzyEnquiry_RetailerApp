import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import PrimaryButton from './PrimaryButton';
// Filter options — static defaults (mockData removed)
const mockBrands = ['Kajaria', 'Somany', 'Orient', 'Johnson', 'Nitco'];
const mockSizes = ['600x600', '600x1200', '800x800', '300x300', '1200x2400'];
const mockFinishes = ['Glossy', 'Matt', 'Polished', 'Anti-Skid', 'Satin'];
const mockMaterials = ['Vitrified', 'Ceramic', 'Porcelain', 'Marble', 'Granite'];
const mockColors = ['White', 'Beige', 'Brown', 'Grey', 'Blue', 'Gold'];

const FILTER_SECTIONS = [
  { key: 'brand', label: 'Brand', options: mockBrands },
  { key: 'size', label: 'Size', options: mockSizes },
  { key: 'finish', label: 'Finish', options: mockFinishes },
  { key: 'material', label: 'Material', options: mockMaterials },
  { key: 'color', label: 'Color', options: mockColors },
  {
    key: 'availability',
    label: 'Availability',
    options: ['In Stock', 'Limited Stock', 'Out of Stock'],
  },
];

const FilterBottomSheet = ({ visible, onClose, onApply, initialFilters = {} }) => {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(initialFilters);

  const toggle = (key, value) => {
    setSelected(prev => {
      const current = prev[key] || [];
      const exists = current.includes(value);
      return {
        ...prev,
        [key]: exists ? current.filter(v => v !== value) : [...current, value],
      };
    });
  };

  const isSelected = (key, value) => (selected[key] || []).includes(value);

  const clearAll = () => setSelected({});

  const activeCount = Object.values(selected).reduce(
    (sum, arr) => sum + (arr ? arr.length : 0), 0
  );

  const handleApply = () => {
    onApply(selected);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
              {/* Handle */}
              <View style={styles.handle} />

              {/* Header */}
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Filters</Text>
                {activeCount > 0 ? (
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{activeCount}</Text>
                  </View>
                ) : null}
                <TouchableOpacity onPress={clearAll} style={styles.clearAllBtn}>
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.scrollArea}
                showsVerticalScrollIndicator={false}
              >
                {FILTER_SECTIONS.map(section => (
                  <View key={section.key} style={styles.section}>
                    <Text style={styles.sectionLabel}>{section.label}</Text>
                    <View style={styles.chipsRow}>
                      {section.options.map(option => {
                        const sel = isSelected(section.key, option);
                        return (
                          <TouchableOpacity
                            key={option}
                            style={[styles.chip, sel && styles.chipSelected]}
                            onPress={() => toggle(section.key, option)}
                            activeOpacity={0.75}
                          >
                            <Text style={[styles.chipText, sel && styles.chipTextSelected]}>
                              {option}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </ScrollView>

              {/* Actions */}
              <View style={styles.actions}>
                <PrimaryButton
                  title="CLEAR ALL"
                  onPress={clearAll}
                  variant="outline"
                  style={styles.clearBtn}
                />
                <PrimaryButton
                  title={`APPLY FILTERS${activeCount > 0 ? ` (${activeCount})` : ''}`}
                  onPress={handleApply}
                  variant="primary"
                  style={styles.applyBtn}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius['3xl'],
    borderTopRightRadius: BorderRadius['3xl'],
    maxHeight: '88%',
    paddingTop: 8,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.base,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 8,
  },
  sheetTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    flex: 1,
  },
  countBadge: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  clearAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearAllText: {
    ...Typography.body2,
    color: Colors.primary,
    fontWeight: '600',
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: Spacing.base,
  },
  section: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
    fontSize: 11,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.chip,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  chipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryBg,
  },
  chipText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  clearBtn: {
    flex: 0.45,
  },
  applyBtn: {
    flex: 0.55,
  },
});

export default FilterBottomSheet;
