/**
 * theme.css ile aynı değerler. CSS dışında renk gereken yerler (meta theme-color, React Native) için.
 * Web dolgu metni her iki temada da beyazdır (`--color-on-accent`); mobilde açık lavanta dolgu üzerinde
 * koyu etiket kullanılır, bu yüzden `onAccent` palete göre değişir.
 */
const shared = {
  onPhoto: '#FFFFFF',
  onPhotoMuted: '#D5D0DC',
  photoScrim: '#17151B',
  googleBg: '#FFFFFF',
  googleFg: '#17151B',
} as const;

export const darkColors = {
  primary: '#B99BFB',
  primaryStrong: '#9C7AF2',
  primarySoft: '#D8C8FF',
  accentEnd: '#8E6DE8',
  bgTop: '#645387',
  bgMid: '#3E354F',
  bgBottom: '#17151B',
  surface: '#211E27',
  surface2: '#2B2733',
  text: '#FFFFFF',
  textMuted: '#AAA5B5',
  success: '#35D07F',
  danger: '#FF5C7A',
  warning: '#FFC857',
  onAccent: '#17151B',
  ...shared,
} as const;

export const lightColors = {
  primary: '#6844C0',
  primaryStrong: '#542FA8',
  primarySoft: '#4C2C96',
  accentEnd: '#7A52D0',
  bgTop: '#F7F3FC',
  bgMid: '#EFE7F8',
  bgBottom: '#F4EFFA',
  surface: '#FFFFFF',
  surface2: '#EFE8F7',
  text: '#1B1526',
  textMuted: '#5C546B',
  success: '#0E7A46',
  danger: '#C42342',
  warning: '#8A5B00',
  onAccent: '#FFFFFF',
  ...shared,
} as const;

/** Karanlık palet. Statik ihtiyaçlar için; arayüz `prefers-color-scheme` ile seçer. */
export const colors = darkColors;

export type Palette = { [K in keyof typeof darkColors]: string };
export type ColorToken = keyof Palette;
