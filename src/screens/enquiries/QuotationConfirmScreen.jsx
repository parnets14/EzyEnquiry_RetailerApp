import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import AppHeader from '../../components/common/AppHeader';
import PrimaryButton from '../../components/common/PrimaryButton';
import { formatCurrency } from '../../utils/formatters';
import { enquiryApi, orderApi } from '../../utils/api';
import { SCREENS } from '../../constants';

export default function QuotationConfirmScreen({ navigation, route }) {
  const { enquiryId, offerId } = route.params || {};

  const [offer, setOffer]       = useState(null);
  const [enquiry, setEnquiry]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [placing, setPlacing]   = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [enqData, offersData] = await Promise.all([
        enquiryApi.get(enquiryId),
        enquiryApi.listOffers(enquiryId),
      ]);
      setEnquiry(enqData);
      const offers = offersData?.offers || [];
      // Use the specified offerId or find the accepted offer
      const target = offerId
        ? offers.find(o => o.id === offerId)
        : offers.find(o => o.status === 'Accepted');
      setOffer(target || offers[0] || null);
    } catch (err) {
      setError(err.message || 'Could not load offer details.');
    }
  }, [enquiryId, offerId]);

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]);

  const handlePlaceOrder = async () => {
    if (!offer) return;
    setPlacing(true);
    setError('');
    try {
      const order = await orderApi.create({ offer_id: offer.id });
      setPlacing(false);
      navigation.replace(SCREENS.ORDER_SUCCESS, {
        orderId: order?.order_code || order?.id,
        orderDbId: order?.id,
        productName: enquiry?.product?.name || '',
      });
    } catch (err) {
      setPlacing(false);
      setError(err.message || 'Could not place order. Please try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <AppHeader title="Confirm Order" showBack onBack={() => navigation.goBack()} centerTitle />
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!offer) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <AppHeader title="Confirm Order" showBack onBack={() => navigation.goBack()} centerTitle />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorText}>{error || 'No accepted offer found for this enquiry.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AppHeader title="Confirm Order" showBack onBack={() => navigation.goBack()} centerTitle />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header Banner */}
        <View style={styles.headerBanner}>
          <View style={styles.bannerIcon}>
            <Ionicons name="document-text" size={28} color={Colors.primary} />
          </View>
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>Accepted Offer</Text>
            <Text style={styles.bannerSub}>
              {offer.seller?.name || 'Seller'}{offer.seller?.city ? ` · ${offer.seller.city}` : ''}
            </Text>
          </View>
        </View>

        {/* Product */}
        <InfoCard title="Product">
          <Row label="Product" value={enquiry?.product?.name || '—'} />
          <Row label="Code"    value={enquiry?.product?.code || '—'} />
        </InfoCard>

        {/* Pricing breakdown (from server-calculated offer) */}
        <InfoCard title="Price Breakdown">
          <Row label="Quantity"   value={`${offer.qty} ${offer.unit}`} />
          <Row label="Unit Price" value={`${formatCurrency(offer.unit_price)} / ${offer.unit}`} valueStyle={styles.priceText} />
          <Row label="Subtotal"   value={formatCurrency(offer.amount)} />
          <Row label={`GST (${offer.gst_percent}%)`} value={formatCurrency(offer.gst_amount)} />
          {offer.charges?.transport > 0 && <Row label="Transport" value={formatCurrency(offer.charges.transport)} />}
          {offer.charges?.packing > 0 && <Row label="Packing" value={formatCurrency(offer.charges.packing)} />}
          {offer.charges?.other > 0 && <Row label="Other" value={formatCurrency(offer.charges.other)} />}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Payable</Text>
            <Text style={styles.totalValue}>{formatCurrency(offer.total_amount)}</Text>
          </View>
        </InfoCard>

        {/* Notice */}
        <View style={styles.noticeCard}>
          <Ionicons name="information-circle-outline" size={16} color="#1A6E9F" />
          <Text style={styles.noticeText}>
            Placing this order will notify the seller. Payment and delivery details will be communicated by the seller.
          </Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={Colors.error} />
            <Text style={styles.errorBoxText}>{error}</Text>
          </View>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.actionsCard}>
          <PrimaryButton
            title="PLACE ORDER"
            onPress={handlePlaceOrder}
            loading={placing}
            variant="primary"
            size="lg"
          />
          <PrimaryButton
            title="GO BACK"
            onPress={() => navigation.goBack()}
            variant="outline"
            size="lg"
            style={{ marginTop: 10 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const InfoCard = ({ title, children }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <View style={styles.cardBar} />
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const Row = ({ label, value, valueStyle }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, valueStyle]} numberOfLines={2}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.screenPadding, paddingBottom: 40, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorText: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },

  headerBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm, borderLeftWidth: 3, borderLeftColor: Colors.primary },
  bannerIcon: { width: 50, height: 50, borderRadius: 14, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bannerText: { flex: 1 },
  bannerTitle: { ...Typography.h5, color: Colors.textPrimary },
  bannerSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },

  card: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  cardBar: { width: 3, height: 16, backgroundColor: Colors.primary, borderRadius: 2, marginRight: 8 },
  cardTitle: { ...Typography.h5, color: Colors.textPrimary },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  rowLabel: { ...Typography.caption, color: Colors.textSecondary, flex: 0.45 },
  rowValue: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '600', flex: 0.55, textAlign: 'right' },
  priceText: { color: Colors.primary, fontSize: 14 },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.md, marginTop: 4 },
  totalLabel: { ...Typography.h5, color: Colors.textPrimary },
  totalValue: { ...Typography.h3, color: Colors.primary },

  noticeCard: { flexDirection: 'row', gap: 10, backgroundColor: '#EBF5FB', borderRadius: BorderRadius.lg, padding: Spacing.base, alignItems: 'flex-start' },
  noticeText: { fontSize: 12, color: '#1A6E9F', lineHeight: 18, flex: 1 },

  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Colors.errorBg, borderRadius: BorderRadius.md, padding: Spacing.md },
  errorBoxText: { ...Typography.caption, color: Colors.error, flex: 1 },

  actionsCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, ...Shadows.sm },
});
