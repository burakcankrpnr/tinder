/** theme.css ile aynı değerler; CSS dışında renk gereken yerler (meta theme-color, canvas vb.) için. */
export const colors = {
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
} as const;

export type ColorToken = keyof typeof colors;
