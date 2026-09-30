import React from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Shadows } from '../../theme/spacing';

// The retailer's own listings are the only ones that reach this sheet.
//
// Action set mirrors the wholesaler's `openActions` (ProductListScreen):
//   Edit · Duplicate · Mark Out of Stock / In Stock ·
//   Mark Discontinued / Re-list · Activate / Deactivate · Delete
//
// Each lifecycle action is rendered from `item`'s current status, so the label
// always describes the transition that will happen. Rows the caller does not
// wire up (`onDuplicate` etc. omitted) are hidden, which keeps the sheet usable
// from contexts that only support a subset.
export default function ProductActionsModal({
  visible, productName, item,
  onClose, onEdit, onDelete,
  onDuplicate, onToggleStock, onToggleDiscontinued, onToggleActive,
}) {
  const isOOS      = item?.status === 'out_of_stock';
  const isDisc     = item?.status === 'discontinued';
  const isInactive = item?.is_active === false;

  const actions = [
    onEdit && {
      key: 'edit',
      icon: 'create-outline',
      tint: Colors.primary,
      iconBg: Colors.primaryBg,
      title: 'Edit Product',
      subtitle: 'Update details, pricing, and images',
      onPress: onEdit,
    },
    onDuplicate && {
      key: 'duplicate',
      icon: 'copy-outline',
      tint: Colors.secondary,
      iconBg: Colors.secondaryBg,
      title: 'Duplicate',
      subtitle: 'Start a new product from this one',
      onPress: onDuplicate,
    },
    onToggleStock && {
      key: 'stock',
      icon: isOOS ? 'checkmark-circle-outline' : 'alert-circle-outline',
      tint: isOOS ? '#15803D' : '#B45309',
      iconBg: isOOS ? '#DCFCE7' : '#FEF3C7',
      title: isOOS ? 'Mark In Stock' : 'Mark Out of Stock',
      subtitle: isOOS ? 'Make it orderable again' : 'Hide it from buyers for now',
      onPress: onToggleStock,
    },
    onToggleDiscontinued && {
      key: 'discontinued',
      icon: isDisc ? 'refresh-outline' : 'ban-outline',
      tint: Colors.textSecondary,
      iconBg: Colors.background,
      title: isDisc ? 'Re-list Product' : 'Mark Discontinued',
      subtitle: isDisc ? 'Put it back on sale' : 'Keep the record but stop selling it',
      onPress: onToggleDiscontinued,
    },
    onToggleActive && {
      key: 'active',
      icon: isInactive ? 'eye-outline' : 'eye-off-outline',
      tint: Colors.textSecondary,
      iconBg: Colors.background,
      title: isInactive ? 'Activate' : 'Deactivate',
      subtitle: isInactive ? 'Show it in the catalogues' : 'Hide it from the catalogues',
      onPress: onToggleActive,
    },
    onDelete && {
      key: 'delete',
      icon: 'trash-outline',
      tint: Colors.error,
      iconBg: '#FEF2F2',
      title: 'Delete Product',
      subtitle: 'Remove it from every catalogue',
      destructive: true,
      onPress: onDelete,
    },
  ].filter(Boolean);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <View style={styles.header}>
                <View style={styles.titleWrap}>
                  <Text style={styles.eyebrow}>MANAGE PRODUCT</Text>
                  <Text style={styles.title} numberOfLines={2}>{productName}</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close product actions"
                >
                  <Ionicons name="close" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {actions.map(action => (
                <TouchableOpacity
                  key={action.key}
                  style={styles.action}
                  onPress={action.onPress}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={action.title}
                >
                  <View style={[styles.actionIcon, { backgroundColor: action.iconBg }]}>
                    <Ionicons name={action.icon} size={22} color={action.tint} />
                  </View>
                  <View style={styles.actionText}>
                    <Text style={[styles.actionTitle, action.destructive && styles.deleteTitle]}>
                      {action.title}
                    </Text>
                    <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.52)',
  },
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing.screenPadding, paddingTop: 10, paddingBottom: 28,
    ...Shadows.lg,
  },
  handle: {
    width: 42, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: Spacing.base,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  titleWrap: { flex: 1 },
  eyebrow: { ...Typography.caption, color: Colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  title: { ...Typography.h4, color: Colors.textPrimary, marginTop: 3 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  actionIcon: {
    width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  actionText: { flex: 1 },
  actionTitle: { ...Typography.body1, color: Colors.textPrimary, fontWeight: '700' },
  deleteTitle: { color: Colors.error },
  actionSubtitle: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
});
