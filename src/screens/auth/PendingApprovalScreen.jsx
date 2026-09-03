import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, StatusBar, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import PrimaryButton from '../../components/common/PrimaryButton';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import { useAuth } from '../../context/AuthContext';
import { SCREENS } from '../../constants';

export default function PendingApprovalScreen({ navigation }) {
  const { user, refresh, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [message, setMessage] = useState('');

  const status = user?.company?.status || user?.company_status || 'Pending';
  const isRejected = status === 'Rejected';
  const rejectReason = user?.company?.reject_reason || '';

  const handleRefresh = useCallback(async () => {
    setChecking(true);
    setMessage('');
    try {
      const fresh = await refresh();
      const approved = fresh?.is_approved || (fresh?.company?.status === 'Approved');
      if (approved) {
        navigation.replace(SCREENS.HOME);
      } else {
        setMessage('Your account is still awaiting admin approval.');
      }
    } catch {
      setMessage('Could not check status. Please try again.');
    } finally {
      setChecking(false);
    }
  }, [refresh, navigation]);

  const handleLogout = async () => {
    setShowLogout(false);
    await logout();
    navigation.replace(SCREENS.LOGIN);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Icon */}
        <View style={[styles.iconWrap, isRejected && styles.iconWrapError]}>
          <Ionicons
            name={isRejected ? 'close-circle-outline' : 'hourglass-outline'}
            size={54}
            color={isRejected ? Colors.error : Colors.primary}
          />
        </View>

        <Text style={styles.title}>
          {isRejected ? 'Account Not Approved' : 'Awaiting Admin Approval'}
        </Text>
        <Text style={styles.subtitle}>
          {isRejected
            ? 'Your registration was reviewed but not approved. Please review the reason below or contact support.'
            : 'Your account has been registered and is under review. You will get full access to products, enquiries and orders once an admin approves it.'}
        </Text>

        {/* Status card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Company</Text>
            <Text style={styles.statusValue} numberOfLines={1}>
              {user?.company?.name || user?.company_name || '—'}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status</Text>
            <View style={[styles.badge, isRejected ? styles.badgeError : styles.badgePending]}>
              <Text style={[styles.badgeText, isRejected ? styles.badgeTextError : styles.badgeTextPending]}>
                {status}
              </Text>
            </View>
          </View>
          {isRejected && rejectReason ? (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>Reason</Text>
              <Text style={styles.reasonText}>{rejectReason}</Text>
            </View>
          ) : null}
        </View>

        {/* What happens next */}
        {!isRejected && (
          <View style={styles.stepsCard}>
            <Text style={styles.stepsTitle}>What happens next?</Text>
            <Step icon="document-text-outline" text="Admin reviews your company details and KYC documents." />
            <Step icon="checkmark-circle-outline" text="Once approved, your account is activated instantly." />
            <Step icon="cube-outline" text="You can then browse products, send enquiries and place orders." last />
          </View>
        )}

        {message ? (
          <View style={styles.noticeBox}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.infoText} />
            <Text style={styles.noticeText}>{message}</Text>
          </View>
        ) : null}

        <PrimaryButton
          title={checking ? 'CHECKING…' : 'CHECK APPROVAL STATUS'}
          onPress={handleRefresh}
          loading={checking}
          variant="primary"
          size="lg"
          style={{ marginTop: Spacing.lg }}
        />
        <PrimaryButton
          title="LOGOUT"
          onPress={() => setShowLogout(true)}
          variant="ghost"
          size="lg"
          style={{ marginTop: 8 }}
        />

        <TouchableOpacity style={styles.helpRow} onPress={() => navigation.navigate(SCREENS.HELP_SUPPORT)}>
          <Ionicons name="help-circle-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.helpText}>Need help? Contact support</Text>
        </TouchableOpacity>
      </ScrollView>

      <ConfirmationModal
        visible={showLogout}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmTitle="LOGOUT"
        cancelTitle="CANCEL"
        confirmVariant="danger"
        onCancel={() => setShowLogout(false)}
        onConfirm={handleLogout}
      />
    </SafeAreaView>
  );
}

const Step = ({ icon, text, last }) => (
  <View style={[styles.step, !last && styles.stepBorder]}>
    <View style={styles.stepIcon}>
      <Ionicons name={icon} size={16} color={Colors.primary} />
    </View>
    <Text style={styles.stepText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.screenPadding, paddingTop: Spacing.xl, paddingBottom: 40, alignItems: 'stretch' },
  iconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: Spacing.lg },
  iconWrapError: { backgroundColor: Colors.errorBg },
  title: { ...Typography.h2, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: Spacing.sm, paddingHorizontal: Spacing.sm },

  statusCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm, marginTop: Spacing.xl },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  statusLabel: { ...Typography.caption, color: Colors.textSecondary, flex: 0.4 },
  statusValue: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '700', flex: 0.6, textAlign: 'right' },
  badge: { borderRadius: BorderRadius.badge, paddingHorizontal: 10, paddingVertical: 4 },
  badgePending: { backgroundColor: Colors.warningBg },
  badgeError: { backgroundColor: Colors.errorBg },
  badgeText: { ...Typography.caption, fontWeight: '800', fontSize: 11 },
  badgeTextPending: { color: Colors.warningText },
  badgeTextError: { color: Colors.error },
  reasonBox: { backgroundColor: Colors.errorBg, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.sm },
  reasonLabel: { ...Typography.caption, color: Colors.error, fontWeight: '800' },
  reasonText: { ...Typography.body2, color: Colors.errorText, marginTop: 3, lineHeight: 20 },

  stepsCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm, marginTop: Spacing.base },
  stepsTitle: { ...Typography.h5, color: Colors.textPrimary, marginBottom: Spacing.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  stepBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  stepIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  stepText: { ...Typography.body2, color: Colors.textSecondary, flex: 1, lineHeight: 20 },

  noticeBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: Colors.infoBg, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.base },
  noticeText: { ...Typography.caption, color: Colors.infoText, flex: 1, lineHeight: 18 },

  helpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.lg },
  helpText: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' },
});
