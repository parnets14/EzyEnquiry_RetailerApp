// src/screens/products/MyProductsScreen.jsx
// Retailer Product Catalog — pushed from Home → Marketplace → Products.
//
// Despite the filename this is a BROWSING screen, not a management screen: it
// shows every product the retailer can see, whatever created it. Tapping a card
// opens Product Details; the retailer's own listings also get an ellipsis menu to
// edit, duplicate, change lifecycle or delete.
//
// The body (header, search, scope tabs, filters, legend, list, filter sheet,
// Buy Item bar) is `components/product/CatalogListBody`, shared with
// SearchScreen so the two catalogue surfaces cannot drift apart.
//
// This file owns only the pushed-screen chrome: the back button in the header
// (variant="my").
import React from 'react';
import { SCREENS } from '../../constants';
import { mapMarketplaceProduct } from '../../utils/productMapper';
import CatalogListBody from '../../components/product/CatalogListBody';
import ProductActionsModal from '../../components/product/ProductActionsModal';
import useProductActions from '../../components/product/useProductActions';

// Stable identity — the hook depends on this object.
const SCREENS_FOR_ACTIONS = {
  ADD_PRODUCT: SCREENS.ADD_PRODUCT,
};

export default function MyProductsScreen({ navigation }) {
  const actions = useProductActions({ navigation, screens: SCREENS_FOR_ACTIONS });

  const openProduct = (item) => {
    navigation.navigate(SCREENS.PRODUCT_DETAILS, { product: mapMarketplaceProduct(item) });
  };

  return (
    <>
      <CatalogListBody
        navigation={navigation}
        variant="my"
        onOpenProduct={openProduct}
        onMenuPress={actions.openActions}
      />

      <ProductActionsModal
        visible={Boolean(actions.actionProduct)}
        item={actions.actionProduct}
        productName={actions.actionProduct?.name || ''}
        onClose={actions.closeActions}
        onEdit={() => actions.edit(actions.actionProduct)}
        onDuplicate={() => actions.duplicate(actions.actionProduct)}
        onToggleStock={() => actions.toggleStock(actions.actionProduct)}
        onToggleDiscontinued={() => actions.toggleDiscontinued(actions.actionProduct)}
        onToggleActive={() => actions.toggleActive(actions.actionProduct)}
        onDelete={() => actions.remove(actions.actionProduct)}
      />
    </>
  );
}
