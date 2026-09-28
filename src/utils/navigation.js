// src/utils/navigation.js
//
// Helpers for reaching a screen that lives inside the bottom-tab navigator
// (Search / Enquiries / Orders / Profile) from anywhere in the app.
//
// WHY THIS EXISTS
// ---------------
// The Retailer app has two navigator levels:
//
//   Root Stack  →  SCREENS.HOME (= MainTabs), QUOTATIONS, ORDER_DETAILS, …
//                    └── Bottom Tabs → SEARCH, ENQUIRIES, ORDERS, PROFILE
//
// React Navigation resolves `navigate(name)` by bubbling **UP** the navigator
// tree — it never searches DOWN into a sibling child navigator. So a screen
// registered in the Root Stack (e.g. Quotations) cannot do
// `navigate(SCREENS.SEARCH)`; it throws:
//
//   The action 'NAVIGATE' with payload {"name":"Search"} was not handled by
//   any navigator.
//
// Tab screens (Home, Enquiries, Orders) CAN use the plain form because Search
// is their sibling. To make one code path work from both positions, these
// helpers always target the tab through its parent stack route.

import { SCREENS } from '../constants';

/**
 * Navigate to a bottom-tab screen from ANY screen, whether that screen is
 * itself a tab or a root-stack screen.
 *
 * @param {object} navigation  the screen's navigation prop
 * @param {string} tabName     one of SCREENS.SEARCH / ENQUIRIES / ORDERS / PROFILE
 */
export function navigateToTab(navigation, tabName) {
  // Preferred: name the parent stack route and the tab inside it.
  // This works from stack screens and is harmless from tab screens.
  navigation.navigate(SCREENS.HOME, { screen: tabName });
}

/** Navigate to the Search tab. */
export const goToSearch = (navigation) => navigateToTab(navigation, SCREENS.SEARCH);

/** Navigate to the Orders tab. */
export const goToOrders = (navigation) => navigateToTab(navigation, SCREENS.ORDERS);

/** Navigate to the Quotations (Enquiries) tab. */
export const goToQuotations = (navigation) => navigateToTab(navigation, SCREENS.ENQUIRIES);

/** Navigate to the Profile tab. */
export const goToProfile = (navigation) => navigateToTab(navigation, SCREENS.PROFILE);
