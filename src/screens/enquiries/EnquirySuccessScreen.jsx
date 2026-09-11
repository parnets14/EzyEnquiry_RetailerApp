import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import SuccessState from '../../components/common/SuccessState';
import { SCREENS } from '../../constants';

const EnquirySuccessScreen = ({ navigation, route }) => {
  const { enquiryId, enquiryDbId, product } = route.params || {};

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <SuccessState
        title="Quotation Sent Successfully"
        subtitle={`Your quotation request for ${product?.name || 'the product'} has been sent. The seller will respond shortly.`}
        referenceLabel="Quotation ID"
        referenceValue={enquiryId}
        message="You will be notified when the seller responds to your quotation."
        primaryButtonTitle="VIEW QUOTATION"
        onPrimaryPress={() => {
          if (enquiryDbId) {
            navigation.replace(SCREENS.HOME);
            setTimeout(() => navigation.navigate(SCREENS.ENQUIRY_DETAILS, { enquiryId: enquiryDbId }), 100);
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

export default EnquirySuccessScreen;
