export const Spacing = {
  // Base unit = 4px
  '0': 0,
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,

  // Named
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,

  // Screen padding
  screenPadding: 16,
  screenPaddingLg: 20,

  // Card padding
  cardPadding: 16,
  cardPaddingSm: 12,

  // Section gap
  sectionGap: 24,
  sectionGapSm: 16,
};

export const BorderRadius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 999,

  // Named
  button: 10,
  card: 12,
  input: 10,
  badge: 20,
  chip: 20,
};

export const Shadows = {
  none: {},
  sm: {
    shadowColor: '#1A2340',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#1A2340',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#1A2340',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
  },
  xl: {
    shadowColor: '#1A2340',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
};

export default { Spacing, BorderRadius, Shadows };
