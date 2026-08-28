import React, { useEffect } from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { SCREENS } from '../../constants';

/**
 * Legacy bridge — the real order creation now lives in QuotationConfirmScreen.
 * If this screen is somehow reached, redirect to the quotation confirm flow.
 */
export default function OrderConfirmationScreen({ navigation, route }) {
  const { enquiryId, offerId } = route.params || {};

  useEffect(() => {
    if (enquiryId) {
      navigation.replace(SCREENS.QUOTATION_CONFIRM, { enquiryId, offerId });
    } else {
      navigation.replace(SCREENS.HOME);
    }
  }, [navigation, enquiryId, offerId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    </SafeAreaView>
  );
}
