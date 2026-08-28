import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import AppHeader from '../../components/common/AppHeader';
import StatusBadge from '../../components/common/StatusBadge';
import PrimaryButton from '../../components/common/PrimaryButton';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { enquiryApi } from '../../utils/api';
import { SCREENS } from '../../constants';

export default function EnquiryDetailsScreen({ navigation, route }) {
  // Accept either a full enquiry object (legacy) or just an id
  const { enquiry: passedEnquiry, enquiryId } = route.params || {};
  const initialId = enquiryId || passedEnquiry?.id || passedEnquiry?._raw?.id;

  const [enquiry, setEnquiry]     = useState(passedEnquiry?._raw || passedEnquiry || null);
  const [offers, setOffers]       = useState([]);
  const [loading, setLoading]     = useState(!enquiry);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAccept, setShowAccept]   = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [error, setError]         = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [enqData, offersData] = await Promise.all([
        enquiryApi.get(initialId),
        enquiryApi.listOffers(initialId),
      ]);
      setEnquiry(enqData);
      setOffers(offersData?.offers || []);
    } catch (err) {
      setError(err.message || 'Could not load enquiry.');
    }
  }, [initialId]);

  useEffect(() => {
    if (!initialId) return;
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [initialId, load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleRespondOffer = async (offerId, action) => {
    setActionLoading(true);
    try {
      await enquiryApi.respondToOffer(initialId, offerId, action);
      await load();
      if (action === 'accept') {
        // Navigate to order confirmation
        navigation.navigate(SCREENS.QUOTATION_CONFIRM, { enquiryId: initialId });
      }
    } catch (err) {
      setError(err.message || `Could not ${action} offer.`);
    } finally {
      setActionLoading(false);
      setShowAccept(false);
    }
  };

  const handleCancelEnquiry = async () => {
    setActionLoading(true);
    try {
      await enquiryApi.cancel(initialId);
      await load();
    } catch (err) {
      setError(err.message || 'Could not cancel enquiry.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <AppHeader title="Enquiry Details" showBack onBack={() => navigation.goBack()} centerTitle />
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!enquiry || error) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <AppHeader title="Enquiry Details" showBack onBack={() => navigation.goBack()} centerTitle />
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || 'Enquiry not found.'}</Text>
          <TouchableOpacity onPress={onRefresh}><Text style={styles.retryText}>Tap to retry</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const pendingOffer = offers.find(o => o.status === 'Pending');
  const acceptedOffer = offers.find(o => o.status === 'Accepted');
  const canNegotiate = ['New', 'Viewed', 'Replied', 'Negotiation'].includes(enquiry.status) && enquiry.status !== 'Cancelled';
  const canCancel    = ['New', 'Viewed', 'Replied', 'Negotiation'].includes(enquiry.status) && !enquiry.order_id;
  const hasOrder     = !!enquiry.order_id;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AppHeader title="Enquiry Details" showBack onBack={() => navigation.goBack()} centerTitle />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {/* Status Banner */}
        <View style={styles.statusBanner}>
          <View>
            <Text style={styles.enquiryId}>{enquiry.enquiry_code || initialId}</Text>
            <Text style={styles.enquiryDate}>Created {formatDate(enquiry.created_at)}</Text>
          </View>
          <StatusBadge status={enquiry.status} type="enquiry" size="md" />
        </View>

        {error ? (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        ) : null}

        {/* Product */}
        <InfoCard title="Product">
          <Row label="Product Name"     value={enquiry.product?.name || enquiry.product_name || '—'} />
          <Row label="Product Code"     value={enquiry.product?.code || enquiry.product_code || '—'} />
          <Row label="Quantity"         value={`${enquiry.qty} ${enquiry.unit}`} />
          <Row label="Delivery Location" value={enquiry.location || '—'} />
          {enquiry.remarks ? <Row label="Remarks" value={enquiry.remarks} /> : null}
        </InfoCard>

        {/* Seller */}
        {enquiry.seller && (
          <InfoCard title="Seller Information">
            <Row label="Company"  value={enquiry.seller.name} />
            <Row label="Location" value={[enquiry.seller.city, enquiry.seller.state].filter(Boolean).join(', ')} />
          </InfoCard>
        )}

        {/* Offers */}
        {offers.length > 0 && (
          <InfoCard title={`Offers (${offers.length})`}>
            {offers.map((offer, idx) => (
              <View key={offer.id} style={[styles.offerItem, idx < offers.length - 1 && styles.offerBorder]}>
                <View style={styles.offerHeader}>
                  <Text style={styles.offerLabel}>Offer #{idx + 1}</Text>
                  <View style={[styles.offerStatusBadge, offer.status === 'Pending' && styles.badgePending, offer.status === 'Accepted' && styles.badgeAccepted, offer.status === 'Rejected' && styles.badgeRejected]}>
                    <Text style={[styles.offerStatusText, offer.status === 'Pending' && styles.badgePendingText, offer.status === 'Accepted' && styles.badgeAcceptedText, offer.status === 'Rejected' && styles.badgeRejectedText]}>
                      {offer.status}
                    </Text>
                  </View>
                </View>
                <Row label="Unit Price"  value={`${formatCurrency(offer.unit_price)} / ${offer.unit}`} valueStyle={styles.priceText} />
                <Row label="Quantity"    value={`${offer.qty} ${offer.unit}`} />
                <Row label="GST"         value={`${offer.gst_percent}% (${formatCurrency(offer.gst_amount)})`} />
                {offer.charges?.transport > 0 && <Row label="Transport" value={formatCurrency(offer.charges.transport)} />}
                <Row label="Total"       value={formatCurrency(offer.total_amount)} valueStyle={styles.totalText} />
                {offer.notes ? <Row label="Seller Note" value={offer.notes} /> : null}
              </View>
            ))}
          </InfoCard>
        )}

        {/* Actions */}
        <View style={styles.actionsCard}>
          {pendingOffer && (
            <>
              <PrimaryButton
                title="ACCEPT OFFER"
                onPress={() => { setSelectedOffer(pendingOffer); setShowAccept(true); }}
                loading={actionLoading}
                variant="primary"
                style={styles.actionBtn}
              />
              <PrimaryButton
                title="REJECT OFFER"
                onPress={() => handleRespondOffer(pendingOffer.id, 'reject')}
                loading={actionLoading}
                variant="outline"
                style={styles.actionBtn}
              />
            </>
          )}
          {canNegotiate && (
            <PrimaryButton
              title="SEND MESSAGE"
              onPress={() => navigation.navigate(SCREENS.NEGOTIATION, { enquiryId: initialId, enquiry })}
              variant="secondary"
              style={styles.actionBtn}
            />
          )}
          {acceptedOffer && !hasOrder && (
            <PrimaryButton
              title="CREATE ORDER"
              onPress={() => navigation.navigate(SCREENS.QUOTATION_CONFIRM, { enquiryId: initialId, offerId: acceptedOffer.id })}
              variant="primary"
              style={styles.actionBtn}
            />
          )}
          {hasOrder && (
            <PrimaryButton
              title="VIEW ORDER"
              onPress={() => navigation.navigate(SCREENS.ORDER_DETAILS, { orderId: enquiry.order_id })}
              variant="secondary"
              style={styles.actionBtn}
            />
          )}
          {canCancel && (
            <PrimaryButton
              title="CANCEL ENQUIRY"
              onPress={handleCancelEnquiry}
              loading={actionLoading}
              variant="ghost"
              style={[styles.actionBtn, { marginTop: 4 }]}
            />
          )}
        </View>
      </ScrollView>

      {/* Accept offer confirmation modal */}
      <ConfirmationModal
        visible={showAccept}
        title="Accept this Offer?"
        onCancel={() => setShowAccept(false)}
        onConfirm={() => selectedOffer && handleRespondOffer(selectedOffer.id, 'accept')}
        confirmTitle="ACCEPT"
        cancelTitle="CANCEL"
      >
        {selectedOffer && (
          <View style={{ marginBottom: 4 }}>
            <Row label="Unit Price" value={`${formatCurrency(selectedOffer.unit_price)} / ${selectedOffer.unit}`} />
            <Row label="Quantity"   value={`${selectedOffer.qty} ${selectedOffer.unit}`} />
            <Row label="Total"      value={formatCurrency(selectedOffer.total_amount)} valueStyle={styles.totalText} />
          </View>
        )}
      </ConfirmationModal>
    </SafeAreaView>
  );
}

const InfoCard = ({ title, children }) => (
  <View style={styles.infoCard}>
    <View style={styles.infoCardHeader}>
      <View style={styles.infoCardBar} />
      <Text style={styles.infoCardTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const Row = ({ label, value, valueStyle }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, valueStyle]} numberOfLines={3}>{value ?? '—'}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.screenPadding, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorText: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  retryText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },
  inlineError: { backgroundColor: Colors.errorBg, borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.base },
  inlineErrorText: { ...Typography.caption, color: Colors.error },
  statusBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm, marginBottom: Spacing.base, borderLeftWidth: 3, borderLeftColor: Colors.primary },
  enquiryId: { ...Typography.h5, color: Colors.textPrimary },
  enquiryDate: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2 },
  infoCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm, marginBottom: Spacing.base },
  infoCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  infoCardBar: { width: 3, height: 16, backgroundColor: Colors.primary, borderRadius: 2, marginRight: 8 },
  infoCardTitle: { ...Typography.h5, color: Colors.textPrimary },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  rowLabel: { ...Typography.caption, color: Colors.textSecondary, flex: 0.45 },
  rowValue: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '600', flex: 0.55, textAlign: 'right' },
  priceText: { color: Colors.primary, fontSize: 14 },
  totalText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  offerItem: { paddingVertical: Spacing.sm },
  offerBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight, marginBottom: Spacing.sm },
  offerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  offerLabel: { ...Typography.body2, color: Colors.textPrimary, fontWeight: '700' },
  offerStatusBadge: { borderRadius: BorderRadius.badge, paddingHorizontal: 8, paddingVertical: 3 },
  badgePending: { backgroundColor: Colors.warningBg },
  badgePendingText: { color: Colors.warning },
  badgeAccepted: { backgroundColor: Colors.successBg },
  badgeAcceptedText: { color: Colors.success },
  badgeRejected: { backgroundColor: Colors.errorBg },
  badgeRejectedText: { color: Colors.error },
  offerStatusText: { ...Typography.caption, fontWeight: '700', fontSize: 10 },
  actionsCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm, gap: 10 },
  actionBtn: {},
});
