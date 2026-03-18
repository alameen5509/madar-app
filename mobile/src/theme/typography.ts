import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, fontFamily },
  h2: { fontSize: 22, fontWeight: '600' as const, fontFamily },
  h3: { fontSize: 18, fontWeight: '600' as const, fontFamily },
  body: { fontSize: 15, fontWeight: '400' as const, fontFamily },
  bodyBold: { fontSize: 15, fontWeight: '600' as const, fontFamily },
  caption: { fontSize: 13, fontWeight: '400' as const, fontFamily },
  small: { fontSize: 11, fontWeight: '400' as const, fontFamily },
};
