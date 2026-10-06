export const PRIMARY_NAV = [
  { href: '/#tinder-features', label: 'Ürün' },
  { href: '/#abonelikler', label: 'Abonelikler' },
  { href: '/#safety', label: 'Güvenlik' },
  { href: '/#destek', label: 'Destek' },
  { href: '/#download', label: 'İndir' },
  { href: '/#hediye', label: 'Hediye Kartları' },
  { href: '/#etkinlikler', label: 'Etkinlikler' },
] as const;

export const LANGUAGES = [
  { id: 'tr', label: 'Türkçe' },
  { id: 'en', label: 'English' },
  { id: 'de', label: 'Deutsch' },
  { id: 'fr', label: 'Français' },
] as const;

export type LandingLang = (typeof LANGUAGES)[number]['id'];
export type LangAnchor = 'header' | 'footer';
