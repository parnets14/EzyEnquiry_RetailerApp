import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Shadows } from '../theme/spacing';
import { SCREENS } from '../constants';
import { setNavigationRef } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';

// Auth Screens
import SplashScreen from '../screens/auth/SplashScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import OTPScreen from '../screens/auth/OTPScreen';
import PendingApprovalScreen from '../screens/auth/PendingApprovalScreen';

// Main Tab Screens
import HomeScreen from '../screens/home/HomeScreen';
import SearchScreen from '../screens/products/SearchScreen';
import EnquiriesScreen from '../screens/enquiries/EnquiriesScreen';
import OrdersScreen from '../screens/orders/OrdersScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

// Product Screens
import ProductDetailsScreen from '../screens/products/ProductDetailsScreen';
import SearchResultsScreen from '../screens/products/SearchResultsScreen';
import AddProductScreen from '../screens/products/AddProductScreen';
import CategoriesBrandsScreen from '../screens/products/CategoriesBrandsScreen';
import MyProductsScreen from '../screens/products/MyProductsScreen';

// Enquiry Screens
import CreateEnquiryScreen from '../screens/enquiries/CreateEnquiryScreen';
import EnquirySuccessScreen from '../screens/enquiries/EnquirySuccessScreen';
import EnquiryDetailsScreen from '../screens/enquiries/EnquiryDetailsScreen';
import NegotiationScreen from '../screens/enquiries/NegotiationScreen';
import QuotationConfirmScreen from '../screens/enquiries/QuotationConfirmScreen';

// Order Screens
import OrderConfirmationScreen from '../screens/orders/OrderConfirmationScreen';
import OrderSuccessScreen from '../screens/orders/OrderSuccessScreen';
import OrderDetailsScreen from '../screens/orders/OrderDetailsScreen';
import OrderTrackingScreen from '../screens/orders/OrderTrackingScreen';
import DispatchDetailsScreen from '../screens/orders/DispatchDetailsScreen';
import DeliveryOTPScreen from '../screens/orders/DeliveryOTPScreen';

// Invoice Screens
import InvoicesScreen from '../screens/invoices/InvoicesScreen';
import InvoiceDetailsScreen from '../screens/invoices/InvoiceDetailsScreen';

// Quotation Screens
import QuotationsScreen from '../screens/quotations/QuotationsScreen';

// Notification Screen
import NotificationsScreen from '../screens/notifications/NotificationsScreen';

// Profile Screens
import CompanyDetailsScreen from '../screens/profile/CompanyDetailsScreen';
import DocumentsScreen from '../screens/profile/DocumentsScreen';
import SubscriptionScreen from '../screens/profile/SubscriptionScreen';
import {
  NotificationSettingsScreen,
  ChangePasswordScreen,
  HelpSupportScreen,
} from '../screens/profile/SettingsScreen';

// Staff Management Screens
import StaffListScreen    from '../screens/staff/StaffListScreen';
import AddEditStaffScreen from '../screens/staff/AddEditStaffScreen';

// ── ERP Screens (wholesaler parity) ──────────────────────────────────────────
import SalesListScreen    from '../screens/erp/SalesListScreen';
import SalesEntryScreen   from '../screens/erp/SalesEntryScreen';
import SalesReportScreen  from '../screens/erp/SalesReportScreen';
import ExpenseListScreen   from '../screens/erp/ExpenseListScreen';
import ExpenseEntryScreen  from '../screens/erp/ExpenseEntryScreen';
import ExpenseReportScreen from '../screens/erp/ExpenseReportScreen';
import ProfitLossScreen    from '../screens/erp/ProfitLossScreen';
import InventoryScreen     from '../screens/erp/InventoryScreen';
import StockAdjustScreen   from '../screens/erp/StockAdjustScreen';
import StockTransferScreen from '../screens/erp/StockTransferScreen';
import WarehouseListScreen from '../screens/erp/WarehouseListScreen';
import PurchaseListScreen  from '../screens/erp/PurchaseListScreen';
import PurchaseEntryScreen from '../screens/erp/PurchaseEntryScreen';
import SupplierListScreen  from '../screens/erp/SupplierListScreen';
import { PaymentReceivableScreen, PaymentPayableScreen } from '../screens/erp/PaymentListScreen';
import AccountsScreen      from '../screens/erp/AccountsScreen';
import PartyLedgerScreen   from '../screens/erp/PartyLedgerScreen';
import CustomerListScreen  from '../screens/erp/CustomerListScreen';
import LeadListScreen      from '../screens/erp/LeadListScreen';
import ReportCenterScreen  from '../screens/erp/ReportCenterScreen';
import AnalyticsScreen     from '../screens/erp/AnalyticsScreen';
import DispatchTrackingScreen from '../screens/erp/DispatchTrackingScreen';
import DispatchEntryScreen    from '../screens/erp/DispatchEntryScreen';
import DocumentRepositoryScreen from '../screens/erp/DocumentRepositoryScreen';

// ── Tools (client-side, no backend) ──────────────────────────────────────────
import StoneCalculationScreen from '../screens/tools/StoneCalculationScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ─── Tab Icons ─────────────────────────────────────────────────────────────────
const TAB_CONFIG = {
  HomeTab:             { icon: 'home-outline',           iconActive: 'home',             label: 'Home' },
  [SCREENS.SEARCH]:    { icon: 'search-outline',    iconActive: 'search',           label: 'Search' },
  [SCREENS.ENQUIRIES]: { icon: 'chatbubble-ellipses-outline', iconActive: 'chatbubble-ellipses', label: 'Enquiries' },
  [SCREENS.ORDERS]:    { icon: 'cube-outline',      iconActive: 'cube',             label: 'Orders' },
  [SCREENS.PROFILE]:   { icon: 'person-outline',    iconActive: 'person',           label: 'Profile' },
};

// ─── Custom Tab Bar ─────────────────────────────────────────────────────────────
const CustomTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const config = TAB_CONFIG[route.name] || { icon: 'ellipse-outline', iconActive: 'ellipse', label: route.name };

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabItem}
            onPress={onPress}
            activeOpacity={0.75}
          >
            <View style={[styles.tabIconWrap, isFocused && styles.tabIconWrapActive]}>
              <Ionicons
                name={isFocused ? config.iconActive : config.icon}
                size={22}
                color={isFocused ? Colors.primary : Colors.textTertiary}
              />
            </View>
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
              {config.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ─── Main Bottom Tabs ───────────────────────────────────────────────────────────
const MainTabs = () => (
  <Tab.Navigator
    tabBar={props => <CustomTabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="HomeTab"           component={HomeScreen} />
    <Tab.Screen name={SCREENS.SEARCH}    component={SearchScreen} />
    <Tab.Screen name={SCREENS.ENQUIRIES} component={EnquiriesScreen} />
    <Tab.Screen name={SCREENS.ORDERS}    component={OrdersScreen} />
    <Tab.Screen name={SCREENS.PROFILE}   component={ProfileScreen} />
  </Tab.Navigator>
);

// ─── Root Stack ─────────────────────────────────────────────────────────────────
export const navigationRef = React.createRef();

/**
 * Reactive auth gate.
 *
 * SplashScreen decides the initial route ONCE at startup, so it cannot react to
 * a session dying later (expired JWT → global 401 handler in `api.js` clears the
 * session and nulls the user). Without this, the app would stay on the
 * authenticated stack with a dead token and every request would fail with
 * "Invalid or expired token".
 *
 * When `user` transitions from set → null while the user is past the auth
 * screens, reset the stack to Login.
 */
function useSessionGate() {
  const { user } = useAuth();
  const wasLoggedIn = useRef(false);

  useEffect(() => {
    if (user) {
      wasLoggedIn.current = true;
      return;
    }
    // Only bounce if we were previously signed in — otherwise this would fight
    // the normal startup flow (Splash → Login) and the logout button itself.
    if (!wasLoggedIn.current) return;
    wasLoggedIn.current = false;

    const nav = navigationRef.current;
    if (!nav?.isReady?.()) return;

    const current = nav.getCurrentRoute?.()?.name;
    // Already on an auth screen (e.g. the user pressed Logout) — nothing to do.
    const AUTH_ROUTES = [
      SCREENS.SPLASH, SCREENS.LOGIN, SCREENS.REGISTER,
      SCREENS.OTP_VERIFY, SCREENS.PENDING_APPROVAL,
    ];
    if (AUTH_ROUTES.includes(current)) return;

    nav.reset({ index: 0, routes: [{ name: SCREENS.LOGIN }] });
  }, [user]);
}

const AppNavigator = React.forwardRef((props, ref) => {
  useSessionGate();
  return (
    <NavigationContainer ref={ref || navigationRef} onReady={() => setNavigationRef(ref || navigationRef)}>
    <Stack.Navigator
      initialRouteName={SCREENS.SPLASH}
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      {/* Auth */}
      <Stack.Screen name={SCREENS.SPLASH}          component={SplashScreen} />
      <Stack.Screen name={SCREENS.LOGIN}            component={LoginScreen} />
      <Stack.Screen name={SCREENS.REGISTER}         component={RegisterScreen} />
      <Stack.Screen name={SCREENS.OTP_VERIFY}       component={OTPScreen} />
      <Stack.Screen name={SCREENS.PENDING_APPROVAL} component={PendingApprovalScreen} options={{ gestureEnabled: false }} />

      {/* Main Tabs */}
      <Stack.Screen name={SCREENS.HOME} component={MainTabs} />

      {/* Products */}
      <Stack.Screen
        name={SCREENS.PRODUCT_DETAILS}
        component={ProductDetailsScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name={SCREENS.SEARCH_RESULTS}
        component={SearchResultsScreen}
      />
      <Stack.Screen
        name={SCREENS.CATEGORIES_BRANDS}
        component={CategoriesBrandsScreen}
      />
      <Stack.Screen
        name={SCREENS.ADD_PRODUCT}
        component={AddProductScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name={SCREENS.MY_PRODUCTS}
        component={MyProductsScreen}
      />

      {/* Enquiries */}
      <Stack.Screen name={SCREENS.CREATE_ENQUIRY}    component={CreateEnquiryScreen} />
      <Stack.Screen
        name={SCREENS.ENQUIRY_SUCCESS}
        component={EnquirySuccessScreen}
        options={{ animation: 'fade', gestureEnabled: false }}
      />
      <Stack.Screen name={SCREENS.ENQUIRY_DETAILS}  component={EnquiryDetailsScreen} />
      <Stack.Screen name={SCREENS.NEGOTIATION}      component={NegotiationScreen} />
      <Stack.Screen name={SCREENS.QUOTATION_CONFIRM} component={QuotationConfirmScreen} />

      {/* Orders */}
      <Stack.Screen name={SCREENS.ORDER_CONFIRMATION} component={OrderConfirmationScreen} />
      <Stack.Screen
        name={SCREENS.ORDER_SUCCESS}
        component={OrderSuccessScreen}
        options={{ animation: 'fade', gestureEnabled: false }}
      />
      <Stack.Screen name={SCREENS.ORDER_DETAILS}   component={OrderDetailsScreen} />
      <Stack.Screen name={SCREENS.ORDER_TRACKING}  component={OrderTrackingScreen} />
      <Stack.Screen name={SCREENS.DISPATCH_DETAILS} component={DispatchDetailsScreen} />
      <Stack.Screen name={SCREENS.DELIVERY_OTP}    component={DeliveryOTPScreen} />

      {/* Invoices & Payments */}
      <Stack.Screen name={SCREENS.INVOICES}         component={InvoicesScreen} />
      <Stack.Screen name={SCREENS.INVOICE_DETAILS}  component={InvoiceDetailsScreen} />

      {/* Quotations */}
      <Stack.Screen name={SCREENS.QUOTATIONS}       component={QuotationsScreen} />

      {/* Notifications */}
      <Stack.Screen name={SCREENS.NOTIFICATIONS}   component={NotificationsScreen} />

      {/* Profile */}
      <Stack.Screen name={SCREENS.COMPANY_DETAILS}        component={CompanyDetailsScreen} />
      <Stack.Screen name={SCREENS.DOCUMENTS}              component={DocumentsScreen} />
      <Stack.Screen name={SCREENS.SUBSCRIPTION}           component={SubscriptionScreen} />
      <Stack.Screen name={SCREENS.NOTIFICATION_SETTINGS}  component={NotificationSettingsScreen} />
      <Stack.Screen name={SCREENS.CHANGE_PASSWORD}        component={ChangePasswordScreen} />
      <Stack.Screen name={SCREENS.HELP_SUPPORT}           component={HelpSupportScreen} />

      {/* Staff Management */}
      <Stack.Screen name={SCREENS.STAFF_LIST}     component={StaffListScreen} />
      <Stack.Screen
        name={SCREENS.STAFF_ADD_EDIT}
        component={AddEditStaffScreen}
        options={{ animation: 'slide_from_bottom' }}
      />

      {/* ── ERP modules (wholesaler parity) ── */}
      <Stack.Screen name={SCREENS.SALES_LIST}    component={SalesListScreen} />
      <Stack.Screen name={SCREENS.SALES_REPORT}  component={SalesReportScreen} />
      <Stack.Screen
        name={SCREENS.SALES_ENTRY}
        component={SalesEntryScreen}
        options={{ animation: 'slide_from_bottom' }}
      />

      <Stack.Screen name={SCREENS.EXPENSE_LIST}   component={ExpenseListScreen} />
      <Stack.Screen name={SCREENS.EXPENSE_REPORT} component={ExpenseReportScreen} />
      <Stack.Screen name={SCREENS.PROFIT_LOSS}    component={ProfitLossScreen} />
      <Stack.Screen
        name={SCREENS.EXPENSE_ENTRY}
        component={ExpenseEntryScreen}
        options={{ animation: 'slide_from_bottom' }}
      />

      <Stack.Screen name={SCREENS.INVENTORY}      component={InventoryScreen} />
      <Stack.Screen name={SCREENS.WAREHOUSE_LIST} component={WarehouseListScreen} />
      <Stack.Screen name={SCREENS.STOCK_TRANSFER} component={StockTransferScreen} />
      <Stack.Screen
        name={SCREENS.STOCK_ADJUST}
        component={StockAdjustScreen}
        options={{ animation: 'slide_from_bottom' }}
      />

      <Stack.Screen name={SCREENS.PURCHASE_LIST} component={PurchaseListScreen} />
      <Stack.Screen name={SCREENS.SUPPLIER_LIST} component={SupplierListScreen} />
      <Stack.Screen
        name={SCREENS.PURCHASE_ENTRY}
        component={PurchaseEntryScreen}
        options={{ animation: 'slide_from_bottom' }}
      />

      <Stack.Screen name={SCREENS.PAYMENT_RECEIVABLE} component={PaymentReceivableScreen} />
      <Stack.Screen name={SCREENS.PAYMENT_PAYABLE}    component={PaymentPayableScreen} />
      <Stack.Screen name={SCREENS.ACCOUNTS}           component={AccountsScreen} />
      <Stack.Screen name={SCREENS.CUSTOMER_LEDGER}    component={PartyLedgerScreen} />

      <Stack.Screen name={SCREENS.CUSTOMER_LIST}      component={CustomerListScreen} />
      <Stack.Screen name={SCREENS.LEAD_LIST}          component={LeadListScreen} />
      <Stack.Screen name={SCREENS.REPORT_CENTER}      component={ReportCenterScreen} />
      <Stack.Screen name={SCREENS.ANALYTICS}          component={AnalyticsScreen} />

      <Stack.Screen name={SCREENS.DISPATCH_TRACKING}  component={DispatchTrackingScreen} />
      <Stack.Screen
        name={SCREENS.DISPATCH_ENTRY}
        component={DispatchEntryScreen}
        options={{ animation: 'slide_from_bottom' }}
      />

      <Stack.Screen name={SCREENS.DOCUMENT_REPOSITORY} component={DocumentRepositoryScreen} />

      <Stack.Screen name={SCREENS.STONE_CALC}         component={StoneCalculationScreen} />
    </Stack.Navigator>
    </NavigationContainer>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 6,
    ...Shadows.lg,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrap: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    marginBottom: 2,
  },
  tabIconWrapActive: {
    backgroundColor: Colors.primaryBg,
  },
  tabLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
});

export default AppNavigator;
