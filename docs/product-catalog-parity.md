# Product Catalog — Wholesaler vs Retailer Logic Comparison

Read-only audit. Wholesaler app is the specification and is never edited.

| | Wholesaler (spec) | Retailer (current) |
|---|---|---|
| Product list | `screens/product/ProductListScreen.jsx` (905 L) | `screens/products/SearchScreen.jsx` (517 L) + `screens/products/MyProductsScreen.jsx` (535 L) |
| Product detail | `screens/product/ProductDetailScreen.jsx` (447 L) | `screens/products/ProductDetailsScreen.jsx` (683 L) |
| Categories/Brands | `screens/product/CategoryBrandManagerScreen.jsx` (344 L) | `screens/products/CategoriesBrandsScreen.jsx` (559 L) |
| Add/Edit product | `screens/product/AddProductScreen.jsx` (676 L) | `screens/products/AddProductScreen.jsx` (921 L) |
| Service | `wholesalerProductService` in `services/productService.js` | `productService` + `myProductService` + `catalogService` |
| List endpoint | `GET /api/wholesaler/products` | `GET /api/products` (marketplace) |
| Card | inline `ProductCard` in list screen | shared `components/product/CatalogProductCard.jsx` |
| Filter sheet | inline `FilterSheet` in list screen | shared `components/product/CatalogFilterSheet.jsx` |
| Shared config | inline `FILTER_KEYS` in list screen | `components/product/catalogShared.js` |

## Already at parity

- Navy header: decorative circles, icon+title, live count subtitle, manage-categories button, filter button with count badge
- Debounced search bar (400 ms) + clear button, placeholder "Search code, name, size…"
- Active filter chips row with per-chip remove
- Rate legend strip + total count
- Filter sheet: Size / Finish / Material / Color / Category / Brand, Clear All, Apply
- Pagination `page/limit 20`, `onEndReached` load-more, `RefreshControl`
- Race-condition guard via `reqTokenRef` (`tab:page`)
- Reload on screen focus
- Card anatomy: 78x92 thumb, code + source/inactive/out-of-stock badge, spec chips from `attributes` with legacy fallback, `category · brand`, full price breakup box
- Detail screen: View Only badge, header tag pills, image hero, PRODUCT INFORMATION / DESCRIPTION / IMAGES / PACKING INFO section cards, Buy Item bottom bar
- Categories/Brands: two separate sections, separate modals, "+Sub" per category, master/default tag protection, Add Item/Product continue button

## Real logic gaps

### G1 — Price box on the card (RESOLVED — buyer-safe four-row layout)
`CatalogProductCard` originally showed **Purchase / Selling / Wholesale / MRP** —
the retailer is a BUYER, so purchase and selling are the seller's internal
cost/margin columns. That was the wholesaler's cost view rendered for a buyer.

Resolution: the card keeps the **same four-row visual structure** as the
wholesaler's card but shows the retailer's own buyer-facing fields —
**Wholesale / MRP / Retail / Dealer**, then GST and Per Box:

```jsx
<PriceRow label="Wholesale" value={money(item.wholesale_rate)} />
<PriceRow label="MRP"       value={money(item.mrp)} />
<PriceRow label="Retail"    value={money(item.retail_price)} />
<PriceRow label="Dealer"    value={money(item.dealer_price)} />
```

`purchase_price` and `selling_price` are **deliberately withheld** — they are the
seller's cost and margin. The layout matches the wholesaler screenshot; the values
are the retailer's own. The detail screen's PRICING card (MRP + Retail Rate) is
unchanged and remains consistent with this.

### G2 — Catalog scope: `catalog_only: true` (was closed, now APPLIED)
The wholesaler's Product Catalog shows **only Admin-granted products** because
`ProductListScreen` sends `catalog_only: true`. The retailer now does the same.

What the backend does with it:
- `catalog_only=true` → `query.created_by_type = 'Admin'`
  (`retailerMarketplaceController.js:557`).
- The access clause (`buildAccessClause`, lines 90–108) is pushed into
  `query.$and` (line 552) — a **separate** key, so the two **AND** together rather
  than overwriting each other.
- Net effect: `created_by_type: 'Admin'` **AND** (`shared_with_all: true` **OR**
  caller's `company_code` ∈ `allowed_company_codes`).

So the retailer sees exactly the Admin-created products Admin has granted their
company — the screenshot's behaviour.

Retailer-side scope **tabs** were implemented and then **removed** (they cannot
work):
- `mine=true` keys on `source: 'wholesaler'` + own company — in this dataset the
  retailer's own rows carry `source: 'admin'`, so it returns **empty**.
- `source` and `created_by_type` disagree on legacy rows, which is exactly what the
  wholesaler controller's own comment warns about.

Conclusion: the retailer keeps ONE unified feed, scoped with `catalog_only: true`.
Do not re-add the tabs without first reconciling `source` vs `created_by_type`.
(Admin grants are per-company-code — e.g. `PRD-MTJZ7Z3W-FM4` →
`["EZY012","EZY2236286","EZY011","EZY013"]`, `BDM-1299` → `["EZY012","EZY2236286"]`.)

### G3 — No batch toolbar on the retailer list (MEDIUM)
Wholesaler has `openActions(item)` → `Alert` action list: Edit / Duplicate / Mark Out of Stock / Mark Discontinued / Activate–Deactivate / Delete, each wired to `wholesalerProductService.update`, plus ✅ **Bulk import from .xlsx/.xls/.csv** (`bulkImport` + `@react-native-documents/picker`).
Retailer has a single-action `ProductActionsModal` with **Edit / Delete only**.
Retailer's `myProductService` has no `duplicate`, `patch-status`, or `bulkImport`. Backend equivalent is `PUT /api/my-products/:id` + `POST /api/wholesaler/products/bulk-import` (no retailer bulk-import route exists — `my-products` has only list/create/get/update/delete).

### G4 — Filter-options strategy (RESOLVED)
Wholesaler: one `Promise.all([getFilters(), masterService.all()])` — a dedicated
distinct-values endpoint plus authoritative master category/brand lists.
Retailer (fixed): `Promise.all([catalogApi.categories(), catalogApi.brands(),
productApi.filters(), productApi.search({ limit: 100 })])`. The dedicated
`GET /api/products/filters` route was added on the **retailer** route file
(`retailerRoutes.js`, registered **above** `/products/:id` — verified filters at
index 32, `:id` at 33), backed by `getProductFilters` in
`retailerMarketplaceController.js` (distinct size/finish/material/color scoped by
`CATALOG_PRODUCT_QUERY` + `buildAccessClause`). `pickDistinct()` over the first 100
products is retained only as a **fallback** when the endpoint returns nothing.

### G5 — Detail screen extras that have no wholesaler counterpart (LOW)
Retailer `ProductDetailsScreen` adds PRICING and SELLER & AVAILABILITY cards, a manage ellipsis on the hero, a refresh-in-progress row, and a stale-data warning banner. Per the bidirectional parity rule ("if not in wholesaler i don't want in retailer app also") these need an explicit keep/remove decision. SELLER & AVAILABILITY has a clear buyer justification (the retailer picks who it buys from); the refresh/warning rows are pure padding.

### G6 — Duplicated list screen (MEDIUM, structural)
`SearchScreen.jsx` and `MyProductsScreen.jsx` are ~95% the same file (same header, filters, legend, list, filter sheet, fab bar) and differ mainly in the title ("Products" vs "Product Catalog"), the back button, and one API-param token. The shared header logic is not extracted. Wholesaler has one screen.
Fix: extract a `CatalogListBody` component, or collapse to one screen.

### G7 — `unknown` source badge label
`sourceOf()` maps `added_by_type` to `admin / wholesaler / retailer / mine` but `productResponse` (backend line 254) falls back to `inferredCreatorType` which can be the literal string `'Unknown'`. `sourceOf` has no `case 'Unknown'` — it lands on the default `Seller` badge, so unknown-origin products look like generic seller listings.

## Route registration (verified)
Wholesaler registers `ProductDetail`, `AddProduct`, `CategoryBrandManager` (AppStack:131–133) and `Products` as a bottom tab (BottomTabNavigator:72).
Retailer registers the equivalents plus `SEARCH` on its own navigator.
No missing-constant defect found on either product route.

## Status — changes applied (2026-09-30, third pass)

Wholesaler app: **untouched** (verified — its only working-tree entries are a
pre-existing commented-out `BASE_URL` line and a lockfile, neither from this work).

Retailer app:
- `components/product/CatalogProductCard.jsx` — **G1**: price box now uses the
  wholesaler card's four-row layout (Wholesale / MRP / Retail / Dealer) with the
  retailer's own buyer-facing values; `purchase_price` / `selling_price` withheld.
- `components/product/catalogShared.js` — **G7**: added the `'Unknown'` source case.
- `components/product/CatalogListBody.jsx` — **NEW**, **G6**: the shared catalogue
  body, replacing the near-duplicate bodies in SearchScreen / MyProductsScreen.
  **G2**: sends `catalog_only: true` to match the wholesaler's Admin-only scope.
- `screens/products/SearchScreen.jsx`, `MyProductsScreen.jsx` — reduced to thin
  hosts over the shared body.
- `components/product/useProductActions.js` — **NEW**, **G3**: the action set
  (Edit / Duplicate / lifecycle toggles / Delete) defined once.
- `components/product/ProductActionsModal.jsx` — **G3**: now renders the lifecycle
  actions, each label derived from the item's current status.
- `screens/products/ProductDetailsScreen.jsx` — **G5**: removed the SELLER &
  AVAILABILITY card, the refreshing row and the stale-data banner; info rows
  aligned to the wholesaler's exact list.
- `services/productService.js` — added `filters()`.
- `services/myProductService.js` — added `patchStatus()` (JSON PATCH, so a
  lifecycle change never rewrites `image_urls` the way the multipart path would).

Backend:
- `models/Product Management/Product.js` — **fixed a real defect**: the `status`
  enum allowed only `['active','deleted']`, but the wholesaler's action menu writes
  `'out_of_stock'` / `'discontinued'`. Mongoose rejected those, so Mark Out of Stock
  and Mark Discontinued **silently did nothing in the wholesaler app too**. The
  client's `STATUS_BADGE` entries for those states were dead code.
- `controllers/Retailer Management/retailerProductController.js` — `updateMyProduct`
  now accepts `status` / `is_active` (it previously ignored both, so the retailer's
  lifecycle actions had no backend).
- `controllers/Retailer Management/retailerMarketplaceController.js` — **G4**:
  added `getProductFilters` (distinct spec values, scoped to the caller's visible
  catalogue).
- `routes/Retailer Management/retailerRoutes.js` — registered
  `GET /products/filters` **above** `/products/:id` (verified by stack inspection:
  filters at index 32, `:id` at 33).

## Recommended order
1. ~~**G1**~~ done — card price box is buyer-safe, wholesaler layout.
2. ~~**G2**~~ done — `catalog_only: true` on the retailer feed; tabs not used.
3. ~~**G7**~~ done — `sourceOf` case.
4. ~~**G4**~~ done — retailer `/products/filters` endpoint.
5. **G5** done; **G3** done; **G6** done.
6. Open: reconcile `source` vs `created_by_type` on legacy Product rows; the
   retailer's bulk-import has no backend route (`my-products` exposes only
   list / create / get / update / delete).
