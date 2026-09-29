// src/screens/products/MyProductsScreen.jsx
// Retailer Product Catalog — view only (structural parity with wholesalerapp).
//
// Shows the products the retailer can browse: the Admin catalogue it has been
// granted access to, PLUS its own listings (`RPD-` products). Browsing only —
// products are created/edited from the Add Product form, and categories/brands
// from Categories & Brands. Tapping a card opens Product Details.
//
// Mirrors wholesalerapp/src/screens/product/ProductListScreen.jsx:
//   - custom navy header (icon + title + count + manage-categories + filter)
//   - search bar inside the header (debounced)
//   - active filter chips
//   - rate legend strip
//   - ProductCard with thumbnail, source badge, spec chips and full price breakup
//   - FilterSheet (Size / Finish / Material / Color / Category / Brand)
//   - bottom action bar with "Buy Item" only
//   - pagination + focus reload + race-condition guards
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
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
import { Shadows } from '../../theme/spacing';
import { catalogApi, mediaUrl, productApi } from '../../utils/api';
import { mapMarketplaceProduct } from '../../utils/productMapper';
import { SCREENS } from '../../constants';

const NAV = Colors.secondary;   // #1A2340
const OR  = Colors.primary;     // #F4500A

const FILTER_KEYS = [
  { key: 'size',     label: 'Size'     },
  { key: 'finish',   label: 'Finish'   },
  { key: 'material', label: 'Material' },
  { key: 'color',    label: 'Color'    },
  { key: 'category', label: 'Category' },
  { key: 'brand',    label: 'Brand'    },
];

const EMPTY_FILTERS = { size: '', finish: '', material: '', color: '', category: '', brand: '' };

// filterOptions keys aren't always key + 's' (category → categories).
const OPT_KEY = {
  size: 'sizes', finish: 'finishes', material: 'materials',
  color: 'colors', category: 'categories', brand: 'brands',
};

const STATUS_BADGE = {
  out_of_stock: { label: 'Out of Stock', bg: '#FEF2F2', color: '#DC2626' },
  discontinued: { label: 'Discontinued', bg: '#F3F4F6', color: '#6B7280' },
};

// Product images come back as relative paths (/uploads/images/x.jpg); the
// device can't resolve those, so prefix the API host.
const resolveImg = (u) => (!u ? null : /^https?:/.test(u) ? u : mediaUrl(u));

const money = (n) => (n == null || n === '' || Number(n) === 0) ? '—' : '₹' + Number(n).toLocaleString('en-IN');

// A product is part of the Admin catalogue when the backend tagged it that way.
const isAdminProduct = (item) => (item.added_by_type || '') === 'Admin';

// ── Price row helper ─────────────────────────────────────────
function PriceRow({ label, value, strong }) {
  return (
    <View style={st.priceRow}>
      <Text style={st.priceLabel}>{label}</Text>
      <Text style={[st.priceVal, strong && st.priceValStrong]}>{value}</Text>
    </View>
  );
}

// ── Product card ─────────────────────────────────────────────
function ProductCard({ item, onPress, isMine }) {
  const imageUrl = resolveImg(item.image_urls?.[0]);
  const nameOf = (v) => (v && typeof v === 'object' ? (v.name || '—') : (v || '—'));
  const catName   = nameOf(item.category_id) !== '—' ? nameOf(item.category_id) : nameOf(item.category);
  const brandName = nameOf(item.brand_id)    !== '—' ? nameOf(item.brand_id)    : nameOf(item.brand);
  const unit = item.unit || 'Sq Ft';

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

  const isAdmin = isAdminProduct(item);

  return (
    <TouchableOpacity style={st.card} onPress={onPress} activeOpacity={0.85}>
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

        <View style={st.cardBody}>
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
            {isAdmin ? (
              <View style={[st.srcBadge, st.srcBadgeAdmin]}>
                <Text style={[st.srcBadgeText, { color: '#1D4ED8' }]}>Admin Catalog</Text>
              </View>
            ) : (
              <View style={[st.srcBadge, st.srcBadgeMine]}>
                <Text style={[st.srcBadgeText, { color: '#047857' }]}>{isMine ? 'My Product' : 'Seller'}</Text>
              </View>
            )}
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

      {/* Full price breakup */}
      <View style={st.priceBox}>
        <Text style={st.priceBoxTitle}>Price Breakup (per {unit})</Text>
        <PriceRow label="Purchase"  value={money(item.purchase_price)} />
        <PriceRow label="Selling"   value={money(item.selling_price)} />
        <PriceRow label="Wholesale" value={money(item.wholesale_rate)} />
        <PriceRow label="MRP"       value={money(item.mrp)} />
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

// ── Filter bottom sheet ───────────────────────────────────────
function FilterSheet({ visible, onClose, filterOptions, activeFilters, onApply }) {
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

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════
export default function MyProductsScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [products,      setProducts]      = useState([]);
  const [pagination,    setPagination]    = useState({ page: 1, totalPages: 1, total: 0 });
  const [search,        setSearch]        = useState('');
  const [activeFilters, setActiveFilters] = useState({ ...EMPTY_FILTERS });
  const [filterOptions, setFilterOptions] = useState({ sizes: [], finishes: [], materials: [], colors: [], categories: [], brands: [] });
  const [filterVisible, setFilterVisible] = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);
  const [error,         setError]         = useState(null);

  const searchTimer = useRef(null);
  const currentPage = useRef(1);
  const reqTokenRef = useRef('');

  // Load filter options once: distinct spec values + price fields come off the
  // catalogue listing (top-level in the DTO); categories/brands come from the
  // catalog API. request() unwraps the envelope, so catalogApi resolves to a
  // bare array and productApi.search resolves to { products, pagination }.
  useEffect(() => {
    const arr = (v) => (Array.isArray(v) ? v : []);
    Promise.all([
      catalogApi.categories().catch(() => []),
      catalogApi.brands().catch(() => []),
      productApi.search({ limit: 100 }).catch(() => ({})),
    ]).then(([cats, brands, catalogue]) => {
      const pick = (list, getter) =>
        [...new Set(arr(list).map(getter).filter(Boolean).map(String))].sort();
      const all = arr(catalogue?.products);
      setFilterOptions({
        sizes:      pick(all, p => p.size),
        finishes:   pick(all, p => p.finish),
        materials:  pick(all, p => p.material),
        colors:     pick(all, p => p.color),
        categories: pick(cats, c => c?.name),
        brands:     pick(brands, b => b?.name),
      });
    });
  }, []);

  // Load / reload products — one call covers BOTH the admin catalogue the
  // retailer can see AND the retailer's own listings.
  const loadProducts = useCallback(async (page = 1, append = false) => {
    if (page === 1) { append ? setRefreshing(true) : setLoading(true); }
    else setLoadingMore(true);
    setError(null);

    reqTokenRef.current = 'catalog:' + page;
    const myToken = reqTokenRef.current;

    try {
      const params = {
        page, limit: 20,
        ...(search.trim()          && { search:   search.trim() }),
        ...(activeFilters.size     && { size:     activeFilters.size }),
        ...(activeFilters.finish   && { finish:   activeFilters.finish }),
        ...(activeFilters.material && { material: activeFilters.material }),
        ...(activeFilters.color    && { color:    activeFilters.color }),
        ...(activeFilters.category && { category: activeFilters.category }),
        ...(activeFilters.brand    && { brand:    activeFilters.brand }),
      };

      const res  = await productApi.search(params);
      // request() already unwraps the envelope: { products, pagination }.
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

  // Reload whenever the screen regains focus (e.g. after Add Product).
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

  const statusBarHeight = Platform.OS === 'android'
    ? (StatusBar.currentHeight ?? 24)
    : insets.top;

  return (
    <View style={st.screen}>
      <StatusBar barStyle="light-content" backgroundColor={NAV} />

      {/* ══ CUSTOM TOP HEADER ══ */}
      <View style={[st.header, { paddingTop: statusBarHeight + 10 }]}>
        <View style={st.hCircle1} />
        <View style={st.hCircle2} />

        <View style={st.headerContent}>
          <View style={st.headerTitleBlock}>
            <TouchableOpacity
              style={st.headerIconWrap}
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate(SCREENS.HOME))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.82}
            >
              <Ionicons name="arrow-back" size={20} color="#FFF" />
            </TouchableOpacity>
            <View>
              <Text style={st.headerTitle}>Product Catalog</Text>
              <Text style={st.headerSub}>
                {loading ? 'Loading…' : `${pagination.total} products available`}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* Manage categories & brands */}
            <TouchableOpacity
              style={st.headerFilterBtn}
              onPress={() => navigation.navigate(SCREENS.CATEGORIES_BRANDS)}
              activeOpacity={0.82}
            >
              <Ionicons name="pricetags-outline" size={20} color="#FFF" />
            </TouchableOpacity>

            {/* Filter */}
            <TouchableOpacity
              style={[st.headerFilterBtn, activeFilterCount > 0 && st.headerFilterBtnActive]}
              onPress={() => setFilterVisible(true)}
              activeOpacity={0.82}
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
            <TouchableOpacity onPress={() => { setSearch(''); loadProducts(1); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
      {error && !loading && (
        <View style={st.errorBox}>
          <Ionicons name="cloud-offline-outline" size={18} color="#DC2626" />
          <Text style={st.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => loadProducts(1)} style={st.retryBtn}>
            <Text style={st.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

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
            <ProductCard
              item={item}
              isMine={!isAdminProduct(item)}
              onPress={() => navigation.navigate(SCREENS.PRODUCT_DETAILS, {
                product: mapMarketplaceProduct(item),
              })}
            />
          )}
          contentContainerStyle={st.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh}
              colors={[NAV]} tintColor={NAV} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator size="small" color={NAV} style={{ marginVertical: 20 }} />
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
                    onPress={() => { setSearch(''); setActiveFilters({ ...EMPTY_FILTERS }); }}
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
      <FilterSheet
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
        >
          <Ionicons name="cart-outline" size={18} color="#FFF" />
          <Text style={st.fabPrimaryText}>Buy Item</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F2F8' },

  /* ── Custom header ── */
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
  headerIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF', letterSpacing: 0.2 },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
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

  /* ── Product list ── */
  list: { padding: 12, paddingBottom: 90 },

  /* ── Product card ── */
  card: {
    backgroundColor: '#FFF', borderRadius: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  thumb: { width: 78, height: 92 },
  thumbPlaceholder: {
    width: 78, height: 92, backgroundColor: '#F0EEF8',
    justifyContent: 'center', alignItems: 'center',
  },
  thumbImg: { width: 78, height: 92 },
  cardBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  cardName: { fontSize: 14.5, fontWeight: '800', color: Colors.textPrimary },
  cardCode: { fontSize: 11, color: Colors.textSecondary },
  cardCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 1, flexWrap: 'wrap' },
  srcBadge:      { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  srcBadgeAdmin: { backgroundColor: '#DBEAFE' },
  srcBadgeMine:  { backgroundColor: '#DCFCE7' },
  srcBadgeText:  { fontSize: 9.5, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  specChip: {
    backgroundColor: '#F0EEF8', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  specChipText: { fontSize: 10, color: Colors.textSecondary, fontWeight: '500' },
  cardCat: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  /* ── Price breakup box ── */
  priceBox: {
    backgroundColor: '#FAFBFC',
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  priceBoxTitle: {
    fontSize: 10.5, fontWeight: '800', color: OR,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  priceLabel:     { fontSize: 12.5, color: Colors.textSecondary },
  priceVal:       { fontSize: 12.5, fontWeight: '700', color: Colors.textPrimary },
  priceValStrong: { color: OR },
  priceDivider:   { height: 1, backgroundColor: Colors.border, marginVertical: 6 },

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
  clearFiltersBtn: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 9, backgroundColor: NAV, borderRadius: 20 },
  clearFiltersBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  /* ── Filter sheet ── */
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
  clearAll:   { fontSize: 13, fontWeight: '700', color: OR },
  filterGroup: { marginBottom: 18 },
  filterGroupLabel: {
    fontSize: 11, fontWeight: '800', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  noOpts:        { fontSize: 12, color: Colors.textDisabled, fontStyle: 'italic' },
  filterOpt: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: '#F4F6FA',
  },
  filterOptActive:     { backgroundColor: NAV, borderColor: NAV },
  filterOptText:       { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  filterOptTextActive: { color: '#FFF' },
  applyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: NAV, borderRadius: 14, height: 50, marginTop: 10,
  },
  applyBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

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
