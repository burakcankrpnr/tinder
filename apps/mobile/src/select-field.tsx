import { Ionicons } from '@expo/vector-icons';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { menuStore, setActiveMenu, subscribeActiveMenu, useRevealField } from './field-scroll';
import { useTheme } from './theme';

export interface SelectOption {
  value: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  emoji?: string;
}

export function SelectField({
  label,
  icon,
  placeholder,
  options,
  value,
  values,
  multiple = false,
  loading = false,
  disabled = false,
  emptyText = 'Sonuç yok.',
  onChange,
  onChangeMany,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  options: readonly SelectOption[];
  value?: string | null;
  values?: readonly string[];
  multiple?: boolean;
  loading?: boolean;
  disabled?: boolean;
  emptyText?: string;
  onChange?: (value: string) => void;
  onChangeMany?: (values: string[]) => void;
}) {
  const { colors, ui } = useTheme();
  const menuId = useId();
  const box = useRef<View>(null);
  const trigger = useRef<View>(null);
  const reveal = useRevealField();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchable = options.length > 6;
  const selected = new Set(multiple ? (values ?? []) : value ? [value] : []);
  const summary = options
    .filter((option) => selected.has(option.value))
    .map((option) => option.label)
    .join(', ');

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr');
    if (!needle) return options;
    return options.filter((option) => option.label.toLocaleLowerCase('tr').includes(needle));
  }, [options, query]);

  useEffect(() => subscribeActiveMenu((id) => {
    if (id !== menuId) setOpen(false);
  }), [menuId]);

  useEffect(() => () => menuStore.remove(menuId), [menuId]);

  useLayoutEffect(() => {
    if (!open) {
      menuStore.remove(menuId);
      return;
    }
    menuStore.set({
      id: menuId,
      anchor: trigger,
      render: () => (
        <View style={ui.menu}>
          {searchable ? (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Ara"
              placeholderTextColor={colors.textMuted}
              style={[ui.input, ui.menuSearch, { borderRadius: 0 }]}
              autoCorrect={false}
              autoFocus
              onFocus={() => setTimeout(() => reveal(box.current, 'input'), 40)}
            />
          ) : null}
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: searchable ? 180 : 220 }}>
            {filtered.length === 0 ? <Text style={[ui.subtitle, { padding: 12 }]}>{emptyText}</Text> : null}
            {filtered.map((item) => {
              const on = selected.has(item.value);
              return (
                <Pressable key={item.value} accessibilityRole="button" onPress={() => choose(item)} style={ui.option}>
                  {item.emoji ? <Text style={{ fontSize: 18 }}>{item.emoji}</Text> : null}
                  {item.icon ? <Ionicons name={item.icon} size={18} color={on ? colors.primary : colors.textMuted} /> : null}
                  <Text style={[ui.selectText, on && { color: colors.primarySoft }]}>{item.label}</Text>
                  {on ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ),
    });
  });

  function toggle() {
    if (disabled || loading) return;
    if (open) {
      setOpen(false);
      setQuery('');
      setActiveMenu(null);
      return;
    }
    setActiveMenu(menuId);
    setOpen(true);
    setTimeout(() => reveal(box.current, 'menu'), 40);
  }

  function choose(option: SelectOption) {
    if (multiple) {
      const next = selected.has(option.value)
        ? [...selected].filter((item) => item !== option.value)
        : [...selected, option.value];
      onChangeMany?.(next);
      return;
    }
    onChange?.(option.value);
    setOpen(false);
    setQuery('');
    setActiveMenu(null);
  }

  return (
    <View ref={box} style={{ gap: 8 }}>
      <View style={ui.fieldLabel}>
        <Ionicons name={icon} size={18} color={colors.primarySoft} />
        <Text style={ui.subtitle}>{label}</Text>
      </View>
      <View ref={trigger} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ expanded: open }}
          disabled={disabled || loading}
          onPress={toggle}
          style={[ui.select, { opacity: disabled ? 0.5 : 1 }]}
        >
          <Text style={summary ? ui.selectText : ui.selectPlaceholder} numberOfLines={1}>
            {loading ? 'Seçenekler geliyor.' : summary || placeholder}
          </Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}
