import { darkColors, lightColors, type Palette } from '@dating/ui/tokens';

export { darkColors, lightColors };
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

export type ColorSchemeName = 'light' | 'dark';

export function paletteFor(scheme: string | null | undefined): Palette {
  return scheme === 'light' ? lightColors : darkColors;
}

function mixColor(from: string, to: string, amount: number): string {
  const blend = (start: number, end: number) => Math.round(start + (end - start) * amount);
  const channel = (hex: string, index: number) => Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  const mixed = [0, 1, 2].map((index) => blend(channel(from, index), channel(to, index)).toString(16).padStart(2, '0'));
  return `#${mixed.join('')}`;
}

/** Doluluk arttıkça kırmızıdan sarıya, sonra yeşile kayar. */
export function completionColor(percent: number, colors: Palette): string {
  const value = Math.min(100, Math.max(0, percent)) / 100;
  if (value < 0.5) return mixColor(colors.danger, colors.warning, value / 0.5);
  return mixColor(colors.warning, colors.success, (value - 0.5) / 0.5);
}

function createUi(colors: Palette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bgBottom,
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 8,
    },
    screenContent: {
      flexGrow: 1,
      gap: 22,
      paddingHorizontal: 20,
    },
    meter: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.surface2,
      overflow: 'hidden',
    },
    meterFill: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    title: { color: colors.text, fontSize: 28, fontWeight: '700' },
    subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
    input: {
      backgroundColor: colors.surface,
      color: colors.text,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
    },
    inputWrap: { position: 'relative', justifyContent: 'center' },
    reveal: {
      position: 'absolute',
      right: 6,
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primary: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
    },
    secondary: {
      backgroundColor: colors.surface2,
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
    },
    ghost: {
      borderRadius: 999,
      paddingVertical: 12,
      alignItems: 'center',
    },
    primaryText: { color: colors.onAccent, fontWeight: '700', fontSize: 16 },
    secondaryText: { color: colors.text, fontWeight: '600', fontSize: 16 },
    hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
    error: { color: colors.danger, fontSize: 14 },
    alertDanger: {
      backgroundColor: `${colors.danger}22`,
      borderColor: colors.danger,
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    alertSuccess: {
      backgroundColor: `${colors.success}22`,
      borderColor: colors.success,
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    alertDangerText: { color: colors.text, fontSize: 14, lineHeight: 20 },
    alertSuccessText: { color: colors.text, fontSize: 14, lineHeight: 20 },
    google: {
      backgroundColor: colors.googleBg,
      borderRadius: 999,
      paddingVertical: 14,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    googleText: { color: colors.googleFg, fontWeight: '700', fontSize: 16 },
    googleMark: {
      width: 22,
      height: 22,
      borderRadius: 11,
      overflow: 'hidden',
      backgroundColor: colors.googleBg,
    },
    googleSlice: { position: 'absolute', width: 11, height: 11 },
    googleSliceBlue: { top: 0, left: 0, backgroundColor: '#4285F4' },
    googleSliceRed: { top: 0, right: 0, backgroundColor: '#EA4335' },
    googleSliceYellow: { bottom: 0, left: 0, backgroundColor: '#FBBC05' },
    googleSliceGreen: { bottom: 0, right: 0, backgroundColor: '#34A853' },
    googleCore: {
      position: 'absolute',
      top: 4,
      left: 4,
      right: 4,
      bottom: 4,
      borderRadius: 8,
      backgroundColor: colors.googleBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    googleLetter: { color: '#4285F4', fontWeight: '800', fontSize: 13, lineHeight: 16 },
    divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.surface2 },
    dividerText: { color: colors.textMuted, fontSize: 13 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      overflow: 'hidden',
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 12,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.surface2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionPass: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surface2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionLike: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionSuper: {
      width: 62,
      height: 62,
      borderRadius: 31,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    overlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      padding: 16,
      gap: 4,
      backgroundColor: `${colors.photoScrim}CC`,
    },
    chip: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surface2,
    },
    chipOn: { backgroundColor: colors.primary },
    chipText: { color: colors.text, fontSize: 14 },
    chipTextOn: { color: colors.onAccent, fontWeight: '700' },
    row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pageIcon: {
      width: 52,
      height: 52,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandMark: {
      width: 88,
      height: 88,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centered: { textAlign: 'center' },
    photoCell: {
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoCover: { borderWidth: 2, borderColor: colors.primary },
    photoSelected: { borderWidth: 2, borderColor: colors.primarySoft },
    photoBadge: {
      position: 'absolute',
      left: 6,
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    photoBadgeTop: { top: 6 },
    photoBadgeBottom: { bottom: 6 },
    photoBadgeText: { color: colors.onAccent, fontSize: 11, fontWeight: '700' },
    select: {
      minHeight: 52,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    selectText: { color: colors.text, fontSize: 16, flex: 1 },
    selectPlaceholder: { color: colors.textMuted, fontSize: 16, flex: 1 },
    menu: {
      maxHeight: 220,
      backgroundColor: colors.surface,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.surface2,
      elevation: 16,
      shadowColor: colors.photoScrim,
      shadowOpacity: 0.45,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    menuSearch: {
      borderBottomWidth: 1,
      borderBottomColor: colors.surface2,
    },
    option: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.surface2,
    },
  });
}

export type UiStyles = ReturnType<typeof createUi>;

const ThemeContext = createContext<{ scheme: ColorSchemeName; colors: Palette; ui: UiStyles } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const scheme: ColorSchemeName = system === 'light' ? 'light' : 'dark';
  const value = useMemo(() => {
    const colors = paletteFor(scheme);
    return { scheme, colors, ui: createUi(colors) };
  }, [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme, ThemeProvider içinde kullanılmalı.');
  }
  return value;
}
