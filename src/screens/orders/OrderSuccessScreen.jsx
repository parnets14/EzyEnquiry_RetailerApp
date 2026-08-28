import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import SuccessState from '../../components/common/SuccessState';
import { SCREENS } from '../../constants';

const OrderSuccessScreen = ({ navigation, route }) => {
  const { orderId, orderDbId, productName } = route.params || {};

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <SuccessState
        title="Order Placed Successfully"
        subtitle={`Your order${productName ? ` for ${productName}` : ''} has been placed. The seller will confirm soon.`}
        referenceLabel="Order Number"
        referenceValue={orderId}
        message="You will be notified when the seller accepts and processes your order."
        primaryButtonTitle="VIEW ORDER"
        onPrimaryPress={() => {
          if (orderDbId) {
            navigation.replace(SCREENS.HOME);
            setTimeout(() => navigation.navigate(SCREENS.ORDER_DETAILS, { orderId: orderDbId }), 100);
          } else {
            navigation.replace(SCREENS.HOME);
          }
        }}
        secondaryButtonTitle="TRACK ORDER"
        onSecondaryPress={() => {
          if (orderDbId) {
            navigation.replace(SCREENS.HOME);
            setTimeout(() => navigation.navigate(SCREENS.ORDER_TRACKING, { orderId: orderDbId }), 100);
          } else {
            navigation.replace(SCREENS.HOME);
          }
        }}
        tertiaryButtonTitle="BACK TO HOME"
        onTertiaryPress={() => navigation.replace(SCREENS.HOME)}
      />
    </SafeAreaView>
  );
};

export default OrderSuccessScreen;
