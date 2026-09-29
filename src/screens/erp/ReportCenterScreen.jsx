/**
 * src/screens/erp/ReportCenterScreen.jsx  (Retailer app)
 *
 * Report Center — a launcher that mirrors the wholesaler's ReportCenterScreen
 * design: one card per report, each with an icon, a "Tap to view" / "Export only"
 * subtitle, a chevron (when it opens a screen) and PDF / Excel export buttons.
 *
 * This matches the wholesaler's look while reusing the retailer's own icon set
 * (Ionicons) and colour palette, and routes each card to a screen that already
 * exists in the retailer app:
 *   Sales Report     → SCREENS.SALES_REPORT   (SalesReportScreen)
 *   Purchase Report  → SCREENS.PURCHASE_LIST  (PurchaseListScreen)
 *   Expense Report   → SCREENS.EXPENSE_REPORT (ExpenseReportScreen)
 *   Profit & Loss    → SCREENS.PROFIT_LOSS    (ProfitLossScreen)
 *   Business Analytics → SCREENS.ANALYTICS    (AnalyticsScreen)
 *   Inventory Report → SCREENS.INVENTORY      (InventoryScreen)
 *   Customer / Supplier → Export only (no dedicated report screen, as in the
 *                          wholesaler — the backend builds the export file).
 *
 * Export uses erpApi.reportExportUrl, which returns an authenticated download
 * URL (token in the query string, because Linking.openURL can't set a header).
 * The shared exportReport controller builds sales / purchases / expenses /
 * inventory; customer / supplier export returns a friendly error from the
 * backend (same limitation the wholesaler has) — surfaced via an Alert, never a crash.
 */
import React, { useCallback } from 'react';
import {
  Alert, Linking, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { SCREENS } from '../../constants';
import { erpApi } from '../../utils/api';
import { ErpHeader, ERP } from '../../components/erp';

const NAVY = Colors.secondary;

// Mirrors the wholesaler's REPORTS list — same eight entries, retailer icons.
const REPORTS = [
  { key: 'sales',      label: 'Sales Report',      icon: 'trending-up-outline', color: '#059669', bg: '#ECFDF5', screen: SCREENS.SALES_REPORT,  exportType: 'sales' },
  { key: 'purchases',  label: 'Purchase Report',   icon: 'cart-outline',        color: '#DC2626', bg: '#FEF2F2', screen: SCREENS.PURCHASE_LIST, exportType: 'purchases' },
  { key: 'expenses',   label: 'Expense Report',    icon: 'wallet-outline',      color: '#EA580C', bg: '#FFF7ED', screen: SCREENS.EXPENSE_REPORT, exportType: 'expenses' },
  { key: 'profit',     label: 'Profit & Loss',     icon: 'pie-chart-outline',   color: '#059669', bg: '#ECFDF5', screen: SCREENS.PROFIT_LOSS },
  { key: 'analytics',  label: 'Business Analytics', icon: 'stats-chart-outline', color: '#2563EB', bg: '#EFF6FF', screen: SCREENS.ANALYTICS },
  { key: 'customers',  label: 'Customer Report',   icon: 'people-outline',      color: '#7C3AED', bg: '#F5F3FF', exportType: 'customers' },
  { key: 'suppliers',  label: 'Supplier Report',   icon: 'business-outline',    color: '#0891B2', bg: '#ECFEFF', exportType: 'suppliers' },
  { key: 'inventory',  label: 'Inventory Report',  icon: 'cube-outline',        color: '#CA8A04', bg: '#FEFCE8', screen: SCREENS.INVENTORY,     exportType: 'inventory' },
];

export default function ReportCenterScreen({ navigation }) {
  const doExport = useCallback(async (typeParam, format) => {
    try {
      const url = await erpApi.reportExportUrl(typeParam, { format });
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
      else Alert.alert('Export', 'Could not open the download link.');
    } catch (e) {
      Alert.alert('Export failed', e?.message || 'Could not export the report.');
    }
  }, []);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {/* Blue OS status bar to match the navy ErpHeader. */}
      <StatusBar barStyle="light-content" backgroundColor={NAVY} translucent={false} />

      <ErpHeader
        title="Report Center"
        subtitle="Open a report or export it"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={st.hint}>Open a report, or export it as PDF / Excel.</Text>

        {REPORTS.map(r => (
          <View key={r.key} style={st.card}>
            <TouchableOpacity
              style={st.cardMain}
              activeOpacity={r.screen ? 0.75 : 1}
              onPress={() => (r.screen ? navigation.navigate(r.screen) : null)}>
              <View style={[st.iconWrap, { backgroundColor: r.bg }]}>
                <Ionicons name={r.icon} size={20} color={r.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.cardLabel}>{r.label}</Text>
                <Text style={st.cardSub}>{r.screen ? 'Tap to view' : 'Export only'}</Text>
              </View>
              {r.screen ? <Ionicons name="chevron-forward" size={18} color="#C7CCD6" /> : null}
            </TouchableOpacity>

            {r.exportType ? (
              <View style={st.exportRow}>
                <TouchableOpacity
                  style={[st.expBtn, { borderColor: '#DC2626' }]}
                  onPress={() => doExport(r.exportType, 'pdf')}
                  activeOpacity={0.8}>
                  <Ionicons name="download-outline" size={15} color="#DC2626" />
                  <Text style={[st.expTxt, { color: '#DC2626' }]}>PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.expBtn, { borderColor: '#059669' }]}
                  onPress={() => doExport(r.exportType, 'excel')}
                  activeOpacity={0.8}>
                  <Ionicons name="download-outline" size={15} color="#059669" />
                  <Text style={[st.expTxt, { color: '#059669' }]}>Excel</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ERP.bg },
  hint: { fontSize: 12.5, color: ERP.muted, marginBottom: 12 },

  card: {
    backgroundColor: '#FFF', borderRadius: 14, marginBottom: 10,
    borderWidth: 1, borderColor: ERP.border, overflow: 'hidden',
  },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 14.5, fontWeight: '700', color: ERP.text },
  cardSub: { fontSize: 11.5, color: ERP.muted, marginTop: 2 },

  exportRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingBottom: 12, paddingTop: 2 },
  expBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, backgroundColor: '#FFF',
  },
  expTxt: { fontSize: 12.5, fontWeight: '700' },
});
