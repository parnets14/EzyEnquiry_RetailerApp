// src/screens/products/SearchScreen.jsx
// Retailer Search tab — the browse surface.
//
// The body (header, search, scope tabs, filters, legend, list, filter sheet,
// Buy Item bar) is `components/product/CatalogListBody`, shared with
// MyProductsScreen so the two catalogue surfaces cannot drift apart.
//
// This file owns only what is genuinely different about the tab: it is a tab
// root (no back button).
import React from 'react';
import { SCREENS } from '../../constants';
import { mapMarketplaceProduct } from '../../utils/productMapper';
import CatalogListBody from '../../components/product/CatalogListBody';
import ProductActionsModal from '../../components/product/ProductActionsModal';
import useProductActions from '../../components/product/useProductActions';

// Kept out of the component so the object identity is stable across renders —
// the hook lists it as a dependency.
const SCREENS_FOR_ACTIONS = {
  ADD_PRODUCT: SCREENS.ADD_PRODUCT,
};

const SearchScreen = ({ navigation }) => {
  const actions = useProductActions({ navigation, screens: SCREENS_FOR_ACTIONS });

  const openProduct = (item) => {
    navigation.navigate(SCREENS.PRODUCT_DETAILS, { product: mapMarketplaceProduct(item) });
  };

  return (
    <>
      <CatalogListBody
        navigation={navigation}
        variant="search"
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
};

export default SearchScreen;
