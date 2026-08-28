import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, StatusBar,
  ActivityIndicator, Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import AppHeader from '../../components/common/AppHeader';
import { formatDateTime } from '../../utils/formatters';
import { enquiryApi } from '../../utils/api';

export default function NegotiationScreen({ navigation, route }) {
  const { enquiryId, enquiry } = route.params || {};
  const resolvedId = enquiryId || enquiry?.id || enquiry?._raw?.id;
  const insets = useSafeAreaInsets();

  const [messages, setMessages]   = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState(false);
  const [error, setError]         = useState('');
  const flatListRef = useRef(null);

  const productName  = enquiry?.product?.name || enquiry?.productName || enquiry?._raw?.product?.name || '';
  const enquiryCode  = enquiry?.enquiry_code || enquiry?.enquiryId || enquiry?._raw?.enquiry_code || resolvedId || '';
  const qty          = enquiry?.qty || enquiry?.quantity || '';
  const unitLabel    = enquiry?.unit || '';
  const sellerName   = enquiry?.seller?.name || enquiry?._raw?.seller?.name || '';

  const loadMessages = useCallback(async () => {
    if (!resolvedId) return;
    setError('');
    try {
      const data = await enquiryApi.listMessages(resolvedId);
      setMessages(data?.messages || []);
    } catch (err) {
      setError(err.message || 'Could not load messages.');
    }
  }, [resolvedId]);

  useEffect(() => {
    (async () => { setLoading(true); await loadMessages(); setLoading(false); })();
  }, [loadMessages]);

  const scrollToEnd = () => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    Keyboard.dismiss();
    setSending(true);
    const clientId = `msg_${Date.now()}`;
    // Optimistic append
    const optimistic = {
      id: clientId,
      message: text,
      sender_side: 'buyer',
      sender: null,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setInputText('');
    scrollToEnd();
    try {
      const created = await enquiryApi.sendMessage(resolvedId, text, clientId);
      setMessages(prev => prev.map(m => m.id === clientId ? { ...m, id: created._id || created.id || clientId, _optimistic: false } : m));
    } catch (err) {
      setError(err.message || 'Could not send message.');
      setMessages(prev => prev.filter(m => m.id !== clientId));
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isBuyer = item.sender_side === 'buyer';
    return (
      <View style={[styles.msgRow, isBuyer ? styles.msgRowBuyer : styles.msgRowSeller]}>
        {!isBuyer && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.sender?.name?.charAt(0) || 'S'}</Text>
          </View>
        )}
        <View style={[styles.bubble, isBuyer ? styles.bubbleBuyer : styles.bubbleSeller]}>
          {!isBuyer && (
            <Text style={styles.senderName}>{item.sender?.name || sellerName || 'Seller'}</Text>
          )}
          <Text style={[styles.msgText, isBuyer && styles.msgTextBuyer]}>{item.message}</Text>
          <View style={styles.msgFooter}>
            {item._optimistic && <Ionicons name="time-outline" size={10} color="rgba(255,255,255,0.5)" />}
            <Text style={[styles.timestamp, isBuyer && styles.timestampBuyer]}>
              {formatDateTime(item.created_at)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <SafeAreaView style={styles.safeTop} edges={['top']}>
        <AppHeader
          title="Messages"
          subtitle={enquiryCode}
          showBack
          onBack={() => navigation.goBack()}
          centerTitle
        />

        {/* Enquiry context strip */}
        {(productName || qty) ? (
          <View style={styles.contextStrip}>
            <View style={styles.contextLeft}>
              <View style={styles.contextIcon}>
                <Ionicons name="chatbubbles" size={14} color={Colors.primary} />
              </View>
              <View style={styles.contextInfo}>
                {productName ? <Text style={styles.contextProduct} numberOfLines={1}>{productName}</Text> : null}
                <Text style={styles.contextMeta}>
                  {qty ? `${qty} ${unitLabel}` : ''}{sellerName ? ` · ${sellerName}` : ''}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Messages List */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.loadingText}>Loading messages…</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id || item._id || String(Math.random())}
            contentContainerStyle={[styles.msgList, { paddingBottom: 16 }]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToEnd}
            onLayout={scrollToEnd}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyMsg}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="chatbubble-ellipses-outline" size={40} color={Colors.border} />
                </View>
                <Text style={styles.emptyMsgTitle}>No messages yet</Text>
                <Text style={styles.emptyMsgText}>Send a message to start the conversation with the seller.</Text>
              </View>
            }
            renderItem={renderMessage}
          />
        )}

        {/* Error banner */}
        {error ? (
          <View style={styles.errorBar}>
            <Ionicons name="alert-circle" size={14} color={Colors.error} />
            <Text style={styles.errorBarText}>{error}</Text>
            <TouchableOpacity onPress={() => setError('')}>
              <Ionicons name="close" size={16} color={Colors.error} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Message Input Bar — stays above keyboard */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.messageInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type your message..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              maxLength={2000}
              editable={!sending}
              onFocus={scrollToEnd}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!inputText.trim() || sending}
              activeOpacity={0.8}
            >
              {sending ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Ionicons name="send" size={18} color={Colors.white} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  safeTop: { backgroundColor: Colors.white },
  flex: { flex: 1 },

  /* Context Strip */
  contextStrip: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  contextLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contextIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.primaryBg,
    alignItems: 'center', justifyContent: 'center',
  },
  contextInfo: { flex: 1 },
  contextProduct: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  contextMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },

  /* Loading */
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { fontSize: 13, color: Colors.textSecondary },

  /* Message List */
  msgList: { padding: 16, paddingTop: 12 },

  /* Empty State */
  emptyMsg: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyMsgTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  emptyMsgText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  /* Messages */
  msgRow: { flexDirection: 'row', marginBottom: 14, alignItems: 'flex-end' },
  msgRowBuyer: { justifyContent: 'flex-end' },
  msgRowSeller: { justifyContent: 'flex-start' },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.secondary,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8, flexShrink: 0,
  },
  avatarText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  bubble: {
    maxWidth: '78%', borderRadius: 18,
    padding: 12, paddingBottom: 8,
    ...Shadows.sm,
  },
  bubbleSeller: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  bubbleBuyer: {
    backgroundColor: Colors.secondary,
    borderBottomRightRadius: 4,
  },
  senderName: { fontSize: 11, color: Colors.primary, fontWeight: '700', marginBottom: 4 },
  msgText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 21 },
  msgTextBuyer: { color: Colors.white },
  msgFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, justifyContent: 'flex-end' },
  timestamp: { fontSize: 10, color: Colors.textTertiary },
  timestampBuyer: { color: 'rgba(255,255,255,0.5)' },

  /* Error */
  errorBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.errorBg, paddingHorizontal: 16, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: Colors.error + '30',
  },
  errorBarText: { fontSize: 12, color: Colors.error, flex: 1 },

  /* Input Bar */
  inputBar: {
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    paddingHorizontal: 12, paddingTop: 10,
    ...Shadows.lg,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
  },
  messageInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 22,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    fontSize: 14, color: Colors.textPrimary,
    maxHeight: 110, minHeight: 44,
    lineHeight: 20,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 1,
  },
  sendBtnDisabled: { backgroundColor: Colors.border },
});
