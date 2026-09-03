import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
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
      setError(err.message || 'Could not load quotation.');
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
      setError(err.message || 'Could not cancel quotation.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <AppHeader title="Quotation" showBack onBack={() => navigation.goBack()} centerTitle />
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!enquiry || (error && !enquiry)) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <AppHeader title="Quotation" showBack onBack={() => navigation.goBack()} centerTitle />
        <View style={styles.center}>
          <Ionicons name="document-text-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorText}>{error || 'Quotation not found.'}</Text>
          <TouchableOpacity onPress={onRefresh}><Text style={styles.retryText}>Tap to retry</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const pendingOffer  = offers.find(o => o.status === 'Pending');
  const acceptedOffer = offers.find(o => o.status === 'Accepted');
  const quoteOffer = acceptedOffer || pendingOffer || offers[offers.length - 1] || null;

  const hasOrder     = !!enquiry.order_id;
  // Simple retailer-facing status: New / Accepted / Rejected.
  const statusLabel = enquiry.status === 'Confirmed' ? 'Accepted'
    : enquiry.status === 'Cancelled' ? 'Rejected'
    : 'New';

  const code = enquiry.enquiry_code || initialId;
  const productName = enquiry.product?.name || enquiry.product_name || '—';
  const productCode = enquiry.product?.code || enquiry.product_code || '';
  const qty = enquiry.qty;
  const unit = enquiry.unit;
  const sellerName = enquiry.seller?.name || 'EzyEnquiry Official';

  // Prefer a wholesaler offer (negotiation flow); otherwise use the retailer's
  // own submitted quotation (admin-product self-quote).
  const quote     = enquiry.quotation || null;
  const rate      = quoteOffer?.unit_price ?? quote?.rate ?? enquiry.accepted_offer_price ?? null;
  const gross     = rate != null ? Number(rate) * Number(qty || 0) : null;
  const discount  = quote?.discount ?? 0;
  const gstPct    = quoteOffer?.gst_percent ?? quote?.gst_percent ?? null;
  const gstAmt    = quoteOffer?.gst_amount ?? quote?.gst_amount ?? null;
  const transport = quoteOffer?.charges?.transport ?? quote?.freight_charges ?? 0;
  const packing   = quoteOffer?.charges?.packing ?? 0;
  const other     = quoteOffer?.charges?.other ?? quote?.other_charges ?? 0;
  const grand     = quoteOffer?.total_amount ?? quote?.grand_total ?? (gross != null && gstAmt != null ? gross + gstAmt + transport + packing + other : null);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* ── Top bar ──────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{code}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {/* ── Hero (navy) ────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>QUOTATION</Text>
              <Text style={styles.heroName} numberOfLines={2}>{productName}</Text>
              <Text style={styles.heroId}>{code}</Text>
            </View>
            <StatusBadge status={statusLabel} type="enquiry" size="md" />
          </View>

          <View style={styles.heroAmountRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTotal} numberOfLines={1}>
                {grand != null ? formatCurrency(grand) : '—'}
              </Text>
              <Text style={styles.heroCaption}>
                {statusLabel === 'Accepted' ? 'Accepted · Total value'
                  : statusLabel === 'Rejected' ? 'Rejected by seller'
                  : 'Total quotation value'}
              </Text>
            </View>
            <View style={styles.heroDate}>
              <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.heroDateText}>{formatDate(enquiry.created_at)}</Text>
            </View>
          </View>
        </View>

        {/* ── Status banner ──────────────────────────────── */}
        {statusLabel === 'Accepted' ? (
          <View style={styles.acceptedBanner}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.successText} />
            <Text style={styles.acceptedText}>Your quotation was accepted. A sales order has been created.</Text>
          </View>
        ) : statusLabel === 'Rejected' ? (
          <View style={styles.rejectedBanner}>
            <Ionicons name="close-circle" size={18} color={Colors.error} />
            <Text style={styles.rejectedText}>Your quotation was rejected by the seller.</Text>
          </View>
        ) : (
          <View style={styles.pendingBanner}>
            <Ionicons name="time-outline" size={18} color={Colors.warning} />
            <Text style={styles.pendingText}>Awaiting the seller's decision on your quotation.</Text>
          </View>
        )}

        {error ? (
          <View style={styles.inlineError}>
            <Ionicons name="alert-circle" size={15} color={Colors.error} />
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── Quotation details ────────────────────────────── */}
        <InfoCard icon="calculator-outline" title="Quotation details">
          <Row label="Quantity" value={`${qty} ${unit}`} />
          <Row label="Rate" value={rate != null ? formatCurrency(rate) : '—'} valueStyle={rate != null ? styles.priceText : null} />
          {gross != null ? <Row label="Gross amount" value={formatCurrency(gross)} /> : null}
          {discount > 0 ? <Row label="Discount" value={`- ${formatCurrency(discount)}`} /> : null}
          {gstAmt != null ? <Row label={`GST (${gstPct != null ? gstPct : 0}%)`} value={formatCurrency(gstAmt)} /> : null}
          {transport > 0 ? <Row label="Freight charges" value={formatCurrency(transport)} /> : null}
          {packing > 0 ? <Row label="Packing charges" value={formatCurrency(packing)} /> : null}
          {other > 0 ? <Row label="Other charges" value={formatCurrency(other)} /> : null}
          {grand != null ? (
            <Row label="Grand total" value={formatCurrency(grand)} valueStyle={styles.grandValue} />
          ) : null}
        </InfoCard>

        {/* ── Customer (with Created By nested) ─────────────── */}
        {(enquiry.customer?.name || enquiry.customer?.mobile || enquiry.created_by?.name || enquiry.created_by?.company) ? (
          <InfoCard icon="person-outline" title="Customer">
            {enquiry.customer?.name ? <Row label="Name" value={enquiry.customer.name} /> : null}
            {enquiry.customer?.mobile ? <Row label="Mobile" value={`+91 ${enquiry.customer.mobile}`} /> : null}
            {enquiry.customer?.email ? <Row label="Email" value={enquiry.customer.email} /> : null}
            {enquiry.location ? <Row label="Delivery location" value={enquiry.location} /> : null}
            {(enquiry.created_by?.name || enquiry.created_by?.company || enquiry.created_by?.mobile || enquiry.created_by?.email) ? (
              <View style={styles.createdByBox}>
                <Text style={styles.createdByTitle}>CREATED BY{enquiry.created_by?.type ? ` (${enquiry.created_by.type})` : ''}</Text>
                {enquiry.created_by?.name ? <Row label="Name" value={enquiry.created_by.name} /> : null}
                {enquiry.created_by?.company ? <Row label="Company" value={enquiry.created_by.company} /> : null}
                {enquiry.created_by?.mobile ? <Row label="Phone" value={`+91 ${enquiry.created_by.mobile}`} /> : null}
                {enquiry.created_by?.email ? <Row label="Email" value={enquiry.created_by.email} /> : null}
              </View>
            ) : null}
          </InfoCard>
        ) : null}

        {/* ── Product ──────────────────────────────────────── */}
        <InfoCard icon="cube-outline" title="Product">
          <Row label="Product" value={productName} />
          {productCode ? <Row label="Product code" value={productCode} /> : null}
          <Row label="Product added by" value={enquiry.added_by_type || 'Admin'} />
          <Row label="Quotation by" value="You (Retailer)" />
          <Row label="Requested on" value={formatDate(enquiry.created_at)} />
          <TouchableOpacity
            disabled={!hasOrder}
            onPress={() => hasOrder && navigation.navigate(SCREENS.ORDER_DETAILS, { orderId: enquiry.order_id })}
            style={styles.rowNoBorder}
          >
            <Text style={styles.rowLabel}>Sales order</Text>
            <Text style={[styles.rowValue, hasOrder && styles.rowLink]} numberOfLines={1}>
              {hasOrder ? 'View order →' : 'Not created yet'}
            </Text>
          </TouchableOpacity>
        </InfoCard>

        {/* ── Offers (only when there are revisions) ───────── */}
        {offers.length > 1 && (
          <InfoCard icon="pricetags-outline" title={`Offers (${offers.length})`}>
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
                <Row label="Unit Price" value={`${formatCurrency(offer.unit_price)} / ${offer.unit}`} valueStyle={styles.priceText} />
                <Row label="Total" value={formatCurrency(offer.total_amount)} valueStyle={styles.grandValue} />
                {offer.notes ? <Row label="Seller Note" value={offer.notes} /> : null}
              </View>
            ))}
          </InfoCard>
        )}

        {/* ── Remarks ──────────────────────────────────────── */}
        {enquiry.remarks ? (
          <View style={styles.remarksCard}>
            <View style={styles.remarksIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.remarksLabel}>Remarks</Text>
              <Text style={styles.remarksValue}>{enquiry.remarks}</Text>
            </View>
          </View>
        ) : null}

        {/* ── Accepted → Sales Order banner ────────────────── */}
        {(enquiry.status === 'Confirmed' || hasOrder) ? (
          <View style={styles.linkedBanner}>
            <Ionicons name="link" size={18} color={Colors.successText} />
            <Text style={styles.linkedText}>
              {hasOrder
                ? 'This confirmed quotation is linked to your Sales Order.'
                : 'Confirmed quotations create a Sales Order without re-entering product details.'}
            </Text>
          </View>
        ) : null}

        {/* ── Actions ──────────────────────────────────────── */}
        {hasOrder ? (
          <View style={styles.actionsCard}>
            <PrimaryButton title="VIEW SALES ORDER" onPress={() => navigation.navigate(SCREENS.ORDER_DETAILS, { orderId: enquiry.order_id })} variant="primary" size="lg" />
          </View>
        ) : null}
      </ScrollView>

    </SafeAreaView>
  );
}

const InfoCard = ({ icon, title, children }) => (
  <View style={styles.infoCard}>
    <View style={styles.infoCardHeader}>
      <View style={styles.infoCardIcon}>
        <Ionicons name={icon} size={16} color={Colors.primary} />
      </View>
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
  safe: { flex: 1, backgroundColor: Colors.white },
  scrollArea: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorText: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  retryText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.secondary, paddingHorizontal: Spacing.screenPadding, paddingTop: 8, paddingBottom: 10 },
  backBtn: { width: 32, height: 32, alignItems: 'flex-start', justifyContent: 'center' },
  topBarTitle: { ...Typography.h5, color: '#FFF', fontWeight: '700' },

  scroll: { padding: Spacing.screenPadding, paddingTop: Spacing.base, paddingBottom: 40, gap: Spacing.base },

  // Hero
  hero: { backgroundColor: Colors.secondary, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadows.sm },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  heroLabel: { ...Typography.caption, color: 'rgba(255,255,255,0.6)', fontWeight: '800', fontSize: 10, letterSpacing: 0.8 },
  heroName: { ...Typography.h4, color: '#FFF', marginTop: 3 },
  heroId: { ...Typography.caption, color: '#FFD9C7', fontWeight: '700', marginTop: 3 },
  heroAmountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)', marginTop: Spacing.base, paddingTop: Spacing.base },
  heroTotal: { ...Typography.h2, color: '#FFF' },
  heroCaption: { ...Typography.caption, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  heroDate: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 3 },
  heroDateText: { ...Typography.caption, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },

  inlineError: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: Colors.errorBg, borderRadius: BorderRadius.md, padding: Spacing.sm },
  inlineErrorText: { ...Typography.caption, color: Colors.error, flex: 1 },

  // Cards
  infoCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm },
  infoCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  infoCardIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  infoCardTitle: { ...Typography.h5, color: Colors.textPrimary },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  rowNoBorder: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowLabel: { ...Typography.caption, color: Colors.textSecondary, flex: 0.45 },
  rowValue: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '600', flex: 0.55, textAlign: 'right' },
  rowLink: { color: Colors.primary, fontWeight: '700' },
  createdByBox: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.md },
  createdByTitle: { ...Typography.caption, color: Colors.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  priceText: { color: Colors.primary, fontWeight: '700' },
  grandValue: { color: Colors.primary, fontSize: 15, fontWeight: '800' },

  // Offers
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

  // Remarks
  remarksCard: { flexDirection: 'row', gap: 12, backgroundColor: Colors.primaryBg, borderRadius: BorderRadius.xl, padding: Spacing.base },
  remarksIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  remarksLabel: { ...Typography.caption, color: Colors.primary, fontWeight: '800' },
  remarksValue: { ...Typography.body2, color: Colors.textSecondary, marginTop: 3, lineHeight: 20 },

  // Linked banner
  linkedBanner: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: Colors.successBg, borderRadius: BorderRadius.xl, padding: Spacing.base },
  linkedText: { ...Typography.caption, color: Colors.successText, flex: 1, lineHeight: 18, fontWeight: '600' },

  // Status banners
  acceptedBanner: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: Colors.successBg, borderRadius: BorderRadius.lg, padding: Spacing.base },
  acceptedText: { ...Typography.caption, color: Colors.successText, flex: 1, lineHeight: 18, fontWeight: '700' },
  rejectedBanner: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: Colors.errorBg, borderRadius: BorderRadius.lg, padding: Spacing.base },
  rejectedText: { ...Typography.caption, color: Colors.error, flex: 1, lineHeight: 18, fontWeight: '700' },
  pendingBanner: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: Colors.warningBg, borderRadius: BorderRadius.lg, padding: Spacing.base },
  pendingText: { ...Typography.caption, color: Colors.warning, flex: 1, lineHeight: 18, fontWeight: '700' },

  // Actions
  actionsCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm, gap: 10 },
});
