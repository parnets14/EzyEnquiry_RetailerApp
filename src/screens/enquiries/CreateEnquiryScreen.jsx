import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar, ActivityIndicator, Image,
  Modal, TouchableWithoutFeedback, Keyboard, useWindowDimensions,
  TextInput as RNTextInput, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import TextInput from '../../components/common/TextInput';
import PrimaryButton from '../../components/common/PrimaryButton';
import QuantitySelector from '../../components/common/QuantitySelector';
import { enquiryApi, profileApi, customerApi, productApi, mediaUrl } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { SCREENS } from '../../constants';

const UNITS = ['Box', 'Sq Ft', 'Sq Mtr', 'Pieces', 'Pallets'];

// Two-letter initials from a customer name, e.g. "ABC Traders" -> "AT".
const initials = (name = '') =>
  String(name).trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

export default function CreateEnquiryScreen({ navigation, route }) {
  const { product } = route.params;
  const { user } = useAuth();
  const raw = product._raw || product;

  const [quantity, setQuantity]           = useState(100);
  const [unit, setUnit]                   = useState(raw?.unit || product?.unit || 'Box');
  const [deliveryAddress, setDeliveryAddress] = useState(''); // typed here on this screen
  const [remarks, setRemarks]             = useState('');
  const [errors, setErrors]               = useState({});
  const [loading, setLoading]             = useState(false);

  // Quotation estimate fields (matches Staff create-quotation)
  const initialRate = String(raw?.retail_price || raw?.prices?.retail_price || product?.retailPrice || '');
  const [rate, setRate]           = useState(initialRate);
  const [discount, setDiscount]   = useState('0');
  const [gst, setGst]             = useState(String(raw?.gst_percent ?? product?.gstPercent ?? 18));
  const [freight, setFreight]     = useState('0');
  const [otherCharge, setOtherCharge] = useState('0');

  // Customer details (who the quotation is for). Customers belong to the
  // product-owner (Admin) company, chosen from a dropdown or added inline.
  // Owner company is optional now — the backend defaults to the Admin company
  // and returns ALL of its customers (added by Admin, Staff app, or Retailer app).
  const initialOwnerId = product.ownerCompanyId || raw?.owner_company_id
    || product.seller?.id || raw?.seller?.id || raw?.seller?._id || null;
  const [ownerCompanyId, setOwnerCompanyId] = useState(initialOwnerId);
  const [customers, setCustomers]       = useState([]);
  const [custLoading, setCustLoading]   = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [custSearch, setCustSearch]     = useState('');
  const [addCustVisible, setAddCustVisible] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [editCustId, setEditCustId] = useState(null); // when set, Add modal is in edit mode
  const [deletingCust, setDeletingCust] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', mobile: '', email: '', gst_number: '', address: '', city: '', state: '', pincode: '' });
  const addFormRef = React.useRef(null);
  // Scroll the focused field into view above the keyboard. `y` is the field's
  // approximate offset within the form.
  const scrollFormTo = (y) => {
    requestAnimationFrame(() => addFormRef.current?.scrollTo({ y, animated: true }));
  };

  const selectedCustomer = customers.find(c => String(c.id) === String(selectedCustomerId)) || null;

  // Track keyboard height so bottom-sheets can lift their content above it
  // (KeyboardAvoidingView is unreliable for bottom-anchored sheets on Android).
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = e => setKbHeight(e?.endCoordinates?.height || 0);
    const onHide = () => setKbHeight(0);
    const s = Keyboard.addListener(showEvt, onShow);
    const h = Keyboard.addListener(hideEvt, onHide);
    return () => { s.remove(); h.remove(); };
  }, []);

  // Product details
  const productName  = product.name || raw?.name || '';
  const productCode  = product.productCode || raw?.code || '';
  const brandName    = product.brand || raw?.brand_id?.name || '';
  const categoryName = product.category || raw?.category_id?.name || '';
  const size         = product.size || raw?.size || '';
  const finish       = product.finish || raw?.finish || '';
  const color        = product.color || raw?.color || '';
  const material     = product.material || raw?.material || '';
  const gstPercent   = raw?.gst_percent ?? product.gstPercent ?? 18;
  const retailPrice  = raw?.retail_price || raw?.prices?.retail_price || product.retailPrice;
  const mrpPrice     = raw?.mrp || raw?.prices?.mrp || product.mrp;
  const sellerName   = product.seller?.name || raw?.seller?.name || '';
  const sellerCity   = product.seller?.city || raw?.seller?.city || '';
  const sellerState  = product.seller?.state || raw?.seller?.state || '';
  const visibleStock = raw?.visible_stock ?? product.visibleStock ?? null;
  const inStock      = raw?.in_stock !== false && product.inStock !== false;
  const productImage = (product.images && product.images[0]) || (raw?.image_urls && mediaUrl(raw.image_urls[0])) || null;
  const pcsPerBox    = raw?.pcs_per_box || raw?.packing?.pcs_per_box || product.pcsPerBox;
  const sqftPerBox   = raw?.sqft_per_box || raw?.packing?.sqft_per_box || product.sqftPerBox;

  // If the owner company id wasn't in the passed product, fetch the product
  // detail to resolve it (handles products opened without a populated seller).
  const productId = raw?.id || raw?._id || product.id;
  useEffect(() => {
    if (ownerCompanyId || !productId) return;
    let active = true;
    productApi.get(productId)
      .then(data => {
        const oid = data?.owner_company_id || data?.seller?.id || null;
        if (active && oid) setOwnerCompanyId(oid);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [ownerCompanyId, productId]);

  // Load only THIS retailer's own customers (added via retailer API).
  const [custError, setCustError] = useState('');
  const loadCustomers = useCallback(async () => {
    setCustLoading(true);
    setCustError('');
    try {
      // Backend now filters to only this retailer's customers automatically
      const data = await customerApi.list(ownerCompanyId || undefined, { limit: 200 });
      setCustomers(data?.customers || []);
    } catch (err) {
      setCustomers([]);
      setCustError(err?.message || 'Could not load customers.');
    } finally {
      setCustLoading(false);
    }
  }, [ownerCompanyId]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const resetNewCust = () => setNewCust({ name: '', mobile: '', email: '', gst_number: '', address: '', city: '', state: '', pincode: '' });

  const openAddCustomer = () => {
    setEditCustId(null);
    resetNewCust();
    setErrors({});
    setAddCustVisible(true);
  };

  const openEditCustomer = (c) => {
    setEditCustId(c.id);
    setNewCust({
      name: c.name || '', mobile: c.mobile || '', email: c.email || '',
      gst_number: c.gst_number || '', address: c.address || '',
      city: c.city || '', state: c.state || '', pincode: c.pincode || '',
    });
    setErrors({});
    setAddCustVisible(true);
  };

  const handleAddCustomer = async () => {
    const name = newCust.name.trim();
    const mobile = newCust.mobile.trim();
    const address = newCust.address.trim();
    const city = newCust.city.trim();
    const state = newCust.state.trim();
    const pincode = newCust.pincode.trim();
    const ce = {};
    if (!name) ce.custName = 'Customer name is required';
    if (!/^\d{10}$/.test(mobile)) ce.custMobile = 'Valid 10-digit mobile required';
    if (!address) ce.custAddress = 'Address is required';
    if (!city) ce.custCity = 'City is required';
    if (!state) ce.custState = 'State is required';
    if (!/^\d{6}$/.test(pincode)) ce.custPincode = 'Valid 6-digit pincode required';
    if (Object.keys(ce).length) { setErrors(e => ({ ...e, ...ce })); return; }
    setSavingCustomer(true);
    setErrors({});
    const payload = {
      name, mobile,
      email: newCust.email.trim(),
      gst_number: newCust.gst_number.trim(),
      address, city, state, pincode,
    };
    try {
      if (editCustId) {
        const updated = await customerApi.update(editCustId, ownerCompanyId || undefined, payload);
        setCustomers(prev => prev.map(c => String(c.id) === String(editCustId) ? { ...c, ...updated } : c));
        setSelectedCustomerId(updated.id || editCustId);
      } else {
        const created = await customerApi.create(ownerCompanyId || undefined, payload);
        setCustomers(prev => {
          const exists = prev.some(c => String(c.id) === String(created.id));
          return exists ? prev : [created, ...prev];
        });
        setSelectedCustomerId(created.id);
      }
      setAddCustVisible(false);
      setEditCustId(null);
      resetNewCust();
    } catch (err) {
      setErrors(e => ({ ...e, custSubmit: err.message || 'Could not save customer.' }));
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleDeleteCustomer = () => {
    if (!selectedCustomer) return;
    Alert.alert(
      'Delete customer?',
      `${selectedCustomer.name} will be removed. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingCust(true);
            try {
              await customerApi.remove(selectedCustomer.id, ownerCompanyId || undefined);
              setCustomers(prev => prev.filter(c => String(c.id) !== String(selectedCustomer.id)));
              setSelectedCustomerId(null);
              setCustSearch('');
            } catch (err) {
              Alert.alert('Could not delete', err.message || 'Please try again.');
            } finally {
              setDeletingCust(false);
            }
          },
        },
      ],
    );
  };

  const filteredCustomers = customers.filter(c => {
    if (!custSearch.trim()) return true;
    const q = custSearch.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) || (c.mobile || '').includes(custSearch);
  });

  // Live quotation totals (mirrors the Staff create-quotation math)
  const qtyN   = Number(quantity || 0);
  const rateN  = Number(rate || 0);
  const discN  = Number(discount || 0);
  const gstN   = Number(gst || 0);
  const amount = qtyN * rateN;
  const taxable = Math.max(0, amount - discN);
  const gstAmount = taxable * (gstN / 100);
  const itemTotal = taxable + gstAmount;
  const freightN = Number(freight || 0);
  const otherN   = Number(otherCharge || 0);
  const grandTotal = Math.round(itemTotal + freightN + otherN);

  const validate = () => {
    const e = {};
    if (!selectedCustomerId) e.customer = 'Please select or add a customer';
    if (!quantity || quantity < 1) e.quantity = 'Quantity must be at least 1';
    // Delivery location is optional — if none is picked we use the customer's own location.
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      const productId = raw?.id || raw?._id || product.id;
      // Prefer the delivery address typed on this screen; otherwise fall back to
      // the selected customer's own location.
      const customerLocation = selectedCustomer
        ? [selectedCustomer.address, selectedCustomer.city, selectedCustomer.state, selectedCustomer.pincode].filter(Boolean).join(', ')
        : '';
      const location = deliveryAddress.trim() || customerLocation;

      const payload = {
        product_id: productId,
        qty:        quantity,
        unit,
        location,
        remarks: remarks.trim(),
        // Quotation estimate + customer (sent with the enquiry)
        rate: rateN || undefined,
        discount: discN || undefined,
        gst_percent: gstN,
        freight_charges: freightN || undefined,
        other_charges: otherN || undefined,
        estimated_total: grandTotal || undefined,
        // Selected saved customer (belongs to the product-owner company).
        customer_id: selectedCustomerId || undefined,
        customer: selectedCustomer ? {
          name: selectedCustomer.name,
          mobile: selectedCustomer.mobile,
          gst: selectedCustomer.gst_number,
        } : undefined,
      };

      const enquiry = await enquiryApi.create(payload);
      setLoading(false);
      navigation.replace(SCREENS.ENQUIRY_SUCCESS, {
        enquiryId:   enquiry?.enquiry_code || enquiry?.id,
        enquiryDbId: enquiry?.id,
        product,
      });
    } catch (err) {
      setLoading(false);
      setErrors({ submit: err.message || 'Could not send enquiry. Please try again.' });
    }
  };


  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
      <View style={styles.blueHeader}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Send Quotation</Text>
          <Text style={styles.headerSub}>Create a quotation request</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={true}
        >
          {/* ═══ Product Hero Card ═══ */}
          <View style={styles.heroCard}>
            {/* Product Image */}
            <View style={styles.heroTop}>
              {productImage ? (
                <Image source={{ uri: productImage }} style={styles.heroImage} resizeMode="cover" />
              ) : (
                <View style={[styles.heroImage, styles.heroImagePlaceholder]}>
                  <Ionicons name="image-outline" size={32} color={Colors.border} />
                </View>
              )}
              <View style={styles.heroInfo}>
                <Text style={styles.heroName} numberOfLines={2}>{productName}</Text>
                {productCode ? <Text style={styles.heroCode}>{productCode}</Text> : null}
                <View style={styles.heroChips}>
                  {brandName ? (
                    <View style={styles.chipBrand}>
                      <Ionicons name="pricetag" size={10} color={Colors.secondary} />
                      <Text style={styles.chipBrandText}>{brandName}</Text>
                    </View>
                  ) : null}
                  {categoryName ? (
                    <View style={styles.chipCat}>
                      <Text style={styles.chipCatText}>{categoryName}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Product Specs Grid */}
            <View style={styles.specsGrid}>
              {size ? <SpecItem icon="resize-outline" label="Size" value={size} /> : null}
              {finish ? <SpecItem icon="color-palette-outline" label="Finish" value={finish} /> : null}
              {color ? <SpecItem icon="ellipse" label="Color" value={color} /> : null}
              {material ? <SpecItem icon="layers-outline" label="Material" value={material} /> : null}
            </View>

            {/* Pricing + Stock Row */}
            <View style={styles.priceStockRow}>
              <View style={styles.priceBox}>
                {retailPrice ? (
                  <>
                    <Text style={styles.priceLabel}>RETAIL PRICE</Text>
                    <Text style={styles.priceValue}>{formatCurrency(retailPrice)}<Text style={styles.priceUnit}>/{unit}</Text></Text>
                  </>
                ) : mrpPrice ? (
                  <>
                    <Text style={styles.priceLabel}>MRP</Text>
                    <Text style={styles.priceValue}>{formatCurrency(mrpPrice)}<Text style={styles.priceUnit}>/{unit}</Text></Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.priceLabel}>PRICE</Text>
                    <Text style={styles.priceOnEnquiry}>On Enquiry</Text>
                  </>
                )}
              </View>
              <View style={styles.stockBox}>
                <View style={[styles.stockDot, inStock ? styles.stockDotGreen : styles.stockDotRed]} />
                <Text style={[styles.stockText, inStock ? styles.stockTextGreen : styles.stockTextRed]}>
                  {visibleStock != null && visibleStock > 0
                    ? `${visibleStock} ${unit} available`
                    : inStock ? 'In Stock' : 'Out of Stock'}
                </Text>
              </View>
            </View>

            {/* Packing info */}
            {(pcsPerBox || sqftPerBox) ? (
              <View style={styles.packingRow}>
                <Ionicons name="cube-outline" size={14} color={Colors.textTertiary} />
                <Text style={styles.packingText}>
                  {pcsPerBox ? `${pcsPerBox} pcs/box` : ''}{pcsPerBox && sqftPerBox ? ' · ' : ''}{sqftPerBox ? `${sqftPerBox} sqft/box` : ''}
                </Text>
              </View>
            ) : null}

            {/* Seller Info */}
            {sellerName ? (
              <View style={styles.sellerRow}>
                <View style={styles.sellerIcon}>
                  <Ionicons name="storefront-outline" size={16} color={Colors.primary} />
                </View>
                <View style={styles.sellerInfo}>
                  <Text style={styles.sellerName}>{sellerName}</Text>
                  {(sellerCity || sellerState) ? (
                    <Text style={styles.sellerLocation}>
                      <Ionicons name="location-outline" size={11} color={Colors.textTertiary} />
                      {' '}{[sellerCity, sellerState].filter(Boolean).join(', ')}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.sellerBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#27AE60" />
                  <Text style={styles.sellerBadgeText}>Verified</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* ═══ Customer Details ═══ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="person-outline" size={18} color={Colors.primary} />
              <Text style={styles.cardTitle}>Customer Details</Text>
            </View>

            {selectedCustomer ? (
              /* Selected customer detail card */
              <View style={styles.selCustCard}>
                <View style={styles.selCustHeader}>
                  <View style={styles.selCustAvatar}><Text style={styles.selCustAvatarText}>{initials(selectedCustomer.name)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selCustName} numberOfLines={1}>{selectedCustomer.name}</Text>
                    <View style={styles.selCustSourceBadge}>
                      <Ionicons name="ribbon-outline" size={11} color={Colors.secondary} />
                      <Text style={styles.selCustSourceText}>
                        {selectedCustomer.created_by_name
                          ? `Added by ${selectedCustomer.created_by_name} · ${selectedCustomer.created_by_type || 'Admin'}`
                          : `Added by ${selectedCustomer.created_by_type || 'Admin'}`}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.selCustChange} onPress={() => { setSelectedCustomerId(null); setCustSearch(''); }} activeOpacity={0.8}>
                    <Ionicons name="create-outline" size={14} color={Colors.primary} />
                    <Text style={styles.selCustChangeText}>Change</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.selCustDivider} />
                <DetailLine icon="call-outline" label="Mobile" value={`+91 ${selectedCustomer.mobile}`} />
                {selectedCustomer.email ? <DetailLine icon="mail-outline" label="Email" value={selectedCustomer.email} /> : null}
                {selectedCustomer.gst_number ? <DetailLine icon="document-text-outline" label="GSTIN" value={selectedCustomer.gst_number} /> : null}
                {(selectedCustomer.address || selectedCustomer.city) ? (
                  <DetailLine
                    icon="location-outline"
                    label="Address"
                    value={[selectedCustomer.address, selectedCustomer.city, selectedCustomer.state, selectedCustomer.pincode].filter(Boolean).join(', ')}
                  />
                ) : null}
                <DetailLine
                  icon="person-add-outline"
                  label="Added by"
                  value={selectedCustomer.created_by_name
                    ? `${selectedCustomer.created_by_name} (${selectedCustomer.created_by_type || 'Admin'})`
                    : (selectedCustomer.created_by_type || 'Admin')}
                />

                {/* Edit/Delete only for customers added from this app */}
                {selectedCustomer.created_by_type === 'Retailer App' ? (
                  <View style={styles.selCustActions}>
                    <TouchableOpacity style={styles.selCustEditBtn} onPress={() => openEditCustomer(selectedCustomer)} activeOpacity={0.8}>
                      <Ionicons name="create-outline" size={15} color={Colors.primary} />
                      <Text style={styles.selCustEditText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.selCustDeleteBtn} onPress={handleDeleteCustomer} disabled={deletingCust} activeOpacity={0.8}>
                      {deletingCust ? (
                        <ActivityIndicator size="small" color={Colors.error} />
                      ) : (
                        <>
                          <Ionicons name="trash-outline" size={15} color={Colors.error} />
                          <Text style={styles.selCustDeleteText}>Delete</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ) : (
              /* Inline search + results list */
              <>
                <View style={[styles.custSearchBox, errors.customer && styles.custSearchBoxError]}>
                  <Ionicons name="search" size={18} color={Colors.textTertiary} />
                  <RNTextInput
                    placeholder="Search customer by name or mobile"
                    placeholderTextColor={Colors.textTertiary}
                    value={custSearch}
                    onChangeText={setCustSearch}
                    style={styles.custSearchInput}
                    autoCapitalize="none"
                    returnKeyType="search"
                  />
                  {custSearch ? (
                    <TouchableOpacity onPress={() => setCustSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                {errors.customer ? <Text style={styles.errorText}>{errors.customer}</Text> : null}

                {custError ? (
                  <View style={styles.inlineEmpty}>
                    <Ionicons name="alert-circle-outline" size={24} color={Colors.error} />
                    <Text style={styles.inlineEmptyText}>{custError}</Text>
                    <TouchableOpacity onPress={loadCustomers} style={styles.inlineRetry}>
                      <Ionicons name="refresh" size={14} color={Colors.primary} />
                      <Text style={styles.inlineRetryText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : !custSearch.trim() ? (
                  /* No search yet — just a hint, no list */
                  <View style={styles.searchHint}>
                    <Ionicons name="search-outline" size={16} color={Colors.textTertiary} />
                    <Text style={styles.searchHintText}>
                      {custLoading ? 'Loading your customers…' : 'Type to search your customers'}
                    </Text>
                  </View>
                ) : filteredCustomers.length === 0 ? (
                  <View style={styles.inlineEmpty}>
                    <Ionicons name="person-outline" size={24} color={Colors.textTertiary} />
                    <Text style={styles.inlineEmptyText}>No customer found for “{custSearch.trim()}”</Text>
                    <Text style={styles.inlineEmptyHint}>Add them as a new customer below.</Text>
                  </View>
                ) : (
                  <View style={styles.inlineList}>
                    <Text style={styles.inlineCount}>{filteredCustomers.length} result{filteredCustomers.length === 1 ? '' : 's'}</Text>
                    <ScrollView
                      style={styles.inlineScroll}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                    >
                      {filteredCustomers.map(c => (
                        <TouchableOpacity
                          key={c.id}
                          style={styles.inlineRow}
                          onPress={() => { setSelectedCustomerId(c.id); Keyboard.dismiss(); setErrors(e => ({ ...e, customer: undefined })); }}
                          activeOpacity={0.75}
                        >
                          <View style={styles.inlineAvatar}><Text style={styles.inlineAvatarText}>{initials(c.name)}</Text></View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.inlineName} numberOfLines={1}>{c.name}</Text>
                            <View style={styles.inlineMetaRow}>
                              <Ionicons name="call-outline" size={12} color={Colors.textTertiary} />
                              <Text style={styles.inlineMeta} numberOfLines={1}>+91 {c.mobile}</Text>
                              {c.city ? (
                                <>
                                  <Ionicons name="location-outline" size={12} color={Colors.textTertiary} style={{ marginLeft: 8 }} />
                                  <Text style={styles.inlineMeta} numberOfLines={1}>{c.city}</Text>
                                </>
                              ) : null}
                            </View>
                          </View>
                          <View style={styles.custSourceBadge}><Text style={styles.custSourceText}>{c.created_by_type || 'Admin'}</Text></View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.addCustomerBtn}
                  onPress={openAddCustomer}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                  <Text style={styles.addCustomerText}>Add New Customer</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ═══ Quantity Section ═══ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="calculator-outline" size={18} color={Colors.primary} />
              <Text style={styles.cardTitle}>Quantity & Unit</Text>
            </View>
            <Text style={styles.fieldLabel}>HOW MUCH DO YOU NEED?</Text>
            <QuantitySelector value={quantity} onChangeValue={setQuantity} unit={unit} min={1} step={10} />
            {errors.quantity ? <Text style={styles.errorText}>{errors.quantity}</Text> : null}

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>SELECT UNIT</Text>
            <View style={styles.unitRow}>
              {UNITS.map(u => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitChip, unit === u && styles.unitChipActive]}
                  onPress={() => setUnit(u)}
                >
                  <Text style={[styles.unitChipText, unit === u && styles.unitChipTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>

          </View>

          {/* ═══ Quotation Estimate ═══ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="pricetags-outline" size={18} color={Colors.primary} />
              <Text style={styles.cardTitle}>Quotation Estimate</Text>
            </View>

            {/* Rate and GST come from the product; only QTY and DISCOUNT here. */}
            <View style={styles.estRow}>
              <View style={styles.estCol}>
                <Text style={styles.estLabel}>QTY</Text>
                <View style={styles.estBox}><Text style={styles.estBoxText}>{qtyN} {unit}</Text></View>
              </View>
              <View style={styles.estCol}>
                <Text style={styles.estLabel}>DISCOUNT (₹)</Text>
                <TextInput
                  value={discount}
                  onChangeText={(t) => setDiscount(t.replace(/[^0-9.]/g, ''))}
                  placeholder="0"
                  keyboardType="numeric"
                  style={styles.estInputWrap}
                />
              </View>
            </View>

            {/* Auto-calculation strip (Qty · Amount · Discount · GST Amt · Total) */}
            <View style={styles.calcStrip}>
              <CalcCell label="QTY" value={`${qtyN} ${unit}`} color={Colors.secondary} />
              <CalcCell label="AMOUNT" value={formatCurrency(amount)} color={Colors.textPrimary} />
              <CalcCell label="DISCOUNT" value={formatCurrency(discN)} color="#D97706" />
              <CalcCell label="GST AMT" value={formatCurrency(gstAmount)} color="#7C3AED" />
              <CalcCell label="TOTAL" value={formatCurrency(itemTotal)} color={Colors.primary} />
            </View>

            {/* Charges */}
            <View style={styles.estRow}>
              <View style={styles.estCol}>
                <Text style={styles.estLabel}>FREIGHT CHARGES (₹)</Text>
                <TextInput value={freight} onChangeText={(t) => setFreight(t.replace(/[^0-9.]/g, ''))} placeholder="0" keyboardType="numeric" style={styles.estInputWrap} />
              </View>
              <View style={styles.estCol}>
                <Text style={styles.estLabel}>OTHER CHARGES (₹)</Text>
                <TextInput value={otherCharge} onChangeText={(t) => setOtherCharge(t.replace(/[^0-9.]/g, ''))} placeholder="0" keyboardType="numeric" style={styles.estInputWrap} />
              </View>
            </View>

            {/* Totals */}
            <View style={styles.totalsBlock}>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Subtotal + GST</Text>
                <Text style={styles.totalsValue}>{formatCurrency(itemTotal)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Freight Charges</Text>
                <Text style={styles.totalsValue}>{formatCurrency(freightN)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Other Charges</Text>
                <Text style={styles.totalsValue}>{formatCurrency(otherN)}</Text>
              </View>
              <View style={styles.totalsDivider} />
              <View style={styles.grandRow}>
                <Text style={styles.grandLabel}>GRAND TOTAL</Text>
                <Text style={styles.grandValue}>{formatCurrency(grandTotal)}</Text>
              </View>
            </View>

            <View style={styles.rateNote}>
              <Ionicons name="information-circle-outline" size={13} color={Colors.textTertiary} />
              <Text style={styles.rateNoteText}>Rate and GST are taken from the product. Discount and charges are auto-calculated.</Text>
            </View>
          </View>

          {/* ═══ Delivery Location ═══ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="location-outline" size={18} color={Colors.primary} />
              <Text style={styles.cardTitle}>Delivery Location</Text>
              <Text style={styles.optionalTag}>Optional</Text>
            </View>

            <TextInput
              label="Delivery Address"
              placeholder="Enter delivery address (building, street, city, state, pincode)"
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
              multiline
              numberOfLines={3}
            />

            {!deliveryAddress.trim() && selectedCustomer && (selectedCustomer.city || selectedCustomer.address) ? (
              <View style={styles.custLocHint}>
                <Ionicons name="navigate-circle-outline" size={15} color={Colors.secondary} />
                <Text style={styles.custLocHintText}>
                  Leave blank to deliver to {selectedCustomer.name}'s location: {[selectedCustomer.address, selectedCustomer.city, selectedCustomer.state, selectedCustomer.pincode].filter(Boolean).join(', ')}
                </Text>
                <TouchableOpacity
                  onPress={() => setDeliveryAddress([selectedCustomer.address, selectedCustomer.city, selectedCustomer.state, selectedCustomer.pincode].filter(Boolean).join(', '))}
                  style={styles.useCustLocBtn}
                >
                  <Text style={styles.useCustLocText}>Use</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {/* ═══ Remarks ═══ */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="chatbox-ellipses-outline" size={18} color={Colors.primary} />
              <Text style={styles.cardTitle}>Additional Notes</Text>
            </View>
            <TextInput
              placeholder="Special requirements, project details, urgency, preferred delivery date..."
              value={remarks}
              onChangeText={setRemarks}
              multiline
              numberOfLines={4}
              maxLength={2000}
            />
            <Text style={styles.charCount}>{remarks.length}/2000</Text>
          </View>

          {/* ═══ Order Summary ═══ */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryIconCircle}>
                <Ionicons name="receipt-outline" size={20} color={Colors.secondary} />
              </View>
              <Text style={styles.summaryTitle}>Quotation Summary</Text>
            </View>

            <View style={styles.summaryDivider} />

            <SummaryRow icon="grid-outline" label="Product" value={productName} />
            <SummaryRow icon="pricetag-outline" label="Brand" value={brandName || '—'} />
            <SummaryRow icon="person-outline" label="Customer" value={selectedCustomer?.name || 'Not selected'} highlight />
            <SummaryRow icon="layers-outline" label="Quantity" value={`${quantity} ${unit}`} />
            <SummaryRow
              icon="location-outline"
              label="Deliver To"
              value={
                deliveryAddress.trim()
                  ? deliveryAddress.trim()
                  : (selectedCustomer
                      ? `${[selectedCustomer.address, selectedCustomer.city, selectedCustomer.state, selectedCustomer.pincode].filter(Boolean).join(', ') || selectedCustomer.name} (customer)`
                      : 'Not set')
              }
            />
            {grandTotal > 0 ? (
              <View style={styles.summaryTotal}>
                <Text style={styles.summaryTotalLabel}>Estimated Total</Text>
                <Text style={styles.summaryTotalValue}>{formatCurrency(grandTotal)}</Text>
                <Text style={styles.summaryTotalNote}>Incl. {gstPercent}% GST{discN > 0 ? `, after ${formatCurrency(discN)} discount` : ''} · Final price confirmed by seller</Text>
              </View>
            ) : null}
          </View>

          {/* ═══ Error ═══ */}
          {errors.submit ? (
            <View style={styles.submitError}>
              <Ionicons name="alert-circle" size={18} color={Colors.error} />
              <Text style={styles.submitErrorText}>{errors.submit}</Text>
            </View>
          ) : null}

          {/* ═══ Submit Button ═══ */}
          <PrimaryButton
            title="SEND QUOTATION"
            onPress={handleSubmit}
            loading={loading}
            size="lg"
            style={styles.submitBtn}
          />

          <Text style={styles.disclaimer}>
            By sending, you agree to receive quotations from the seller. No payment is required at this stage.
          </Text>

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ═══ Add Customer Modal ═══ */}
      <Modal visible={addCustVisible} transparent animationType="slide" onRequestClose={() => setAddCustVisible(false)}>
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setAddCustVisible(false); }}>
          <View style={styles.sheetOverlay}>
            <TouchableWithoutFeedback>
              <View style={[
                styles.addSheet,
                {
                  height: screenHeight * 0.8,
                  paddingBottom: (kbHeight > 0 ? 12 : Math.max(insets.bottom, 12)) + 4,
                },
              ]}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>{editCustId ? 'Edit Customer' : 'Add New Customer'}</Text>
                  <TouchableOpacity onPress={() => { setAddCustVisible(false); setEditCustId(null); }} style={styles.sheetClose}>
                    <Ionicons name="close" size={21} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  ref={addFormRef}
                  style={styles.addSheetForm}
                  contentContainerStyle={{ paddingBottom: 260 }}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="none"
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.formSection}>BASIC DETAILS</Text>
                  <TextInput
                    label="Customer / Business Name *"
                    placeholder="e.g. ABC Tiles"
                    value={newCust.name}
                    onChangeText={t => setNewCust(p => ({ ...p, name: t }))}
                    onFocus={() => scrollFormTo(0)}
                  />
                  {errors.custName ? <Text style={styles.errorText}>{errors.custName}</Text> : null}
                  <View style={styles.custRow}>
                    <View style={styles.custRowItem}>
                      <TextInput
                        label="Mobile Number *"
                        placeholder="10-digit mobile"
                        value={newCust.mobile}
                        onChangeText={t => setNewCust(p => ({ ...p, mobile: t.replace(/\D/g, '').slice(0, 10) }))}
                        keyboardType="number-pad"
                        maxLength={10}
                        onFocus={() => scrollFormTo(90)}
                      />
                    </View>
                    <View style={styles.custRowItem}>
                      <TextInput
                        label="Email"
                        placeholder="customer@business.com"
                        value={newCust.email}
                        onChangeText={t => setNewCust(p => ({ ...p, email: t }))}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        onFocus={() => scrollFormTo(90)}
                      />
                    </View>
                  </View>
                  {errors.custMobile ? <Text style={styles.errorText}>{errors.custMobile}</Text> : null}
                  <TextInput
                    label="GST Number"
                    placeholder="Optional GSTIN"
                    value={newCust.gst_number}
                    onChangeText={t => setNewCust(p => ({ ...p, gst_number: t.toUpperCase() }))}
                    autoCapitalize="characters"
                    maxLength={15}
                    onFocus={() => scrollFormTo(180)}
                  />

                  <Text style={styles.formSection}>ADDRESS</Text>
                  <TextInput
                    label="Street / Building *"
                    placeholder="Building and street"
                    value={newCust.address}
                    onChangeText={t => setNewCust(p => ({ ...p, address: t }))}
                    multiline
                    numberOfLines={2}
                    onFocus={() => scrollFormTo(300)}
                  />
                  {errors.custAddress ? <Text style={styles.errorText}>{errors.custAddress}</Text> : null}
                  <View style={styles.custRow}>
                    <View style={styles.custRowItem}>
                      <TextInput label="City *" placeholder="City" value={newCust.city} onChangeText={t => setNewCust(p => ({ ...p, city: t }))} onFocus={() => scrollFormTo(430)} />
                    </View>
                    <View style={styles.custRowItem}>
                      <TextInput label="State *" placeholder="State" value={newCust.state} onChangeText={t => setNewCust(p => ({ ...p, state: t }))} onFocus={() => scrollFormTo(430)} />
                    </View>
                  </View>
                  {errors.custCity ? <Text style={styles.errorText}>{errors.custCity}</Text> : null}
                  {errors.custState ? <Text style={styles.errorText}>{errors.custState}</Text> : null}
                  <TextInput
                    label="Pincode *"
                    placeholder="6-digit pincode"
                    value={newCust.pincode}
                    onChangeText={t => setNewCust(p => ({ ...p, pincode: t.replace(/\D/g, '').slice(0, 6) }))}
                    keyboardType="number-pad"
                    maxLength={6}
                    onFocus={() => scrollFormTo(520)}
                  />
                  {errors.custPincode ? <Text style={styles.errorText}>{errors.custPincode}</Text> : null}
                  {errors.custSubmit ? <Text style={styles.errorText}>{errors.custSubmit}</Text> : null}
                </ScrollView>

                <PrimaryButton
                  title={editCustId ? 'UPDATE CUSTOMER' : 'SAVE CUSTOMER'}
                  onPress={handleAddCustomer}
                  loading={savingCustomer}
                  size="lg"
                  style={{ marginTop: 8 }}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

/* ─── Sub-components ─── */
const CalcCell = ({ label, value, color }) => (
  <View style={styles.calcCell}>
    <Text style={styles.calcLabel}>{label}</Text>
    <Text style={[styles.calcValue, { color }]} numberOfLines={1}>{value}</Text>
  </View>
);

const SpecItem = ({ icon, label, value }) => (
  <View style={styles.specItem}>
    <Ionicons name={icon} size={13} color={Colors.textTertiary} />
    <Text style={styles.specLabel}>{label}</Text>
    <Text style={styles.specValue}>{value}</Text>
  </View>
);

const DetailLine = ({ icon, label, value }) => (
  <View style={styles.detailLine}>
    <Ionicons name={icon} size={14} color={Colors.textTertiary} />
    <Text style={styles.detailLineLabel}>{label}</Text>
    <Text style={styles.detailLineValue} numberOfLines={2}>{value}</Text>
  </View>
);

const SummaryRow = ({ icon, label, value, highlight }) => (
  <View style={styles.summaryRow}>
    <View style={styles.summaryRowLeft}>
      <Ionicons name={icon} size={14} color={Colors.textTertiary} />
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
    <Text style={[styles.summaryValue, highlight && styles.summaryValueHighlight]} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

/* ─── Styles ─── */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { padding: Spacing.screenPadding, paddingBottom: 40 },

  /* Hero Card */
  heroCard: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 16, marginBottom: 14,
    ...Shadows.md, borderWidth: 1, borderColor: Colors.borderLight,
  },
  heroTop: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  heroImage: { width: 80, height: 80, borderRadius: 14, backgroundColor: Colors.background },
  heroImagePlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  heroInfo: { flex: 1 },
  heroName: { ...Typography.h5, color: Colors.textPrimary, marginBottom: 3, lineHeight: 22 },
  heroCode: { ...Typography.caption, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  heroChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chipBrand: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.secondaryBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  chipBrandText: { fontSize: 11, fontWeight: '700', color: Colors.secondary },
  chipCat: { backgroundColor: Colors.primaryBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  chipCatText: { fontSize: 11, fontWeight: '700', color: Colors.primary },

  /* Specs Grid */
  specsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  specItem: { flexDirection: 'row', alignItems: 'center', gap: 5, width: '47%', paddingVertical: 3 },
  specLabel: { fontSize: 10, color: Colors.textTertiary, minWidth: 42 },
  specValue: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary, flex: 1 },

  /* Price + Stock */
  priceStockRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  priceBox: {},
  priceLabel: { fontSize: 9, fontWeight: '700', color: Colors.textTertiary, letterSpacing: 0.5, marginBottom: 2 },
  priceValue: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  priceUnit: { fontSize: 12, fontWeight: '400', color: Colors.textSecondary },
  priceOnEnquiry: { fontSize: 15, fontWeight: '700', color: Colors.secondary },
  stockBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  stockDot: { width: 8, height: 8, borderRadius: 4 },
  stockDotGreen: { backgroundColor: '#27AE60' },
  stockDotRed: { backgroundColor: Colors.error },
  stockText: { fontSize: 11, fontWeight: '600' },
  stockTextGreen: { color: '#27AE60' },
  stockTextRed: { color: Colors.error },

  /* Packing */
  packingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8 },
  packingText: { fontSize: 11, color: Colors.textSecondary },

  /* Seller */
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  sellerIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  sellerInfo: { flex: 1 },
  sellerName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  sellerLocation: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  sellerBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#E8F8EF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  sellerBadgeText: { fontSize: 10, fontWeight: '700', color: '#27AE60' },

  /* Generic Card */
  card: { backgroundColor: Colors.white, borderRadius: 18, padding: 18, ...Shadows.sm, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: { ...Typography.h5, color: Colors.textPrimary },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: Colors.textTertiary, letterSpacing: 0.8, marginBottom: 10 },
  errorText: { fontSize: 12, color: Colors.error, marginTop: 4, marginBottom: 4 },

  /* Units */
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background },
  unitChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  unitChipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  unitChipTextActive: { color: Colors.primary, fontWeight: '700' },

  /* Approx value */
  approxBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.infoBg, borderRadius: 10, padding: 12, marginTop: 14 },
  approxText: { fontSize: 12, color: Colors.infoText, flex: 1, lineHeight: 17 },
  approxBold: { fontWeight: '700' },

  /* Quotation Estimate */
  estRow: { flexDirection: 'row', gap: 12 },
  estCol: { flex: 1 },
  estLabel: { fontSize: 10, fontWeight: '700', color: Colors.textTertiary, letterSpacing: 0.6, marginBottom: 6 },
  estBox: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.input, backgroundColor: Colors.background, minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.base, marginBottom: Spacing.base },
  estBoxText: { ...Typography.body1, color: Colors.textPrimary, fontWeight: '700' },
  estInputWrap: { marginBottom: Spacing.base },

  calcStrip: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: Colors.background, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.borderLight, paddingVertical: 10, marginBottom: 14 },
  calcCell: { flexGrow: 1, flexBasis: '18%', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 4 },
  calcLabel: { fontSize: 9, fontWeight: '700', color: Colors.textTertiary, letterSpacing: 0.3 },
  calcValue: { fontSize: 12, fontWeight: '800', marginTop: 3 },

  totalsBlock: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.borderLight, padding: 14 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  totalsLabel: { fontSize: 13, color: Colors.textSecondary },
  totalsValue: { fontSize: 13, color: Colors.textPrimary, fontWeight: '700' },
  totalsDivider: { height: 1.5, backgroundColor: Colors.border, marginVertical: 10 },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 3, borderLeftColor: Colors.primary, paddingLeft: 12 },
  grandLabel: { fontSize: 12, fontWeight: '800', color: Colors.primary, letterSpacing: 0.5 },
  grandValue: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  rateNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  rateNoteText: { fontSize: 11, color: Colors.textTertiary, flex: 1 },

  /* Address */
  optionalTag: { marginLeft: 'auto', fontSize: 10, fontWeight: '700', color: Colors.textTertiary, backgroundColor: Colors.background, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  custLocHint: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.secondaryBg, borderRadius: 10, padding: 10, marginTop: 4 },
  custLocHintText: { flex: 1, fontSize: 12, color: Colors.secondary, fontWeight: '600', lineHeight: 17 },
  useCustLocBtn: { backgroundColor: Colors.secondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  useCustLocText: { fontSize: 12, color: '#FFF', fontWeight: '700' },
  addrLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16 },
  addrLoadingText: { fontSize: 13, color: Colors.textSecondary },
  noAddrBox: { alignItems: 'center', gap: 6, paddingVertical: 20 },
  noAddrTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  noAddrSub: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  addressCard: { flexDirection: 'row', padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, marginBottom: 10, gap: 12, backgroundColor: Colors.background },
  addressCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radioOuterActive: { borderColor: Colors.primary },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary },
  addressContent: { flex: 1 },
  addressTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  addressLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  defaultBadge: { backgroundColor: '#E8F8EF', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  defaultText: { fontSize: 9, fontWeight: '800', color: '#27AE60', letterSpacing: 0.4 },
  addressLine: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18, marginBottom: 4 },
  addressMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  addressCity: { fontSize: 11, color: Colors.textTertiary },

  /* Remarks */
  charCount: { fontSize: 10, color: Colors.textTertiary, textAlign: 'right', marginTop: 4 },

  /* Summary */
  summaryCard: { backgroundColor: Colors.secondaryBg, borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: Colors.secondary + '15' },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  summaryIconCircle: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', ...Shadows.sm },
  summaryTitle: { ...Typography.h5, color: Colors.secondary },
  summaryDivider: { height: 1, backgroundColor: Colors.secondary + '15', marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  summaryRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryLabel: { fontSize: 12, color: Colors.textSecondary },
  summaryValue: { fontSize: 12, color: Colors.textPrimary, fontWeight: '600', maxWidth: '55%', textAlign: 'right' },
  summaryValueHighlight: { color: Colors.primary, fontWeight: '800', fontSize: 14 },
  summaryTotal: { alignItems: 'center', paddingTop: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: Colors.secondary + '15' },
  summaryTotalLabel: { fontSize: 10, fontWeight: '700', color: Colors.textTertiary, letterSpacing: 0.5 },
  summaryTotalValue: { fontSize: 22, fontWeight: '800', color: Colors.secondary, marginTop: 2 },
  summaryTotalNote: { fontSize: 10, color: Colors.textTertiary, marginTop: 4 },

  /* GST note */
  gstNote: { flexDirection: 'row', gap: 8, backgroundColor: Colors.infoBg, borderRadius: 12, padding: 12, marginBottom: 14, alignItems: 'flex-start' },
  gstNoteText: { fontSize: 11, color: Colors.infoText, flex: 1, lineHeight: 17 },

  /* Error */
  submitError: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Colors.errorBg, borderRadius: 12, padding: 14, marginBottom: 14 },
  submitErrorText: { fontSize: 13, color: Colors.error, flex: 1, lineHeight: 19 },

  /* Submit */
  submitBtn: { marginBottom: 12 },
  disclaimer: { fontSize: 11, color: Colors.textTertiary, textAlign: 'center', lineHeight: 17, paddingHorizontal: 16 },

  /* Blue header (matches Add Product) */
  blueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.secondary, paddingHorizontal: Spacing.screenPadding, paddingTop: 8, paddingBottom: 14 },
  headerBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { ...Typography.h4, color: '#FFF' },
  headerSub: { ...Typography.caption, color: 'rgba(255,255,255,0.7)', marginTop: 1 },

  /* Customer picker */
  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, letterSpacing: 0.5, marginBottom: 8 },
  custPicker: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.input, paddingHorizontal: 12, paddingVertical: 8 },
  custPickerError: { borderColor: Colors.error },
  custPickerSelected: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  custPickerName: { ...Typography.body1, color: Colors.textPrimary, fontWeight: '700' },
  custPickerMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
  custPickerPlaceholder: { ...Typography.body1, color: Colors.textTertiary, flex: 1 },
  custAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  custAvatarText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  addCustomerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 12, paddingVertical: 6 },
  addCustomerText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },

  /* Inline customer search + list */
  custSearchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background, borderRadius: BorderRadius.input, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, height: 50 },
  custSearchBoxError: { borderColor: Colors.error },
  custSearchInput: { flex: 1, ...Typography.body1, color: Colors.textPrimary, paddingVertical: 0 },
  inlineCount: { ...Typography.caption, color: Colors.textTertiary, fontWeight: '700', marginTop: 12, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  inlineScroll: { maxHeight: 260 },
  inlineMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  inlineList: { marginTop: 4 },
  inlineLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16, justifyContent: 'center' },
  inlineLoadingText: { ...Typography.caption, color: Colors.textSecondary },
  inlineEmpty: { alignItems: 'center', gap: 4, paddingVertical: 18 },
  inlineEmptyText: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center', fontWeight: '600' },
  inlineEmptyHint: { ...Typography.caption, color: Colors.textTertiary, textAlign: 'center' },
  searchHint: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 4 },
  searchHintText: { ...Typography.caption, color: Colors.textTertiary },
  inlineRetry: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingVertical: 4, paddingHorizontal: 10 },
  inlineRetryText: { ...Typography.caption, color: Colors.primary, fontWeight: '700' },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  inlineAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  inlineAvatarText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  inlineName: { ...Typography.body1, color: Colors.textPrimary, fontWeight: '700' },
  inlineMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },

  /* Selected customer detail card */
  selCustCard: { backgroundColor: Colors.background, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  selCustHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  selCustAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  selCustAvatarText: { color: '#FFF', fontWeight: '800', fontSize: 17 },
  selCustName: { ...Typography.h5, color: Colors.textPrimary },
  selCustSourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: Colors.secondaryBg, borderRadius: BorderRadius.badge, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  selCustSourceText: { ...Typography.caption, color: Colors.secondary, fontWeight: '700', fontSize: 10 },
  selCustChange: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryBg, borderRadius: BorderRadius.badge, paddingHorizontal: 10, paddingVertical: 6 },
  selCustChangeText: { ...Typography.caption, color: Colors.primary, fontWeight: '700' },
  selCustDivider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 12 },
  detailLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 5 },
  detailLineLabel: { ...Typography.caption, color: Colors.textTertiary, width: 64 },
  detailLineValue: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '600', flex: 1 },
  selCustActions: { flexDirection: 'row', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  selCustEditBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primaryBg, borderRadius: BorderRadius.md, paddingVertical: 10 },
  selCustEditText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },
  selCustDeleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.errorBg, borderRadius: BorderRadius.md, paddingVertical: 10 },
  selCustDeleteText: { ...Typography.body2, color: Colors.error, fontWeight: '700' },

  /* Bottom sheet (picker + add) */
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '82%', backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.screenPadding, paddingTop: 8, paddingBottom: 24 },
  sheetHandle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { ...Typography.h4, color: Colors.textPrimary },
  sheetClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sheetSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background, borderRadius: BorderRadius.md, paddingHorizontal: 12, marginBottom: 10 },
  sheetSearchInput: { flex: 1 },
  sheetLoading: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  sheetLoadingText: { ...Typography.caption, color: Colors.textSecondary },
  sheetEmpty: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  sheetEmptyText: { ...Typography.body1, color: Colors.textSecondary, fontWeight: '700' },
  sheetEmptyHint: { ...Typography.caption, color: Colors.textTertiary, textAlign: 'center' },
  sheetList: { maxHeight: 360 },
  custOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  custOptionActive: { backgroundColor: Colors.primaryBg, borderRadius: BorderRadius.md },
  custOptionTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  custOptionName: { ...Typography.body1, color: Colors.textPrimary, fontWeight: '700', flexShrink: 1 },
  custOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  custOptionMeta: { ...Typography.caption, color: Colors.textSecondary },
  custSourceBadge: { backgroundColor: Colors.secondaryBg, borderRadius: BorderRadius.xs, paddingHorizontal: 6, paddingVertical: 2 },
  custSourceText: { ...Typography.caption, color: Colors.secondary, fontSize: 9, fontWeight: '800' },
  sheetAddBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 13, marginTop: 12 },
  sheetAddText: { ...Typography.body1, color: '#FFF', fontWeight: '700' },
  sheetKav: { flex: 1 },
  sheetForm: { maxHeight: 360 },
  addSheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing.screenPadding, paddingTop: 8,
  },
  addSheetForm: { flex: 1 },
  formSection: { ...Typography.caption, color: Colors.textTertiary, fontWeight: '800', letterSpacing: 0.6, marginTop: 6, marginBottom: 8 },
  custRow: { flexDirection: 'row', gap: 10 },
  custRowItem: { flex: 1 },
});
