import { useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets, type Edges } from 'react-native-safe-area-context';
import {
  FieldScrollContext,
  menuStore,
  requestMenuMeasure,
  setActiveMenu,
  setMenuMeasurer,
  type ScrollMode,
} from './field-scroll';
import { completionColor, useTheme } from './theme';

export { setActiveMenu, subscribeActiveMenu, useRevealField } from './field-scroll';

function ScrollThumb({ bar }: { bar: { view: number; content: number; offset: number } }) {
  const { colors } = useTheme();
  const overflow = bar.content - bar.view;
  if (bar.view <= 0 || overflow <= 12) return null;
  const height = Math.max(28, (bar.view / bar.content) * bar.view);
  const top = (Math.min(Math.max(bar.offset, 0), overflow) / overflow) * (bar.view - height);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        right: 0,
        top,
        width: 4,
        height,
        borderRadius: 999,
        backgroundColor: colors.primary,
      }}
    />
  );
}

function MenuLayer({ keyboardInset }: { keyboardInset: number }) {
  const host = useRef<View>(null);
  const frames = useSyncExternalStore(menuStore.subscribe, menuStore.getSnapshot, menuStore.getSnapshot);
  const [boxes, setBoxes] = useState<Record<string, { top: number; left: number; width: number; maxHeight: number }>>({});

  const measure = useRef(() => {});
  measure.current = () => {
    host.current?.measureInWindow((originX, originY) => {
      if (frames.length === 0) {
        setBoxes((current) => (Object.keys(current).length === 0 ? current : {}));
        return;
      }
      frames.forEach((frame) => {
        frame.anchor.current?.measureInWindow((x, y, width, height) => {
          const top = y + height + 6 - originY;
          const space = Dimensions.get('window').height - keyboardInset - (y + height) - 16;
          const next = {
            top,
            left: x - originX,
            width,
            maxHeight: Math.min(220, Math.max(96, space)),
          };
          setBoxes((current) => {
            const prev = current[frame.id];
            if (
              prev &&
              prev.top === next.top &&
              prev.left === next.left &&
              prev.width === next.width &&
              prev.maxHeight === next.maxHeight
            ) {
              return current;
            }
            return { ...current, [frame.id]: next };
          });
        });
      });
    });
  };

  useLayoutEffect(() => {
    measure.current();
  }, [frames, keyboardInset]);

  useEffect(() => setMenuMeasurer(() => measure.current()), []);

  return (
    <View
      ref={host}
      pointerEvents={frames.length === 0 ? 'none' : 'box-none'}
      style={StyleSheet.absoluteFill}
      collapsable={false}
    >
      {frames.map((frame) => {
        const box = boxes[frame.id];
        if (!box) return null;
        return (
          <View
            key={frame.id}
            style={{
              position: 'absolute',
              top: box.top,
              left: box.left,
              width: box.width,
              maxHeight: box.maxHeight,
              zIndex: 40,
              elevation: 18,
              overflow: 'hidden',
            }}
          >
            {frame.render()}
          </View>
        );
      })}
    </View>
  );
}

export function Screen({ children, header = false }: { children: React.ReactNode; header?: boolean }) {
  const { ui } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0);
  const keyboardHeight = useRef(0);
  const fullHeight = useRef(Dimensions.get('window').height);
  const pending = useRef<{ target: View; mode: ScrollMode } | null>(null);
  const [keyboardPad, setKeyboardPad] = useState(0);
  const [bar, setBar] = useState({ view: 0, content: 0, offset: 0 });
  const edges: Edges = header ? ['bottom'] : ['top', 'bottom'];

  function reveal(target: View | null, mode: ScrollMode) {
    if (!target) return;
    pending.current = { target, mode };
    target.measureInWindow((_x, y, _width, height) => {
      const visibleBottom = Dimensions.get('window').height - keyboardHeight.current - 12;
      const needed = y + height + (mode === 'menu' ? 200 : 0);
      const overflow = needed - visibleBottom;
      if (overflow > 8) {
        scrollRef.current?.scrollTo({ y: offset.current + overflow, animated: true });
      }
      requestMenuMeasure();
    });
  }

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      const resized = fullHeight.current - Dimensions.get('window').height > 80;
      keyboardHeight.current = resized ? 0 : event.endCoordinates.height;
      setKeyboardPad(resized ? 0 : event.endCoordinates.height);
      const current = pending.current;
      if (current) setTimeout(() => reveal(current.target, current.mode), Platform.OS === 'ios' ? 0 : 80);
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      keyboardHeight.current = 0;
      setKeyboardPad(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <FieldScrollContext.Provider value={reveal}>
      <SafeAreaView edges={edges} style={[ui.screen, { paddingHorizontal: 0 }]}>
        <View style={{ flex: 1 }}>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            onLayout={(event) => {
              const view = event.nativeEvent.layout.height;
              setBar((current) => ({ ...current, view }));
            }}
            onContentSizeChange={(_width, content) => {
              setBar((current) => ({ ...current, content }));
            }}
            onScroll={(event) => {
              const next = event.nativeEvent.contentOffset.y;
              offset.current = next;
              setBar((current) => ({ ...current, offset: next }));
              requestMenuMeasure();
            }}
            scrollEventThrottle={16}
            contentContainerStyle={[
              ui.screenContent,
              {
                paddingBottom: keyboardPad + 28,
                paddingLeft: 20 + insets.left,
                paddingRight: 20 + insets.right,
              },
            ]}
          >
            <Pressable accessible={false} onPress={Keyboard.dismiss} style={{ gap: 22 }}>
              {children}
            </Pressable>
          </ScrollView>
          <MenuLayer keyboardInset={keyboardPad} />
          <ScrollThumb bar={bar} />
        </View>
      </SafeAreaView>
    </FieldScrollContext.Provider>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  const { ui } = useTheme();
  return <Text style={ui.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  const { ui } = useTheme();
  return <Text style={ui.subtitle}>{children}</Text>;
}

export function StepBack({
  href,
}: {
  href: '/onboarding/profile' | '/onboarding/photos' | '/onboarding/preferences';
}) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Geri" hitSlop={12} onPress={() => router.replace(href)}>
      <Ionicons name="chevron-back" size={28} color={colors.text} />
    </Pressable>
  );
}

export function PageHeading({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  const { colors, ui } = useTheme();
  return (
    <View style={{ gap: 10, alignItems: 'center' }}>
      <View style={ui.pageIcon}>
        <Ionicons name={icon} size={26} color={colors.onAccent} />
      </View>
      <Text style={[ui.title, ui.centered]}>{title}</Text>
      {subtitle ? <Text style={[ui.subtitle, ui.centered]}>{subtitle}</Text> : null}
    </View>
  );
}

export function ProfileMeter({ percent, centered = false }: { percent: number; centered?: boolean }) {
  const { colors, ui } = useTheme();
  const color = completionColor(percent, colors);
  const width = `${Math.min(100, Math.max(0, percent))}%` as const;
  return (
    <View style={{ gap: 8 }}>
      <Text style={[ui.subtitle, centered ? ui.centered : null, { color, fontWeight: '700' }]}>
        Profiliniz %{percent} dolu
      </Text>
      <View style={ui.meter}>
        <View style={[ui.meterFill, { width, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function BrandSplash({ message = 'Hesabın hazırlanıyor' }: { message?: string }) {
  const { colors, ui } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: colors.bgBottom, paddingHorizontal: 32 }}>
      <View style={ui.brandMark}>
        <Ionicons name="flame" size={44} color={colors.onAccent} />
      </View>
      <Text style={[ui.title, ui.centered]}>Dating</Text>
      <Text style={[ui.subtitle, ui.centered]}>{message}</Text>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function Field({
  label,
  icon,
  hint,
  error,
  secureTextEntry,
  ...props
}: { label: string; icon?: keyof typeof Ionicons.glyphMap; hint?: string; error?: string } & TextInputProps) {
  const { colors, ui } = useTheme();
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));
  const masked = Boolean(secureTextEntry) && hidden;
  const box = useRef<View>(null);
  const reveal = useContext(FieldScrollContext);
  const { onFocus, ...rest } = props;
  return (
    <View ref={box} style={{ gap: 8 }}>
      <View style={ui.fieldLabel}>
        {icon ? <Ionicons name={icon} size={18} color={colors.primarySoft} /> : null}
        <Text style={ui.subtitle}>{label}</Text>
      </View>
      <View style={ui.inputWrap}>
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[ui.input, secureTextEntry ? { paddingRight: 48 } : null]}
          accessibilityLabel={label}
          secureTextEntry={masked}
          onFocus={(event) => {
            setActiveMenu(null);
            onFocus?.(event);
            setTimeout(() => reveal(box.current, 'input'), 40);
          }}
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Şifreyi göster' : 'Şifreyi gizle'}
            hitSlop={8}
            onPress={() => setHidden((value) => !value)}
            style={ui.reveal}
          >
            <Ionicons name={hidden ? 'eye' : 'eye-off'} size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {hint ? <Text style={ui.hint}>{hint}</Text> : null}
      {error ? <Text style={ui.error}>{error}</Text> : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { colors, ui } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [ui.primary, { opacity: pressed || disabled ? 0.7 : 1 }]}
    >
      {loading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={ui.primaryText}>{label}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { ui } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[ui.secondary, { opacity: disabled ? 0.7 : 1 }]}
    >
      <Text style={ui.secondaryText}>{label}</Text>
    </Pressable>
  );
}

export function Notice({ tone, children }: { tone: 'danger' | 'success'; children: React.ReactNode }) {
  const { ui } = useTheme();
  if (!children) return null;
  const danger = tone === 'danger';
  return (
    <View accessibilityRole="alert" style={danger ? ui.alertDanger : ui.alertSuccess}>
      <Text style={danger ? ui.alertDangerText : ui.alertSuccessText}>{children}</Text>
    </View>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return <Notice tone="danger">{children}</Notice>;
}

export function showAlert(message: string, title = 'Eksik bilgi'): void {
  Alert.alert(title, message);
}

export function flagMissing(setMessage: (message: string | null) => void, message: string): void {
  setMessage(message);
  showAlert(message);
}

export function GoogleMark() {
  const { ui } = useTheme();
  return (
    <View style={ui.googleMark}>
      <View style={[ui.googleSlice, ui.googleSliceBlue]} />
      <View style={[ui.googleSlice, ui.googleSliceRed]} />
      <View style={[ui.googleSlice, ui.googleSliceYellow]} />
      <View style={[ui.googleSlice, ui.googleSliceGreen]} />
      <View style={ui.googleCore}>
        <Text style={ui.googleLetter}>G</Text>
      </View>
    </View>
  );
}

export function GoogleButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { ui } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [ui.google, { opacity: pressed || disabled ? 0.7 : 1 }]}
    >
      <GoogleMark />
      <Text style={ui.googleText}>{label}</Text>
    </Pressable>
  );
}

export function OrDivider() {
  const { ui } = useTheme();
  return (
    <View style={ui.divider}>
      <View style={ui.dividerLine} />
      <Text style={ui.dividerText}>veya</Text>
      <View style={ui.dividerLine} />
    </View>
  );
}
