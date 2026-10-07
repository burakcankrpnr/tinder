import type { Gender, ReportReason } from '@dating/types';
import { LANGUAGE_OPTIONS } from '@dating/validation';

export {
  COMMUNICATION_LABELS,
  DRINK_SMOKE_LABELS as FREQUENCY_LABELS,
  EDUCATION_LEVEL_LABELS,
  EXERCISE_LABELS,
  INTENTION_LABELS,
  KIDS_LABELS,
  LOVE_LABELS,
  PET_LABELS,
  SEXUAL_ORIENTATION_LABELS,
  SOCIAL_LABELS,
  ZODIAC_LABELS,
} from '@dating/validation';

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

export const LANGUAGE_LABELS: Record<string, string> = Object.fromEntries(
  LANGUAGE_OPTIONS.map((item) => [item.code, item.label]),
);

export function languageLabel(code: string): string {
  return LANGUAGE_LABELS[code] ?? code.toUpperCase();
}
