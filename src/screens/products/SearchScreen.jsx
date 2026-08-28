import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import SearchBar from '../../components/common/SearchBar';
import ProductCard from '../../components/product/ProductCard';
import EmptyState from '../../components/common/EmptyState';
import { productApi, mediaUrl } from '../../utils/api';

// ─── Map backend marketplace product DTO → ProductCard shape ─────────────────
import { SCREENS } from '../../constants';

// Map backend marketplace product DTO → shape ProductCard/ProductDetailsScreen expects.
// The backend returns a safe projection with no internal pricing fields.
function mapProduct(p) {
  // prices object from retailer marketplace DTO
  const prices  = p.prices || {};
  const specs   = p.specs  || {};
  const packing = p.packing || {};
  const retail  = prices.retail_price || 0;
  const mrp     = prices.mrp || 0;
  return {
    id:          p.id || p._id,
    // _raw mirrors the full DTO so ProductDetailsScreen can read fields
    _raw: {
      ...p,
      // normalise to flat names that ProductDetailsScreen reads from _raw
      code:         p.code,
      name:         p.name,
      brand_id:     p.brand  ? { _id: p.brand.id, name: p.brand.name } : null,
      category_id:  p.category ? { _id: p.category.id, name: p.category.name } : null,
      sub_category_id: p.sub_category ? { _id: p.sub_category.id, name: p.sub_category.name } : null,
      size:         specs.size || '',
      finish:       specs.finish || '',
      color:        specs.color || '',
      surface:      specs.surface || '',
      thickness:    specs.thickness || '',
      grade:        specs.grade || '',
      tile_type:    specs.tile_type || '',
      application:  specs.application || '',
      material:     specs.material || '',
      anti_skid:    specs.anti_skid || '',
      origin:       specs.origin || '',
      manufacturer: specs.manufacturer || '',
      hsn_code:     specs.hsn_code || '',
      design:       specs.design || '',
      collection:   specs.collection || '',
      pcs_per_box:  packing.pcs_per_box,
      sqft_per_box: packing.sqft_per_box,
      weight_per_box: packing.weight_per_box,
      unit:         p.unit || '',
      gst_percent:  p.gst_percent,
      description:  p.description || '',
      retail_price: prices.retail_price,
      dealer_price: prices.dealer_price,
      mrp:          prices.mrp,
      image_urls:   p.image_urls || [],
    },
    name:        p.name || 'Unnamed Product',
    productCode: p.code || '',
    brand:       p.brand?.name || '',
    category:    p.category?.name || p.sub_category?.name || '',
    size:        specs.size || '',
    finish:      specs.finish || '',
    tileType:    specs.tile_type || '',
    grade:       specs.grade || '',
    material:    specs.material || '',
    color:       specs.color || '',
    thickness:   specs.thickness || '',
    application: specs.application || '',
    unit:        p.unit || '',
    gstPercent:  p.gst_percent,
    retailPrice: retail > 0 ? retail : null,
    mrp:         mrp   > 0 ? mrp   : null,
    dealerPrice: prices.dealer_price > 0 ? prices.dealer_price : null,
    pcsPerBox:   packing.pcs_per_box || null,
    sqftPerBox:  packing.sqft_per_box || null,
    visibleStock: p.visible_stock || 0,
    inStock:      p.in_stock !== false,
    seller:       p.seller || null,
    images:      Array.isArray(p.image_urls) ? p.image_urls.map(mediaUrl).filter(Boolean) : [],
  };
}

const SearchScreen = ({ navigation }) => {
  const [query, setQuery]       = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async (q = '') => {
    setError('');
    try {
      const data = await productApi.search({ search: q, limit: 50 });
      const list = (data?.products || []).map(mapProduct);
      setProducts(list);
    } catch (err) {
      setError(err.message || 'Could not load products.');
      setProducts([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load('');
      setLoading(false);
    })();
  }, [load]);

  const onSubmit = async () => {
    setLoading(true);
    await load(query.trim());
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load(query.trim());
    setRefreshing(false);
  };

  const openProduct = (item) => {
    navigation.navigate(SCREENS.PRODUCT_DETAILS, { product: item });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />

      {/* Blue branded header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Products</Text>
        <Text style={styles.headerSub}>Browse products from sellers</Text>

        {/* Search inside header */}
        <View style={styles.searchWrap}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            onSubmit={onSubmit}
            onClear={() => { setQuery(''); setLoading(true); load('').then(() => setLoading(false)); }}
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />
          }
          renderItem={({ item }) => (
            <View style={styles.cardCol}>
              <ProductCard product={item} onPress={() => openProduct(item)} compact />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              iconName="cube-outline"
              title="No products found"
              message={query ? `No products match "${query}". Try a different search.` : 'No products are available yet. Check back soon.'}
            />
          }
        />
      )}
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
  headerTitle: { ...Typography.h3, color: Colors.white },
  headerSub: { ...Typography.caption, color: 'rgba(255,255,255,0.55)', marginTop: 2 },

  searchWrap: { marginTop: Spacing.base },

  list: { padding: Spacing.screenPadding, paddingTop: 56, paddingBottom: 100 },
  columnWrapper: { gap: 12, marginBottom: 12 },
  cardCol: { flex: 1 },

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
