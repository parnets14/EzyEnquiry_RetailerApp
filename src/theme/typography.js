import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },
  android: {
    regular: 'Roboto',
    medium: 'Roboto-Medium',
    semiBold: 'Roboto-Medium',
    bold: 'Roboto-Bold',
  },
});

export const Typography = {
  // Font Families
  fontRegular: fontFamily.regular,
  fontMedium: fontFamily.medium,
  fontSemiBold: fontFamily.semiBold,
  fontBold: fontFamily.bold,

  // Font Sizes
  xs: 10,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 22,
  '4xl': 24,
  '5xl': 28,
  '6xl': 32,

  // Line Heights
  lineHeightSm: 16,
  lineHeightBase: 20,
  lineHeightMd: 22,
  lineHeightLg: 24,
  lineHeightXl: 28,
  lineHeight2xl: 32,

  // Font Weights (for style use)
  weightRegular: '400',
  weightMedium: '500',
  weightSemiBold: '600',
  weightBold: '700',

  // Predefined Text Styles
  h1: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
  },
  h5: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  body1: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  body2: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  button: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
};

export default Typography;
