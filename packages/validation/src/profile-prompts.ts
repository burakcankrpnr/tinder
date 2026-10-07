export const SEXUAL_ORIENTATIONS = [
  'STRAIGHT',
  'GAY',
  'LESBIAN',
  'BISEXUAL',
  'PANSEXUAL',
  'ASEXUAL',
  'QUEER',
  'UNSURE',
] as const;

export const EDUCATION_LEVELS = ['HIGH_SCHOOL', 'ASSOCIATE', 'BACHELOR', 'MASTER', 'DOCTORATE', 'OTHER'] as const;

export const KIDS_PREFERENCES = ['WANT', 'DONT_WANT', 'HAVE_AND_WANT', 'HAVE_AND_DONT', 'NOT_SURE'] as const;

export const COMMUNICATION_STYLES = ['TEXTER', 'CALLER', 'VIDEO', 'BAD_TEXTER', 'IN_PERSON'] as const;

export const LOVE_STYLES = ['GESTURES', 'GIFTS', 'TOUCH', 'COMPLIMENTS', 'TIME'] as const;

export const PET_STATUSES = ['DOG', 'CAT', 'OTHER', 'NONE', 'WANT_ONE'] as const;

export const ZODIAC_SIGNS = [
  'ARIES',
  'TAURUS',
  'GEMINI',
  'CANCER',
  'LEO',
  'VIRGO',
  'LIBRA',
  'SCORPIO',
  'SAGITTARIUS',
  'CAPRICORN',
  'AQUARIUS',
  'PISCES',
] as const;

export const SEXUAL_ORIENTATION_LABELS: Record<(typeof SEXUAL_ORIENTATIONS)[number], string> = {
  STRAIGHT: 'Heteroseksüel',
  GAY: 'Gey',
  LESBIAN: 'Lezbiyen',
  BISEXUAL: 'Biseksüel',
  PANSEXUAL: 'Panseksüel',
  ASEXUAL: 'Aseksüel',
  QUEER: 'Queer',
  UNSURE: 'Emin değilim',
};

export const EDUCATION_LEVEL_LABELS: Record<(typeof EDUCATION_LEVELS)[number], string> = {
  HIGH_SCHOOL: 'Lise',
  ASSOCIATE: 'Ön lisans',
  BACHELOR: 'Lisans',
  MASTER: 'Yüksek lisans',
  DOCTORATE: 'Doktora',
  OTHER: 'Diğer',
};

export const KIDS_LABELS: Record<(typeof KIDS_PREFERENCES)[number], string> = {
  WANT: 'İstiyorum',
  DONT_WANT: 'İstemiyorum',
  HAVE_AND_WANT: 'Var, daha isterim',
  HAVE_AND_DONT: 'Var, daha istemem',
  NOT_SURE: 'Kararsızım',
};

export const COMMUNICATION_LABELS: Record<(typeof COMMUNICATION_STYLES)[number], string> = {
  TEXTER: 'Çok mesajlaşırım',
  CALLER: 'Aramayı severim',
  VIDEO: 'Görüntülü konuşurum',
  BAD_TEXTER: 'Az yazarım',
  IN_PERSON: 'Yüz yüze daha iyiyim',
};

export const LOVE_LABELS: Record<(typeof LOVE_STYLES)[number], string> = {
  GESTURES: 'Küçük jestler',
  GIFTS: 'Hediyeler',
  TOUCH: 'Fiziksel temas',
  COMPLIMENTS: 'İltifat',
  TIME: 'Birlikte zaman',
};

export const PET_LABELS: Record<(typeof PET_STATUSES)[number], string> = {
  DOG: 'Köpeğim var',
  CAT: 'Kedim var',
  OTHER: 'Başka bir evcil hayvanım var',
  NONE: 'Yok',
  WANT_ONE: 'Yok, isterim',
};

export const ZODIAC_LABELS: Record<(typeof ZODIAC_SIGNS)[number], string> = {
  ARIES: 'Koç',
  TAURUS: 'Boğa',
  GEMINI: 'İkizler',
  CANCER: 'Yengeç',
  LEO: 'Aslan',
  VIRGO: 'Başak',
  LIBRA: 'Terazi',
  SCORPIO: 'Akrep',
  SAGITTARIUS: 'Yay',
  CAPRICORN: 'Oğlak',
  AQUARIUS: 'Kova',
  PISCES: 'Balık',
};

export const INTENTION_LABELS = {
  LONG_TERM: 'Uzun süreli ilişki',
  LONG_TERM_OPEN_TO_SHORT: 'Uzun ilişki, kısa da olur',
  SHORT_TERM_OPEN_TO_LONG: 'Kısa ilişki, uzun da olur',
  SHORT_TERM: 'Kısa süreli eğlence',
  FRIENDSHIP: 'Yeni arkadaşlar',
  NOT_SURE: 'Henüz karar vermedim',
} as const;

export const DRINK_SMOKE_LABELS = {
  NEVER: 'Hiç',
  SOMETIMES: 'Ara sıra',
  OFTEN: 'Sık sık',
} as const;

export const EXERCISE_LABELS = {
  NEVER: 'Hayır',
  SOMETIMES: 'Ara sıra',
  OFTEN: 'Evet, düzenli',
} as const;

export const SOCIAL_LABELS = {
  NEVER: 'Hiç',
  SOMETIMES: 'Ara sıra',
  OFTEN: 'Çok aktif',
} as const;

export const LANGUAGE_OPTIONS = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'İngilizce' },
  { code: 'de', label: 'Almanca' },
  { code: 'fr', label: 'Fransızca' },
  { code: 'es', label: 'İspanyolca' },
  { code: 'it', label: 'İtalyanca' },
  { code: 'ru', label: 'Rusça' },
  { code: 'ar', label: 'Arapça' },
  { code: 'ku', label: 'Kürtçe' },
  { code: 'az', label: 'Azerice' },
  { code: 'nl', label: 'Felemenkçe' },
  { code: 'ja', label: 'Japonca' },
] as const;

export const UNIVERSITIES = [
  'Abdullah Gül Üniversitesi',
  'Acıbadem Üniversitesi',
  'Akdeniz Üniversitesi',
  'Anadolu Üniversitesi',
  'Ankara Üniversitesi',
  'Atatürk Üniversitesi',
  'Bahçeşehir Üniversitesi',
  'Bilkent Üniversitesi',
  'Boğaziçi Üniversitesi',
  'Çukurova Üniversitesi',
  'Dokuz Eylül Üniversitesi',
  'Ege Üniversitesi',
  'Erciyes Üniversitesi',
  'Galatasaray Üniversitesi',
  'Gazi Üniversitesi',
  'Gebze Teknik Üniversitesi',
  'Hacettepe Üniversitesi',
  'İstanbul Bilgi Üniversitesi',
  'İstanbul Medipol Üniversitesi',
  'İstanbul Teknik Üniversitesi',
  'İstanbul Üniversitesi',
  'İzmir Ekonomi Üniversitesi',
  'İzmir Yüksek Teknoloji Enstitüsü',
  'Karadeniz Teknik Üniversitesi',
  'Koç Üniversitesi',
  'Marmara Üniversitesi',
  'Orta Doğu Teknik Üniversitesi',
  'Özyeğin Üniversitesi',
  'Sabancı Üniversitesi',
  'Selçuk Üniversitesi',
  'TOBB Ekonomi ve Teknoloji Üniversitesi',
  'Uludağ Üniversitesi',
  'Yeditepe Üniversitesi',
  'Yıldız Teknik Üniversitesi',
] as const;

/** Doğum tarihinden burç. Tarih UTC takvim günü olarak okunur. */
export function zodiacFromDate(date: Date): (typeof ZODIAC_SIGNS)[number] {
  const index = (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  if (index >= 1222 || index <= 119) return 'CAPRICORN';
  if (index <= 218) return 'AQUARIUS';
  if (index <= 320) return 'PISCES';
  if (index <= 419) return 'ARIES';
  if (index <= 520) return 'TAURUS';
  if (index <= 620) return 'GEMINI';
  if (index <= 722) return 'CANCER';
  if (index <= 822) return 'LEO';
  if (index <= 922) return 'VIRGO';
  if (index <= 1022) return 'LIBRA';
  if (index <= 1121) return 'SCORPIO';
  return 'SAGITTARIUS';
}
