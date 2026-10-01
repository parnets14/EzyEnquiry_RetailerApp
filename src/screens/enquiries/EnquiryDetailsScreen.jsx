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

const STATUS_TRANSITIONS = {
  New:         ['Viewed', 'Replied', 'Negotiation', 'Confirmed', 'Cancelled'],
  Viewed:      ['Replied', 'Negotiation', 'Confirmed', 'Cancelled'],
  Replied:     ['Negotiation', 'Confirmed', 'Cancelled'],
  Negotiation: ['Confirmed', 'Cancelled'],
};
const CANCELLABLE = ['New', 'Viewed', 'Replied', 'Negotiation'];

const STATUS_META = {
  New:         { chipBg: '#EFF6FF', chipText: '#2563EB' },
  Viewed:      { chipBg: '#F3F4F6', chipText: '#6B7280' },
  Replied:     { chipBg: '#FFF7ED', chipText: '#D97706' },
  Negotiation: { chipBg: '#F5F3FF', chipText: '#7C3AED' },
  Confirmed:   { chipBg: '#F0FDF4', chipText: '#059669' },
  Cancelled:   { chipBg: '#FEF2F2', chipText: '#DC2626' },
};

export default function EnquiryDetailsScreen({ navigation, route }) {
  const { user } = useAuth();
  const { enquiry: passedEnquiry, enquiryId } = route.params || {};
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
      setReplies(repliesRes.status === 'fulfilled' ? (repliesRes.value || null) : null);
      const historyList = historyRes?.status === 'fulfilled' ? (historyRes.value?.replies || historyRes.value?.data?.replies || []) : [];
      setReplyHistory(Array.isArray(historyList) ? historyList : []);

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
  }, [initialId]);

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
        const saved = await enquiryService.createReplyHistory(initialId, payload);
        newEntry = saved?.data || saved;
      } catch (histErr) {
        // Non-fatal — the status update below still records the latest quote.
      }

      // 2) Update the enquiry itself (moves status to Replied + carries latest quote).
      await enquiryService.reply(initialId, {
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
        enquiryService.listReplyHistory(initialId)
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
  const isReceived = enquiry.is_recipient === true;
  const partyName = isReceived
    ? (enquiry.sender?.name || '—')
    : (enquiry.customer?.name || enquiry.seller?.name || '—');
  const partyMobile = isReceived ? '' : (enquiry.customer?.mobile || enquiry.seller?.mobile || '');
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
              {(enquiry.sender?.mobile || enquiry.retailer_mobile) ? (
                <View style={styles.detailContact}>
                  <Ionicons name="call-outline" size={12} color={Colors.textSecondary} />
                  <Text style={styles.detailContactText}>{enquiry.sender?.mobile || enquiry.retailer_mobile}</Text>
                </View>
              ) : null}
              {(enquiry.sender?.email || enquiry.retailer_email) ? (
                <View style={styles.detailContact}>
                  <Ionicons name="mail-outline" size={12} color={Colors.textSecondary} />
                  <Text style={styles.detailContactText}>{enquiry.sender?.email || enquiry.retailer_email}</Text>
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

        {/* ══ 3 CRM-style action buttons ══ */}
        {(() => {
          const isCancelled = enquiry.status === 'Cancelled';
          const isConfirmed = enquiry.status === 'Confirmed';
          const canAct    = !isCancelled;
          const canCancel = !isCancelled && !isConfirmed;
          return (
            <>
              <View style={styles.crmActions}>
                {/* Message */}
                <TouchableOpacity
                  style={[styles.crmBtn, styles.crmBtnOrange, !canAct && styles.crmBtnDisabled]}
                  onPress={() => {
                    if (!canAct) return;
                    setShowReply(false);
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

              {/* ── Inline Message panel ── */}
              {messageModal.visible ? (
                <View style={styles.inlinePanel}>
                  <View style={styles.inlinePanelHeader}>
                    <Ionicons name="chatbubbles-outline" size={14} color="#FFF" />
                    <Text style={styles.inlinePanelTitle}>
                      Chat with {partyName}
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
});
