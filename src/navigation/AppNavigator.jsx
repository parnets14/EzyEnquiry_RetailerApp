import React from 'react';
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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ─── Tab Icons ─────────────────────────────────────────────────────────────────
const TAB_CONFIG = {
  HomeTab:             { icon: 'home-outline',           iconActive: 'home',             label: 'Home' },
  [SCREENS.SEARCH]:    { icon: 'search-outline',    iconActive: 'search',           label: 'Search' },
  [SCREENS.ENQUIRIES]: { icon: 'document-text-outline', iconActive: 'document-text', label: 'Enquiries' },
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
const AppNavigator = React.forwardRef((props, ref) => (
  <NavigationContainer ref={ref}>
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
        name={SCREENS.ADD_PRODUCT}
        component={AddProductScreen}
        options={{ animation: 'slide_from_bottom' }}
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
    </Stack.Navigator>
  </NavigationContainer>
));

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
