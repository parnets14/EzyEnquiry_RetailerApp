// src/components/product/CatalogListBody.jsx
//
// The browsing body shared by the two catalogue surfaces:
//   - screens/products/SearchScreen.jsx      (Search tab)
//   - screens/products/MyProductsScreen.jsx  (Home → Marketplace → Products)
//
// Both show the same catalogue from the same endpoint, so the header, search,
// scope tabs, filter chips, legend, list and filter sheet live here once rather
// than being maintained as two near-identical copies.
//
// Mirrors wholesalerapp/src/screens/product/ProductListScreen.jsx, but with one
// deliberate divergence:
//
//   The wholesaler narrows its feed into All / Admin / My Products scope tabs.
//   That does NOT transfer to the retailer. The wholesaler's 'mine' tab keys on
//   `source === 'wholesaler'` + its own company, and `source` disagrees with
//   `created_by_type` on legacy rows. A retailer-side tab built the same way
//   returns an empty list, and there is no Admin-created catalogue here to
//   populate an 'Admin' tab. So the retailer keeps ONE unified feed: every
//   product it can actually see, per the backend's access clause.
//
// `variant` only changes the chrome the two hosts genuinely differ on:
//   'search' → title "Products",    no back button  (it is a tab root)
//   'my'     → title "Product Catalog", back button (pushed from Home)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { productService as productApi } from '../../services/productService';
import { catalogService as catalogApi } from '../../services/catalogService';
import { SCREENS } from '../../constants';
import CatalogProductCard from './CatalogProductCard';
import CatalogFilterSheet from './CatalogFilterSheet';
import { EMPTY_FILTERS, FILTER_KEYS, isMine, pickDistinct } from './catalogShared';

const NAV = Colors.secondary;   // #1A2340
const OR  = Colors.primary;     // #F4500A

export default function CatalogListBody({
  navigation,
  variant = 'search',
  onMenuPress,
  onOpenProduct,
  headerRight,
}) {
  const insets = useSafeAreaInsets();

  const [products,      setProducts]      = useState([]);
  const [pagination,    setPagination]    = useState({ page: 1, totalPages: 1, total: 0 });
  const [search,        setSearch]        = useState('');
  const [activeFilters, setActiveFilters] = useState({ ...EMPTY_FILTERS });
  const [filterOptions, setFilterOptions] = useState({
    sizes: [], finishes: [], materials: [], colors: [], categories: [], brands: [],
  });
  const [filterVisible, setFilterVisible] = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);
  const [error,         setError]         = useState(null);

  const searchTimer = useRef(null);
  const currentPage = useRef(1);
  const reqTokenRef = useRef('');

  // Filter options: distinct spec values now come from the dedicated filters
  // endpoint (complete), with the first catalogue page as a fallback for older
  // backends. Categories/brands come from the catalog API.
  useEffect(() => {
    Promise.all([
      catalogApi.categories().catch(() => []),
      catalogApi.brands().catch(() => []),
      productApi.filters().catch(() => ({})),
      productApi.search({ limit: 100 }).catch(() => ({})),
    ]).then(([cats, brands, filters, catalogue]) => {
      const sample = Array.isArray(catalogue?.products) ? catalogue.products : [];
      const f = filters || {};
      setFilterOptions({
        sizes:      f.sizes?.length     ? f.sizes     : pickDistinct(sample, p => p.size),
        finishes:   f.finishes?.length  ? f.finishes  : pickDistinct(sample, p => p.finish),
        materials:  f.materials?.length ? f.materials : pickDistinct(sample, p => p.material),
        colors:     f.colors?.length    ? f.colors    : pickDistinct(sample, p => p.color),
        categories: pickDistinct(cats, c => c?.name),
        brands:     pickDistinct(brands, b => b?.name),
      });
    });
  }, []);

  const loadProducts = useCallback(async (page = 1, append = false) => {
    if (page === 1) { append ? setRefreshing(true) : setLoading(true); }
    else setLoadingMore(true);
    setError(null);

    // Guard against a stale response overwriting a newer one (e.g. a slow
    // search keystroke resolving after the next one).
    reqTokenRef.current = String(page);
    const myToken = reqTokenRef.current;

    try {
      const params = {
        page, limit: 20,
        // Admin-catalog scope — the same param the wholesaler's ProductListScreen
        // sends. Narrows the feed to `created_by_type: 'Admin'`, so the retailer
        // sees exactly the products Admin has granted this company access to
        // (access itself is enforced separately by the backend's access clause).
        catalog_only: true,
        ...(search.trim()          && { search:   search.trim() }),
        ...(activeFilters.size     && { size:     activeFilters.size }),
        ...(activeFilters.finish   && { finish:   activeFilters.finish }),
        ...(activeFilters.material && { material: activeFilters.material }),
        ...(activeFilters.color    && { color:    activeFilters.color }),
        ...(activeFilters.category && { category: activeFilters.category }),
        ...(activeFilters.brand    && { brand:    activeFilters.brand }),
      };

      const res = await productApi.search(params);
      const list = res?.products ?? [];
      const pag  = res?.pagination ?? { page: 1, totalPages: 1, total: list.length };

      setProducts(prev => (append && page > 1) ? [...prev, ...list] : list);
      setPagination(pag);
      currentPage.current = page;
    } catch (e) {
      setError(e?.message || 'Failed to load products');
    } finally {
      if (myToken === reqTokenRef.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, [search, activeFilters]);

  useEffect(() => { loadProducts(1); }, [loadProducts]);

  // Reload on focus so an edit / delete made elsewhere is reflected here.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { loadProducts(1); });
    return unsub;
  }, [navigation, loadProducts]);

  const handleRefresh  = () => loadProducts(1, true);
  const handleLoadMore = () => {
    if (!loadingMore && currentPage.current < pagination.totalPages)
      loadProducts(currentPage.current + 1, true);
  };
  const handleApplyFilters = (f) => setActiveFilters(f);

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;
  const clearAll = () => { setSearch(''); setActiveFilters({ ...EMPTY_FILTERS }); };

  const statusBarHeight = Platform.OS === 'android'
    ? (StatusBar.currentHeight ?? 24)
    : insets.top;

  const title = variant === 'my' ? 'Product Catalog' : 'Products';

  const goBack = () => (
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate(SCREENS.HOME)
  );

  return (
    <View style={st.screen}>
      <StatusBar barStyle="light-content" backgroundColor={NAV} />

      {/* ══ HEADER ══ */}
      <View style={[st.header, { paddingTop: statusBarHeight + 10 }]}>
        <View style={st.hCircle1} />
        <View style={st.hCircle2} />

        <View style={st.headerContent}>
          <View style={st.headerTitleBlock}>
            {variant === 'my' ? (
              <TouchableOpacity
                style={st.headerIconWrap}
                onPress={goBack}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="arrow-back" size={20} color="#FFF" />
              </TouchableOpacity>
            ) : null}
            <View style={st.headerTextBox}>
              <Text style={st.headerTitle}>{title}</Text>
              <Text style={st.headerSub}>
                {loading ? 'Loading…' : `${pagination.total} products available`}
              </Text>
            </View>
          </View>

          <View style={st.headerActions}>
            {headerRight}
            {/* Manage categories & brands */}
            <TouchableOpacity
              style={st.headerFilterBtn}
              onPress={() => navigation.navigate(SCREENS.CATEGORIES_BRANDS)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Manage categories and brands"
            >
              <Ionicons name="pricetags-outline" size={20} color="#FFF" />
            </TouchableOpacity>

            {/* Filter */}
            <TouchableOpacity
              style={[st.headerFilterBtn, activeFilterCount > 0 && st.headerFilterBtnActive]}
              onPress={() => setFilterVisible(true)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Filter products"
            >
              <Ionicons name="filter-outline" size={20} color={activeFilterCount > 0 ? NAV : '#FFF'} />
              {activeFilterCount > 0 && (
                <View style={st.filterBadge}>
                  <Text style={st.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Search box — code / name / size */}
        <View style={st.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textDisabled} />
          <TextInput
            style={st.searchBarInput}
            placeholder="Search code, name, size…"
            placeholderTextColor={Colors.textDisabled}
            value={search}
            onChangeText={(t) => {
              setSearch(t);
              if (searchTimer.current) clearTimeout(searchTimer.current);
              searchTimer.current = setTimeout(() => loadProducts(1), 400);
            }}
            returnKeyType="search"
            onSubmitEditing={() => loadProducts(1)}
          />
          {search ? (
            <TouchableOpacity
              onPress={() => { setSearch(''); loadProducts(1); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={16} color={Colors.textDisabled} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ── Active filter chips ── */}
      {activeFilterCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.activeFilterRow}
          style={st.activeFilterScroll}
        >
          {FILTER_KEYS.filter(f => activeFilters[f.key]).map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={st.activeChip}
              onPress={() => setActiveFilters(p => ({ ...p, [key]: '' }))}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${label} filter`}
            >
              <Text style={st.activeChipText}>{label}: {activeFilters[key]}</Text>
              <Ionicons name="close-circle" size={13} color={NAV} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Rate legend strip ── */}
      <View style={st.legendStrip}>
        <View style={st.legendItem}>
          <View style={[st.dot, { backgroundColor: '#10B981' }]} />
          <Text style={st.legendText}>Rate set</Text>
        </View>
        <View style={st.legendItem}>
          <View style={[st.dot, { backgroundColor: '#D1D5DB' }]} />
          <Text style={st.legendText}>Rate pending</Text>
        </View>
        {!loading && (
          <Text style={st.legendCount}>{pagination.total} total</Text>
        )}
      </View>

      {/* ── Error ── */}
      {error && !loading ? (
        <View style={st.errorBox}>
          <Ionicons name="cloud-offline-outline" size={18} color="#DC2626" />
          <Text style={st.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={() => loadProducts(1)}
            style={st.retryBtn}
            accessibilityRole="button"
            accessibilityLabel="Retry loading products"
          >
            <Text style={st.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Product list ── */}
      {loading && products.length === 0 ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={NAV} />
          <Text style={st.loadingText}>Loading products…</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => String(item._id || item.id)}
          renderItem={({ item }) => (
            <CatalogProductCard
              item={item}
              onPress={() => onOpenProduct?.(item)}
              onMenuPress={isMine(item) ? onMenuPress : undefined}
            />
          )}
          contentContainerStyle={st.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh}
              colors={[NAV]} tintColor={NAV} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator size="small" color={NAV} style={st.loadMoreSpinner} />
              : null
          }
          ListEmptyComponent={
            !loading && !error ? (
              <View style={st.empty}>
                <View style={st.emptyIconWrap}>
                  <Ionicons name="cube-outline" size={44} color={Colors.textDisabled} />
                </View>
                <Text style={st.emptyTitle}>No products found</Text>
                <Text style={st.emptySub}>
                  {activeFilterCount > 0 || search
                    ? 'Try adjusting your search or filters'
                    : 'No products available yet'}
                </Text>
                {(activeFilterCount > 0 || search) && (
                  <TouchableOpacity
                    style={st.clearFiltersBtn}
                    onPress={clearAll}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search and filters"
                  >
                    <Text style={st.clearFiltersBtnText}>Clear Search & Filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null
          }
        />
      )}

      {/* ── Filter sheet ── */}
      <CatalogFilterSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        filterOptions={filterOptions}
        activeFilters={activeFilters}
        onApply={handleApplyFilters}
      />

      {/* ── Bottom action bar — Buy Item only ── */}
      <View style={[st.fabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TouchableOpacity
          style={st.fabPrimary}
          activeOpacity={0.85}
          onPress={() => navigation.navigate(SCREENS.PURCHASE_ENTRY)}
          accessibilityRole="button"
          accessibilityLabel="Buy item"
        >
          <Ionicons name="cart-outline" size={18} color="#FFF" />
          <Text style={st.fabPrimaryText}>Buy Item</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F2F8' },

  /* ── Header ── */
  header: {
    backgroundColor: NAV,
    paddingHorizontal: 16,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  hCircle1: {
    position: 'absolute', top: -30, right: -30,
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  hCircle2: {
    position: 'absolute', bottom: -20, left: -20,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerContent: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  headerTextBox: { flexShrink: 1 },
  headerIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF', letterSpacing: 0.2 },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  headerFilterBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  headerFilterBtnActive: { backgroundColor: '#FFF', borderColor: '#FFF' },
  filterBadge: {
    position: 'absolute', top: 5, right: 5,
    width: 15, height: 15, borderRadius: 8,
    backgroundColor: OR, justifyContent: 'center', alignItems: 'center',
  },
  filterBadgeText: { color: '#FFF', fontSize: 8, fontWeight: '900' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 12,
    marginTop: 12, height: 42,
  },
  searchBarInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, paddingVertical: 0 },

  /* ── Active filter chips ── */
  activeFilterScroll: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    maxHeight: 46,
  },
  activeFilterRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: 'center' },
  activeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.secondaryBg, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: NAV + '30',
  },
  activeChipText: { fontSize: 11, fontWeight: '600', color: NAV },

  /* ── Legend strip ── */
  legendStrip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: 12,
  },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:         { width: 8, height: 8, borderRadius: 4 },
  legendText:  { fontSize: 11, color: Colors.textSecondary },
  legendCount: { marginLeft: 'auto', fontSize: 11, fontWeight: '700', color: Colors.textSecondary },

  /* ── Error ── */
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, padding: 12, backgroundColor: '#FEF2F2',
    borderRadius: 10, borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { flex: 1, fontSize: 12, color: '#DC2626' },
  retryBtn:  { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#DC2626', borderRadius: 6 },
  retryText: { fontSize: 11, color: '#FFF', fontWeight: '700' },

  /* ── Loading ── */
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
  loadingText: { fontSize: 13, color: Colors.textSecondary },
  loadMoreSpinner: { marginVertical: 20 },

  /* ── Product list ── */
  list: { padding: 12, paddingBottom: 90 },

  /* ── Empty ── */
  empty: { alignItems: 'center', paddingTop: 64, paddingHorizontal: 32, gap: 10 },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#F0EEF8',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  emptySub:   { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  clearFiltersBtn: {
    marginTop: 8, paddingHorizontal: 18, paddingVertical: 9,
    backgroundColor: NAV, borderRadius: 20,
  },
  clearFiltersBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  /* ── Bottom action bar ── */
  fabBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingTop: 8,
    backgroundColor: '#FFF',
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  fabPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 46, borderRadius: 12, backgroundColor: OR, marginLeft: 6,
  },
  fabPrimaryText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
});
