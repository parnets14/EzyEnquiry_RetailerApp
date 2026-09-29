// src/screens/products/CategoriesBrandsScreen.jsx
//
// Category & Brand management for the retailer — mirrors the wholesaler app's
// "Categories & Brands" screen, with two clearly-separate sections (never mixed
// in the same popup):
//
//   • Category Management — "Add Category" (own modal), the category list, and
//     under each category its sub-categories plus a "+ Sub" action.
//   • Brand Management    — "Add Brand" (own separate modal), brand chips.
//
// Reached from the Search screen's "Add" button: this screen is the first stop
// of the add-product flow, and its "Add Item / Product" button continues on to
// the Add Product form.
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { catalogApi } from '../../utils/api';
import { SCREENS } from '../../constants';

const CategoriesBrandsScreen = ({ navigation }) => {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [busy, setBusy]             = useState(false);

  // Category modal
  const [catModal, setCatModal] = useState(false);
  const [catName, setCatName]   = useState('');
  // Sub-category modal (always opened for a specific parent)
  const [subModal, setSubModal]   = useState(false);
  const [subParent, setSubParent] = useState(null);
  const [subName, setSubName]     = useState('');
  // Brand modal (completely separate from the category one)
  const [brandModal, setBrandModal] = useState(false);
  const [brandName, setBrandName]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The catalog endpoint returns categories already nested with their
      // sub-categories, so one round-trip covers the whole tree.
      const [catRes, brandRes] = await Promise.all([
        catalogApi.categories(),
        catalogApi.brands(),
      ]);
      const cats   = catRes?.data   || catRes   || [];
      const brnds  = brandRes?.data || brandRes || [];
      setCategories(Array.isArray(cats)  ? cats  : []);
      setBrands(    Array.isArray(brnds) ? brnds : []);
    } catch {
      setCategories([]);
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // This screen is reachable from two places: the Search screen header (no form
  // underneath) and the Add Product form's "Manage Categories & Brands" button.
  // React Navigation 7's navigate() no longer pops back to an existing route, so
  // coming from the form would stack a SECOND empty Add Product screen on top.
  // Pop back to the open form instead when there is one.
  const openProductForm = () => {
    const alreadyOpen = (navigation.getState()?.routes || [])
      .some(r => r.name === SCREENS.ADD_PRODUCT);
    if (alreadyOpen) navigation.popTo(SCREENS.ADD_PRODUCT);
    else navigation.navigate(SCREENS.ADD_PRODUCT);
  };

  // ── Category ──────────────────────────────────────────────
  const saveCategory = async () => {
    const v = catName.trim();
    if (!v) return;
    setBusy(true);
    try {
      await catalogApi.createCategory({ name: v });
      await load();
      setCatModal(false);
      setCatName('');
      // Offer to add a sub-category straight away — same flow as the wholesaler.
      Alert.alert('Category added', `Add a sub-category under "${v}" now?`, [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Add Sub-Category',
          onPress: () => {
            const created = { _id: null, name: v };
            openSub(created, v);
          },
        },
      ]);
    } catch (err) {
      Alert.alert('Failed', err?.message || 'Could not add category.');
    } finally {
      setBusy(false);
    }
  };

  // Sub-categories are created against a parent id. When we just created the
  // parent we only know its name, so look the real record up before opening the
  // modal — the backend requires a valid category_id.
  const openSub = (cat, nameHint) => {
    const name = nameHint || cat?.name || '';
    if (cat?._id) {
      setSubParent(cat);
      setSubName('');
      setSubModal(true);
      return;
    }
    // Resolve the freshly-created category by name.
    (async () => {
      try {
        const res  = await catalogApi.categories();
        const cats = res?.data || res || [];
        const found = (Array.isArray(cats) ? cats : []).find(
          c => String(c.name).toLowerCase() === String(name).toLowerCase(),
        );
        if (!found) {
          Alert.alert('Not ready yet', 'The category was saved but could not be loaded. Pull to refresh and try again.');
          return;
        }
        setSubParent(found);
        setSubName('');
        setSubModal(true);
      } catch (err) {
        Alert.alert('Failed', err?.message || 'Could not open the sub-category form.');
      }
    })();
  };

  const saveSub = async () => {
    const v = subName.trim();
    if (!v) return;
    if (!subParent?._id) { Alert.alert('Missing parent category'); return; }
    setBusy(true);
    try {
      await catalogApi.createSubCategory({ name: v, category_id: subParent._id });
      await load();
      setSubModal(false);
      setSubName('');
    } catch (err) {
      Alert.alert('Failed', err?.message || 'Could not add sub-category.');
    } finally {
      setBusy(false);
    }
  };

  // ── Brand ─────────────────────────────────────────────────
  const saveBrand = async () => {
    const v = brandName.trim();
    if (!v) return;
    setBusy(true);
    try {
      await catalogApi.createBrand({ name: v });
      await load();
      setBrandModal(false);
      setBrandName('');
    } catch (err) {
      Alert.alert('Failed', err?.message || 'Could not add brand.');
    } finally {
      setBusy(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────
  const confirmDelete = (item, label, fn) => {
    Alert.alert('Delete', `Delete "${item.name}" ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await fn();
            await load();
          } catch (err) {
            Alert.alert('Cannot delete', err?.message || 'Delete failed.');
          }
        },
      },
    ]);
  };

  const delCategory = (c) => confirmDelete(c, 'category', () => catalogApi.deleteCategory(c._id));
  const delSub      = (s) => confirmDelete(s, 'sub-category', () => catalogApi.deleteSubCategory(s._id));
  const delBrand    = (b) => confirmDelete(b, 'brand', () => catalogApi.deleteBrand(b._id));

  const canContinue = categories.length > 0 && brands.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate(SCREENS.HOME))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Categories & Brands</Text>
          <Text style={styles.headerSub}>Set up the options used on products</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading categories…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ══ CATEGORY MANAGEMENT ══ */}
          <View style={styles.sectionHead}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: Colors.primaryBg }]}>
                <Ionicons name="shapes-outline" size={18} color={Colors.primary} />
              </View>
              <View style={styles.sectionTextBox}>
                <Text style={styles.sectionTitle}>Category Management</Text>
                <Text style={styles.sectionSub}>
                  {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { setCatName(''); setCatModal(true); }}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={15} color="#FFF" />
              <Text style={styles.addBtnText}>Add Category</Text>
            </TouchableOpacity>
          </View>

          {categories.length === 0 ? (
            <Empty text={'No categories yet. Tap "Add Category" to create one.'} />
          ) : (
            categories.map(c => {
              const subs = c.sub_categories || [];
              return (
                <View key={String(c._id)} style={styles.catCard}>
                  <View style={styles.catRow}>
                    <View style={styles.dot} />
                    <Text style={styles.catName}>{c.name}</Text>
                    {!!c.code && <View style={styles.tag}><Text style={styles.tagText}>{c.code}</Text></View>}
                    <View style={styles.flexSpacer} />
                    <TouchableOpacity
                      style={styles.subAddBtn}
                      onPress={() => openSub(c)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="add" size={13} color={Colors.primary} />
                      <Text style={styles.subAddText}>Sub</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => delCategory(c)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.deleteBtn}
                    >
                      <Ionicons name="trash-outline" size={18} color={Colors.error} />
                    </TouchableOpacity>
                  </View>

                  {subs.length > 0 && (
                    <View style={styles.subList}>
                      {subs.map(s => (
                        <View key={String(s._id)} style={styles.subRow}>
                          <Ionicons name="return-down-forward-outline" size={14} color={Colors.textSecondary} />
                          <Text style={styles.subName}>{s.name}</Text>
                          {!!s.code && <View style={styles.tag}><Text style={styles.tagText}>{s.code}</Text></View>}
                          <View style={styles.flexSpacer} />
                          <TouchableOpacity
                            onPress={() => delSub(s)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="close" size={16} color={Colors.error} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}

          {/* ══ BRAND MANAGEMENT ══ */}
          <View style={[styles.sectionHead, styles.sectionHeadSpaced]}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: Colors.secondaryBg }]}>
                <Ionicons name="pricetag-outline" size={18} color={Colors.secondary} />
              </View>
              <View style={styles.sectionTextBox}>
                <Text style={styles.sectionTitle}>Brand Management</Text>
                <Text style={styles.sectionSub}>{brands.length} brand{brands.length === 1 ? '' : 's'}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.addBtn, styles.addBtnNavy]}
              onPress={() => { setBrandName(''); setBrandModal(true); }}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={15} color="#FFF" />
              <Text style={styles.addBtnText}>Add Brand</Text>
            </TouchableOpacity>
          </View>

          {brands.length === 0 ? (
            <Empty text={'No brands yet. Tap "Add Brand" to create one.'} />
          ) : (
            <View style={styles.brandWrap}>
              {brands.map(b => (
                <View key={String(b._id)} style={styles.brandChip}>
                  <Text style={styles.brandChipText}>{b.name}</Text>
                  <TouchableOpacity
                    onPress={() => delBrand(b)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={16} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Continue → the actual product form */}
          {canContinue && (
            <TouchableOpacity
              style={styles.continueBtn}
              activeOpacity={0.9}
              onPress={openProductForm}
            >
              <Ionicons name="cube-outline" size={18} color="#FFF" />
              <Text style={styles.continueText}>Add Item / Product</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>
          )}
          {!canContinue && (
            <Text style={styles.continueHint}>
              Add at least one category and one brand to continue to the product form.
            </Text>
          )}
        </ScrollView>
      )}

      {/* ── Category modal ── */}
      <FormModal
        visible={catModal}
        title="Add Category"
        placeholder="e.g. Tiles"
        value={catName}
        onChange={setCatName}
        busy={busy}
        onClose={() => setCatModal(false)}
        onSave={saveCategory}
        note="After adding, you can add sub-categories under it."
      />

      {/* ── Sub-category modal (under a specific category) ── */}
      <FormModal
        visible={subModal}
        title={`Add Sub-Category${subParent ? ` in ${subParent.name}` : ''}`}
        placeholder="e.g. Ceramic"
        value={subName}
        onChange={setSubName}
        busy={busy}
        onClose={() => setSubModal(false)}
        onSave={saveSub}
      />

      {/* ── Brand modal (kept separate from the category one) ── */}
      <FormModal
        visible={brandModal}
        title="Add Brand"
        placeholder="e.g. Kajaria"
        value={brandName}
        onChange={setBrandName}
        busy={busy}
        onClose={() => setBrandModal(false)}
        onSave={saveBrand}
        accent={Colors.secondary}
      />
    </SafeAreaView>
  );
};

function Empty({ text }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="information-circle-outline" size={22} color={Colors.textTertiary} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function FormModal({
  visible, title, placeholder, value, onChange, busy, onClose, onSave, note,
  accent = Colors.primary,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalTitle}>{title}</Text>
          {!!note && <Text style={styles.modalNote}>{note}</Text>}
          <TextInput
            style={styles.modalInput}
            value={value}
            onChangeText={onChange}
            autoFocus
            placeholder={placeholder}
            placeholderTextColor={Colors.textTertiary}
          />
          <View style={styles.modalBtnRow}>
            <TouchableOpacity style={styles.btnGhost} onPress={onClose}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimary, { backgroundColor: accent }, busy && styles.btnDisabled]}
              onPress={onSave}
              disabled={busy}
            >
              <Text style={styles.btnPrimaryText}>{busy ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    backgroundColor: Colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.base,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    zIndex: 10,
    elevation: 4,
  },
  backBtn: { width: 32, height: 32, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { ...Typography.h5, color: Colors.white, fontWeight: '800' },
  headerSub: { ...Typography.caption, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  headerSpacer: { width: 32 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { ...Typography.body2, color: Colors.textSecondary },

  scroll: { padding: Spacing.screenPadding, paddingBottom: 48 },

  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md,
  },
  sectionHeadSpaced: { marginTop: Spacing['2xl'] },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  sectionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTextBox: { flexShrink: 1 },
  sectionTitle: { ...Typography.h5, color: Colors.textPrimary, fontWeight: '800' },
  sectionSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primary, paddingHorizontal: 13, paddingVertical: 9,
    borderRadius: BorderRadius.md,
  },
  addBtnNavy: { backgroundColor: Colors.secondary },
  addBtnText: { fontSize: 12.5, fontWeight: '800', color: Colors.white },

  catCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.cardPadding,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  catName: { ...Typography.h5, fontSize: 15, color: Colors.textPrimary, fontWeight: '800' },
  flexSpacer: { flex: 1 },
  subAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: BorderRadius.md,
    borderWidth: 1.2, borderColor: Colors.primary, backgroundColor: Colors.primaryBg,
  },
  subAddText: { fontSize: 11, fontWeight: '800', color: Colors.primary },
  deleteBtn: { marginLeft: 10 },
  subList: {
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight, gap: 8,
  },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subName: { fontSize: 13.5, color: Colors.textPrimary, fontWeight: '600' },

  brandWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  brandChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.badge, paddingHorizontal: 14, paddingVertical: 9,
  },
  brandChipText: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },

  tag: { backgroundColor: Colors.secondaryBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 9.5, fontWeight: '800', color: Colors.textSecondary },

  empty: { alignItems: 'center', gap: 8, paddingVertical: 22 },
  emptyText: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },

  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, paddingVertical: 16, marginTop: 24,
  },
  continueText: { fontSize: 15, fontWeight: '800', color: Colors.white },
  continueHint: {
    ...Typography.caption, color: Colors.textTertiary,
    textAlign: 'center', marginTop: 24, paddingHorizontal: 12,
  },

  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 20 },
  modalTitle: { ...Typography.h5, color: Colors.textPrimary, fontWeight: '800' },
  modalNote: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4 },
  modalInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.lg, height: 48,
    paddingHorizontal: 14, fontSize: 15, color: Colors.textPrimary,
    backgroundColor: Colors.background, marginTop: 14,
  },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  btnGhost: {
    flex: 1, height: 46, borderRadius: BorderRadius.lg, borderWidth: 1.5,
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  btnGhostText: { fontSize: 14, fontWeight: '800', color: Colors.textSecondary },
  btnPrimary: { flex: 1, height: 46, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { fontSize: 14, fontWeight: '800', color: Colors.white },
});

export default CategoriesBrandsScreen;
