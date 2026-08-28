import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import AppHeader from '../../components/common/AppHeader';
import ProductCard from '../../components/product/ProductCard';
import FilterBottomSheet from '../../components/common/FilterBottomSheet';
import EmptyState from '../../components/common/EmptyState';
// mockData removed — this screen is unused but kept to prevent navigation crash
const mockProducts = [];
import { SCREENS } from '../../constants';

const SORT_OPTIONS = [
  { key: 'default',    label: 'Default'              },
  { key: 'price_asc',  label: 'Price: Low → High'    },
  { key: 'price_desc', label: 'Price: High → Low'    },
  { key: 'name',       label: 'Name A – Z'           },
  { key: 'available',  label: 'Available First'       },
];

const SearchResultsScreen = ({ navigation, route }) => {
  const { query = '', initialFilters = {} } = route.params || {};

  const [filters, setFilters]       = useState(initialFilters);
  const [sort, setSort]             = useState('default');
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort]     = useState(false);

  const activeFilterCount = Object.values(filters).reduce(
    (s, a) => s + (a ? a.length : 0), 0,
  );

  const results = useMemo(() => {
    let list = [...mockProducts];

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q)         ||
        p.productCode.toLowerCase().includes(q)  ||
        p.brand.toLowerCase().includes(q)        ||
        p.category.toLowerCase().includes(q)     ||
        (p.color && p.color.toLowerCase().includes(q)) ||
        (p.finish && p.finish.toLowerCase().includes(q))
      );
    }

    if (filters.brand?.length)        list = list.filter(p => filters.brand.includes(p.brand));
    if (filters.size?.length)         list = list.filter(p => filters.size.includes(p.size));
    if (filters.finish?.length)       list = list.filter(p => filters.finish.includes(p.finish));
    if (filters.material?.length)     list = list.filter(p => filters.material.includes(p.material));
    if (filters.color?.length)        list = list.filter(p => filters.color.includes(p.color));
    if (filters.availability?.length) list = list.filter(p => filters.availability.includes(p.availability));

    switch (sort) {
      case 'price_asc':  list.sort((a, b) => (a.price || 0) - (b.price || 0)); break;
      case 'price_desc': list.sort((a, b) => (b.price || 0) - (a.price || 0)); break;
      case 'name':       list.sort((a, b) => a.name.localeCompare(b.name));    break;
      case 'available':
        list.sort((a) => a.availability === 'In Stock' ? -1 : 1);
        break;
      default: break;
    }

    return list;
  }, [query, filters, sort]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <AppHeader
        title={query ? `"${query}"` : 'Search Results'}
        subtitle={`${results.length} product${results.length !== 1 ? 's' : ''} found`}
        showBack
        onBack={() => navigation.goBack()}
        centerTitle={false}
        rightComponent={
          <TouchableOpacity
            style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
            onPress={() => setShowFilter(true)}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={activeFilterCount > 0 ? Colors.primary : Colors.textSecondary}
            />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        }
      />

      {/* Sort / Filter toolbar */}
      <View style={styles.toolbar}>
        <Text style={styles.resultCount}>{results.length} results</Text>
        <TouchableOpacity
          style={styles.sortBtn}
          onPress={() => setShowSort(s => !s)}
        >
          <Ionicons name="swap-vertical-outline" size={14} color={Colors.primary} />
          <Text style={styles.sortLabel}>
            {SORT_OPTIONS.find(s => s.key === sort)?.label || 'Sort'}
          </Text>
          <Ionicons
            name={showSort ? 'chevron-up' : 'chevron-down'}
            size={13}
            color={Colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Sort dropdown */}
      {showSort && (
        <View style={styles.sortDropdown}>
          {SORT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sortOption, sort === opt.key && styles.sortOptionActive]}
              onPress={() => { setSort(opt.key); setShowSort(false); }}
            >
              {sort === opt.key && (
                <Ionicons name="checkmark" size={14} color={Colors.primary} style={styles.sortCheck} />
              )}
              <Text style={[styles.sortOptionText, sort === opt.key && styles.sortOptionTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Active filters chips */}
      {activeFilterCount > 0 && (
        <View style={styles.activeFiltersRow}>
          <FlatList
            data={Object.entries(filters).flatMap(([key, vals]) =>
              (vals || []).map(v => ({ key: `${key}:${v}`, filterKey: key, value: v }))
            )}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={i => i.key}
            contentContainerStyle={styles.activeFiltersContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.activeChip}
                onPress={() => {
                  setFilters(prev => ({
                    ...prev,
                    [item.filterKey]: (prev[item.filterKey] || []).filter(v => v !== item.value),
                  }));
                }}
              >
                <Text style={styles.activeChipText}>{item.value}</Text>
                <Ionicons name="close" size={11} color={Colors.primary} />
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity
            style={styles.clearAllChip}
            onPress={() => setFilters({})}
          >
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      )}

      {results.length === 0 ? (
        <EmptyState
          iconName="search-outline"
          title="No Products Found"
          message={`No products match "${query}". Try different keywords or clear filters.`}
          buttonTitle="CLEAR FILTERS"
          onButtonPress={() => setFilters({})}
          buttonVariant="outline"
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={() => navigation.navigate(SCREENS.PRODUCT_DETAILS, { product: item })}
            />
          )}
        />
      )}

      <FilterBottomSheet
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        onApply={f => setFilters(f)}
        initialFilters={filters}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  filterBtn: {
    width: 36, height: 36, borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
    position: 'relative',
  },
  filterBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.primary, borderRadius: 8,
    minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: Colors.white,
  },
  filterBadgeText: { color: Colors.white, fontSize: 9, fontWeight: '800' },

  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  resultCount: { ...Typography.caption, color: Colors.textSecondary },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.badge,
    backgroundColor: Colors.primaryBg,
  },
  sortLabel: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },

  sortDropdown: {
    position: 'absolute',
    top: 108,
    right: Spacing.screenPadding,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    ...Shadows.lg,
    zIndex: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 190,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sortOptionActive: { backgroundColor: Colors.primaryBg },
  sortCheck: { marginRight: 6 },
  sortOptionText: { ...Typography.body2, color: Colors.textSecondary },
  sortOptionTextActive: { color: Colors.primary, fontWeight: '700' },

  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingVertical: 8,
  },
  activeFiltersContent: {
    paddingHorizontal: Spacing.screenPadding,
    gap: 6,
    flexGrow: 1,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryBg,
    borderRadius: BorderRadius.badge,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  activeChipText: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
  clearAllChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  clearAllText: { ...Typography.caption, color: Colors.error, fontWeight: '600' },

  list: {
    padding: Spacing.screenPadding,
    paddingBottom: 90,
  },
});

export default SearchResultsScreen;
