import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Easing,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { SCREENS } from '../../constants';
import { useAuth } from '../../context/AuthContext';

const LOGO = require('../../assets/logo.jpeg');

export default function SplashScreen({ navigation }) {
  const { user, loading } = useAuth();
  const fade  = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, scale]);

  // Route once the auth session finished loading: keep users signed in.
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      if (!user) {
        navigation.replace(SCREENS.LOGIN);
        return;
      }
      const approved = user.is_approved || user.company?.status === 'Approved' || user.company_status === 'Approved';
      navigation.replace(approved ? SCREENS.HOME : SCREENS.PENDING_APPROVAL);
    }, 1200);
    return () => clearTimeout(timer);
  }, [loading, user, navigation]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />

      {/* Decorative thin rings behind logo */}
      <View style={styles.ringOuter} />
      <View style={styles.ringInner} />

      <Animated.View style={[styles.center, { opacity: fade, transform: [{ scale }] }]}>

        {/* ── Glass card around logo ── */}
        <View style={styles.glassCard}>
          <View style={styles.glassHighlight} />
          <View style={styles.logoWrap}>
            <Image source={LOGO} style={styles.logo} resizeMode="cover" />
          </View>
          {/* Small orange dot accent */}
          <View style={styles.accentDot} />
        </View>

        {/* Brand */}
        <Text style={styles.brand}>
          <Text style={styles.brandEzy}>Ezy</Text>
          <Text style={styles.brandEnquiry}>Enquiry</Text>
        </Text>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <View style={styles.dividerDot} />
          <View style={styles.dividerLine} />
        </View>

        {/* Tagline */}
        <Text style={styles.tagline}>TILES BUSINESS PLATFORM</Text>
      </Animated.View>

      {/* Footer */}
      <Animated.View style={[styles.footer, { opacity: fade }]}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.footerText}>Loading...</Text>
        <Text style={styles.version}>v 1.0.0</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  /* Decorative rings — adds subtle depth */
  ringOuter: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: 'rgba(244, 80, 10, 0.10)',
  },
  ringInner: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },

  center: {
    alignItems: 'center',
  },

  /* ── Glass card ── */
  glassCard: {
    width: 148,
    height: 148,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 22,
    right: 22,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
    borderRadius: 1,
  },
  accentDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 4,
  },

  logoWrap: {
    width: 104,
    height: 104,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  logo: {
    width: '100%',
    height: '100%',
  },

  brand: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 12,
  },
  brandEzy: {
    color: Colors.primary,
  },
  brandEnquiry: {
    color: Colors.white,
  },

  /* Divider */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  dividerLine: {
    width: 28,
    height: 1.5,
    backgroundColor: 'rgba(244, 80, 10, 0.45)',
    borderRadius: 1,
  },
  dividerDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    opacity: 0.7,
  },

  tagline: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.35)',
    letterSpacing: 3,
  },

  footer: {
    position: 'absolute',
    bottom: 48,
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.35)',
  },
  version: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.20)',
  },
});
