// src/components/product/useProductActions.js
//
// Owns the "manage my own listing" flow for the two catalogue surfaces
// (SearchScreen, MyProductsScreen) so the action set is defined once.
//
// Returns the state the screens hand straight to <ProductActionsModal>, plus the
// callbacks each lifecycle action needs.
//
// Mirrors the wholesaler's `openActions` / `patchProduct` / `duplicateProduct` in
// wholesalerapp/src/screens/product/ProductListScreen.jsx:
//   - status toggles PATCH only { status } / { is_active } so a lifecycle change
//     never resends the whole product (which would rewrite image_urls)
//   - lifecycle actions do NOT refetch the list; they are confirmed with an
//     Alert and the list converges on the next focus reload
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { myProductService as myProductApi } from '../../services/myProductService';

export default function useProductActions({ navigation, screens, onChanged }) {
  const [actionProduct, setActionProduct] = useState(null);

  const close = useCallback(() => setActionProduct(null), []);

  const patchStatus = useCallback(async (item, changes, successMsg) => {
    try {
      await myProductApi.patchStatus(item._id || item.id, changes);
      if (successMsg) Alert.alert('Done', successMsg);
      onChanged?.();
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Could not update product.');
    }
  }, [onChanged]);

  const edit = useCallback((item) => {
    close();
    if (!item) return;
    navigation.navigate(screens.ADD_PRODUCT, { mode: 'edit', product: item });
  }, [close, navigation, screens]);

  // Open Add Product prefilled from this item, minus id/code so a NEW product is
  // created — the wholesaler's `duplicateProduct`.
  const duplicate = useCallback((item) => {
    close();
    if (!item) return;
    const { _id, id, code, created_at, updated_at, ...rest } = item;
    navigation.navigate(screens.ADD_PRODUCT, {
      mode: 'create',
      product: { ...rest, name: `${item.name} (Copy)` },
    });
  }, [close, navigation, screens]);

  const toggleStock = useCallback((item) => {
    close();
    if (!item) return;
    const isOOS = item.status === 'out_of_stock';
    patchStatus(
      item,
      { status: isOOS ? 'active' : 'out_of_stock' },
      isOOS ? 'Marked as in stock.' : 'Marked out of stock.',
    );
  }, [close, patchStatus]);

  const toggleDiscontinued = useCallback((item) => {
    close();
    if (!item) return;
    const isDisc = item.status === 'discontinued';
    patchStatus(
      item,
      { status: isDisc ? 'active' : 'discontinued' },
      isDisc ? 'Product re-listed.' : 'Marked discontinued.',
    );
  }, [close, patchStatus]);

  const toggleActive = useCallback((item) => {
    close();
    if (!item) return;
    const isInactive = item.is_active === false;
    patchStatus(
      item,
      { is_active: isInactive },
      isInactive ? 'Product activated.' : 'Product deactivated (hidden from catalog).',
    );
  }, [close, patchStatus]);

  const remove = useCallback((item) => {
    close();
    if (!item) return;
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
              await myProductApi.remove(item._id || item.id);
              Alert.alert('Product deleted', `${item.name} has been removed from all catalogues.`);
              onChanged?.();
            } catch (err) {
              Alert.alert('Could not delete product', err.message || 'Please try again.');
            }
          },
        },
      ],
    );
  }, [close, onChanged]);

  return {
    actionProduct,
    openActions: setActionProduct,
    closeActions: close,
    edit,
    duplicate,
    toggleStock,
    toggleDiscontinued,
    toggleActive,
    remove,
  };
}
