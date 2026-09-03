import React, { useState, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  FlatList, StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import SearchBar from '../../components/common/SearchBar';
import ProductCard from '../../components/product/ProductCard';
import ProductActionsModal from '../../components/product/ProductActionsModal';
import EmptyState from '../../components/common/EmptyState';
import { productApi, myProductApi } from '../../utils/api';
import { mapMarketplaceProduct } from '../../utils/productMapper';
import { SCREENS } from '../../constants';

const PAGE_SIZE = 30;
const CATALOG_FILTERS = [
  { key: 'all', label: 'All Products', icon: 'grid-outline' },
  { key: 'featured', label: 'Featured', icon: 'star-outline' },
  { key: 'new_arrival', label: 'New Arrivals', icon: 'sparkles-outline' },
];

const SearchScreen = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, total: 0, hasNext: false });
  const [error, setError] = useState('');
  const [actionProduct, setActionProduct] = useState(null);
  const queryRef = useRef('');
  const filterRef = useRef('all');

  const load = useCallback(async ({ q = '', page = 1, append = false, filter = 'all' } = {}) => {
    if (!append) setError('');
    try {
      const data = await productApi.search({
        search: q,
        page,
        limit: PAGE_SIZE,
        featured: filter === 'featured' ? true : undefined,
        new_arrival: filter === 'new_arrival' ? true : undefined,
      });
      const list = (data?.products || []).map(mapMarketplaceProduct);
      setProducts(current => {
        if (!append) return list;
        const existingIds = new Set(current.map(product => String(product.id)));
        return [...current, ...list.filter(product => !existingIds.has(String(product.id)))];
      });
      setPagination(data?.pagination || {
        page,
        total: list.length,
        hasNext: list.length === PAGE_SIZE,
      });
      return true;
    } catch (err) {
      if (!append) {
        setError(err.message || 'Could not load products.');
        setProducts([]);
      }
      return false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load({ q: queryRef.current.trim(), filter: filterRef.current })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [load]),
  );

  const onSubmit = async () => {
    setLoading(true);
    await load({ q: query.trim(), filter: activeFilter });
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load({ q: query.trim(), filter: activeFilter });
    setRefreshing(false);
  };

  const changeFilter = async (filter) => {
    if (filter === activeFilter) return;
    setActiveFilter(filter);
    filterRef.current = filter;
    setLoading(true);
    await load({ q: query.trim(), filter });
    setLoading(false);
  };

  const clearSearch = async () => {
    setQuery('');
    queryRef.current = '';
    setLoading(true);
    await load({ q: '', filter: activeFilter });
    setLoading(false);
  };

  const loadMore = async () => {
    if (loading || loadingMore || refreshing || !pagination.hasNext) return;
    setLoadingMore(true);
    await load({
      q: query.trim(),
      page: (pagination.page || 1) + 1,
      append: true,
      filter: activeFilter,
    });
    setLoadingMore(false);
  };

  const openProduct = (item) => {
    navigation.navigate(SCREENS.PRODUCT_DETAILS, { product: item });
  };

  const deleteProduct = (item) => {
    setActionProduct(null);
    Alert.alert(
      'Delete product?',
      `${item.name} will be removed from the Retailer, Wholesaler, and Admin catalogues.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await myProductApi.remove(item.id);
              setProducts(current => current.filter(product => String(product.id) !== String(item.id)));
              setPagination(current => ({ ...current, total: Math.max((current.total || 1) - 1, 0) }));
              Alert.alert('Product deleted', `${item.name} has been removed from all catalogues.`);
            } catch (err) {
              Alert.alert('Could not delete product', err.message || 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const openProductMenu = (item) => setActionProduct(item);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Blue branded header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('HomeTab'))}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Products</Text>
            <Text style={styles.headerSub}>Browse products from sellers</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate(SCREENS.ADD_PRODUCT)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="add-circle-outline" size={26} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Search inside header */}
        <View style={styles.searchWrap}>
          <SearchBar
            value={query}
            onChangeText={value => {
              setQuery(value);
              queryRef.current = value;
            }}
            onSubmit={onSubmit}
            onClear={clearSearch}
            autoFocus={false}
            placeholder="Search by name, code, brand, size..."
          />
        </View>
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading products…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={44} color={Colors.textTertiary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onSubmit}>
            <Ionicons name="refresh" size={16} color={Colors.white} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />
          }
          ListHeaderComponent={(
            <View style={styles.catalogHeader}>
              <View style={styles.resultRow}>
                <Text style={styles.resultTitle}>Product Catalogue</Text>
                <Text style={styles.resultCount}>{pagination.total || products.length} products</Text>
              </View>
              <View style={styles.filterRow}>
                {CATALOG_FILTERS.map(filter => {
                  const selected = activeFilter === filter.key;
                  return (
                    <TouchableOpacity
                      key={filter.key}
                      style={[styles.filterChip, selected && styles.filterChipActive]}
                      onPress={() => changeFilter(filter.key)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={filter.icon} size={14} color={selected ? Colors.white : Colors.textSecondary} />
                      <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{filter.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.cardCol}>
              <ProductCard
                product={item}
                onPress={() => openProduct(item)}
                onMenuPress={item.canManage ? openProductMenu : undefined}
                compact
              />
            </View>
          )}
          ListFooterComponent={loadingMore ? (
            <View style={styles.loadMore}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadMoreText}>Loading more products…</Text>
            </View>
          ) : pagination.hasNext ? <View style={styles.loadMoreSpacer} /> : null}
          ListEmptyComponent={
            <EmptyState
              iconName="cube-outline"
              title="No products found"
              message={query ? `No products match "${query}". Try a different search.` : 'No products are available yet. Check back soon.'}
            />
          }
        />
      )}
      <ProductActionsModal
        visible={Boolean(actionProduct)}
        productName={actionProduct?.name || ''}
        onClose={() => setActionProduct(null)}
        onEdit={() => {
          const item = actionProduct;
          setActionProduct(null);
          if (item) navigation.navigate(SCREENS.ADD_PRODUCT, { mode: 'edit', product: item });
        }}
        onDelete={() => actionProduct && deleteProduct(actionProduct)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.base,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 32, height: 32, alignItems: 'flex-start', justifyContent: 'center' },
  addBtn: { width: 32, height: 32, alignItems: 'flex-end', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { ...Typography.h3, color: Colors.white, textAlign: 'center' },
  headerSub: { ...Typography.caption, color: 'rgba(255,255,255,0.55)', marginTop: 2, textAlign: 'center' },

  searchWrap: { marginTop: Spacing.base },

  list: { padding: Spacing.screenPadding, paddingTop: Spacing.base, paddingBottom: 100 },
  catalogHeader: { marginBottom: 14 },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  resultTitle: { ...Typography.h4, color: Colors.textPrimary },
  resultCount: { ...Typography.caption, color: Colors.textTertiary, fontWeight: '600' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, rowGap: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 7, borderRadius: 18,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: Colors.white },
  columnWrapper: { justifyContent: 'space-between', marginBottom: 12 },
  cardCol: { width: '48.5%' },
  loadMore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18,
  },
  loadMoreText: { ...Typography.caption, color: Colors.textSecondary },
  loadMoreSpacer: { height: 16 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingText: { ...Typography.body2, color: Colors.textSecondary },
  errorText: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingHorizontal: 18, paddingVertical: 10, marginTop: 4,
  },
  retryText: { ...Typography.button, color: Colors.white },
});

export default SearchScreen;
