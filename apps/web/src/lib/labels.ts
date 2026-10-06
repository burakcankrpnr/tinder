import type { Gender, LifestyleFrequency, RelationshipIntention, ReportReason } from '@dating/types';

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  FAKE_PROFILE: 'Sahte profil',
  HARASSMENT: 'Taciz veya zorbalık',
  SCAM: 'Dolandırıcılık',
  SPAM: 'Spam / reklam',
  SEXUAL_CONTENT: 'Uygunsuz cinsel içerik',
  VIOLENCE: 'Şiddet veya tehdit',
  UNDERAGE: 'Reşit olmadığını düşünüyorum',
  OTHER: 'Diğer',
};

export const GENDER_LABELS: Record<Gender, string> = {
  WOMAN: 'Kadın',
  MAN: 'Erkek',
  NON_BINARY: 'Non-binary',
};

export const INTERESTED_IN_LABELS: Record<Gender, string> = {
  WOMAN: 'Kadınlar',
  MAN: 'Erkekler',
  NON_BINARY: 'Non-binary kişiler',
};

export const INTENTION_LABELS: Record<RelationshipIntention, string> = {
  LONG_TERM: 'Uzun süreli ilişki',
  LONG_TERM_OPEN_TO_SHORT: 'Uzun süreli, kısaya da açığım',
  SHORT_TERM_OPEN_TO_LONG: 'Kısa süreli, uzuna da açığım',
  SHORT_TERM: 'Kısa süreli eğlence',
  FRIENDSHIP: 'Yeni arkadaşlar',
  NOT_SURE: 'Henüz emin değilim',
};

export const FREQUENCY_LABELS: Record<LifestyleFrequency, string> = {
  NEVER: 'Hiç',
  SOMETIMES: 'Bazen',
  OFTEN: 'Sık sık',
};

export const LANGUAGE_LABELS: Record<string, string> = {
  tr: 'Türkçe',
  en: 'İngilizce',
  de: 'Almanca',
  fr: 'Fransızca',
  es: 'İspanyolca',
  it: 'İtalyanca',
  ru: 'Rusça',
  ar: 'Arapça',
  ku: 'Kürtçe',
  az: 'Azerice',
  nl: 'Felemenkçe',
  ja: 'Japonca',
};

export function languageLabel(code: string): string {
  return LANGUAGE_LABELS[code] ?? code.toUpperCase();
}
