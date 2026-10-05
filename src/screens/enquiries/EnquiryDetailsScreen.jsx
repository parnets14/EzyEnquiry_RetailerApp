/**
 * src/screens/enquiries/EnquiryDetailsScreen.jsx  (Retailer app)
 *
 * Enhanced enquiry detail screen for retailers:
 * - Shows full details of what was sent (product specs, qty, delivery location)
 * - Displays seller reply cards with company details, contact, remarks, price
 * - Three action buttons per seller: Message (1-on-1 chat), Reply (quote form), Cancel
 * - Message modal shows chat thread with that seller
 * - Reply modal shows quote form (rate, qty, timeline, remarks)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, TextInput,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import PrimaryButton from '../../components/common/PrimaryButton';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { enquiryService } from '../../services/enquiryService';
import { orderService } from '../../services/orderService';
import { SCREENS } from '../../constants';
import useAuth from '../../hooks/useAuth';
import { enquirySeen } from '../../utils/enquirySeen';

const STATUS_TRANSITIONS = {
  New:         ['Viewed', 'Replied', 'Confirmed', 'Cancelled'],
  Viewed:      ['Replied', 'Confirmed', 'Cancelled'],
  Replied:     ['Confirmed', 'Cancelled'],
};
const CANCELLABLE = ['New', 'Viewed', 'Replied'];

const STATUS_META = {
  New:         { chipBg: '#EFF6FF', chipText: '#2563EB' },
  Viewed:      { chipBg: '#F3F4F6', chipText: '#6B7280' },
  Replied:     { chipBg: '#FFF7ED', chipText: '#D97706' },
  Confirmed:   { chipBg: '#F0FDF4', chipText: '#059669' },
  Cancelled:   { chipBg: '#FEF2F2', chipText: '#DC2626' },
};

export default function EnquiryDetailsScreen({ navigation, route }) {
  const { user } = useAuth();
  const { enquiry: passedEnquiry, enquiryId, seenUpdatedAt, seenKey, direction: routeDirection } = route.params || {};
  const initialId = enquiryId || passedEnquiry?.id || passedEnquiry?._raw?.id;

  const [enquiry, setEnquiry] = useState(passedEnquiry?._raw || passedEnquiry || null);
  const [offers, setOffers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [replies, setReplies] = useState(null);
  const [loading, setLoading] = useState(!enquiry);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [error, setError] = useState('');
  // The enquiry row the inline Message/Reply panels act on. Defaults to the
  // opened enquiry; a reply card sets it to THAT replier's own row so the
  // conversation/history stays scoped to that one party.
  const [activeRowId, setActiveRowId] = useState(null);

  // ── Modal states for Message and Reply ──
  const [messageModal, setMessageModal] = useState({ visible: false, seller: null, sellerId: null, enquiryIdForSeller: null });
  const [replyModal, setReplyModal] = useState({ visible: false, seller: null, sellerId: null, enquiryIdForSeller: null });
  const [modalSending, setModalSending] = useState(false);
  
  // ── Modal message composer ──
  const [messageText, setMessageText] = useState('');
  
  // ── Modal reply form ──
  const [modalReplyForm, setModalReplyForm] = useState({ rate: '', available_qty: '', timeline: '', remarks: '' });

  // ── Reply history state ──
  const [replyHistory, setReplyHistory] = useState([]);  // all replies for this enquiry
  const [form, setForm] = useState({ rate: '', available_qty: '', timeline: '', remarks: '' });
  const [sending, setSending] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Inline chat composer ──
  const [msgText, setMsgText] = useState('');
  const [threadTexts, setThreadTexts] = useState({});
  const [sendingMsg, setSendingMsg] = useState(false);
  const setThreadText = (sellerId, text) =>
    setThreadTexts(prev => ({ ...prev, [String(sellerId)]: text }));

  const msgInputRefs = useRef({});
  const [counterOpen, setCounterOpen] = useState({});
  const [counterForms, setCounterForms] = useState({});
  const [counterSending, setCounterSending] = useState(false);
  const toggleCounter = (sellerId) =>
    setCounterOpen(prev => ({ ...prev, [String(sellerId)]: !prev[String(sellerId)] }));
  const setCounterField = (sellerId, key, value) =>
    setCounterForms(prev => ({
      ...prev,
      [String(sellerId)]: { ...(prev[String(sellerId)] || {}), [key]: value },
    }));

  const recipientMsgInputRef = useRef(null);
  const scrollRef = useRef(null);
  const chatScrollRef = useRef(null);

  // Scroll the panel into view once it opens so the keyboard never hides the
  // input/send button at the bottom of the page.
  const scrollToBottomSoon = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
  };

  const load = useCallback(async () => {
    if (!initialId) return;
    setError('');
    try {
      const [enqRes, offersRes, msgRes, repliesRes, historyRes] = await Promise.allSettled([
        enquiryService.get(initialId),
        enquiryService.listOffers(initialId),
        enquiryService.listMessages(initialId),
        enquiryService.listReplies(initialId),
        enquiryService.listReplyHistory(initialId),
      ]);

      if (enqRes.status === 'rejected') throw enqRes.reason;
      const data = enqRes.value;
      setEnquiry(data);

      const offerList = offersRes.status === 'fulfilled' ? offersRes.value?.offers : [];
      const msgList = msgRes.status === 'fulfilled' ? msgRes.value?.messages : [];
      setOffers(Array.isArray(offerList) ? offerList : []);
      setMessages(Array.isArray(msgList) ? msgList : []);
      const repliesEnvelope = repliesRes.status === 'fulfilled' ? (repliesRes.value || null) : null;
      setReplies(repliesEnvelope);
      const historyList = historyRes?.status === 'fulfilled' ? (historyRes.value?.replies || historyRes.value?.data?.replies || []) : [];
      setReplyHistory(Array.isArray(historyList) ? historyList : []);

      // ── Mark SEEN at the LATEST activity timestamp ──
      // The list's green dot compares the group's newest `updated_at` (across
      // every recipient sibling) against what we last saw. The enquiry row we
      // opened only carries ITS OWN `updated_at`, older than a reply sitting on
      // a sibling row — so store the MAX of: the enquiry's updated_at, every
      // reply's responded_at, and the newest message time. That matches (or
      // exceeds) whatever the list can compute, so the dot clears on return.
      const repliedRows =
        (Array.isArray(repliesEnvelope?.data?.replied) ? repliesEnvelope.data.replied
          : Array.isArray(repliesEnvelope?.replied) ? repliesEnvelope.replied
          : []);
      const candidateTimes = [
        // The value the list itself used — guarantees "seen" is never behind.
        seenUpdatedAt,
        data?.updated_at || data?.updatedAt,
        ...repliedRows.map(r => r.responded_at || r.updated_at || r.created_at),
        ...(Array.isArray(msgList) ? msgList : []).map(m => m.created_at),
      ].filter(Boolean).map(t => new Date(t).getTime()).filter(num => !Number.isNaN(num));
      // +1s cushion so the stored "seen" sits a hair AHEAD of the list value.
      const latestSeen = candidateTimes.length
        ? new Date(Math.max(...candidateTimes) + 1000).toISOString()
        : new Date().toISOString();
      // Mark seen under the SAME stable key the list's dot checks (enq_code).
      enquirySeen.markSeen(seenKey || initialId, latestSeen).catch(() => {});

      if (data?.status === 'New') {
        enquiryService.update(initialId, { status: 'Viewed' }).catch(() => {});
      }

      setForm(f => ({
        rate:          f.rate || (data?.accepted_offer_price != null ? String(data.accepted_offer_price) : ''),
        available_qty: f.available_qty || (data?.available_quantity != null ? String(data.available_quantity) : ''),
        timeline:      f.timeline || data?.delivery_timeline || '',
        remarks:       f.remarks || data?.distributor_reply || '',
      }));
    } catch (err) {
      setError(err.message || 'Could not load enquiry.');
    }
  }, [initialId, seenKey, seenUpdatedAt]);

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // ── Open Message modal for a seller ──
  // Load and maintain messages keyed to the SELLER's row (enquiryIdForSeller)
  // because that's where createBuyerMessage stores them. Using initialId would
  // return 304 (the buyer's own row hasn't changed) or miss the messages entirely.
  const openMessageModal = async (seller, sellerId, rowId) => {
    setMessageText('');
    setMessageModal({ visible: true, seller, sellerId, enquiryIdForSeller: rowId });
    // Load messages for this specific seller conversation
    try {
      const res = await enquiryService.listMessages(rowId);
      setMessages(Array.isArray(res?.messages) ? res.messages : []);
    } catch {
      setMessages([]);
    }
  };

  // ── Send message from modal — optimistic bubble, no Alert ──
  const sendMessageFromModal = async () => {
    const text = messageText.trim();
    if (!text || modalSending) return;
    setModalSending(true);
    const optimistic = {
      id: `tmp-${Date.now()}`,
      message: text,
      sender_side: 'buyer',
      created_at: new Date().toISOString(),
      __pending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setMessageText('');
    try {
      // Post to the SELLER's specific row so they receive the message
      await enquiryService.sendMessage(messageModal.enquiryIdForSeller, text, `c${Date.now()}`);
      // Fetch messages from the SAME row we posted to — this avoids the
      // 304 stale-cache problem where the buyer's own row hasn't changed
      const res = await enquiryService.listMessages(messageModal.enquiryIdForSeller);
      setMessages(Array.isArray(res?.messages) ? res.messages : []);
      scrollToBottomSoon();
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setMessageText(text);
      Alert.alert('Could not send', err.message || 'Please try again.');
    } finally {
      setModalSending(false);
    }
  };

  // ── Open Reply modal for a seller — blank form + load THIS seller's history only ──
  const openReplyModal = async (seller, sellerId, rowId) => {
    // Start BLANK — history above shows previous replies for reference
    setModalReplyForm({ rate: '', available_qty: '', timeline: '', remarks: '' });
    setReplyModal({ visible: true, seller, sellerId, enquiryIdForSeller: rowId });
    setReplyHistory([]);
    // Load history for THIS specific seller row only
    try {
      const res = await enquiryService.listReplyHistory(rowId);
      const list = res?.replies || res?.data?.replies || [];
      setReplyHistory(Array.isArray(list) ? list : []);
    } catch {
      setReplyHistory([]);
    }
  };

  // ── Send reply — saves to history for THIS seller only, never overwrites ──
  const sendReplyFromModal = async () => {
    if (!modalReplyForm.rate.trim()) {
      Alert.alert('Rate required', 'Enter your rate per unit before sending.');
      return;
    }
    setModalSending(true);
    try {
      const payload = {
        offered_price:      parseFloat(modalReplyForm.rate),
        available_quantity: modalReplyForm.available_qty ? parseFloat(modalReplyForm.available_qty) : undefined,
        delivery_timeline:  modalReplyForm.timeline,
        remarks:            modalReplyForm.remarks,
        unit:               enquiry?.unit || '',
      };
      // Save to history — new record every time, goes to THIS seller's row
      const saved = await enquiryService.createReplyHistory(replyModal.enquiryIdForSeller, payload);
      const newEntry = saved?.data || saved;
      // Append to history list immediately (optimistic)
      setReplyHistory(prev => [...(Array.isArray(prev) ? prev : []), newEntry]);
      // Clear form so next reply starts fresh
      setModalReplyForm({ rate: '', available_qty: '', timeline: '', remarks: '' });
      // Reload enquiry to update status shown on card
      load();
    } catch (err) {
      Alert.alert('Could not send', err.message || 'Please try again.');
    } finally {
      setModalSending(false);
    }
  };

  // ── Cancel offer (for replies section - not used in these modals) ──
  const cancelOffer = (seller, sellerId) => {
    Alert.alert(
      'Cancel negotiation?',
      `Reject the offer from ${seller?.name || 'this seller'}?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              // Find the offer for this seller and reject it
              const offer = offers.find(o => String(o.seller?.id) === String(sellerId));
              if (offer) {
                await enquiryService.respondToOffer(initialId, offer.id, 'reject');
                await load();
              }
            } catch (err) {
              Alert.alert('Could not cancel', err.message || 'Please try again.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSubmit = async () => {
    if (!form.rate) {
      Alert.alert('Rate required', 'Enter your rate per unit before sending.');
      return;
    }
    setSending(true);
    // Target the active row (a specific replier's row when the inline Reply
    // panel was opened from a reply card), falling back to the opened enquiry.
    const targetId = activeRowId || initialId;
    try {
      const payload = {
        offered_price: parseFloat(form.rate),
        available_quantity: form.available_qty ? parseFloat(form.available_qty) : undefined,
        delivery_timeline: form.timeline,
        remarks: form.remarks,
        unit: enquiry?.unit || '',
      };

      // 1) Store the reply in reply-history (this is what the inline panel shows).
      //    New record every time — never overwrites a previous reply.
      let newEntry = null;
      try {
        const saved = await enquiryService.createReplyHistory(targetId, payload);
        newEntry = saved?.data || saved;
      } catch (histErr) {
        // Non-fatal — the status update below still records the latest quote.
      }

      // 2) Update the enquiry itself (moves status to Replied + carries latest quote).
      await enquiryService.reply(targetId, {
        status: 'Replied',
        offered_price: parseFloat(form.rate),
        available_quantity: form.available_qty ? parseFloat(form.available_qty) : undefined,
        delivery_timeline: form.timeline,
        distributor_reply: form.remarks,
      });

      // 3) Reflect locally — append to history list and update the card.
      if (newEntry) {
        setReplyHistory(prev => [...(Array.isArray(prev) ? prev : []), newEntry]);
      } else {
        // Fall back to reloading the history from the server.
        enquiryService.listReplyHistory(targetId)
          .then(r => setReplyHistory(r?.replies || r?.data?.replies || []))
          .catch(() => {});
      }
      setEnquiry(prev => ({
        ...prev,
        status: 'Replied',
        accepted_offer_price: parseFloat(form.rate),
        available_quantity: form.available_qty ? parseFloat(form.available_qty) : prev?.available_quantity,
        delivery_timeline: form.timeline || prev?.delivery_timeline,
        distributor_reply: form.remarks || prev?.distributor_reply,
      }));

      // 4) Clear the form so the next reply starts fresh, keep the panel open
      //    so the user sees their reply land in the history above.
      setForm({ rate: '', available_qty: '', timeline: '', remarks: '' });
      Alert.alert('Sent', 'Your quote has been sent.');
    } catch (err) {
      Alert.alert('Could not send', err.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

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

  const code = enquiry.enquiry_code || initialId || 'Enquiry';
  const productName = enquiry.product?.name || enquiry.product_name || '—';
  const productCode = enquiry.product?.code || enquiry.product_code || '';
  const qty = enquiry.qty ?? enquiry.quantity;
  const unit = enquiry.unit || '';
  // RECEIVED vs raised. The retailer backend sets `is_recipient` (reliable) and
  // `direction` ('received' | 'raised'). Prefer `is_recipient`; if the payload
  // somehow lacks it, fall back to `direction`, then to the hint the list
  // passed. Anything that is a 'sent'/'raised' direction is NOT received.
  const isReceived =
    enquiry.is_recipient === true ? true :
    enquiry.is_recipient === false ? false :
    enquiry.direction ? (enquiry.direction === 'received') :
    routeDirection ? (routeDirection === 'received') :
    true;
  // ── Replies roster ──
  // The /replies endpoint returns the whole envelope:
  //   { data: { replied: [...], awaiting: [...], counts: {...} } }
  // We only care about who actually ANSWERED, so unwrap `replied`. Accept all
  // shapes (data.replied / replied / bare array) so cards render regardless.
  const repliedList = Array.isArray(replies?.data?.replied) ? replies.data.replied
    : Array.isArray(replies?.replied)   ? replies.replied
    : Array.isArray(replies?.data)      ? replies.data
    : Array.isArray(replies)            ? replies
    : [];
  // "SENT BY" = who raised this enquiry.
  //  • RECEIVED → the company that sent it to us (sender).
  //  • SENT     → US, the retailer. Pull our own business/contact from the
  //    backend's `created_by` block (filled from retailer_* even without a
  //    quotation). Previously this showed the recipient/seller name, which read
  //    as if the admin/seller had sent it.
  const partyName = isReceived
    ? (enquiry.sender?.name || enquiry.retailer_name || '—')
    : (enquiry.created_by?.company || enquiry.created_by?.name || enquiry.retailer_name || '—');
  const partyMobile = isReceived
    ? (enquiry.sender?.mobile || enquiry.retailer_mobile || '')
    : (enquiry.created_by?.mobile || enquiry.retailer_mobile || '');
  const partyEmail = isReceived
    ? (enquiry.sender?.email || enquiry.retailer_email || '')
    : (enquiry.created_by?.email || enquiry.retailer_email || '');
  const location = enquiry.location || enquiry.delivery_location || '';
  const remarks = enquiry.remarks || enquiry.notes || '';
  const proposed = enquiry.proposed_price ?? enquiry.accepted_offer_price ?? null;
  const isRecipient = enquiry.is_recipient === true;
  const isMarketplace = !isRecipient && !!(enquiry.buyer_company_id || enquiry.seller?.id || enquiry.seller?._id);
  const nextStatuses = STATUS_TRANSITIONS[enquiry.status] || [];
  const canWithdraw = !isRecipient && CANCELLABLE.includes(enquiry.status);
  const hasOrder = !!enquiry.order_id;
  const replyCtaLabel = isRecipient
    ? 'Reply with Availability & Price'
    : isMarketplace ? 'Send Offer' : 'Reply to Enquiry';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
      <TopBar code={code} onBack={() => navigation.goBack()} />

      {/* The chat composer and the reply form sit at the BOTTOM of this screen.
          Without a KeyboardAvoidingView the keyboard covers them and — because
          the panel is the last thing in the ScrollView — there is nothing left
          to scroll, so the input and Send button became unreachable. `padding`
          on iOS lifts the content above the keyboard; Android's default
          `adjustResize` already shrinks the window, so it needs no behaviour. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollArea}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        >
        {error ? (
          <View style={styles.inlineError}>
            <Ionicons name="alert-circle" size={15} color={Colors.error} />
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        ) : null}

        {/* ══ CRM-style detail card ══ */}
        <View style={styles.detailCard}>

          {/* ── Orange header: code + date + status ── */}
          <View style={styles.detailCardHeader}>
            <View>
              <Text style={styles.detailCardLabel}>ENQUIRY CODE</Text>
              <Text style={styles.detailCardCode}>{code}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={styles.detailCardDate}>{formatDate(enquiry.created_at)}</Text>
              <View style={[styles.statusChip, { backgroundColor: (STATUS_META[enquiry.status] || STATUS_META.New).chipBg }]}>
                <Text style={[styles.statusChipText, { color: (STATUS_META[enquiry.status] || STATUS_META.New).chipText }]}>
                  {enquiry.status || 'New'}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Sent By ── */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionLabel}>SENT BY</Text>
            <Text style={styles.detailSenderName}>{partyName}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
              {partyMobile ? (
                <View style={styles.detailContact}>
                  <Ionicons name="call-outline" size={12} color={Colors.textSecondary} />
                  <Text style={styles.detailContactText}>{partyMobile}</Text>
                </View>
              ) : null}
              {partyEmail ? (
                <View style={styles.detailContact}>
                  <Ionicons name="mail-outline" size={12} color={Colors.textSecondary} />
                  <Text style={styles.detailContactText}>{partyEmail}</Text>
                </View>
              ) : null}
            </View>
            {location ? (
              <View style={[styles.detailContact, { marginTop: 4 }]}>
                <Ionicons name="location-outline" size={12} color={Colors.textSecondary} />
                <Text style={styles.detailContactText}>{location}</Text>
              </View>
            ) : null}
          </View>

          {/* ── Sent To ──
              Only for a SINGLE-SELLER enquiry we raised. A BROADCAST goes to
              many recipients, so naming one ("EzyEnquiry Admin") is misleading —
              the wholesaler app hides this for broadcasts and shows the recipients
              in the Replies section instead. So suppress it whenever this is a
              broadcast (has broadcast_audience). */}
          {!isReceived && !enquiry.broadcast_audience && enquiry.seller?.name ? (
            <View style={[styles.detailSection, { backgroundColor: '#fafafa' }]}>
              <Text style={styles.detailSectionLabel}>SENT TO</Text>
              <Text style={styles.detailSenderName}>{enquiry.seller.name}</Text>
              {(enquiry.seller?.city || enquiry.seller?.state) ? (
                <View style={[styles.detailContact, { marginTop: 4 }]}>
                  <Ionicons name="location-outline" size={12} color={Colors.textSecondary} />
                  <Text style={styles.detailContactText}>
                    {[enquiry.seller.city, enquiry.seller.state].filter(Boolean).join(', ')}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* ── Enquiry Details: Product · Qty · Budget ── */}
          <View style={[styles.detailSection, { backgroundColor: '#fafafa' }]}>
            <Text style={styles.detailSectionLabel}>ENQUIRY DETAILS</Text>
            <View style={{ flexDirection: 'row', gap: 0, marginTop: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailFieldLabel}>Product</Text>
                <Text style={styles.detailFieldValue}>{productName}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailFieldLabel}>Quantity</Text>
                <Text style={styles.detailFieldValue}>{qty ?? '—'} {unit}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailFieldLabel}>Budget</Text>
                <Text style={styles.detailFieldValue}>
                  {proposed ? formatCurrency(proposed) : 'Flexible'}
                </Text>
              </View>
            </View>

            {/* Specifications — parsed from remarks */}
            {remarks ? (
              <View style={styles.specsBox}>
                <Text style={styles.detailSectionLabel}>SPECIFICATIONS</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                  {remarks.split('\n').filter(l => l.includes(':')).map((line, i) => {
                    const colonIdx = line.indexOf(':');
                    const label = line.slice(0, colonIdx).trim();
                    const value = line.slice(colonIdx + 1).trim();
                    return (
                      <View key={i} style={styles.specItem}>
                        <Text style={styles.specLabel}>{label}: </Text>
                        <Text style={styles.specValue}>{value}</Text>
                      </View>
                    );
                  })}
                  {!remarks.includes(':') ? (
                    <Text style={styles.specValue}>{remarks}</Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* ══ Replies section (who answered a SENT enquiry) ══
            One ReplyCard per replier. Each card targets THAT replier's own row
            id so the chat / reply history opened from it stays scoped to that
            one party. Rendered BEFORE the shared action row so the cards carry
            the per-replier actions. */}
        {repliedList.length > 0 ? (
          <Section title={`Replies (${repliedList.length})`}>
            {repliedList.map((reply, idx) => {
              const rowId = reply.id || reply._id || initialId;
              return (
                <ReplyCard
                  key={rowId || idx}
                  reply={reply}
                  enquiryId={rowId}
                  onReply={() => {
                    // Open the inline Reply panel (handleSubmit posts to the
                    // active row) scoped to THIS replier's row + history.
                    setMessageModal({ visible: false, seller: null, sellerId: null, enquiryIdForSeller: null });
                    setActiveRowId(rowId);
                    setForm({ rate: '', available_qty: '', timeline: '', remarks: '' });
                    setShowReply(true);
                    enquiryService.listReplyHistory(rowId)
                      .then(r => setReplyHistory(r?.replies || r?.data?.replies || []))
                      .catch(() => setReplyHistory([]));
                    scrollToBottomSoon();
                  }}
                  onMessage={() => {
                    // Open the inline Message panel scoped to THIS replier's row
                    // via the existing per-seller modal plumbing.
                    setShowReply(false);
                    setActiveRowId(rowId);
                    openMessageModal(reply.company || null, reply.company?.id || reply.company?._id || null, rowId);
                    scrollToBottomSoon();
                  }}
                  onReload={load}
                />
              );
            })}
          </Section>
        ) : null}

        {/* ══ 3 CRM-style action buttons ══
            Shown for RECEIVED enquiries only — those were sent TO us and we must
            reply. On a SENT enquiry WE raised, the sellers reply (their quotes
            appear in the roster), so the Message/Reply/Cancel row is hidden.
            Hidden too the moment reply cards exist: THEY carry the actions, so
            this shared row would duplicate them. */}
        {(() => {
          const isCancelled = enquiry.status === 'Cancelled';
          const isConfirmed = enquiry.status === 'Confirmed';
          const canAct    = !isCancelled;
          const canCancel = !isCancelled && !isConfirmed;
          // Show the shared Message/Reply/Cancel row ONLY when there are no reply
          // cards: a RECEIVED enquiry we must answer with nobody having replied
          // yet. The moment reply cards exist, THEY carry the actions, so this
          // shared row would duplicate them — hide it. The inline Message/Reply
          // panels still render (they open from the cards too).
          const showSharedActions = isReceived && repliedList.length === 0;
          return (
            <>
              {showSharedActions ? (
              <View style={styles.crmActions}>
                {/* Message */}
                <TouchableOpacity
                  style={[styles.crmBtn, styles.crmBtnOrange, !canAct && styles.crmBtnDisabled]}
                  onPress={() => {
                    if (!canAct) return;
                    setShowReply(false);
                    setActiveRowId(initialId);
                    const willOpen = !messageModal.visible;
                    setMessageModal(prev => ({ visible: !prev.visible, seller: null, sellerId: null, enquiryIdForSeller: initialId }));
                    if (willOpen) {
                      enquiryService.listMessages(initialId)
                        .then(r => setMessages(Array.isArray(r?.messages) ? r.messages : []))
                        .catch(() => setMessages([]));
                      scrollToBottomSoon();
                    }
                  }}
                  activeOpacity={canAct ? 0.8 : 1}
                >
                  <Ionicons name="chatbubble-outline" size={14} color="#FFF" />
                  <Text style={styles.crmBtnText}>Message</Text>
                </TouchableOpacity>

                {/* Reply */}
                <TouchableOpacity
                  style={[styles.crmBtn, styles.crmBtnOrange, !canAct && styles.crmBtnDisabled]}
                  onPress={() => {
                    if (!canAct) return;
                    setMessageModal({ visible: false, seller: null, sellerId: null, enquiryIdForSeller: null });
                    setActiveRowId(initialId);
                    const willOpen = !showReply;
                    setShowReply(willOpen);
                    if (willOpen) {
                      enquiryService.listReplyHistory(initialId)
                        .then(r => setReplyHistory(r?.replies || r?.data?.replies || []))
                        .catch(() => setReplyHistory([]));
                      scrollToBottomSoon();
                    }
                  }}
                  activeOpacity={canAct ? 0.8 : 1}
                >
                  <Ionicons name="return-down-forward-outline" size={14} color="#FFF" />
                  <Text style={styles.crmBtnText}>Reply</Text>
                </TouchableOpacity>

                {/* Cancel */}
                <TouchableOpacity
                  style={[styles.crmBtn, styles.crmBtnRed, !canCancel && styles.crmBtnDisabledRed]}
                  onPress={() => {
                    if (!canCancel) return;
                    Alert.alert(
                      'Cancel enquiry?',
                      'This cannot be undone.',
                      [
                        { text: 'Keep', style: 'cancel' },
                        { text: 'Cancel', style: 'destructive', onPress: () => changeStatus('Cancelled') },
                      ]
                    );
                  }}
                  activeOpacity={canCancel ? 0.8 : 1}
                >
                  <Ionicons name="ban-outline" size={14} color={canCancel ? '#FFF' : '#ef4444'} />
                  <Text style={[styles.crmBtnText, !canCancel && { color: '#ef4444' }]}>
                    {isCancelled ? 'Cancelled' : isConfirmed ? 'Confirmed' : 'Cancel'}
                  </Text>
                </TouchableOpacity>
              </View>
              ) : null}

              {/* ── Inline Message panel ── */}
              {messageModal.visible ? (
                <View style={styles.inlinePanel}>
                  <View style={styles.inlinePanelHeader}>
                    <Ionicons name="chatbubbles-outline" size={14} color="#FFF" />
                    <Text style={styles.inlinePanelTitle}>
                      Chat with {messageModal.seller?.name || partyName}
                    </Text>
                    <TouchableOpacity onPress={() => setMessageModal({ visible: false, seller: null, sellerId: null, enquiryIdForSeller: null })}>
                      <Ionicons name="close" size={16} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    ref={chatScrollRef}
                    style={styles.inlineChatBody}
                    contentContainerStyle={styles.inlineChatBodyContent}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: false })}
                  >
                    {messages.length === 0 ? (
                      <View style={styles.threadEmpty}>
                        <Ionicons name="chatbubbles-outline" size={28} color="#ccc" />
                        <Text style={styles.threadEmptyText}>No messages yet.{'\n'}Start the conversation below.</Text>
                      </View>
                    ) : (
                      messages.map((m, i) => {
                        // "Mine" = sent by THIS logged-in user. The backend tags
                        // the retailer's own messages as sender_side 'buyer' even
                        // on a received enquiry, so comparing the sender user id is
                        // the only reliable way to split my bubbles from theirs.
                        const myUserId  = String(user?._id || user?.id || '');
                        const msgSender = String(m.sender?.id || m.sender_user_id || '');
                        const mine = m.__pending
                          || (myUserId && msgSender && myUserId === msgSender);
                        const time = m.created_at
                          ? new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                          : '';
                        const senderName = mine
                          ? 'You'
                          : (m.sender?.name || partyName);
                        return (
                          <View key={m.id || i} style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
                            <Text style={{ fontSize: 10, color: '#888', marginBottom: 2, paddingHorizontal: 4 }}>
                              {senderName}
                            </Text>
                            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, m.__pending && { opacity: 0.6 }]}>
                              <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.message}</Text>
                              <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{time}{m.__pending ? ' · sending…' : ''}</Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </ScrollView>
                  <View style={styles.inlineChatInput}>
                    <TextInput
                      style={styles.inlineMsgInput}
                      placeholder="Type a message…"
                      placeholderTextColor={Colors.textTertiary}
                      value={messageText}
                      onChangeText={setMessageText}
                      multiline
                      returnKeyType="send"
                      blurOnSubmit={false}
                      onSubmitEditing={() => { if (messageText.trim()) sendMessageFromModal(); }}
                    />
                    <TouchableOpacity
                      style={[styles.inlineSendBtn, (!messageText.trim() || modalSending) && styles.msgSendDisabled]}
                      onPress={sendMessageFromModal}
                      disabled={!messageText.trim() || modalSending}
                      activeOpacity={0.8}
                    >
                      {modalSending
                        ? <ActivityIndicator size="small" color="#FFF" />
                        : <Ionicons name="send" size={16} color="#FFF" />}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* ── Inline Reply panel ── */}
              {showReply ? (
                <View style={styles.inlinePanel}>
                  <View style={styles.inlinePanelHeader}>
                    <Ionicons name="return-down-forward-outline" size={14} color="#FFF" />
                    <Text style={styles.inlinePanelTitle}>Reply with Availability & Price</Text>
                    <TouchableOpacity onPress={() => setShowReply(false)}>
                      <Ionicons name="close" size={16} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                  <View style={{ padding: Spacing.base }}>
                    {/* Reply history */}
                    {replyHistory.length > 0 ? (
                      <View style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Your Reply History ({replyHistory.length})
                          </Text>
                        </View>
                        {replyHistory.map((h, i) => (
                          <View key={h.id || i} style={{
                            backgroundColor: '#fff', borderRadius: 10,
                            borderWidth: i === replyHistory.length - 1 ? 2 : 1,
                            borderColor: i === replyHistory.length - 1 ? Colors.primary : '#e2e8f0',
                            padding: 10, marginBottom: 8,
                          }}>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 4 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="pricetag-outline" size={12} color={Colors.primary} />
                                <Text style={{ fontSize: 15, fontWeight: '800', color: Colors.primary }}>{formatCurrency(h.offered_price)}</Text>
                              </View>
                              {h.available_quantity != null && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Ionicons name="cube-outline" size={11} color={Colors.textSecondary} />
                                  <Text style={{ fontSize: 12, color: '#64748b' }}>{h.available_quantity} {h.unit || ''}</Text>
                                </View>
                              )}
                            </View>
                            {h.delivery_timeline ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                                <Ionicons name="time-outline" size={11} color={Colors.textSecondary} />
                                <Text style={{ fontSize: 12, color: '#64748b' }}>{h.delivery_timeline}</Text>
                              </View>
                            ) : null}
                            {h.remarks ? <Text style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginBottom: 4 }}>"{h.remarks}"</Text> : null}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                              <Text style={{ fontSize: 10, color: '#94a3b8' }}>
                                {h.sender_name || 'You'} · {h.created_at ? new Date(h.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                              </Text>
                              {i === replyHistory.length - 1 && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#dcfce7', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                                  <Ionicons name="checkmark-circle-outline" size={10} color="#16a34a" />
                                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#16a34a' }}>Latest</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {/* New reply form */}
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
                      title={sending ? 'SENDING…' : `SEND REPLY${replyHistory.length > 0 ? ` #${replyHistory.length + 1}` : ''}`}
                      onPress={handleSubmit}
                      loading={sending}
                      variant="primary"
                      size="lg"
                      style={{ marginTop: Spacing.md }}
                    />
                  </View>
                </View>
              ) : null}

              {/* Order button if confirmed */}
              {hasOrder ? (
                <View style={{ marginTop: 12 }}>
                  <PrimaryButton
                    title="VIEW SALES ORDER"
                    onPress={() => navigation.navigate(SCREENS.ORDER_DETAILS, { orderId: enquiry.order_id })}
                    variant="primary"
                    size="lg"
                  />
                </View>
              ) : null}
            </>
          );
        })()}

      </ScrollView>
      </KeyboardAvoidingView>
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
    <View style={styles.sectionContent}>{children}</View>
  </View>
);

// ── Reply card component ──
// One card per replier on a SENT enquiry: who replied (name, phone, city), a
// GREEN status chip (red only when Cancelled), the offer line (price / avail /
// delivery), their message, and 3 action buttons (Message, Reply, Cancel).
// Message/Reply are wired by the parent to the existing per-seller inline
// panels; Cancel marks THAT replier's row Cancelled and reloads.
const ReplyCard = ({ reply, enquiryId, onReply, onMessage, onReload }) => {
  // The /replies endpoint shapes each row as:
  //   { id, company: { name, mobile, city, state, email }, status,
  //     offered_price, available_quantity, delivery_timeline, message, responded_at }
  // Fall back to older flat shapes too so this works regardless.
  const company       = reply.company || null;
  const replyerName   = company?.name || reply.company_name || reply.retailer_name || reply.wholesaler_name || 'Unknown';
  const replierPhone  = company?.mobile || reply.mobile || reply.phone || '';
  const replierCity   = company?.city || reply.city || '';
  const offeredPrice  = reply.offered_price ?? reply.unit_price ?? null;
  const availQty      = reply.available_quantity ?? null;
  const deliveryTime  = reply.delivery_timeline || '';
  const replyMessage  = reply.message || reply.notes || reply.remarks || '';
  const replyStatus   = reply.status || '';
  const unit          = reply.unit || '';
  const respondedAt   = reply.responded_at || reply.created_at;
  const replyTime = respondedAt
    ? new Date(respondedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <View style={styles.replyCard}>
      {/* ── Header: Who replied ── */}
      <View style={styles.replyCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.replyCardName}>{replyerName}</Text>
          {replierPhone ? (
            <View style={styles.replyCardInfo}>
              <Ionicons name="call-outline" size={12} color={Colors.textTertiary} />
              <Text style={styles.replyCardInfoText}>{replierPhone}</Text>
            </View>
          ) : null}
          {replierCity ? (
            <View style={styles.replyCardInfo}>
              <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
              <Text style={styles.replyCardInfoText}>{replierCity}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {replyStatus ? (
            // A reply arriving is a positive signal — show it GREEN so a
            // Replied / Negotiation / Confirmed card reads at a glance as "they
            // answered". Only Cancelled stays red.
            <View style={[
              styles.replyCardStatusChip,
              replyStatus === 'Cancelled' ? styles.replyCardStatusChipRed : styles.replyCardStatusChipGreen,
            ]}>
              <Text style={[
                styles.replyCardStatusText,
                replyStatus === 'Cancelled' ? styles.replyCardStatusTextRed : styles.replyCardStatusTextGreen,
              ]}>{replyStatus}</Text>
            </View>
          ) : null}
          {replyTime ? <Text style={styles.replyCardTime}>{replyTime}</Text> : null}
        </View>
      </View>

      {/* ── Offer details (price / qty / delivery) ── */}
      {(offeredPrice != null || availQty != null || deliveryTime) ? (
        <View style={styles.replyCardOffer}>
          {offeredPrice != null ? (
            <View style={styles.replyCardOfferItem}>
              <Ionicons name="pricetag-outline" size={13} color={Colors.primary} />
              <Text style={styles.replyCardPrice}>{formatCurrency(offeredPrice)}{unit ? ` / ${unit}` : ''}</Text>
            </View>
          ) : null}
          {availQty != null ? (
            <View style={styles.replyCardOfferItem}>
              <Ionicons name="cube-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.replyCardOfferText}>Avail: {availQty} {unit}</Text>
            </View>
          ) : null}
          {deliveryTime ? (
            <View style={styles.replyCardOfferItem}>
              <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.replyCardOfferText}>{deliveryTime}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── Message body ── */}
      {replyMessage ? (
        <View style={styles.replyCardMessage}>
          <Text style={styles.replyCardMessageText}>{replyMessage}</Text>
        </View>
      ) : null}

      {/* ── Action buttons: Message, Reply, Cancel ── */}
      <View style={styles.replyCardActions}>
        <TouchableOpacity
          style={[styles.replyCardBtn, styles.replyCardBtnOrange]}
          onPress={onMessage}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-outline" size={14} color="#FFF" />
          <Text style={styles.replyCardBtnText}>Message</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.replyCardBtn, styles.replyCardBtnOrange]}
          onPress={onReply}
          activeOpacity={0.8}
        >
          <Ionicons name="return-down-forward-outline" size={14} color="#FFF" />
          <Text style={styles.replyCardBtnText}>Reply</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.replyCardBtn, styles.replyCardBtnRed]}
          onPress={() => {
            Alert.alert(
              'Cancel this enquiry?',
              'This enquiry will be marked as Cancelled.',
              [
                { text: 'Keep', style: 'cancel' },
                { text: 'Cancel', style: 'destructive', onPress: async () => {
                  try {
                    await enquiryService.update(enquiryId, { status: 'Cancelled' });
                    onReload?.();
                  } catch (err) {
                    Alert.alert('Error', err.message || 'Could not cancel.');
                  }
                }}
              ]
            );
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="close-circle-outline" size={14} color="#FFF" />
          <Text style={styles.replyCardBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

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
  flex: { flex: 1 },
  scrollArea: { flex: 1, backgroundColor: Colors.background },
  // Generous bottom padding so the last interactive element (the chat
  // composer / reply form at the end of the page) can always be scrolled clear
  // of the keyboard — 40 left it flush against the keyboard edge.
  scroll: { padding: Spacing.base, paddingBottom: 120 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorText: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  retryText: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.screenPadding, paddingTop: 8, paddingBottom: 10,
  },
  backBtn: { width: 32, height: 32, alignItems: 'flex-start', justifyContent: 'center' },
  topBarTitle: { ...Typography.h5, color: '#FFF', fontWeight: '700', flex: 1, textAlign: 'center' },

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

  /* ── Seller reply cards with action buttons ── */
  sellerCard: {
    backgroundColor: Colors.background, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  sellerHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sellerInfo: { flex: 1 },
  sellerName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  sellerMeta: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  sellerRight: { alignItems: 'flex-end', minWidth: 70 },
  sellerPrice: { fontSize: 14, fontWeight: '800', color: Colors.success },
  sellerAvail: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  sellerDetails: { marginVertical: 6 },
  sellerDetail: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  sellerRemarks: { fontSize: 12, color: Colors.textPrimary, marginVertical: 6, fontStyle: 'italic' },
  sellerTimeline: { fontSize: 11, color: Colors.textSecondary, marginBottom: 8 },
  sellerActions: { flexDirection: 'row', gap: 6, marginTop: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: BorderRadius.md },
  actionBtnMessage: { backgroundColor: Colors.primary },
  actionBtnReply: { backgroundColor: Colors.secondary },
  actionBtnCancel: { backgroundColor: Colors.error },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText: { color: '#FFF', fontWeight: '700', fontSize: 11.5 },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.base },
  inlineError: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: Colors.errorBg, borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: 10 },
  inlineErrorText: { ...Typography.caption, color: Colors.error, flex: 1 },

  actionsCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, marginTop: 10, ...Shadows.sm },
  mb10: { marginBottom: 10 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.md, backgroundColor: Colors.primary },
  statusConfirmed: { backgroundColor: Colors.secondary },
  statusCancelled: { backgroundColor: Colors.error },
  statusBtnText: { color: '#FFF', fontWeight: '600', fontSize: 13 },

  replyFormSection: { marginTop: 10 },
  fieldWrap: { marginTop: Spacing.md },
  fieldLabel: { ...Typography.caption, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 },
  fieldInput: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.textPrimary },
  fieldInputMulti: { minHeight: 80, textAlignVertical: 'top' },

  /* ── Modals ── */
  modalSafe: { flex: 1, backgroundColor: Colors.white },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.secondary, paddingHorizontal: Spacing.base, paddingVertical: 10 },
  modalTitle: { ...Typography.h5, color: '#FFF', fontWeight: '700', textAlign: 'center' },
  modalSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 1 },
  modalThread: { flex: 1, paddingHorizontal: Spacing.base, paddingVertical: 10 },
  modalScroll: { flex: 1 },
  modalScrollContent: { padding: Spacing.base, paddingBottom: 40 },
  threadEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  threadEmptyText: { fontSize: 13, color: Colors.textTertiary, textAlign: 'center' },
  bubble: { maxWidth: '82%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  bubbleMine: { backgroundColor: Colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: Colors.borderLight, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 13.5, color: Colors.textPrimary, lineHeight: 19 },
  bubbleTextMine: { color: '#FFF' },
  bubbleTime: { fontSize: 10, color: Colors.textSecondary, marginTop: 3 },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  modalInput: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: Spacing.base, paddingVertical: 10, backgroundColor: Colors.background },
  msgInput: { flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Colors.textPrimary, maxHeight: 100, borderWidth: 1, borderColor: Colors.border },
  msgSend: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  msgSendDisabled: { opacity: 0.5 },

  /* ── CRM-style detail card ── */
  detailCard: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 },
  detailCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14,
    backgroundColor: '#f97316',
  },
  detailCardLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  detailCardCode:  { fontSize: 15, fontWeight: '800', color: '#fff' },
  detailCardDate:  { fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  statusChip: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  detailSection: { padding: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#fff' },
  detailSectionLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  detailSenderName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  detailContact: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailContactText: { fontSize: 12, color: '#64748b' },
  sentToHint: { fontSize: 11, color: '#f97316', fontWeight: '700', marginTop: 6 },
  detailFieldLabel: { fontSize: 10, color: '#94a3b8', marginBottom: 3 },
  detailFieldValue: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  specsBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  specItem: { flexDirection: 'row', width: '50%', marginBottom: 4 },
  specLabel: { fontSize: 12, color: '#94a3b8' },
  specValue: { fontSize: 12, fontWeight: '600', color: '#334155', flex: 1 },

  /* ── 3 CRM action buttons ── */
  crmActions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  crmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderRadius: 8 },
  crmBtnOrange: { backgroundColor: '#f97316' },
  crmBtnRed: { backgroundColor: '#ef4444' },
  crmBtnDisabled: { backgroundColor: '#f97316', opacity: 0.45 },
  crmBtnDisabledRed: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#ef4444' },
  crmBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  /* ── Inline Message / Reply panels ── */
  inlinePanel: { borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: '#f97316', marginBottom: 14 },
  inlinePanelHeader: { backgroundColor: '#f97316', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  inlinePanelTitle: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 13 },
  inlineChatBody: { minHeight: 180, maxHeight: 260, backgroundColor: '#f8fafc' },
  // Padding lives on the CONTENT so the inner scroll can breathe (a ScrollView's
  // own padding is applied outside the scrollable area and would clip bubbles).
  inlineChatBodyContent: { padding: 12, flexGrow: 1 },
  inlineChatInput: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, backgroundColor: Colors.background },
  inlineMsgInput: { flex: 1, backgroundColor: Colors.white, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, color: Colors.textPrimary, maxHeight: 80, borderWidth: 1, borderColor: Colors.border },
  inlineSendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },

  /* ── Section content wrapper (used by the Replies section) ── */
  sectionContent: { gap: 10 },

  /* ── Reply card (per-replier on a SENT enquiry) ── */
  replyCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
    ...Shadows.sm,
  },
  replyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  replyCardName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  replyCardInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  replyCardInfoText: { fontSize: 11, color: Colors.textTertiary },
  replyCardTime: { fontSize: 10, color: Colors.textTertiary, marginTop: 4 },
  replyCardStatusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  replyCardStatusChipGreen: { backgroundColor: '#DCFCE7' },
  replyCardStatusChipRed:   { backgroundColor: '#FEE2E2' },
  replyCardStatusText: { fontSize: 10, fontWeight: '700' },
  replyCardStatusTextGreen: { color: '#16a34a' },
  replyCardStatusTextRed:   { color: '#DC2626' },
  replyCardOffer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  replyCardOfferItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  replyCardPrice: { fontSize: 15, fontWeight: '800', color: Colors.primary },
  replyCardOfferText: { fontSize: 12, color: Colors.textSecondary },
  replyCardMessage: { backgroundColor: Colors.primaryBg, borderRadius: 8, padding: 10, marginBottom: 12 },
  replyCardMessageText: { fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
  replyCardActions: { flexDirection: 'row', gap: 8 },
  replyCardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  replyCardBtnOrange: { backgroundColor: '#f97316' },
  replyCardBtnRed: { backgroundColor: '#ef4444' },
  replyCardBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
});
