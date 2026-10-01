/**
 * src/screens/enquiries/CreateEnquiryScreen.jsx  (Retailer app)
 *
 * The retailer's "raise an enquiry" form, reached from the Enquiries tab (the
 * floating "＋ Enquiry" button and the empty-state button).
 *
 * ── Design rules, in the order the user gave them ───────────────────────────
 *   > "product details i want to enter in simple way i dont want nuber"
 *   > "i want product details screen in good way with more details with category"
 *   > "and have a specific seller remove and contact and sent to like remove"
 *   > "if i sent the enquery it should be go all wholealer , admin also"
 *
 * So:
 *   • The product section is PLAIN TEXT and now RICHER — product name, category,
 *     brand, size, finish, colour, grade and a free description. No catalogue
 *     picker, no codes, no HSN, no expected-rate number.
 *   • The optional "Have a specific seller?" picker is GONE.
 *   • The Contact section is GONE — the retailer's identity comes from the auth
 *     token server-side (`req.user.mobile` / `req.company`), so nothing is lost.
 *   • The "Sending to" card is GONE — the destination is no longer a choice to
 *     display, because every enquiry now goes to EVERYONE (see below).
 *
 * ── Where it goes ───────────────────────────────────────────────────────────
 * One enquiry is created PER RECIPIENT: every approved, active wholesaler
 * company plus the Admin company (`createFreeTextEnquiry` fans out). Each
 * recipient answers on its own copy, so replies arrive as separate threads the
 * retailer can compare. The response carries `recipients` (how many were sent),
 * which the success screen reports — the app never needs to guess the fan-out.
 *
 * Admin replies land in CRM → Market Management; wholesalers reply from their
 * own app. Both paths were unblocked the same day (a product-less enquiry could
 * not previously be answered at all).
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput as RNTextInput,
  KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadows } from '../../theme/spacing';
import PrimaryButton from '../../components/common/PrimaryButton';
import { enquiryService } from '../../services/enquiryService';
import { useAuth } from '../../hooks/useAuth';
import { navigateToTab } from '../../utils/navigation';
import { UNITS, SCREENS } from '../../constants';

export default function CreateEnquiryScreen({ navigation }) {
  const { user } = useAuth();
  const company = user?.company || {};

  // ── Product details (all free text) ───────────────────────────────────────
  const [productName, setProductName] = useState('');
  const [category, setCategory]       = useState('');
  const [brand, setBrand]             = useState('');
  const [size, setSize]               = useState('');
  const [finish, setFinish]           = useState('');
  const [colour, setColour]           = useState('');
  const [grade, setGrade]             = useState('');
  const [details, setDetails]         = useState('');

  // ── Requirement ───────────────────────────────────────────────────────────
  const [qty, setQty]           = useState('');
  const [unit, setUnit]         = useState('Boxes');
  const [location, setLocation] = useState(company.city || '');
  const [remarks, setRemarks]   = useState('');

  const [errors, setErrors]   = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(null);

  const scrollRef = useRef(null);

  const unitOptions = useMemo(
    () => [...new Set(UNITS.filter(Boolean).map(String))],
    [],
  );

  const clearError = (key) => setErrors(e => (e[key] ? { ...e, [key]: undefined } : e));

  const validate = () => {
    const next = {};
    if (!productName.trim()) next.productName = 'Enter the product name.';
    const n = Number(qty);
    if (!qty.trim()) next.qty = 'Enter a quantity.';
    else if (!Number.isFinite(n) || n <= 0) next.qty = 'Quantity must be greater than zero.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (sending) return;
    if (!validate()) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setSending(true);
    try {
      // No `product_id` → the backend takes the free-text branch and broadcasts
      // to every wholesaler + Admin. The extra spec fields are composed into the
      // enquiry's remarks server-side.
      const created = await enquiryService.create({
        product_name: productName.trim(),
        category: category.trim(),
        brand: brand.trim(),
        size: size.trim(),
        finish: finish.trim(),
        colour: colour.trim(),
        grade: grade.trim(),
        details: details.trim(),
        qty: Number(qty),
        unit,
        location: location.trim(),
        remarks: remarks.trim(),
      });
      setSent(created || {});
    } catch (err) {
      setErrors({ submit: err?.message || 'Could not send the enquiry. Please try again.' });
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSending(false);
    }
  };

  const openCreated = () => {
    const id = sent?.id || sent?._id;
    if (id) navigation.replace(SCREENS.ENQUIRY_DETAILS, { enquiryId: id });
    else navigation.goBack();
  };

  // This screen lives in the ROOT STACK while ENQUIRIES is a bottom-tab route.
  // React Navigation only bubbles UP, never down into a sibling child, so a plain
  // navigate(SCREENS.ENQUIRIES) from here would throw — the helper targets the
  // tab through its parent stack route instead.
  const goBack = () =>
    navigation.canGoBack() ? navigation.goBack() : navigateToTab(navigation, SCREENS.ENQUIRIES);

  // ── Success state ─────────────────────────────────────────────────────────
  if (sent) {
    const count = Number(sent.recipients) || 0;
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
        <View style={styles.navbar}>
          <View style={styles.navCircle1} />
          <View style={styles.navCircle2} />
          <View style={styles.navRow}>
            <View style={styles.navTitleWrap}>
              <Text style={styles.navTitle}>Enquiry Sent</Text>
              <Text style={styles.navSub}>Your request is on its way</Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.successWrap} showsVerticalScrollIndicator={false}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={40} color="#FFF" />
          </View>
          <Text style={styles.successTitle}>Enquiry submitted</Text>
          <Text style={styles.successMsg}>
            {count > 0
              ? `Sent to ${count} recipient${count === 1 ? '' : 's'} — wholesalers, retailers and the Admin team. `
              : 'Sent to all wholesalers, retailers and the Admin team. '}
            Replies will appear here as they come in.
          </Text>

          <View style={styles.successCard}>
            {sent.enquiry_code ? (
              <SuccessRow icon="pricetag-outline" label="Enquiry code" value={sent.enquiry_code} />
            ) : null}
            <SuccessRow
              icon="cube-outline"
              label="Product"
              value={sent.product?.name || productName || '—'}
            />
            {category.trim() ? (
              <SuccessRow icon="grid-outline" label="Category" value={category.trim()} />
            ) : null}
            <SuccessRow icon="calculator-outline" label="Quantity" value={`${qty} ${unit}`} />
            {location.trim() ? (
              <SuccessRow icon="location-outline" label="Location" value={location.trim()} last />
            ) : null}
          </View>

          <PrimaryButton title="View enquiry" onPress={openCreated} style={styles.successBtn} />
          <PrimaryButton
            title="Back to enquiries"
            variant="outline"
            onPress={goBack}
            style={styles.successBtnSecondary}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />

      <View style={styles.navbar}>
        <View style={styles.navCircle1} />
        <View style={styles.navCircle2} />
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.navIconBtn} onPress={goBack} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.navTitleWrap}>
            <Text style={styles.navTitle}>New Enquiry</Text>
            <Text style={styles.navSub}>Type the product details and send</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {errors.submit ? (
            <View style={styles.banner}>
              <Ionicons name="alert-circle" size={18} color={Colors.errorText} />
              <Text style={styles.bannerText}>{errors.submit}</Text>
            </View>
          ) : null}

          {/* ══════ 1 · Product details ══════ */}
          <Section
            step="1"
            title="Product details"
            hint="Just type what you need — no codes required."
          >
            <Field label="Product name" required error={errors.productName}>
              <RNTextInput
                style={[styles.fieldInput, errors.productName && styles.fieldInputError]}
                placeholder="e.g. Vitrified floor tile"
                placeholderTextColor={Colors.textTertiary}
                value={productName}
                onChangeText={t => { setProductName(t); clearError('productName'); }}
              />
            </Field>

            <Field label="Category" hint="e.g. Floor tiles, Wall tiles, Sanitaryware">
              <RNTextInput
                style={styles.fieldInput}
                placeholder="e.g. Floor tiles"
                placeholderTextColor={Colors.textTertiary}
                value={category}
                onChangeText={setCategory}
              />
            </Field>

            <FieldRow>
              <Field label="Brand" half>
                <RNTextInput
                  style={styles.fieldInput}
                  placeholder="e.g. Kajaria"
                  placeholderTextColor={Colors.textTertiary}
                  value={brand}
                  onChangeText={setBrand}
                />
              </Field>
              <Field label="Size" half>
                <RNTextInput
                  style={styles.fieldInput}
                  placeholder="e.g. 600 x 600 mm"
                  placeholderTextColor={Colors.textTertiary}
                  value={size}
                  onChangeText={setSize}
                />
              </Field>
            </FieldRow>

            <FieldRow>
              <Field label="Finish" half>
                <RNTextInput
                  style={styles.fieldInput}
                  placeholder="e.g. Glossy"
                  placeholderTextColor={Colors.textTertiary}
                  value={finish}
                  onChangeText={setFinish}
                />
              </Field>
              <Field label="Colour" half>
                <RNTextInput
                  style={styles.fieldInput}
                  placeholder="e.g. Ivory"
                  placeholderTextColor={Colors.textTertiary}
                  value={colour}
                  onChangeText={setColour}
                />
              </Field>
            </FieldRow>

            <Field label="Grade">
              <RNTextInput
                style={styles.fieldInput}
                placeholder="e.g. A"
                placeholderTextColor={Colors.textTertiary}
                value={grade}
                onChangeText={setGrade}
              />
            </Field>

            <Field
              label="More details"
              hint="Anything else the seller should know."
              last
            >
              <RNTextInput
                style={[styles.fieldInput, styles.multiline]}
                placeholder="e.g. Anti-skid surface, matte look, branded packing"
                placeholderTextColor={Colors.textTertiary}
                value={details}
                onChangeText={setDetails}
                multiline
                numberOfLines={3}
                maxLength={500}
                textAlignVertical="top"
              />
            </Field>
          </Section>

          {/* ══════ 2 · Your requirement ══════ */}
          <Section
            step="2"
            title="Your requirement"
            hint="Quantity is required — the rest helps the seller quote faster."
          >
            <Field label="Quantity" required error={errors.qty}>
              <RNTextInput
                style={[styles.fieldInput, errors.qty && styles.fieldInputError]}
                placeholder="e.g. 500"
                placeholderTextColor={Colors.textTertiary}
                value={qty}
                onChangeText={t => { setQty(t.replace(/[^0-9.]/g, '')); clearError('qty'); }}
                keyboardType="numeric"
              />
            </Field>

            <Field label="Unit">
              <View style={styles.chipRow}>
                {unitOptions.map(u => {
                  const active = u === unit;
                  return (
                    <TouchableOpacity
                      key={u}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setUnit(u)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{u}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>

            <Field label="Delivery location" hint="City / site where you need the material.">
              <RNTextInput
                style={styles.fieldInput}
                placeholder="e.g. Pune, Maharashtra"
                placeholderTextColor={Colors.textTertiary}
                value={location}
                onChangeText={setLocation}
              />
            </Field>

            <Field label="Notes" hint="Optional — delivery timeline or anything else." last>
              <RNTextInput
                style={[styles.fieldInput, styles.multiline]}
                placeholder="e.g. Need delivery within 2 weeks"
                placeholderTextColor={Colors.textTertiary}
                value={remarks}
                onChangeText={setRemarks}
                multiline
                numberOfLines={3}
                maxLength={1000}
                textAlignVertical="top"
              />
            </Field>
          </Section>

          {/* One-line destination note. NOT the old "Sending to" card (which
              resolved a single recipient and was removed on request) — now that
              every enquiry is broadcast, the retailer needs to know that up
              front rather than discovering it in the list afterwards. */}
          <View style={styles.noteStrip}>
            <Ionicons name="megaphone-outline" size={16} color="#185FA5" />
            <View style={styles.flex}>
              <Text style={styles.noteStripTitle}>Goes to every wholesaler, retailer and the Admin team</Text>
              <Text style={styles.noteStripText}>
                Each reply comes back as its own thread so you can compare quotes.
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            title="Send Enquiry"
            onPress={submit}
            loading={sending}
            disabled={sending}
            icon={<Ionicons name="paper-plane" size={17} color="#FFF" />}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const Section = ({ step, title, hint, children }) => (
  <View style={styles.section}>
    <View style={styles.sectionHead}>
      <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{step}</Text></View>
      <View style={styles.flex}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      </View>
    </View>
    <View style={styles.sectionBody}>{children}</View>
  </View>
);

// Two short fields side by side — keeps the (now longer) product section from
// turning into a tall single-column stack.
const FieldRow = ({ children }) => <View style={styles.fieldRow}>{children}</View>;

const Field = ({ label, required, error, hint, children, last, half }) => (
  <View style={[styles.field, last && styles.fieldLast, half && styles.fieldHalf]}>
    <Text style={styles.fieldLabel}>
      {label}{required ? <Text style={styles.fieldRequired}> *</Text> : null}
    </Text>
    {children}
    {error ? (
      <Text style={styles.errText}>{error}</Text>
    ) : hint ? (
      <Text style={styles.fieldHint}>{hint}</Text>
    ) : null}
  </View>
);

const SuccessRow = ({ icon, label, value, last }) => (
  <View style={[styles.successRow, last && styles.successRowLast]}>
    <Ionicons name={icon} size={15} color={Colors.textTertiary} />
    <Text style={styles.successRowLabel}>{label}</Text>
    <Text style={styles.successRowValue} numberOfLines={1}>{value}</Text>
  </View>
);

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },

  /* ── Navbar ── */
  navbar: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.base,
    paddingTop: 12,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  navCircle1: {
    position: 'absolute', top: -30, right: -30,
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  navCircle2: {
    position: 'absolute', bottom: -20, left: -20,
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navTitleWrap: { flex: 1 },
  navTitle: { ...Typography.h4, fontWeight: '800', color: '#FFF', letterSpacing: 0.2 },
  navSub: { ...Typography.caption, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  navIconBtn: {
    width: 36, height: 36, borderRadius: BorderRadius.button,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },

  /* ── Scroll ── */
  scroll: { padding: Spacing.base, paddingBottom: 32 },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.errorBg, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: '#F5C6C0',
    padding: 12, marginBottom: Spacing.base,
  },
  bannerText: { ...Typography.caption, color: Colors.errorText, flex: 1, fontWeight: '600' },

  /* ── Section ── */
  section: { marginBottom: Spacing.base },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingHorizontal: 2 },
  stepBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  stepBadgeText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  sectionHint: { fontSize: 11, color: Colors.textTertiary, marginTop: 1 },

  sectionBody: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.card,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14,
    ...Shadows.sm,
  },

  /* ── Fields ── */
  field: { marginBottom: 14 },
  fieldLast: { marginBottom: 0 },
  fieldHalf: { flex: 1, marginBottom: 0 },
  fieldRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  fieldLabel: {
    fontSize: 10.5, fontWeight: '800', color: Colors.textSecondary,
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6,
  },
  fieldRequired: { color: Colors.error },
  fieldInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.input,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, color: Colors.textPrimary, minHeight: 46,
  },
  fieldInputError: { borderColor: Colors.error },
  multiline: { minHeight: 84, paddingTop: 11, paddingBottom: 11 },
  fieldHint: { fontSize: 10.5, color: Colors.textTertiary, marginTop: 5 },
  errText: { fontSize: 11, color: Colors.error, marginTop: 5, fontWeight: '600' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: 18, backgroundColor: Colors.background,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primaryBg, borderColor: Colors.primary },
  chipText: { fontSize: 12.5, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary, fontWeight: '800' },

  /* ── Destination note ── */
  noteStrip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.infoBg,
    borderRadius: BorderRadius.card,
    borderWidth: 1, borderColor: '#B5D4F4',
    padding: 12, marginTop: 2,
  },
  noteStripTitle: { fontSize: 12.5, fontWeight: '800', color: '#185FA5' },
  noteStripText: { fontSize: 11.5, color: '#378ADD', marginTop: 3, lineHeight: 16 },

  /* ── Footer ── */
  footer: {
    paddingHorizontal: Spacing.base, paddingTop: 10, paddingBottom: 12,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.border,
    ...Shadows.md,
  },

  /* ── Success ── */
  successWrap: { padding: Spacing.xl, alignItems: 'center' },
  successIcon: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.xl, marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  successTitle: { ...Typography.h3, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  successMsg: {
    ...Typography.body2, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 21, marginBottom: Spacing.xl,
  },
  successCard: {
    width: '100%', backgroundColor: Colors.white,
    borderRadius: BorderRadius.card, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, marginBottom: Spacing.lg, ...Shadows.sm,
  },
  successRow: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  successRowLast: { borderBottomWidth: 0 },
  successRowLabel: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  successRowValue: { fontSize: 12.5, fontWeight: '800', color: Colors.textPrimary, maxWidth: '58%', textAlign: 'right' },
  successBtn: { width: '100%' },
  successBtnSecondary: { width: '100%', marginTop: 10 },
});
