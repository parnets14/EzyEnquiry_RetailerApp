/**
 * src/screens/enquiries/EnquiryDetailsScreen.jsx  (Retailer app)
 *
 * Full parity with the wholesaler's `enquiry/EnquiryDetailScreen.jsx` structure:
 *
 *   [ Customer            ]  party name + mobile
 *   [ Product             ]  product, code, qty/unit, proposed price
 *   [ Delivery & Remarks  ]  delivery location + the other side's remarks
 *   [ Your Quote          ]  available qty + delivery timeline (this company's reply)
 *   [ reply box           ]  the reply text, when one exists
 *   [ date + status chip  ]
 *   [ Reply / Send Offer  ]  the wholesaler's primary action
 *   [ status buttons      ]  driven by STATUS_TRANSITIONS
 *
 * ── What is retailer-only and deliberately kept ─────────────────────────────
 * The wholesaler is the SELLER, so its detail screen only needs to move its own
 * status around. The retailer is the BUYER on a marketplace enquiry, so this
 * screen additionally carries:
 *
 *   • the negotiation thread — seller offers + chat messages (read-only history,
 *     plus an Accept Offer action that opens the order-confirmation step);
 *   • a Withdraw (cancel) action instead of the wholesaler's raw status buttons
 *     on marketplace enquiries — the buyer cannot move a seller-driven status.
 *
 * ── Field mapping (the DTOs differ) ─────────────────────────────────────────
 *   wholesaler flat field        retailer nested field
 *   ─────────────────────────    ────────────────────────────────────────────
 *   enq_code                     enquiry_code
 *   product_name / product_code  product.name / product.code
 *   offered_price                accepted_offer_price
 *   retailer_name                customer.name  (the end-customer)
 *   distributor_reply            quotation.remarks / distributor_reply
 *   location                     location
 *
 * The party slot shows the END-CUSTOMER this enquiry is for, falling back to the
 * seller. `created_by.company` holds the retailer's OWN company name, so showing
 * that would print the retailer to itself — same rule as EnquiriesScreen.
 *
 * ── Status writes are best-effort ───────────────────────────────────────────
 * Opening a `New` enquiry marks it `Viewed`, and the reply form writes a
 * `Replied` status back — exactly what the wholesaler does. The retailer's buyer
 * routes are narrower than the wholesaler's seller surface, so a write may be
 * refused; every status write here is `.catch(() => {})` and never blocks the
 * screen. The local state is optimistically advanced so the UI stays coherent.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, TextInput,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import PrimaryButton from '../../components/common/PrimaryButton';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { enquiryService } from '../../services/enquiryService';
import { orderService } from '../../services/orderService';
import { SCREENS } from '../../constants';

// Same graph as the wholesaler's STATUS_TRANSITIONS.
const STATUS_TRANSITIONS = {
  New:         ['Viewed', 'Replied', 'Negotiation', 'Confirmed', 'Cancelled'],
  Viewed:      ['Replied', 'Negotiation', 'Confirmed', 'Cancelled'],
  Replied:     ['Negotiation', 'Confirmed', 'Cancelled'],
  Negotiation: ['Confirmed', 'Cancelled'],
};
const CANCELLABLE = ['New', 'Viewed', 'Replied', 'Negotiation'];

export default function EnquiryDetailsScreen({ navigation, route }) {
  const { enquiry: passedEnquiry, enquiryId } = route.params || {};
  const initialId = enquiryId || passedEnquiry?.id || passedEnquiry?._raw?.id;

  const [enquiry, setEnquiry]         = useState(passedEnquiry?._raw || passedEnquiry || null);
  const [offers, setOffers]           = useState([]);
  const [messages, setMessages]       = useState([]);
  const [loading, setLoading]         = useState(!enquiry);
  const [refreshing, setRefreshing]   = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showReply, setShowReply]     = useState(false);
  const [error, setError]             = useState('');

  // ── Reply form (the wholesaler's "Your Quote" fields) ──
  const [form, setForm] = useState({ rate: '', available_qty: '', timeline: '', remarks: '' });
  const [sending, setSending] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Inline chat composer (the wholesaler's Negotiation thread input) ──
  const [msgText, setMsgText]           = useState('');
  const [sendingMsg, setSendingMsg]     = useState(false);

  const load = useCallback(async () => {
    if (!initialId) return;
    setError('');
    try {
      // The thread only exists on marketplace enquiries; a failure there must
      // not blank the screen, so each leg is settled independently.
      const [enqRes, offersRes, msgRes] = await Promise.allSettled([
        enquiryService.get(initialId),
        enquiryService.listOffers(initialId),
        enquiryService.listMessages(initialId),
      ]);

      if (enqRes.status === 'rejected') throw enqRes.reason;
      const data = enqRes.value;
      setEnquiry(data);

      const offerList = offersRes.status === 'fulfilled' ? offersRes.value?.offers : [];
      const msgList   = msgRes.status === 'fulfilled' ? msgRes.value?.messages : [];
      setOffers(Array.isArray(offerList) ? offerList : []);
      setMessages(Array.isArray(msgList) ? msgList : []);

      // Opening a New enquiry marks it Viewed — non-fatal if the backend refuses.
      if (data?.status === 'New') {
        enquiryService.update(initialId, { status: 'Viewed' }).catch(() => {});
      }

      // Seed the reply form from whatever this company already quoted.
      setForm(f => ({
        rate:          f.rate || (data?.accepted_offer_price != null ? String(data.accepted_offer_price) : ''),
        available_qty: f.available_qty || (data?.available_quantity != null ? String(data.available_quantity) : ''),
        timeline:      f.timeline || data?.delivery_timeline || '',
        remarks:       f.remarks || data?.distributor_reply || '',
      }));
    } catch (err) {
      setError(err.message || 'Could not load enquiry.');
    }
  }, [initialId]);

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // ── Reply / quote write ──
  const handleSubmit = async () => {
    if (!form.rate) {
      Alert.alert('Rate required', 'Enter your rate per unit before sending.');
      return;
    }
    setSending(true);
    try {
      await enquiryService.reply(initialId, {
        status:             'Replied',
        offered_price:      parseFloat(form.rate),
        available_quantity: form.available_qty ? parseFloat(form.available_qty) : undefined,
        delivery_timeline:  form.timeline,
        distributor_reply:  form.remarks,
      });
      setEnquiry(prev => ({
        ...prev,
        status: 'Replied',
        accepted_offer_price: parseFloat(form.rate),
        available_quantity:   form.available_qty ? parseFloat(form.available_qty) : prev?.available_quantity,
        delivery_timeline:    form.timeline || prev?.delivery_timeline,
        distributor_reply:    form.remarks || prev?.distributor_reply,
      }));
      setShowReply(false);
      Alert.alert('Sent', 'Your quote has been sent.');
    } catch (err) {
      Alert.alert('Could not send', err.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  // ── Inline chat send (wholesaler's sendMsg, buyer side) ──
  const sendMsg = async () => {
    const text = msgText.trim();
    if (!text || sendingMsg) return;
    setSendingMsg(true);
    try {
      await enquiryService.sendMessage(initialId, text, `c${Date.now()}`);
      setMsgText('');
      // Reload the thread so the persisted message replaces any local echo.
      const res = await enquiryService.listMessages(initialId);
      const list = res?.messages;
      if (Array.isArray(list)) setMessages(list);
    } catch (err) {
      Alert.alert('Could not send', err.message || 'Message failed.');
    } finally {
      setSendingMsg(false);
    }
  };

  // ── Status move (non-marketplace enquiries) ──
  const changeStatus = async (status) => {
    setActionLoading(true);
    try {
      await enquiryService.update(initialId, { status });
      setEnquiry(prev => ({ ...prev, status }));
      Alert.alert('Updated', `Status changed to ${status}.`);
    } catch (err) {
      Alert.alert('Could not update', err.message || 'Status update failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Buyer: accept an offer → order confirmation step ──
  const acceptOffer = async (offer) => {
    setActionLoading(true);
    try {
      await enquiryService.respondToOffer(initialId, offer.id, 'accept');
      await load();
      navigation.navigate(SCREENS.QUOTATION_CONFIRM, { enquiryId: initialId, offerId: offer.id });
    } catch (err) {
      Alert.alert('Could not accept', err.message || 'Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const placeOrder = async (offer) => {
    setActionLoading(true);
    try {
      const order = await orderService.create({ offer_id: offer.id });
      navigation.navigate(SCREENS.ORDER_SUCCESS, {
        orderId:     order?.order_code || order?.id,
        orderDbId:   order?.id,
        productName: enquiry?.product?.name || '',
      });
    } catch (err) {
      Alert.alert('Could not place order', err.message || 'Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Buyer: withdraw the enquiry ──
  const withdraw = () => {
    Alert.alert('Withdraw enquiry', 'This enquiry will be cancelled.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await enquiryService.cancel(initialId);
            await load();
          } catch (err) {
            Alert.alert('Could not withdraw', err.message || 'Please try again.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
        <TopBar code="" onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!enquiry) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
        <TopBar code="" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Ionicons name="document-text-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorText}>{error || 'Enquiry not found.'}</Text>
          <TouchableOpacity onPress={onRefresh}><Text style={styles.retryText}>Tap to retry</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Derived ──
  const code        = enquiry.enquiry_code || initialId || 'Enquiry';
  const productName = enquiry.product?.name || enquiry.product_name || '—';
  const productCode = enquiry.product?.code || enquiry.product_code || '';
  const qty         = enquiry.qty ?? enquiry.quantity;
  const unit        = enquiry.unit || '';
  // Party = the end-customer this enquiry is for; fall back to the seller.
  const partyName   = enquiry.customer?.name || enquiry.seller?.name || '—';
  const partyMobile = enquiry.customer?.mobile || enquiry.seller?.mobile || '';
  const location    = enquiry.location || enquiry.delivery_location || '';
  const remarks     = enquiry.remarks || enquiry.notes || '';
  const proposed    = enquiry.proposed_price ?? enquiry.accepted_offer_price ?? null;
  const isMarketplace = !!(enquiry.buyer_company_id || enquiry.seller?.id || enquiry.seller?._id);
  const nextStatuses  = STATUS_TRANSITIONS[enquiry.status] || [];
  const canWithdraw   = CANCELLABLE.includes(enquiry.status);
  const hasOrder      = !!enquiry.order_id;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
      <TopBar code={code} onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {error ? (
          <View style={styles.inlineError}>
            <Ionicons name="alert-circle" size={15} color={Colors.error} />
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── Customer (wholesaler: "Customer") ── */}
        <Section title="Customer">
          <Text style={styles.value}>{partyName}</Text>
          {partyMobile ? <Text style={styles.sub}>{partyMobile}</Text> : null}
          {enquiry.created_by?.company && enquiry.created_by.company !== partyName ? (
            <Text style={styles.sub}>{enquiry.created_by.company}</Text>
          ) : null}
        </Section>

        {/* ── Product ── */}
        <Section title="Product">
          <Text style={styles.value}>{productName}</Text>
          {productCode ? <Text style={styles.sub}>Code: {productCode}</Text> : null}
          <Text style={styles.sub}>
            Qty: {qty ?? '—'} {unit}
            {proposed != null ? `  |  Proposed: ${formatCurrency(proposed)}` : ''}
          </Text>
        </Section>

        {/* ── Delivery & Remarks ── */}
        <Section title="Delivery & Remarks">
          <Text style={styles.sub}>📍 Delivery Location: {location || '—'}</Text>
          <Text style={styles.sub}>📝 Retailer Remarks: {remarks || '—'}</Text>
        </Section>

        {/* ── Your Quote (this company's reply) ── */}
        {(enquiry.available_quantity != null || enquiry.delivery_timeline) ? (
          <Section title="Your Quote">
            {enquiry.available_quantity != null ? (
              <Text style={styles.sub}>Available Qty: {enquiry.available_quantity} {unit}</Text>
            ) : null}
            {enquiry.delivery_timeline ? (
              <Text style={styles.sub}>Delivery Timeline: {enquiry.delivery_timeline}</Text>
            ) : null}
          </Section>
        ) : null}

        {/* ── Reply box (wholesaler: green "Your Reply") ── */}
        {enquiry.distributor_reply ? (
          <View style={styles.replyBox}>
            <Text style={styles.replyLabel}>Your Reply:</Text>
            <Text style={styles.replyText}>{enquiry.distributor_reply}</Text>
          </View>
        ) : null}

        {/* ── Date + status ── */}
        <View style={styles.metaRow}>
          <Text style={styles.sub}>Date: {formatDate(enquiry.created_at)}</Text>
          <StatusBadge status={enquiry.status || 'New'} type="enquiry" size="md" />
        </View>

        {/* ══ Negotiation thread ══
            The wholesaler always renders this card on a marketplace enquiry
            (`{isMarketplace && (`), with an empty-state line and the inline
            composer, rather than hiding the whole card when the thread is empty. */}
        {isMarketplace ? (
          <Section title="Negotiation">
            {/* Offers history */}
            {offers.map((o, idx) => (
              <View key={o.id || o._id || idx} style={styles.offerCard}>
                <View style={styles.offerTop}>
                  <Text style={styles.offerPrice}>
                    {formatCurrency(o.unit_price)} / {o.unit || unit || 'unit'}
                  </Text>
                  <View style={[
                    styles.offerStatus,
                    o.status === 'Accepted' && styles.offerAccepted,
                    o.status === 'Rejected' && styles.offerRejected,
                  ]}>
                    <Text style={styles.offerStatusText}>{o.status}</Text>
                  </View>
                </View>
                <Text style={styles.offerMeta}>
                  Total {formatCurrency(o.total_amount)}
                  {o.available_quantity != null ? `  •  Avail ${o.available_quantity}` : ''}
                  {o.delivery_timeline ? `  •  ${o.delivery_timeline}` : ''}
                </Text>
                {o.notes ? <Text style={styles.offerNotes}>{o.notes}</Text> : null}

                {/* Buyer-side actions on a pending offer. */}
                {o.status === 'Pending' ? (
                  <View style={styles.offerActions}>
                    <TouchableOpacity
                      style={[styles.offerBtn, styles.offerBtnAccept]}
                      onPress={() => acceptOffer(o)}
                      disabled={actionLoading}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.offerBtnText}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                ) : o.status === 'Accepted' && !hasOrder ? (
                  <View style={styles.offerActions}>
                    <TouchableOpacity
                      style={[styles.offerBtn, styles.offerBtnAccept]}
                      onPress={() => placeOrder(o)}
                      disabled={actionLoading}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.offerBtnText}>Place Order</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))}

            {/* Chat messages */}
            <View style={styles.thread}>
              {messages.length === 0 ? (
                <Text style={styles.threadEmpty}>No messages yet. Start the conversation below.</Text>
              ) : (
                messages.map((m, i) => {
                  // This app is the buyer; its own messages are "mine".
                  const mine = m.sender_side === 'buyer';
                  return (
                    <View key={m._id || m.id || i} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                      <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.message}</Text>
                      <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                        {mine ? 'You' : 'Seller'} · {formatDate(m.created_at)}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>

            {/* Inline message input — same as the wholesaler's, hidden once closed. */}
            {enquiry.status !== 'Cancelled' ? (
              <View style={styles.msgRow}>
                <TextInput
                  style={styles.msgInput}
                  placeholder="Type a message…"
                  placeholderTextColor={Colors.textTertiary}
                  value={msgText}
                  onChangeText={setMsgText}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.msgSend, (!msgText.trim() || sendingMsg) && styles.msgSendDisabled]}
                  onPress={sendMsg}
                  disabled={!msgText.trim() || sendingMsg}
                  activeOpacity={0.8}
                >
                  <Ionicons name="send" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : null}
          </Section>
        ) : null}

        {/* ══ Reply form (section 5 of the wholesaler layout) ══ */}
        {showReply ? (
          <Section title={isMarketplace ? 'Send Offer' : 'Reply to Enquiry'}>
            <Field label="Your Rate (₹ per unit) *" value={form.rate}
              onChangeText={v => set('rate', v)} keyboardType="decimal-pad" />
            <Field label={`Available Quantity${unit ? ` (${unit})` : ''}`} value={form.available_qty}
              onChangeText={v => set('available_qty', v)} keyboardType="decimal-pad"
              placeholder={qty ? `Requested: ${qty}` : 'How much can you supply'} />
            <Field label="Delivery Timeline" value={form.timeline}
              onChangeText={v => set('timeline', v)} placeholder="e.g. 3-5 days / Ready stock" />
            <Field label="Message / Remarks" value={form.remarks}
              onChangeText={v => set('remarks', v)} multiline />
            <PrimaryButton
              title={isMarketplace ? 'SEND OFFER' : 'SEND REPLY'}
              onPress={handleSubmit}
              loading={sending}
              variant="primary"
              size="lg"
              style={{ marginTop: Spacing.md }}
            />
          </Section>
        ) : null}

        {/* ══ Actions ══
            Mirrors the wholesaler's `{nextStatuses.length > 0 && (…)}` block: the
            primary "reply" CTA sits on top, with the raw status buttons beneath it
            for a manual (non-marketplace) enquiry. On a marketplace enquiry the
            buyer cannot move the seller's status, so only Withdraw is offered —
            that is the role asymmetry, not a missing feature. */}
        {hasOrder ? (
          <View style={styles.actionsCard}>
            <PrimaryButton
              title="VIEW SALES ORDER"
              onPress={() => navigation.navigate(SCREENS.ORDER_DETAILS, { orderId: enquiry.order_id })}
              variant="primary"
              size="lg"
            />
          </View>
        ) : nextStatuses.length > 0 ? (
          <View style={styles.actionsCard}>
            {!showReply ? (
              <PrimaryButton
                title={isMarketplace ? 'Send Offer' : 'Reply to Enquiry'}
                onPress={() => setShowReply(true)}
                variant="primary"
                size="lg"
                style={styles.mb10}
              />
            ) : null}

            {isMarketplace ? (
              canWithdraw ? (
                <PrimaryButton
                  title="WITHDRAW ENQUIRY"
                  onPress={withdraw}
                  loading={actionLoading}
                  variant="outline"
                  size="lg"
                />
              ) : null
            ) : (
              <View style={styles.statusRow}>
                {nextStatuses.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.statusBtn,
                      s === 'Confirmed' && styles.statusConfirmed,
                      s === 'Cancelled' && styles.statusCancelled,
                    ]}
                    onPress={() => changeStatus(s)}
                    disabled={actionLoading}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.statusBtnText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Local presentation pieces ───────────────────────────────────────────── */

const TopBar = ({ code, onBack }) => (
  <View style={styles.topBar}>
    <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Ionicons name="arrow-back" size={22} color="#FFF" />
    </TouchableOpacity>
    <Text style={styles.topBarTitle} numberOfLines={1}>{code}</Text>
    <View style={styles.backBtn} />
  </View>
);

const Section = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const Field = ({ label, ...rest }) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.fieldInput, rest.multiline && styles.fieldInputMulti]}
      placeholderTextColor={Colors.textTertiary}
      multiline={!!rest.multiline}
      {...rest}
    />
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  scrollArea: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.base, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorText: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  retryText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.screenPadding, paddingTop: 8, paddingBottom: 10,
  },
  backBtn: { width: 32, height: 32, alignItems: 'flex-start', justifyContent: 'center' },
  topBarTitle: { ...Typography.h5, color: '#FFF', fontWeight: '700', flex: 1, textAlign: 'center' },

  // Sections — the wholesaler's white card per block.
  section: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.base, marginBottom: 10, ...Shadows.sm,
  },
  sectionTitle: {
    ...Typography.caption, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', marginBottom: 4,
  },
  value: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  sub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  // Reply box (wholesaler's green card)
  replyBox: {
    backgroundColor: Colors.successBg, borderRadius: BorderRadius.lg,
    padding: Spacing.base, marginBottom: 10,
  },
  replyLabel: { ...Typography.caption, fontWeight: '700', color: Colors.successText, marginBottom: 4 },
  replyText: { fontSize: 13, color: Colors.textPrimary },

  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.base,
  },

  inlineError: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    backgroundColor: Colors.errorBg, borderRadius: BorderRadius.md,
    padding: Spacing.sm, marginBottom: 10,
  },
  inlineErrorText: { ...Typography.caption, color: Colors.error, flex: 1 },

  // Offers
  offerCard: {
    backgroundColor: Colors.background, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginTop: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  offerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  offerPrice: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  offerStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.badge, backgroundColor: Colors.warningBg },
  offerAccepted: { backgroundColor: Colors.successBg },
  offerRejected: { backgroundColor: Colors.errorBg },
  offerStatusText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
  offerMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  offerNotes: { fontSize: 12, color: Colors.textPrimary, marginTop: 4, fontStyle: 'italic' },
  // Buyer-side actions on an offer (the wholesaler has none here — it is the
  // seller — so these are retailer-only, styled with the app's own tokens).
  offerActions: { flexDirection: 'row', gap: 8, marginTop: Spacing.sm },
  offerBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  offerBtnAccept: { backgroundColor: Colors.secondary },
  offerBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },

  // Messages
  thread: { marginTop: 10 },
  threadEmpty: {
    fontSize: 12, color: Colors.textSecondary,
    textAlign: 'center', paddingVertical: 12,
  },
  bubble: { maxWidth: '82%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  bubbleMine: { backgroundColor: Colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: Colors.borderLight, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 13.5, color: Colors.textPrimary, lineHeight: 19 },
  bubbleTextMine: { color: '#FFF' },
  bubbleTime: { fontSize: 10, color: Colors.textSecondary, marginTop: 3 },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },

  // Inline chat composer
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 6 },
  msgInput: {
    flex: 1, backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: Colors.textPrimary, maxHeight: 100,
  },
  msgSend: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  msgSendDisabled: { opacity: 0.5 },

  // Reply form
  fieldWrap: { marginTop: Spacing.md },
  fieldLabel: { ...Typography.caption, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 },
  fieldInput: {
    backgroundColor: Colors.background, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Colors.textPrimary,
  },
  fieldInputMulti: { minHeight: 80, textAlignVertical: 'top' },

  // Actions
  actionsCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.base, marginTop: 10, ...Shadows.sm,
  },
  mb10: { marginBottom: 10 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.md, backgroundColor: Colors.primary },
  statusConfirmed: { backgroundColor: Colors.secondary },
  statusCancelled: { backgroundColor: Colors.error },
  statusBtnText: { color: '#FFF', fontWeight: '600', fontSize: 13 },
});
