import { MAXIMUM_AGE, MINIMUM_AGE, calculateAge } from '@dating/validation';
import { showAlert } from '@/app-alert';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';

const MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
] as const;

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;

interface CivilDate {
  year: number;
  month: number;
  day: number;
}

interface WheelOption {
  value: number;
  label: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toIso(date: CivilDate): string {
  return `${date.year}-${pad(date.month + 1)}-${pad(date.day)}`;
}

function parseIso(value: string): CivilDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function utcParts(date: Date): CivilDate {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function bounds(now = new Date()): { earliest: CivilDate; latest: CivilDate } {
  const today = utcParts(now);
  const latest = utcParts(new Date(Date.UTC(today.year - MINIMUM_AGE, today.month, today.day)));
  const beforeOldest = utcParts(new Date(Date.UTC(today.year - (MAXIMUM_AGE + 1), today.month, today.day)));
  const earliest = utcParts(new Date(Date.UTC(beforeOldest.year, beforeOldest.month, beforeOldest.day + 1)));
  return { earliest, latest };
}

function withYear(current: CivilDate, year: number): CivilDate {
  return { year, month: current.month, day: Math.min(current.day, daysInMonth(year, current.month)) };
}

function withMonth(current: CivilDate, month: number): CivilDate {
  return { year: current.year, month, day: Math.min(current.day, daysInMonth(current.year, month)) };
}

function formatDate(value: string): string {
  const parsed = parseIso(value);
  if (!parsed) return '';
  return `${parsed.day} ${MONTHS[parsed.month]} ${parsed.year}`;
}

function indexFromOffset(offset: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(offset / ITEM_HEIGHT)));
}

function WheelColumn({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly WheelOption[];
  value: number;
  onChange: (value: number) => void;
}) {
  const { colors, ui } = useTheme();
  const scroll = useRef<ScrollView>(null);
  const aligned = useRef<number | null>(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  useEffect(() => {
    aligned.current = null;
    setActiveIndex(selectedIndex);
  }, [selectedIndex, options.length]);

  function revealSelection(_width: number, height: number) {
    if (height < options.length * ITEM_HEIGHT) return;
    if (aligned.current === selectedIndex) return;
    aligned.current = selectedIndex;
    scroll.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
  }

  function settle(offset: number) {
    const index = indexFromOffset(offset, options.length);
    const next = options[index];
    if (!next) return;
    setActiveIndex(index);
    if (next.value !== value) onChange(next.value);
  }

  return (
    <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
      <Text style={[ui.hint, { textAlign: 'center' }]}>{label}</Text>
      <View style={{ height: ITEM_HEIGHT * VISIBLE_ROWS }}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: ITEM_HEIGHT * 2,
            left: 8,
            right: 8,
            height: ITEM_HEIGHT,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: colors.surface2,
            backgroundColor: colors.surface,
            borderRadius: 12,
          }}
        />
        <ScrollView
          ref={scroll}
          accessibilityLabel={label}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          nestedScrollEnabled
          scrollEventThrottle={16}
          onContentSizeChange={revealSelection}
          onScroll={(event) => {
            const index = indexFromOffset(event.nativeEvent.contentOffset.y, options.length);
            setActiveIndex((current) => (current === index ? current : index));
          }}
          onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.y)}
          onScrollEndDrag={(event) => {
            const velocity = event.nativeEvent.velocity?.y ?? 0;
            if (Math.abs(velocity) < 0.05) settle(event.nativeEvent.contentOffset.y);
          }}
          contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
        >
          {options.map((option, index) => {
            const distance = Math.abs(index - activeIndex);
            return (
              <View key={option.value} style={{ height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={{
                    color: distance === 0 ? colors.text : colors.textMuted,
                    fontSize: distance === 0 ? 20 : 16,
                    fontWeight: distance === 0 ? '700' : '400',
                    opacity: distance === 0 ? 1 : distance === 1 ? 0.7 : 0.35,
                    textAlign: 'center',
                    width: '100%',
                  }}
                >
                  {option.label}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

export function BirthDateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { colors, ui } = useTheme();
  const insets = useSafeAreaInsets();
  const { earliest, latest } = useMemo(() => bounds(), []);
  const years = useMemo(() => {
    const list: WheelOption[] = [];
    for (let year = earliest.year; year <= latest.year; year += 1) list.push({ value: year, label: String(year) });
    return list;
  }, [earliest.year, latest.year]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CivilDate>(latest);
  const months = useMemo<WheelOption[]>(
    () => MONTHS.map((label, value) => ({ value, label })),
    [],
  );
  const days = useMemo<WheelOption[]>(() => {
    const last = daysInMonth(draft.year, draft.month);
    return Array.from({ length: last }, (_, index) => ({ value: index + 1, label: String(index + 1) }));
  }, [draft.year, draft.month]);

  function show() {
    const parsed = parseIso(value);
    setDraft(parsed ?? latest);
    setOpen(true);
  }

  function confirm() {
    const age = calculateAge(new Date(`${toIso(draft)}T00:00:00.000Z`));
    if (age < MINIMUM_AGE || age > MAXIMUM_AGE) {
      setOpen(false);
      showAlert(
        age < MINIMUM_AGE
          ? `Devam etmek için en az ${MINIMUM_AGE} yaşında olmalısın.`
          : `Devam etmek için en fazla ${MAXIMUM_AGE} yaşında olmalısın.`,
        'Yaş uygun değil',
      );
      return;
    }
    onChange(toIso(draft));
    setOpen(false);
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={ui.fieldLabel}>
        <Ionicons name="calendar" size={18} color={colors.primarySoft} />
        <Text style={ui.subtitle}>Doğum tarihi</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Doğum tarihi"
        accessibilityHint="Gün, ay ve yılı kaydırarak seçmek için çarkı açar"
        onPress={show}
        style={ui.select}
      >
        <Text style={value ? ui.selectText : ui.selectPlaceholder}>{value ? formatDate(value) : 'Gün, ay ve yıl seç'}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      <Text style={ui.hint}>Çarkı kaydırarak günü, ayı ve yılı seç.</Text>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            onPress={() => setOpen(false)}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.photoScrim, opacity: 0.55 }}
          />
          <View
            style={{
              backgroundColor: colors.bgBottom,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 16,
              paddingBottom: insets.bottom + 16,
              gap: 16,
            }}
          >
            <Text style={ui.title}>Doğum tarihi</Text>
            <Text style={ui.subtitle}>
              {draft.day} {MONTHS[draft.month]} {draft.year}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <WheelColumn
                label="Gün"
                options={days}
                value={draft.day}
                onChange={(day) => setDraft((current) => ({ ...current, day }))}
              />
              <WheelColumn
                label="Ay"
                options={months}
                value={draft.month}
                onChange={(month) => setDraft((current) => withMonth(current, month))}
              />
              <WheelColumn
                label="Yıl"
                options={years}
                value={draft.year}
                onChange={(year) => setDraft((current) => withYear(current, year))}
              />
            </View>
            <Pressable accessibilityRole="button" onPress={confirm} style={ui.primary}>
              <Text style={ui.primaryText}>Seç</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
