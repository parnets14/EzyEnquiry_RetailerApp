import React from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Shadows } from '../../theme/spacing';

export default function ProductActionsModal({
  visible, productName, onClose, onEdit, onDelete,
}) {
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
                <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close product actions">
                  <Ionicons name="close" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.action} onPress={onEdit} activeOpacity={0.75}>
                <View style={[styles.actionIcon, styles.editIcon]}>
                  <Ionicons name="create-outline" size={22} color={Colors.primary} />
                </View>
                <View style={styles.actionText}>
                  <Text style={styles.actionTitle}>Edit Product</Text>
                  <Text style={styles.actionSubtitle}>Update details, pricing, and images</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.action} onPress={onDelete} activeOpacity={0.75}>
                <View style={[styles.actionIcon, styles.deleteIcon]}>
                  <Ionicons name="trash-outline" size={22} color={Colors.error} />
                </View>
                <View style={styles.actionText}>
                  <Text style={[styles.actionTitle, styles.deleteTitle]}>Delete Product</Text>
                  <Text style={styles.actionSubtitle}>Remove it from every catalogue</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
              </TouchableOpacity>
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
  editIcon: { backgroundColor: Colors.primaryBg },
  deleteIcon: { backgroundColor: '#FEF2F2' },
  actionText: { flex: 1 },
  actionTitle: { ...Typography.body1, color: Colors.textPrimary, fontWeight: '700' },
  deleteTitle: { color: Colors.error },
  actionSubtitle: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
});
